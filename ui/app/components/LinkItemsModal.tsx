"use client";

import { useState, useEffect } from 'react';
import { useSemanticSearch, useSearchProgress, useSearchPatterns, useSearchContext, useSearchCustomData, useCreateLink, useDecisions, useProgress, useSystemPatterns, useSearchDecisions } from '@/shared/conport/hooks';
import { RelationshipType, EDGE_STYLES } from '@/shared/conport/graph-types';

interface LinkItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentItemType: string;
  currentItemId: string;
  onLinkCreated: () => void;
}

interface SearchResult {
  metadata: {
    conport_item_id: string;
    conport_item_type: string;
    [key: string]: any;
  };
  distance?: number;
}

const RELATIONSHIP_TYPES: RelationshipType[] = [
  'related_to',
  'implements', 
  'depends_on',
  'blocked_by',
  'builds_on',
  'clarifies',
  'resolves',
  'tracks',
  'verifies',
  'produces',
  'consumes',
  'derived_from',
  'documented_in'
];

const ITEM_TYPES = [
  { value: 'all', label: 'All Items' },
  { value: 'decision', label: 'Decisions' },
  { value: 'progress_entry', label: 'Progress' },
  { value: 'system_pattern', label: 'Patterns' },
  { value: 'custom_data', label: 'Custom Data' },
  { value: 'context', label: 'Context' }
];

export default function LinkItemsModal({ 
  isOpen, 
  onClose, 
  currentItemType, 
  currentItemId, 
  onLinkCreated 
}: LinkItemsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemType, setSelectedItemType] = useState('all');
  const [selectedRelationshipType, setSelectedRelationshipType] = useState<RelationshipType>('related_to');
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [linkDescription, setLinkDescription] = useState('');

  // Check if search query is numeric for ID-based search
  const isIdSearch = /^\d+$/.test(searchQuery.trim());
  const searchId = isIdSearch ? parseInt(searchQuery.trim()) : null;

  // Text-based search hooks - enabled when we have enough characters AND it's not an ID search
  const shouldEnableTextSearch = searchQuery.length > 2 && !isIdSearch;
  const shouldEnableIdSearch = isIdSearch && searchQuery.length > 0;

  // Use FTS searches instead of semantic for more targeted results
  const { data: progressResults } = useSearchProgress(searchQuery, { top_k: 20 }, {
    enabled: shouldEnableTextSearch && (selectedItemType === 'progress_entry' || selectedItemType === 'all')
  });

  const { data: patternResults } = useSearchPatterns(searchQuery, { top_k: 20 }, {
    enabled: shouldEnableTextSearch && (selectedItemType === 'system_pattern' || selectedItemType === 'all')
  });

  const { data: contextResults } = useSearchContext(searchQuery, { top_k: 20 }, {
    enabled: shouldEnableTextSearch && (selectedItemType === 'context' || selectedItemType === 'all')
  });

  const { data: customDataResults } = useSearchCustomData(searchQuery, { top_k: 20 }, {
    enabled: shouldEnableTextSearch && (selectedItemType === 'custom_data' || selectedItemType === 'all')
  });

  // For decisions, use FTS search
  const { data: decisionResults } = useSearchDecisions({ query_term: searchQuery, limit: 20 }, {
    enabled: shouldEnableTextSearch && (selectedItemType === 'decision' || selectedItemType === 'all')
  });

  // ID-based search hooks - simpler logic
  const { data: allDecisions } = useDecisions({}, {
    enabled: shouldEnableIdSearch && (selectedItemType === 'decision' || selectedItemType === 'all')
  });

  const { data: allProgress } = useProgress({}, {
    enabled: shouldEnableIdSearch && (selectedItemType === 'progress_entry' || selectedItemType === 'all')
  });

  const { data: allPatterns } = useSystemPatterns({}, {
    enabled: shouldEnableIdSearch && (selectedItemType === 'system_pattern' || selectedItemType === 'all')
  });

  // Create link mutation
  const createLinkMutation = useCreateLink({
    onSuccess: () => {
      onLinkCreated();
      onClose();
      // Reset form
      setSearchQuery('');
      setSelectedItem(null);
      setLinkDescription('');
    },
    onError: (error) => {
      console.error('Failed to create link:', error);
      alert('Failed to create link. Please try again.');
    }
  });

  // Combine search results
  const allResults: SearchResult[] = [];

  if (isIdSearch && searchId !== null) {
    // ID-based search - search across ALL loaded data types and show ALL matches with that ID
    if ((selectedItemType === 'decision' || selectedItemType === 'all') && allDecisions) {
      const matchingDecision = allDecisions.find((d: any) => d.id === searchId);
      if (matchingDecision) {
        allResults.push({
          metadata: {
            conport_item_id: matchingDecision.id.toString(),
            conport_item_type: 'decision',
            summary: matchingDecision.summary,
            description: matchingDecision.rationale,
            description_snippet: matchingDecision.summary?.substring(0, 100) + (matchingDecision.summary?.length > 100 ? '...' : ''),
            timestamp_created: matchingDecision.timestamp
          },
          distance: 0
        });
      }
    }

    if ((selectedItemType === 'progress_entry' || selectedItemType === 'all') && allProgress) {
      const matchingProgress = allProgress.find((p: any) => p.id === searchId);
      if (matchingProgress) {
        allResults.push({
          metadata: {
            conport_item_id: matchingProgress.id.toString(),
            conport_item_type: 'progress_entry',
            description: matchingProgress.description,
            description_snippet: matchingProgress.description?.substring(0, 100) + (matchingProgress.description?.length > 100 ? '...' : ''),
            status: matchingProgress.status,
            timestamp_created: matchingProgress.timestamp
          },
          distance: 0
        });
      }
    }

    if ((selectedItemType === 'system_pattern' || selectedItemType === 'all') && allPatterns) {
      const matchingPattern = allPatterns.find((p: any) => p.id === searchId);
      if (matchingPattern) {
        allResults.push({
          metadata: {
            conport_item_id: matchingPattern.id.toString(),
            conport_item_type: 'system_pattern',
            name: matchingPattern.name,
            description: matchingPattern.description,
            description_snippet: matchingPattern.description?.substring(0, 100) + (matchingPattern.description?.length > 100 ? '...' : ''),
            timestamp_created: matchingPattern.timestamp
          },
          distance: 0
        });
      }
    }
  } else {
    // Text-based search - use FTS searches for more targeted results
    if ((selectedItemType === 'decision' || selectedItemType === 'all') && decisionResults) {
      // Transform decision search results to SearchResult format
      const transformedDecisions = decisionResults.map((d: any) => ({
        metadata: {
          conport_item_id: d.id.toString(),
          conport_item_type: 'decision',
          summary: d.summary,
          description: d.rationale,
          description_snippet: d.summary?.substring(0, 100) + (d.summary?.length > 100 ? '...' : ''),
          timestamp_created: d.timestamp
        },
        distance: 0.5
      }));
      allResults.push(...transformedDecisions);
    }
    
    if ((selectedItemType === 'progress_entry' || selectedItemType === 'all') && progressResults) {
      allResults.push(...progressResults);
    }
    if ((selectedItemType === 'system_pattern' || selectedItemType === 'all') && patternResults) {
      allResults.push(...patternResults);
    }
    if ((selectedItemType === 'context' || selectedItemType === 'all') && contextResults) {
      allResults.push(...contextResults);
    }
    if ((selectedItemType === 'custom_data' || selectedItemType === 'all') && customDataResults) {
      allResults.push(...customDataResults);
    }
  }

  // Remove duplicates and filter out current item
  // Fix: Deduplicate based on BOTH item_id AND item_type, not just item_id
  const uniqueResults = allResults
    .filter((result, index, self) =>
      index === self.findIndex(r =>
        r.metadata.conport_item_id === result.metadata.conport_item_id &&
        r.metadata.conport_item_type === result.metadata.conport_item_type
      ) &&
      !(result.metadata.conport_item_type === currentItemType && result.metadata.conport_item_id === currentItemId)
    )
    .sort((a, b) => (a.distance || 0) - (b.distance || 0))
    .slice(0, 50); // Limit to 50 results

  const handleCreateLink = () => {
    if (!selectedItem) return;

    createLinkMutation.mutate({
      sourceType: currentItemType,
      sourceId: currentItemId,
      targetType: selectedItem.metadata.conport_item_type,
      targetId: selectedItem.metadata.conport_item_id,
      relationshipType: selectedRelationshipType,
      description: linkDescription || undefined
    });
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'decision': return '📋';
      case 'progress_entry': return '📈';
      case 'system_pattern': return '🔧';
      case 'custom_data': return '📄';
      case 'context': return '🗃️';
      default: return '📝';
    }
  };

  const getItemTitle = (result: SearchResult) => {
    const meta = result.metadata;
    switch (meta.conport_item_type) {
      case 'decision':
        return meta.summary || `Decision #${meta.conport_item_id}`;
      case 'progress_entry':
        return meta.description || `Progress #${meta.conport_item_id}`;
      case 'system_pattern':
        return meta.name || `Pattern #${meta.conport_item_id}`;
      case 'custom_data':
        return meta.key ? `${meta.category}: ${meta.key}` : `Custom Data #${meta.conport_item_id}`;
      case 'context':
        return meta.name || meta.key || 'Context';
      default:
        return `Item #${meta.conport_item_id}`;
    }
  };

  const getItemDescription = (result: SearchResult) => {
    const meta = result.metadata;
    return meta.description_snippet || meta.description || '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Link to Other Items
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <span className="sr-only">Close</span>
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Search for items to link to the current {currentItemType.replace('_', ' ')}
            </p>
            <div className="relative group">
              <div className="w-4 h-4 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center cursor-help font-bold">
                i
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-80 px-3 py-2 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg shadow-lg text-xs text-yellow-800 dark:text-yellow-200 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                <div className="font-semibold mb-1">⚠️ Link Best Practices:</div>
                <div>• Use only ONE link between any two items</div>
                <div>• Multiple links between the same items won't display at all in the knowledge graph</div>
                <div>• Check existing links before creating new ones</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Search Panel */}
          <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              {/* Search Input */}
              <input
                type="text"
                placeholder="Search for items to link... (by text or ID number)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {isIdSearch && (
                <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                  🔍 Searching by ID: {searchId}
                </div>
              )}

              {/* Item Type Filter */}
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Filter by Type
                </label>
                <select
                  value={selectedItemType}
                  onChange={(e) => setSelectedItemType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {ITEM_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto p-4">
              {searchQuery.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                  <div className="text-4xl mb-2">🔍</div>
                  <p>Search for items by text content or ID number</p>
                  <p className="text-xs mt-2">Examples: "database design" or "42"</p>
                </div>
              ) : searchQuery.length <= 2 && !isIdSearch ? (
                <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                  Type at least 3 characters to search (or enter any ID number)
                </div>
              ) : uniqueResults.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                  No items found
                </div>
              ) : (
                <div className="space-y-2">
                  {uniqueResults.map((result) => (
                    <div
                      key={`${result.metadata.conport_item_type}-${result.metadata.conport_item_id}`}
                      onClick={() => setSelectedItem(result)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedItem?.metadata.conport_item_id === result.metadata.conport_item_id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-lg flex-shrink-0">
                          {getItemTypeIcon(result.metadata.conport_item_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {getItemTitle(result)}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                            {result.metadata.conport_item_type.replace('_', ' ')}
                          </p>
                          {getItemDescription(result) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {getItemDescription(result)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Link Configuration Panel */}
          <div className="w-1/2 flex flex-col">
            {selectedItem ? (
              <>
                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Configure Link
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">From:</span> {currentItemType.replace('_', ' ')} #{currentItemId}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        <span className="font-medium">To:</span> {getItemTitle(selectedItem)}
                      </div>
                    </div>

                    {/* Relationship Type Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Relationship Type
                      </label>
                      <select
                        value={selectedRelationshipType}
                        onChange={(e) => setSelectedRelationshipType(e.target.value as RelationshipType)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {RELATIONSHIP_TYPES.map((relType) => (
                          <option key={relType} value={relType}>
                            {relType.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                      
                      {/* Show visual preview of relationship */}
                      <div className="mt-2 flex items-center">
                        <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Preview:</span>
                        <svg width="60" height="12" className="mr-2">
                          <line
                            x1="2"
                            y1="6"
                            x2="58"
                            y2="6"
                            stroke={EDGE_STYLES[selectedRelationshipType].color}
                            strokeWidth={EDGE_STYLES[selectedRelationshipType].width}
                            {...(EDGE_STYLES[selectedRelationshipType].dashArray ? {
                              strokeDasharray: EDGE_STYLES[selectedRelationshipType].dashArray
                            } : {})}
                          />
                        </svg>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {selectedRelationshipType.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Optional Description */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Description (Optional)
                      </label>
                      <textarea
                        value={linkDescription}
                        onChange={(e) => setLinkDescription(e.target.value)}
                        placeholder="Add a note about this relationship..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Fixed Action Buttons */}
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateLink}
                    disabled={createLinkMutation.isPending}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createLinkMutation.isPending ? 'Creating Link...' : 'Create Link'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">🔗</div>
                  <p>Select an item from the search results to configure the link</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}