"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRecentActivitySummary, useManualRefresh, useProgress } from "../shared/conport/hooks";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getConportClient } from "../shared/conport/client";
import { MicroMetricsWidget, TagHeatmapWidget } from './components/DashboardWidgets';

type DashboardView = 'activity' | 'kanban';
type SavedView = 'all' | 'standup' | 'planning' | 'review';

export default function Dashboard() {
  const router = useRouter();
  
  // State persistence for view toggle
  const [currentView, setCurrentView] = useState<DashboardView>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('dashboard-view') as DashboardView) || 'activity';
    }
    return 'activity';
  });
  
  const [savedView, setSavedView] = useState<SavedView>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('dashboard-saved-view') as SavedView) || 'all';
    }
    return 'all';
  });

  // Polling configuration state
  const [pollingEnabled, setPollingEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dashboard-polling-enabled') !== 'false';
    }
    return true;
  });

  const [pollingInterval, setPollingInterval] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('dashboard-polling-interval') || '3000');
    }
    return 3000;
  });

  // Persist polling settings
  const updatePollingEnabled = (enabled: boolean) => {
    setPollingEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard-polling-enabled', enabled.toString());
    }
  };

  const updatePollingInterval = (interval: number) => {
    setPollingInterval(interval);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard-polling-interval', interval.toString());
    }
  };

  // Persist view changes
  const handleViewChange = (view: DashboardView) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard-view', view);
    }
  };

  const handleSavedViewChange = (view: SavedView) => {
    setSavedView(view);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard-saved-view', view);
    }
  };
  
  const { data: activity, isLoading, isError, error } = useRecentActivitySummary(
    {
      limit_per_type: 5,
      hours_ago: 24 * 30 // Temporary: Look back 30 days to show existing August data
    },
    {
      refetchInterval: pollingEnabled ? pollingInterval : false,
      refetchOnWindowFocus: true,
    }
  );

  // Fetch Progress data for kanban board
  const { data: progressData, isLoading: progressLoading } = useProgress(
    { limit: 100 }, // Get all progress items for kanban
    {
      refetchInterval: pollingEnabled ? pollingInterval : false,
      refetchOnWindowFocus: true,
    }
  );

  // Debug logging to understand what we're getting (only when data is defined)
  if (activity !== undefined) {
    console.log("Dashboard activity data:", activity);
  }
  if (progressData !== undefined) {
    console.log("Dashboard progress data:", progressData);
  }

  const { refreshAll } = useManualRefresh();

  const handleRefresh = () => {
    refreshAll();
  };

  if (isLoading) {
    return <LoadingDashboard />;
  }

  if (isError) {
    return <ErrorDashboard error={error} onRetry={handleRefresh} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              AIMED Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Project knowledge and activity overview
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {/* View Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => handleViewChange('activity')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  currentView === 'activity'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                📊 Activity Feed
              </button>
              <button
                onClick={() => handleViewChange('kanban')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  currentView === 'kanban'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                🗂️ Kanban
              </button>
            </div>

            {/* Saved Views */}
            <select
              value={savedView}
              onChange={(e) => handleSavedViewChange(e.target.value as SavedView)}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            >
              <option value="all">All Items</option>
              <option value="standup">Standup View</option>
              <option value="planning">Planning View</option>
              <option value="review">Review View</option>
            </select>

            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span className="text-lg">🔄</span>
              Refresh
            </button>
          </div>
        </div>

        {/* Render current view */}
        {currentView === 'activity' ? (
          <ActivityDashboard
            activity={activity}
            savedView={savedView}
            router={router}
            pollingEnabled={pollingEnabled}
            pollingInterval={pollingInterval}
            onPollingToggle={updatePollingEnabled}
            onPollingIntervalChange={updatePollingInterval}
          />
        ) : (
          <KanbanDashboard
            progressData={progressData || []}
            isLoading={progressLoading}
            savedView={savedView}
            router={router}
            pollingEnabled={pollingEnabled}
            pollingInterval={pollingInterval}
            onPollingToggle={updatePollingEnabled}
            onPollingIntervalChange={updatePollingInterval}
          />
        )}
      </div>
    </div>
  );
}

// Activity Dashboard Component (existing grid view with fixes)
function ActivityDashboard({
  activity,
  savedView,
  router,
  pollingEnabled,
  pollingInterval,
  onPollingToggle,
  onPollingIntervalChange
}: {
  activity: any;
  savedView: SavedView;
  router: any;
  pollingEnabled: boolean;
  pollingInterval: number;
  onPollingToggle: (enabled: boolean) => void;
  onPollingIntervalChange: (interval: number) => void;
}) {
  return (
    <div className="grid gap-6" style={{
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gridAutoRows: 'min-content'
    }}>
      {/* Column 1 */}
      <div className="flex flex-col gap-6">
        <MicroMetricsWidget activity={activity} />
        <ActivityCard
          title="Context Updates"
          icon={<span className="text-lg">🕒</span>}
          items={[
            ...(activity?.recent_product_context_updates || []),
            ...(activity?.recent_active_context_updates || [])
          ]}
          renderItem={(item: any) => (
            <ContextActivityItem key={`${item.id}-${item.change_source}`} item={item} router={router} />
          )}
        />
        <ActivityCard
          title="Recent Links"
          icon={<span className="text-lg">🔗</span>}
          items={activity?.recent_links_created || []}
          renderItem={(item: any) => (
            <LinkActivityItem key={item.id} item={item} router={router} />
          )}
        />
      </div>

      {/* Column 2 */}
      <div className="flex flex-col gap-6">
        <ActivityCard
          title="Recent Progress"
          icon={<span className="text-lg">✅</span>}
          items={activity?.recent_progress_entries || []}
          renderItem={(item: any) => (
            <ProgressActivityItem key={item.id} item={item} router={router} />
          )}
        />
        <ActivityCard
          title="Custom Data"
          icon={<span className="text-lg">📊</span>}
          items={[]} // TODO: Add custom data when available
          renderItem={(item: any) => (
            <div key={item.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              {item.title || item.description}
            </div>
          )}
        />
      </div>

      {/* Column 3 */}
      <div className="flex flex-col gap-6">
        <ActivityCard
          title="Recent Decisions"
          icon={<span className="text-lg">⚡</span>}
          items={activity?.recent_decisions || []}
          renderItem={(item: any) => (
            <DecisionActivityItem key={item.id} item={item} router={router} />
          )}
        />
        <ActivityCard
          title="System Patterns"
          icon={<span className="text-lg">🏗️</span>}
          items={activity?.recent_system_patterns || []}
          renderItem={(item: any) => (
            <PatternActivityItem key={item.id} item={item} router={router} />
          )}
        />
        <TagHeatmapWidget
          activity={activity}
          pollingEnabled={pollingEnabled}
          pollingInterval={pollingInterval}
          onPollingToggle={onPollingToggle}
          onPollingIntervalChange={onPollingIntervalChange}
        />
      </div>
    </div>
  );
}

// Kanban Dashboard Component with drag/drop functionality
function KanbanDashboard({
  progressData,
  isLoading,
  savedView,
  router,
  pollingEnabled,
  pollingInterval,
  onPollingToggle,
  onPollingIntervalChange
}: {
  progressData: any[];
  isLoading: boolean;
  savedView: SavedView;
  router: any;
  pollingEnabled: boolean;
  pollingInterval: number;
  onPollingToggle: (enabled: boolean) => void;
  onPollingIntervalChange: (interval: number) => void;
}) {
  const [items, setItems] = useState(progressData);
  
  // Update local state when progressData changes
  useEffect(() => {
    setItems(progressData);
  }, [progressData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    // Handle reordering within same column
    if (source.droppableId === destination.droppableId) {
      const columnItems = items.filter(item => item.status === source.droppableId);
      const [movedItem] = columnItems.splice(source.index, 1);
      columnItems.splice(destination.index, 0, movedItem);
      
      // Update items maintaining original order for other columns
      const otherItems = items.filter(item => item.status !== source.droppableId);
      setItems([...otherItems, ...columnItems]);
      return;
    }

    // Handle moving between different columns
    const itemId = parseInt(draggableId);
    const newStatus = destination.droppableId;
    const movedItem = items.find(item => item.id === itemId);
    
    if (!movedItem) return;
    
    // Optimistic update with proper positioning
    const sourceItems = items.filter(item => item.status === source.droppableId && item.id !== itemId);
    const destItems = items.filter(item => item.status === destination.droppableId);
    const otherItems = items.filter(item => item.status !== source.droppableId && item.status !== destination.droppableId);
    
    // Insert at specific position in destination column
    const updatedItem = { ...movedItem, status: newStatus };
    destItems.splice(destination.index, 0, updatedItem);
    
    setItems([...otherItems, ...sourceItems, ...destItems]);

    try {
      // DEBUG: Use original approach first to confirm database update works
      const client = getConportClient();
      await client.updateProgress({
        progress_id: itemId,
        status: newStatus
      });
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Kanban] Updated progress ${itemId} to ${newStatus} in database`);
      }
      
      // TODO: Add UI cache save after confirming database update works
      
    } catch (error) {
      // Revert on error
      setItems(progressData);
      console.error('Failed to update progress:', error);
    }
  };

  // Group progress items by status
  const todoItems = items.filter(item => item.status === 'TODO');
  const inProgressItems = items.filter(item => item.status === 'IN_PROGRESS');
  const doneItems = items.filter(item => item.status === 'DONE');

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <KanbanColumn
          title="To Do"
          status="TODO"
          items={todoItems}
          bgColor="bg-gray-50 dark:bg-gray-800"
          router={router}
        />
        <KanbanColumn
          title="In Progress"
          status="IN_PROGRESS"
          items={inProgressItems}
          bgColor="bg-yellow-50 dark:bg-yellow-900/20"
          router={router}
        />
        <KanbanColumn
          title="Done"
          status="DONE"
          items={doneItems}
          bgColor="bg-green-50 dark:bg-green-900/20"
          router={router}
        />
      </div>
    </DragDropContext>
  );
}

// Reusable Activity Item Component - eliminates all duplication
function ActivityItem({
  item,
  router,
  href,
  badge,
  title,
  subtitle,
  expandableText,
  maxLength = 100
}: {
  item: any;
  router: any;
  href: string;
  badge: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  expandableText?: string;
  maxLength?: number;
}) {
  return (
    <div
      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
      onClick={() => router.push(href)}
    >
      <div className="flex items-center justify-between mb-2">
        {badge}
        <span className="text-xs text-gray-500 dark:text-gray-400">#{item.id}</span>
      </div>
      <div className="min-h-[60px]">
        {title}
        {subtitle}
        {expandableText && (
          <ExpandableText
            text={expandableText}
            maxLength={maxLength}
          />
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {formatDate(item.timestamp)}
      </p>
    </div>
  );
}

// Reusable Expandable Text Component - can be used in both Activity Feed and Kanban
function ExpandableText({
  text,
  maxLength = 100,
  className = "text-xs text-gray-600 dark:text-gray-300 mt-1"
}: {
  text: string;
  maxLength?: number;
  className?: string;
}) {
  const [showMore, setShowMore] = useState(false);
  const needsExpansion = text && text.length > maxLength;
  const displayText = showMore || !needsExpansion
    ? text
    : truncateText(text, maxLength);

  if (!text) return null;

  return (
    <>
      <p className={className}>
        {displayText}
      </p>
      {needsExpansion && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMore(!showMore);
          }}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mt-1"
        >
          {showMore ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  );
}

// Reusable Tag Component - handles overflow for any tag list
function TagList({
  tags,
  colorClass,
  maxVisible = 2
}: {
  tags?: string[];
  colorClass: string;
  maxVisible?: number;
}) {
  const [showAllTags, setShowAllTags] = useState(false);
  
  if (!tags || tags.length === 0) return null;
  
  const visibleTags = showAllTags ? tags : tags.slice(0, maxVisible);
  const hiddenTagsCount = Math.max(0, tags.length - maxVisible);

  return (
    <div className="flex gap-1 flex-wrap items-center flex-1 mr-2">
      {visibleTags.map((tag: string) => (
        <span key={tag} className={`px-2 py-1 text-xs rounded ${colorClass}`}>
          {tag}
        </span>
      ))}
      {hiddenTagsCount > 0 && !showAllTags && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAllTags(true);
          }}
          className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
        >
          +{hiddenTagsCount} more
        </button>
      )}
      {showAllTags && hiddenTagsCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAllTags(false);
          }}
          className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
        >
          show less
        </button>
      )}
    </div>
  );
}

// Simplified specific components using reusable parts
function ProgressActivityItem({ item, router }: { item: any; router: any }) {
  return (
    <ActivityItem
      item={item}
      router={router}
      href={`/progress/${item.id}`}
      badge={<StatusBadge status={item.status} />}
      title={null}
      expandableText={item.description}
    />
  );
}

function DecisionActivityItem({ item, router }: { item: any; router: any }) {
  return (
    <ActivityItem
      item={item}
      router={router}
      href={`/decisions/${item.id}`}
      badge={
        <TagList
          tags={item.tags}
          colorClass="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
        />
      }
      title={
        <p className="text-sm text-gray-900 dark:text-white font-medium mb-1">
          {item.summary}
        </p>
      }
      expandableText={item.rationale}
      maxLength={80}
    />
  );
}

function ContextActivityItem({ item, router }: { item: any; router: any }) {
  const isProduct = item.change_source?.includes('product');
  const contextPath = isProduct ? '/context/product' : '/context/active';
  
  return (
    <ActivityItem
      item={item}
      router={router}
      href={contextPath}
      badge={
        <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
          {isProduct ? 'Product' : 'Active'}
        </span>
      }
      title={
        <p className="text-sm text-gray-900 dark:text-white font-medium mb-1">
          {isProduct ? 'Product' : 'Active'} Context v{item.version} Updated
        </p>
      }
      expandableText={item.change_summary}
    />
  );
}

function LinkActivityItem({ item, router }: { item: any; router: any }) {
  return (
    <ActivityItem
      item={item}
      router={router}
      href={`/links/${item.id}`}
      badge={
        <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
          {item.relationship_type}
        </span>
      }
      title={
        <p className="text-sm text-gray-900 dark:text-white font-medium mb-1">
          {item.source_item_type}:{item.source_item_id} → {item.target_item_type}:{item.target_item_id}
        </p>
      }
      expandableText={item.description}
      maxLength={80}
    />
  );
}

function PatternActivityItem({ item, router }: { item: any; router: any }) {
  return (
    <ActivityItem
      item={item}
      router={router}
      href={`/patterns/${item.id}`}
      badge={
        <TagList
          tags={item.tags}
          colorClass="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200"
        />
      }
      title={
        <p className="text-sm text-gray-900 dark:text-white font-medium mb-1">
          {item.name}
        </p>
      }
      expandableText={item.description}
    />
  );
}

// Kanban Column Component with drag/drop
function KanbanColumn({ title, status, items, bgColor, router }: {
  title: string; status: string; items: any[]; bgColor: string; router: any;
}) {
  return (
    <div className={`${bgColor} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-2 py-1 rounded">
          {items.length}
        </span>
      </div>
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`space-y-3 min-h-[200px] p-2 rounded-lg transition-colors ${
              snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            {items.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">
                No items in {title}
              </p>
            ) : (
              items.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id.toString()} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 transition-all ${
                        snapshot.isDragging ? 'rotate-2 shadow-lg scale-105' : 'hover:shadow-md cursor-pointer'
                      }`}
                      onClick={() => !snapshot.isDragging && router.push(`/progress/${item.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <StatusBadge status={item.status} />
                        <span className="text-xs text-gray-500 dark:text-gray-400">#{item.id}</span>
                      </div>
                      <ExpandableText
                        text={item.description}
                        maxLength={100}
                        className="text-sm text-gray-900 dark:text-white font-medium"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(item.timestamp)}
                        </span>
                        {item.parent_id && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">Sub-task</span>
                        )}
                      </div>
                    </div>
                  )}
                </Draggable>
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}



// Helper Components
function ActivityCard({ 
  title, 
  icon, 
  items, 
  renderItem 
}: { 
  title: string; 
  icon: React.ReactNode; 
  items: any[]; 
  renderItem: (item: any) => React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({items.length})
          </span>
        </div>
      </div>
      <div className="p-4">
        {items.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
            No recent {title.toLowerCase()}
          </p>
        ) : (
          <div className="space-y-3">
            {items.map(renderItem)}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const getStatusStyle = (status: string) => {
    switch (status.toUpperCase()) {
      case 'DONE':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'TODO':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <span className={`px-2 py-1 text-xs rounded ${getStatusStyle(status)}`}>
      {status}
    </span>
  );
}

function LoadingDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-400 mt-4">Loading AIMED dashboard...</p>
      </div>
    </div>
  );
}

function ErrorDashboard({ error, onRetry }: { error: any; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Dashboard Error
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error?.message || 'Failed to load dashboard data'}
        </p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// Utility Functions
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
