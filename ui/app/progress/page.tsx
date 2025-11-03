"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProgress, useLogProgress, useUpdateProgress, useDeleteProgress, useLinkedItems, useDeleteLink } from '@/shared/conport/hooks';
import LinkItemsModal from '../components/LinkItemsModal';

export default function ProgressPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);

    // Fetch all progress for stats
    const { data: allProgress, isLoading: isLoadingAll, isError: isErrorAll, error: errorAll, refetch: refetchAll } = useProgress({}, { staleTime: 10000 });
  
    // Fetch progress with optional status filter for list display
    const { data: progressList, isLoading: isLoadingFiltered, isError: isErrorFiltered, error: errorFiltered, refetch: refetchFiltered } = useProgress(
      statusFilter ? { status_filter: statusFilter } : {},
      { staleTime: 5000 }
    );

  const logProgressMutation = useLogProgress({
    onSuccess: () => {
      setShowCreateModal(false);
      refetchFiltered();
      refetchAll();
    }
  });

  const updateProgressMutation = useUpdateProgress({
    onSuccess: () => {
      refetchFiltered();
      refetchAll();
    }
  });

    // Calculate statistics from ALL progress (not filtered)
    const stats = allProgress ? {
      total: allProgress.length,
      done: allProgress.filter((p: any) => p.status === 'DONE').length,
      inProgress: allProgress.filter((p: any) => p.status === 'IN_PROGRESS').length,
      todo: allProgress.filter((p: any) => p.status === 'TODO').length,
    } : { total: 0, done: 0, inProgress: 0, todo: 0 };

  if (isLoadingFiltered || isLoadingAll) {
    return <LoadingState />;
  }

  if (isErrorFiltered || isErrorAll) {
    return <ErrorState error={errorFiltered || errorAll} onRetry={() => { refetchFiltered(); refetchAll(); }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Progress Tracking
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage and track project progress items
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { refetchFiltered(); refetchAll(); }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              ➕ Add Progress
            </button>
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Items"
            value={stats.total}
            icon="📊"
            color="bg-blue-500"
            onClick={() => setStatusFilter('')}
            active={statusFilter === ''}
          />
          <StatCard
            title="Completed"
            value={stats.done}
            icon="✅"
            color="bg-green-500"
            onClick={() => setStatusFilter(statusFilter === 'DONE' ? '' : 'DONE')}
            active={statusFilter === 'DONE'}
          />
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon="🔄"
            color="bg-yellow-500"
            onClick={() => setStatusFilter(statusFilter === 'IN_PROGRESS' ? '' : 'IN_PROGRESS')}
            active={statusFilter === 'IN_PROGRESS'}
          />
          <StatCard
            title="To Do"
            value={stats.todo}
            icon="📝"
            color="bg-gray-500"
            onClick={() => setStatusFilter(statusFilter === 'TODO' ? '' : 'TODO')}
            active={statusFilter === 'TODO'}
          />
        </div>

        {/* Filters - Commented out as redundant with tab system above */}
        {/*
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Status</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>
            {statusFilter && (
              <button
                onClick={() => setStatusFilter('')}
                className="mt-6 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
        */}

        {/* Progress List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Progress Items ({progressList?.length || 0})
            </h2>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {(!progressList || progressList.length === 0) ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-4">📝</div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No progress items found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {statusFilter 
                    ? `No progress items with status "${statusFilter}"`
                    : "Get started by creating your first progress item"
                  }
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Progress Item
                </button>
              </div>
            ) : (
              progressList.map((progress: any) => (
                <ProgressCard
                  key={progress.id}
                  progress={progress}
                  onUpdate={updateProgressMutation.mutate}
                  onRefresh={async () => {
                    await refetchAll();
                    await refetchFiltered();
                  }}
                  onClick={() => router.push(`/progress/${progress.id}`)}
                />
              ))
            )}
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <CreateProgressModal
            onClose={() => setShowCreateModal(false)}
            onSubmit={(data) => logProgressMutation.mutate(data)}
            isLoading={logProgressMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

/* Helper Components */
function StatCard({ title, value, icon, color, onClick, active }: {
  title: string;
  value: number;
  icon: string;
  color: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={`text-left bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-md transition-all ${onClick ? 'cursor-pointer' : ''} ${active ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}`}
    >
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color}`}>
          <span className="text-xl">{icon}</span>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </button>
  );
}

function ProgressCard({ progress, onUpdate, onRefresh, onClick }: {
  progress: any;
  onUpdate: (data: any) => void;
  onRefresh: () => void;
  onClick: () => void;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    description: progress.description || '',
    status: progress.status || 'TODO'
  });

  // Get linked items for this progress item (always enabled for display)
  const { data: linkedItems, refetch: refetchLinked } = useLinkedItems('progress_entry', progress.id.toString());

  const updateProgressMutation = useUpdateProgress({
    onSuccess: async () => {
      setIsEditing(false);
      // Explicit refetch to match detail page pattern
      await onRefresh();
    }
  });

  const deleteProgressMutation = useDeleteProgress();

  const deleteLinkMutation = useDeleteLink({
    onSuccess: () => {
      refetchLinked();
    }
  });

  const handleStartEdit = () => {
    setEditFormData({
      description: progress.description || '',
      status: progress.status || 'TODO'
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    updateProgressMutation.mutate({
      progress_id: progress.id,
      description: editFormData.description,
      status: editFormData.status
    });
  };

  // Check if description is long enough to need show more/less
  const shouldShowExpandButton = progress.description && progress.description.length > 200;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete progress #${progress.id}?`)) {
      deleteProgressMutation.mutate(progress.id);
    }
  };

  const handleStatusChange = (e: React.MouseEvent, newStatus: string) => {
    e.stopPropagation();
    setIsUpdating(true);
    onUpdate({
      progress_id: progress.id,
      status: newStatus
    });
    // Note: setIsUpdating(false) will be handled by the mutation's onSettled
    setTimeout(() => setIsUpdating(false), 1000);
  };

  if (isEditing) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow border-l-4 border-orange-500">
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              Edit Progress #{progress.id}
            </h4>
            <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded">
              Editing Progress #{progress.id}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description *
            </label>
            <textarea
              rows={4}
              value={editFormData.description}
              onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Progress description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={editFormData.status}
              onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="TODO">TODO</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="DONE">DONE</option>
            </select>
          </div>

          {/* Existing Links Display */}
          {linkedItems && linkedItems.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Existing Links ({linkedItems.length})
              </label>
              <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-gray-50 dark:bg-gray-700 rounded border">
                {linkedItems.map((link: any) => (
                  <div key={link.id} className="flex items-center justify-between text-xs">
                    <span className="truncate text-gray-600 dark:text-gray-300">
                      {link.relationship_type} → {link.target_item_type} #{link.target_item_id}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this link?')) {
                          deleteLinkMutation.mutate({ link_id: link.id });
                        }
                      }}
                      disabled={deleteLinkMutation.isPending}
                      className="ml-2 text-red-500 hover:text-red-700 disabled:opacity-50 cursor-pointer"
                      title="Remove link"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            {/* Add Link Button */}
            <button
              onClick={() => setShowLinkModal(true)}
              disabled={updateProgressMutation.isPending}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              🔗 Add Link
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                disabled={updateProgressMutation.isPending}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateProgressMutation.isPending || !editFormData.description.trim()}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {updateProgressMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Link Items Modal */}
          {showLinkModal && (
            <LinkItemsModal
              isOpen={showLinkModal}
              onClose={() => setShowLinkModal(false)}
              currentItemType="progress_entry"
              currentItemId={progress.id.toString()}
              onLinkCreated={() => {
                refetchLinked();
                setShowLinkModal(false);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <StatusBadge status={progress.status} />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              #{progress.id}
            </span>
            {progress.parent_id && (
              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                Sub-task of #{progress.parent_id}
              </span>
            )}
          </div>
          
          {/* Edit/Delete buttons */}
          <div className="flex justify-start items-center mb-2">
            <div className="flex gap-1">
              <button
                onClick={handleStartEdit}
                disabled={updateProgressMutation.isPending}
                className="p-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors cursor-pointer disabled:opacity-50"
                title="Edit progress"
              >
                ✏️
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteProgressMutation.isPending}
                className="p-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors cursor-pointer disabled:opacity-50"
                title="Delete progress"
              >
                🗑️
              </button>
            </div>
          </div>
          
          <div
            className="text-lg font-semibold text-gray-900 dark:text-white mb-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
            onClick={onClick}
          >
            {isExpanded ? progress.description : progress.description.slice(0, 200)}
            {!isExpanded && shouldShowExpandButton && '...'}
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <span>
              Created: {new Date(progress.timestamp).toLocaleDateString()}
            </span>
          </div>

          {/* Linked Items Display */}
          {linkedItems && linkedItems.length > 0 && (
            <div className="mb-3 pb-3 border-t border-gray-200 dark:border-gray-600 pt-3">
              <div className="flex flex-wrap gap-1 text-xs">
                <span className="text-gray-500 dark:text-gray-400 mr-1">Links:</span>
                {linkedItems.map((link: any) => (
                  <span
                    key={link.id}
                    className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded-full cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-800"
                    title={`${link.relationship_type} → ${link.target_item_type} #${link.target_item_id}`}
                  >
                    {link.relationship_type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {shouldShowExpandButton && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600 dark:text-blue-400 text-sm hover:underline cursor-pointer"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {/* Quick Status Update Buttons */}
          {progress.status !== 'TODO' && (
            <button
              onClick={(e) => handleStatusChange(e, 'TODO')}
              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded transition-colors"
              disabled={isUpdating}
            >
              To Do
            </button>
          )}
          {progress.status !== 'IN_PROGRESS' && (
            <button
              onClick={(e) => handleStatusChange(e, 'IN_PROGRESS')}
              className="px-2 py-1 text-xs bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900 dark:hover:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded transition-colors"
              disabled={isUpdating}
            >
              In Progress
            </button>
          )}
          {progress.status !== 'DONE' && (
            <button
              onClick={(e) => handleStatusChange(e, 'DONE')}
              className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-800 dark:text-green-200 rounded transition-colors"
              disabled={isUpdating}
            >
              Done
            </button>
          )}
          <span className="text-lg">→</span>
        </div>
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
    <span className={`px-3 py-1 text-xs rounded-lg font-medium ${getStatusStyle(status)}`}>
      {status}
    </span>
  );
}

function CreateProgressModal({ onClose, onSubmit, isLoading }: {
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    description: '',
    status: 'TODO' as const,
    parent_id: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) return;

    const submitData: any = {
      description: formData.description.trim(),
      status: formData.status
    };

    // Only add parent_id if it's provided and is a valid number
    if (formData.parent_id.trim()) {
      const parentId = parseInt(formData.parent_id.trim());
      if (!isNaN(parentId)) {
        submitData.parent_id = parentId;
      }
    }

    onSubmit(submitData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Create New Progress Item
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what needs to be done..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initial Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Parent Task ID (optional)
            </label>
            <input
              type="number"
              value={formData.parent_id}
              onChange={(e) => setFormData(prev => ({ ...prev, parent_id: e.target.value }))}
              placeholder="Enter parent task ID if this is a sub-task"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={isLoading || !formData.description.trim()}
            >
              {isLoading ? 'Creating...' : 'Create Progress'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-400 mt-4">Loading progress items...</p>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: any; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Error Loading Progress
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error?.message || 'Failed to load progress items'}
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