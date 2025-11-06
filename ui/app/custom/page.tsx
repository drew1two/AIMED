"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useCustomData,
  useAllCustomDataByIdDesc,
  useLogCustomData,
  useDeleteCustomData,
  useSearchCustomData,
  useManualRefresh,
  useLinkedItems,
  useDeleteLink
} from "../../shared/conport/hooks";
import LinkItemsModal from "../components/LinkItemsModal";

export default function CustomDataPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  
  // Query hooks - use ID-sorted version for consistent ordering like other entry types
  const { data: customData, isLoading, isError, error, refetch: refetchCustomData } = useAllCustomDataByIdDesc();
  
  const { data: searchResults, isLoading: isSearching } = useSearchCustomData(
    searchQuery,
    { top_k: 20 },
    { enabled: searchQuery.length > 2 }
  );
  
  const logCustomDataMutation = useLogCustomData({
    onSuccess: () => {
      setIsCreating(false);
    }
  });

  const deleteCustomDataMutation = useDeleteCustomData();
  
  const { refreshAll } = useManualRefresh();

  // Get unique categories from custom data
  const allCategories = Array.from(
    new Set(
      Array.isArray(customData)
        ? customData.map((item: any) => item.category).filter(Boolean)
        : []
    )
  ) as string[];

  // Filter and display logic
  const filteredData = Array.isArray(customData)
    ? customData.filter((item: any) => 
        selectedCategories.length === 0 || selectedCategories.includes(item.category)
      )
    : [];

  const displayedData = searchQuery.length > 2
    ? (Array.isArray(searchResults) ? searchResults.map((result: any) => ({
        id: result.metadata?.conport_item_id || 'unknown',
        category: result.metadata?.category || 'Unknown',
        key: result.metadata?.key || 'Unknown',
        timestamp: result.metadata?.timestamp_created || new Date().toISOString(),
        snippet: result.metadata?.description_snippet || '',
        distance: result.distance || 0
      })) : [])
    : filteredData;

  const toggleExpanded = (entryId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const handleDelete = async (category: string, key: string) => {
    if (confirm(`Are you sure you want to delete "${category}:${key}"?`)) {
      deleteCustomDataMutation.mutate({ category, key });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Custom Data
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Project-specific data, configurations, and metadata
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={refreshAll}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              ➕ Add Data
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search custom data..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
              {searchQuery.length > 2 ? `Search: ${isSearching ? 'Searching...' : `${displayedData.length} results`}` : `${customData?.length || 0} entries`}
            </div>
          </div>

          {/* Category Filter */}
          {allCategories.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-gray-500 dark:text-gray-400 py-1">Filter by category:</span>
              {allCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    setSelectedCategories(prev => 
                      prev.includes(category) 
                        ? prev.filter(c => c !== category)
                        : [...prev, category]
                    );
                  }}
                  className={`px-3 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                    selectedCategories.includes(category)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {category}
                </button>
              ))}
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-full cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Create Custom Data Modal */}
        {isCreating && (
          <CreateCustomDataModal
            onSubmit={(data) => logCustomDataMutation.mutate(data)}
            onCancel={() => setIsCreating(false)}
            isSubmitting={logCustomDataMutation.isPending}
          />
        )}

        {/* Custom Data List */}
        <div className="space-y-4">
          {isLoading && <LoadingState />}
          
          {isError && (
            <ErrorState error={error} onRetry={refreshAll} />
          )}

          {displayedData && displayedData.length === 0 && !isLoading && (
            <EmptyState searchQuery={searchQuery} />
          )}

          {displayedData.map((item: any) => (
            <CustomDataCard
              key={`${item.category}-${item.key}`}
              item={item}
              isExpanded={expandedEntries.has(`${item.category}-${item.key}`)}
              onToggleExpanded={() => toggleExpanded(`${item.category}-${item.key}`)}
              onDelete={() => handleDelete(item.category, item.key)}
              onRefresh={refetchCustomData}
              isDeleting={deleteCustomDataMutation.isPending}
              isSearchResult={searchQuery.length > 2}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Custom Data Card Component
function CustomDataCard({
  item,
  isExpanded,
  onToggleExpanded,
  onDelete,
  onRefresh,
  isDeleting,
  isSearchResult
}: {
  item: any;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onDelete: () => void;
  onRefresh: () => void;
  isDeleting: boolean;
  isSearchResult?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    category: item.category || '',
    key: item.key || '',
    value: '',
    valueType: 'text' as 'text' | 'json'
  });

  // Smart constraint detection - category OR key change creates new record
  const categoryChanged = isEditing && editFormData.category !== item.category;
  const keyChanged = isEditing && editFormData.key !== item.key;
  const willCreateNewRecord = categoryChanged || keyChanged;

  // Get linked items for this custom data (always enabled for display)
  const { data: linkedItems, refetch: refetchLinked } = useLinkedItems('custom_data', item.id?.toString() || '');

  const logCustomDataMutation = useLogCustomData({
    onSuccess: async () => {
      setIsEditing(false);
      // Explicit refetch to match detail page pattern
      await onRefresh();
    }
  });

  const deleteLinkMutation = useDeleteLink({
    onSuccess: () => {
      refetchLinked();
    }
  });

  const handleStartEdit = () => {
    // BUGFIX Progress #100: Handle undefined/null values safely
    const valueString = item.value !== undefined && item.value !== null
      ? (typeof item.value === 'string' ? item.value : JSON.stringify(item.value, null, 2))
      : '';
    const valueType = typeof item.value === 'object' && item.value !== null ? 'json' : 'text';
    
    setEditFormData({
      category: item.category || '',
      key: item.key || '',
      value: valueString,
      valueType
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    let parsedValue = editFormData.value;
    if (editFormData.valueType === 'json') {
      try {
        parsedValue = JSON.parse(editFormData.value);
      } catch (error) {
        alert('Invalid JSON format');
        return;
      }
    }
    
    logCustomDataMutation.mutate({
      category: editFormData.category,
      key: editFormData.key,
      value: parsedValue
    });
  };

  const renderValue = (value: any) => {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value, null, 2);
  };

  const valueString = isSearchResult ? item.snippet : renderValue(item.value);
  const shouldShowExpandButton = valueString && valueString.length > 200;

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500">
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              Edit Custom Data #{item.id}
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category *
                <span
                  className="text-blue-500 cursor-help text-xs"
                  title="Unique field: Changing the category creates a new entry. See Docs → Unique Constraints Guide for details."
                >
                  ℹ️
                </span>
                {categoryChanged && (
                  <span
                    className="text-amber-500 cursor-help"
                    title="Category changed: Will create new entry. Original entry and links preserved."
                  >
                    ⚠️
                  </span>
                )}
              </label>
              <input
                type="text"
                value={editFormData.category}
                onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                className={`w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  categoryChanged
                    ? 'border-amber-300 dark:border-amber-600 focus:ring-amber-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                }`}
                placeholder="ProjectSettings, UserPreferences, etc."
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Key *
                <span
                  className="text-blue-500 cursor-help text-xs"
                  title="Unique field: Changing the key creates a new entry. See Docs → Unique Constraints Guide for details."
                >
                  ℹ️
                </span>
                {keyChanged && (
                  <span
                    className="text-amber-500 cursor-help"
                    title="Key changed: Will create new entry. Original entry and links preserved."
                  >
                    ⚠️
                  </span>
                )}
              </label>
              <input
                type="text"
                value={editFormData.key}
                onChange={(e) => setEditFormData(prev => ({ ...prev, key: e.target.value }))}
                className={`w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  keyChanged
                    ? 'border-amber-300 dark:border-amber-600 focus:ring-amber-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                }`}
                placeholder="config_name, setting_key, etc."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Value Type
            </label>
            <select
              value={editFormData.valueType}
              onChange={(e) => setEditFormData(prev => ({ ...prev, valueType: e.target.value as 'text' | 'json' }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="text">Text</option>
              <option value="json">JSON Object</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Value *
              <span
                className="text-green-500 cursor-help text-xs"
                title="Safe to update: Value changes update the existing entry without affecting links."
              >
                ✅
              </span>
            </label>
            <textarea
              rows={6}
              value={editFormData.value}
              onChange={(e) => setEditFormData(prev => ({ ...prev, value: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
              placeholder={editFormData.valueType === 'json'
                ? '{"key": "value", "number": 123}'
                : 'Enter your text value here'
              }
            />
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
              disabled={logCustomDataMutation.isPending}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              🔗 Add Link
            </button>
            
            <div className="flex gap-2 items-center">
              {willCreateNewRecord && (
                <div className="flex items-center gap-2 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded text-amber-800 dark:text-amber-200 text-xs">
                  <span className="text-amber-600 dark:text-amber-400">⚠️</span>
                  <span>Will create new record</span>
                </div>
              )}
              <button
                onClick={handleCancelEdit}
                disabled={logCustomDataMutation.isPending}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={logCustomDataMutation.isPending || !editFormData.category.trim() || !editFormData.key.trim() || !(editFormData.value || '').trim()}
                className={`px-4 py-2 text-sm text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer ${
                  willCreateNewRecord
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {logCustomDataMutation.isPending
                  ? (willCreateNewRecord ? 'Creating New...' : 'Saving...')
                  : (willCreateNewRecord ? 'Save as New' : 'Save Changes')
                }
              </button>
            </div>
          </div>

          {/* Link Items Modal */}
          {showLinkModal && (
            <LinkItemsModal
              isOpen={showLinkModal}
              onClose={() => setShowLinkModal(false)}
              currentItemType="custom_data"
              currentItemId={item.id?.toString() || ''}
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Link
              href={`/custom/${encodeURIComponent(item.category)}:${encodeURIComponent(item.key)}`}
              className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
            >
              {item.key}
            </Link>
            <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
              {item.category}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
            <span>#{item.id}</span>
            <span>•</span>
            <span>{new Date(item.timestamp).toLocaleDateString()}</span>
            {isSearchResult && item.distance !== undefined && (
              <>
                <span>•</span>
                <span>Relevance: {(1 - item.distance).toFixed(2)}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-start items-center mt-4">
        <div className="flex gap-1">
          <button
            onClick={handleStartEdit}
            disabled={logCustomDataMutation.isPending}
            className="p-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Edit custom data"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Delete custom data"
          >
            🗑️
          </button>
        </div>
      </div>

      {valueString && (
        <div className="mb-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {isSearchResult ? 'Content Preview:' : 'Value:'}
          </h4>
          <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
            <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono">
              {isExpanded ? valueString : valueString.slice(0, 200)}
              {!isExpanded && shouldShowExpandButton && '...'}
            </pre>
          </div>
        </div>
      )}

      {/* Linked Items Display */}
      {linkedItems && linkedItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <div className="flex flex-wrap gap-1 text-xs">
            <span className="text-gray-500 dark:text-gray-400 mr-1">Links:</span>
            {linkedItems.map((link: any) => (
              <span
                key={link.id}
                className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800"
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
          onClick={onToggleExpanded}
          className="text-blue-600 dark:text-blue-400 text-sm hover:underline cursor-pointer mt-2"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

// Create Custom Data Modal
function CreateCustomDataModal({
  onSubmit,
  onCancel,
  isSubmitting
}: {
  onSubmit: (data: { category: string; key: string; value: any }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState({
    category: '',
    key: '',
    value: '',
    valueType: 'text' as 'text' | 'json'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let parsedValue = formData.value;
    if (formData.valueType === 'json') {
      try {
        parsedValue = JSON.parse(formData.value);
      } catch (error) {
        alert('Invalid JSON format');
        return;
      }
    }
    
    onSubmit({
      category: formData.category,
      key: formData.key,
      value: parsedValue
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Add Custom Data Entry
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category *
            </label>
            <input
              type="text"
              required
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="ProjectSettings, UserPreferences, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Key *
            </label>
            <input
              type="text"
              required
              value={formData.key}
              onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="config_name, setting_key, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Value Type
            </label>
            <select
              value={formData.valueType}
              onChange={(e) => setFormData(prev => ({ ...prev, valueType: e.target.value as 'text' | 'json' }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="text">Text</option>
              <option value="json">JSON Object</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Value *
            </label>
            <textarea
              rows={6}
              required
              value={formData.value}
              onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
              placeholder={formData.valueType === 'json' 
                ? '{"key": "value", "number": 123}' 
                : 'Enter your text value here'
              }
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.category.trim() || !formData.key.trim() || !formData.value.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Save Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper Components
function LoadingState() {
  return (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p className="text-gray-600 dark:text-gray-400 mt-2">Loading custom data...</p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: any; onRetry: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-4">⚠️</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Failed to Load Custom Data
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        {error?.message || 'An error occurred while loading custom data'}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
      >
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">📦</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {searchQuery ? 'No data found' : 'No custom data yet'}
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        {searchQuery 
          ? `Try adjusting your search terms or filters` 
          : 'Start by adding your first custom data entry'
        }
      </p>
    </div>
  );
}