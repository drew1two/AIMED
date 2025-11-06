'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GraphCanvas } from '../components/GraphCanvas';
import { GraphFilters, FocusMode, NodeType, RelationshipType, ProgressStatus, EDGE_STYLES, NODE_STYLES, PROGRESS_STATUS_COLORS } from '../../shared/conport/graph-types';
import { useDecisionItem, useProgressItem, useSystemPatternItem, useCustomData, useCreateLink, useUpdateLink, useDeleteLink } from '../../shared/conport/hooks';
import { debugLog } from '../../shared/conport/client';

export default function GraphPage() {
  const [filters, setFilters] = useState<GraphFilters>({
    nodeTypes: new Set<NodeType>(['decision', 'progress', 'system_pattern', 'custom_data']),
    relationshipTypes: new Set<RelationshipType>(Object.keys(EDGE_STYLES) as RelationshipType[]),
    progressStatuses: new Set<ProgressStatus>(['TODO', 'IN_PROGRESS', 'DONE']),
    tags: new Set<string>(),
    hopDepth: 2
  });

  const [focusMode, setFocusMode] = useState<FocusMode>({
    enabled: false,
    hopDepth: 2,
    visibleNodeIds: new Set()
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [linkMode, setLinkMode] = useState(false);

  // Routing for Edit action
  const router = useRouter();

  // Link management hooks
  const createLinkMutation = useCreateLink({
    onSuccess: () => {
      console.log('Link created successfully');
    },
    onError: (error) => {
      console.error('Failed to create link:', error);
    }
  });

  const updateLinkMutation = useUpdateLink({
    onSuccess: () => {
      console.log('Link updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update link:', error);
    }
  });

  const deleteLinkMutation = useDeleteLink({
    onSuccess: () => {
      console.log('Link deleted successfully');
    },
    onError: (error) => {
      console.error('Failed to delete link:', error);
    }
  });

  // UI Toast for link creation success/error
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (createLinkMutation.isSuccess) {
      try { console.debug('[GraphPage] Link created successfully'); } catch {}
      setToast({ message: 'Link created', type: 'success' });
      const t = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(t);
    }
  }, [createLinkMutation.isSuccess]);

  useEffect(() => {
    if (createLinkMutation.isError) {
      try { console.error('[GraphPage] Link creation failed', createLinkMutation.error); } catch {}
      setToast({ message: 'Failed to create link', type: 'error' });
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [createLinkMutation.isError]);

  // Parse selected node id into a typed descriptor
  const parsed = useMemo(() => {
    if (!selectedNodeId) return null as
      | { kind: 'decision' | 'progress' | 'pattern'; idNumber: number; raw: string }
      | { kind: 'custom'; category: string; key: string; raw: string }
      | { kind: 'unknown'; raw: string }
      | null;

    const [prefix, ...restParts] = selectedNodeId.split('-');
    const rest = restParts.join('-');

    if (prefix === 'decision' || prefix === 'progress' || prefix === 'pattern') {
      const numId = parseInt(rest, 10);
      return { kind: prefix as 'decision' | 'progress' | 'pattern', idNumber: numId, raw: selectedNodeId };
    }
    if (prefix === 'custom') {
      const colonIdx = rest.indexOf(':');
      const category = colonIdx === -1 ? rest : rest.slice(0, colonIdx);
      const key = colonIdx === -1 ? '' : rest.slice(colonIdx + 1);
      return { kind: 'custom' as const, category, key, raw: selectedNodeId };
    }
    return { kind: 'unknown' as const, raw: selectedNodeId };
  }, [selectedNodeId]);

  // Fetch details for the selected node
  const decisionQ = useDecisionItem(parsed?.kind === 'decision' ? parsed.idNumber : 0, {
    enabled: parsed?.kind === 'decision' && typeof parsed.idNumber === 'number' && !isNaN(parsed.idNumber)
  });
  const progressQ = useProgressItem(parsed?.kind === 'progress' ? parsed.idNumber : 0, {
    enabled: parsed?.kind === 'progress' && typeof parsed.idNumber === 'number' && !isNaN(parsed.idNumber)
  });
  const patternQ = useSystemPatternItem(parsed?.kind === 'pattern' ? parsed.idNumber : 0, {
    enabled: parsed?.kind === 'pattern' && typeof parsed.idNumber === 'number' && !isNaN(parsed.idNumber)
  });
  const customQ = useCustomData(
    parsed?.kind === 'custom' ? parsed.category : undefined,
    parsed?.kind === 'custom' ? parsed.key : undefined,
    { enabled: parsed?.kind === 'custom' }
  );

  const onEditNode = () => {
    if (!parsed) return;
    if (parsed.kind === 'decision') router.push(`/decisions/${parsed.idNumber}`);
    else if (parsed.kind === 'progress') router.push(`/progress/${parsed.idNumber}`);
    else if (parsed.kind === 'pattern') router.push(`/patterns/${parsed.idNumber}`);
    else if (parsed.kind === 'custom') router.push(`/custom/${parsed.raw}`);
  };

  const handleNodeTypeToggle = (nodeType: NodeType) => {
    const newNodeTypes = new Set(filters.nodeTypes);
    const action = newNodeTypes.has(nodeType) ? 'remove' : 'add';
    if (action === 'remove') {
      newNodeTypes.delete(nodeType);
    } else {
      newNodeTypes.add(nodeType);
    }
    // DEBUG: log exact nodeType toggled and resulting set
    try {
      console.log('[UI] NodeType toggle', {
        nodeType,
        action,
        before: Array.from(filters.nodeTypes),
        after: Array.from(newNodeTypes)
      });
    } catch {}
    setFilters({ ...filters, nodeTypes: newNodeTypes });
  };

  const handleRelationshipToggle = (relType: RelationshipType) => {
    const newRelationshipTypes = new Set(filters.relationshipTypes);
    const action = newRelationshipTypes.has(relType) ? 'remove' : 'add';
    if (action === 'remove') {
      newRelationshipTypes.delete(relType);
    } else {
      newRelationshipTypes.add(relType);
    }
    // DEBUG
    try {
      console.log('[UI] Relationship toggle', {
        relationshipType: relType,
        action,
        before: Array.from(filters.relationshipTypes),
        after: Array.from(newRelationshipTypes)
      });
    } catch {}
    setFilters({ ...filters, relationshipTypes: newRelationshipTypes });
  };

  const handleProgressStatusToggle = (status: ProgressStatus) => {
    const newProgressStatuses = new Set(filters.progressStatuses);
    const action = newProgressStatuses.has(status) ? 'remove' : 'add';
    if (action === 'remove') {
      newProgressStatuses.delete(status);
    } else {
      newProgressStatuses.add(status);
    }
    // DEBUG
    try {
      console.log('[UI] ProgressStatus toggle', {
        status,
        action,
        before: Array.from(filters.progressStatuses),
        after: Array.from(newProgressStatuses)
      });
    } catch {}
    setFilters({ ...filters, progressStatuses: newProgressStatuses });
  };

  const handleFocusNode = (nodeId: string) => {
    if (!nodeId) {
      // Clear focus mode
      setFocusMode({
        enabled: false,
        hopDepth: 2,
        visibleNodeIds: new Set()
      });
      return;
    }
    
    setFocusMode({
      enabled: true,
      centerNodeId: nodeId,
      hopDepth: filters.hopDepth,
      // Empty set means "show all nodes returned by focused fetch"
      visibleNodeIds: new Set()
    });
  };

  const clearFocus = () => {
    setFocusMode({
      enabled: false,
      hopDepth: 2,
      visibleNodeIds: new Set()
    });
  };

  // Link management handlers
  const handleLinkCreate = (sourceNodeId: string, targetNodeId: string, relationshipType: string, description?: string) => {
    // Parse node IDs to extract item type and ID for ConPort API
    const parseNodeId = (nodeId: string) => {
      const [prefix, ...rest] = nodeId.split('-');
      let id = rest.join('-');
      let itemType = prefix;
      if (prefix === 'pattern') itemType = 'system_pattern';
      if (prefix === 'custom') {
        itemType = 'custom_data';
        // For custom data, the format is custom-category:key, so id = category:key
        id = rest.join('-'); // This gives us "category:key"
      }
      if (prefix === 'progress') itemType = 'progress_entry';
      return { itemType, id };
    };

    const source = parseNodeId(sourceNodeId);
    const target = parseNodeId(targetNodeId);

    createLinkMutation.mutate({
      sourceType: source.itemType,
      sourceId: source.id,
      targetType: target.itemType,
      targetId: target.id,
      relationshipType,
      description
    });
  };

  const handleLinkEdit = (linkId: number, relationshipType?: string, description?: string) => {
    updateLinkMutation.mutate({
      link_id: linkId,
      relationship_type: relationshipType,
      description
    });
  };

  const handleLinkDelete = (linkId: number) => {
    deleteLinkMutation.mutate({
      link_id: linkId
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">🕸️</div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Knowledge Graph
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Interactive visualization of AIMED relationships
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {focusMode.enabled && (
                <button
                  onClick={clearFocus}
                  className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-md hover:bg-amber-200 transition-colors"
                >
                  Clear Focus ({focusMode.centerNodeId})
                </button>
              )}
              
              <button
                onClick={() => {
                  const next = !linkMode;
                  debugLog('🔗 LINK_CREATION_FIX: Create Links button clicked', {
                    currentLinkMode: linkMode,
                    nextLinkMode: next
                  });
                  if (next) {
                    // Clear selection when entering Link Mode to keep Node Details closed
                    setSelectedNodeId(null);
                    debugLog('🔗 LINK_CREATION_FIX: Entering link mode - cleared node selection');
                  } else {
                    debugLog('🔗 LINK_CREATION_FIX: Exiting link mode');
                  }
                  setLinkMode(next);
                  debugLog('🔗 LINK_CREATION_FIX: setLinkMode called with:', next);
                }}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  linkMode
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {linkMode ? 'Exit Link Mode' : 'Create Links'}
              </button>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                {showHelp ? 'Hide Help' : 'Show Help'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-120px)] relative">
        {/* Filters Panel - Fixed positioning to avoid layout shifts */}
        <div
          className={`fixed left-0 top-[120px] bottom-0 w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto transition-transform duration-300 z-20 ${
            showFilters ? 'transform-none' : 'transform -translate-x-full'
          }`}
        >
            <div className="space-y-6">
              {/* Node Types Filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Node Types
                </h3>
                <div className="space-y-2">
                  {(['decision', 'progress', 'system_pattern', 'custom_data'] as NodeType[]).map((nodeType) => (
                    <label key={nodeType} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.nodeTypes.has(nodeType)}
                        onChange={() => handleNodeTypeToggle(nodeType)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {nodeType.replace('_', ' ')} {nodeType === 'decision' ? '📋' : nodeType === 'progress' ? '📈' : nodeType === 'system_pattern' ? '🔧' : '📄'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Progress Status Filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Progress Status
                </h3>
                <div className="space-y-2">
                  {(['TODO', 'IN_PROGRESS', 'DONE'] as ProgressStatus[]).map((status) => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.progressStatuses.has(status)}
                        onChange={() => handleProgressStatusToggle(status)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        {status.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Relationship Types Filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Relationships
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(Object.keys(EDGE_STYLES) as RelationshipType[]).map((relType) => (
                    <label key={relType} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.relationshipTypes.has(relType)}
                          onChange={() => handleRelationshipToggle(relType)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          {relType.replace('_', ' ')}
                        </span>
                      </div>
                      {/* Inline sample of the relationship line style */}
                      <svg width="56" height="12" className="ml-2 flex-shrink-0" aria-hidden="true">
                        <line
                          x1="2"
                          y1="6"
                          x2="54"
                          y2="6"
                          stroke={EDGE_STYLES[relType].color}
                          strokeWidth={EDGE_STYLES[relType].width}
                          {...(EDGE_STYLES[relType].dashArray ? { strokeDasharray: EDGE_STYLES[relType].dashArray } : {})}
                        />
                      </svg>
                    </label>
                  ))}
                </div>
              </div>

              {/* Hop Depth */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Focus Hop Depth
                </h3>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={filters.hopDepth}
                  onChange={(e) => setFilters({ ...filters, hopDepth: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1</span>
                  <span className="font-medium">{filters.hopDepth} hops</span>
                  <span>5</span>
                </div>
              </div>
            </div>
        </div>

        {/* Graph Canvas - Full width (filters overlay, no layout shift) */}
        <div className="flex-1 min-h-0 relative">
          <GraphCanvas
            filters={filters}
            focusMode={focusMode}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
            onNodeFocus={handleFocusNode}
            linkMode={linkMode}
            onLinkCreate={handleLinkCreate}
            onLinkEdit={handleLinkEdit}
            onLinkDelete={handleLinkDelete}
          />
          {toast && (
            <div className={`absolute top-4 right-4 px-3 py-2 rounded-md shadow-lg z-30 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.message}
            </div>
          )}
        </div>


        {/* Node Details Drawer - Fixed positioning */}
        <div
          className={`fixed right-0 top-[120px] bottom-0 w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto transition-transform duration-300 z-10 ${
            selectedNodeId && !showHelp && !linkMode ? 'transform-none' : 'transform translate-x-full'
          }`}
        >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Node Details
              </h3>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md space-y-2">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Selected Node: {selectedNodeId}
                </div>

                {(decisionQ.isLoading || progressQ.isLoading || patternQ.isLoading || customQ.isLoading) && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">Loading details...</div>
                )}

                {parsed?.kind === 'decision' && decisionQ.data && (
                  <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                    <div><span className="font-semibold">Summary:</span> {decisionQ.data.summary}</div>
                    {decisionQ.data.rationale && (
                      <div><span className="font-semibold">Rationale:</span> {decisionQ.data.rationale}</div>
                    )}
                    {Array.isArray(decisionQ.data.tags) && decisionQ.data.tags.length > 0 && (
                      <div><span className="font-semibold">Tags:</span> {decisionQ.data.tags.join(', ')}</div>
                    )}
                  </div>
                )}

                {parsed?.kind === 'progress' && progressQ.data && (
                  <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                    <div><span className="font-semibold">Status:</span> {progressQ.data.status}</div>
                    <div><span className="font-semibold">Description:</span> {progressQ.data.description}</div>
                    {typeof progressQ.data.parent_id === 'number' && (
                      <div><span className="font-semibold">Parent:</span> {progressQ.data.parent_id}</div>
                    )}
                  </div>
                )}

                {parsed?.kind === 'pattern' && patternQ.data && (
                  <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                    <div><span className="font-semibold">Name:</span> {patternQ.data.name}</div>
                    {patternQ.data.description && (
                      <div><span className="font-semibold">Description:</span> {patternQ.data.description}</div>
                    )}
                    {Array.isArray(patternQ.data.tags) && patternQ.data.tags.length > 0 && (
                      <div><span className="font-semibold">Tags:</span> {patternQ.data.tags.join(', ')}</div>
                    )}
                  </div>
                )}

                {parsed?.kind === 'custom' && (
                  <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                    <div><span className="font-semibold">Category:</span> {parsed.category}</div>
                    <div><span className="font-semibold">Key:</span> {parsed.key}</div>
                    <div className="mt-1">
                      <span className="font-semibold">Value:</span>
                      <pre className="mt-1 p-2 bg-white/40 dark:bg-black/20 rounded text-[11px] whitespace-pre-wrap break-words">
                        {customQ.data ? JSON.stringify(customQ.data, null, 2) : '(no data)'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                {/* Focus on This Node temporarily disabled
                <button
                  onClick={() => selectedNodeId && handleFocusNode(selectedNodeId)}
                  disabled={!selectedNodeId}
                  className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Focus on This Node
                </button>
                */}
                
                <button
                  onClick={onEditNode}
                  disabled={!selectedNodeId}
                  className="w-full px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Edit Node
                </button>
              </div>
            </div>
        </div>

        {/* Help Panel - Fixed positioning */}
        <div
          className={`fixed right-0 top-[120px] bottom-0 w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto transition-transform duration-300 z-10 ${
            showHelp ? 'transform-none' : 'transform translate-x-full'
          }`}
        >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Knowledge Graph Help
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Core Purpose</h4>
                <p className="text-xs">
                  The knowledge graph provides an interactive visualization of AIMED (AI Monitoring & Execution Dashboard) entities (decisions, progress entries, system patterns, custom data) and their relationships, allowing you to explore connections and dependencies visually.
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Interactive Features</h4>
                <ul className="space-y-1 text-xs">
                  <li><strong>Node Selection:</strong> Click on any node to select it and view details in the right sidebar</li>
                  <li><strong>Focus Mode:</strong> Double-click on a node to center the view on that node and show its neighbors within a configurable hop depth</li>
                  <li><strong>Pan & Zoom:</strong> Click and drag to move the graph around, use mouse wheel to zoom in/out (0.1x to 4x)</li>
                  <li><strong>Filtering:</strong> Use the filters panel to toggle which entity types, relationship types, and progress statuses to display</li>
                  <li><strong>Link Creation:</strong> Click "Create Links" button, then click source node and target node to create a relationship</li>
                  <li><strong>Link Editing:</strong> Right-click on any edge to edit or delete the relationship</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">🔍 Search Features</h4>
                <ul className="space-y-1 text-xs">
                  <li><strong>Open Search:</strong> Press Ctrl+F or click the 🔍 Search button</li>
                  <li><strong>Real-time Search:</strong> Type to instantly highlight matching nodes with amber borders</li>
                  <li><strong>Results Dropdown:</strong> Shows all matching nodes with icons and types</li>
                  <li><strong>Auto-centering:</strong> Click any result to center the view on that node</li>
                  <li><strong>Persistent Results:</strong> Results list stays open for easy browsing of multiple matches</li>
                  <li><strong>Draggable Interface:</strong> Drag the search box header to move it out of the way</li>
                  <li><strong>Search Scope:</strong> Searches node titles, descriptions, tags, status, category/key fields</li>
                  <li><strong>Keyboard Controls:</strong> Esc to close search and clear highlighting</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Visual Design</h4>
                <div className="space-y-3 text-xs">
                  
                  {/* Node Types */}
                  <div>
                    <strong className="text-gray-900 dark:text-white">Node Types:</strong>
                    <div className="mt-2 space-y-2">
                      {Object.entries(NODE_STYLES).map(([type, style]) => (
                        <div key={type} className="flex items-center">
                          <div
                            className="w-4 h-4 rounded-full mr-3 flex items-center justify-center text-white text-xs flex-shrink-0"
                            style={{ backgroundColor: style.color }}
                          >
                            {style.icon}
                          </div>
                          <span className="capitalize">{type.replace('_', ' ')}</span>
                          <span className="ml-2 text-gray-500 dark:text-gray-400">({style.radius}px)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Progress Status Colors */}
                  <div>
                    <strong className="text-gray-900 dark:text-white">Progress Status:</strong>
                    <div className="mt-2 space-y-2">
                      {Object.entries(PROGRESS_STATUS_COLORS).map(([status, color]) => (
                        <div key={status} className="flex items-center">
                          <div
                            className="w-3 h-3 rounded mr-3 flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span style={{ color }} className="font-medium">
                            {status.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Edge Styles */}
                  <div>
                    <strong className="text-gray-900 dark:text-white">Relationship Types:</strong>
                    <div className="mt-2 space-y-2">
                      {Object.entries(EDGE_STYLES).map(([relationship, style]) => (
                        <div key={relationship} className="flex items-center">
                          <svg width="24" height="12" className="mr-3 flex-shrink-0">
                            <line
                              x1="2"
                              y1="6"
                              x2="22"
                              y2="6"
                              stroke={style.color}
                              strokeWidth={style.width}
                              strokeDasharray={style.dashArray}
                            />
                          </svg>
                          <span style={{ color: style.color }} className="capitalize">
                            {relationship.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Layout & Physics</h4>
                <p className="text-xs">
                  Nodes repel each other (charge force), connected nodes are linked with appropriate distance, collision detection prevents overlap, and center force keeps the graph centered.
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">User Interface</h4>
                <ul className="space-y-1 text-xs">
                  <li><strong>Filters Panel:</strong> Left sidebar that can be toggled on/off</li>
                  <li><strong>Node Details Drawer:</strong> Right sidebar that appears when a node is selected</li>
                  <li><strong>Controls Overlay:</strong> Top-left overlay showing interaction hints</li>
                  <li><strong>Legend:</strong> Bottom-right overlay showing node types and their colors</li>
                  <li><strong>Status Display:</strong> Shows current node/edge count</li>
                </ul>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}