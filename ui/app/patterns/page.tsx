"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useSystemPatterns,
  useManualRefresh,
  useLogSystemPattern,
  useDeleteSystemPattern,
  useLinkedItems,
  useDeleteLink
} from "../../shared/conport/hooks";
import LinkItemsModal from "../components/LinkItemsModal";

export default function PatternsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Query hooks
  const { data: patterns, isLoading, isError, error, refetch: refetchPatterns } = useSystemPatterns(
    { limit: 1000, tags_filter_include_any: selectedTags.length > 0 ? selectedTags : undefined }
  );
  
  const { refreshAll } = useManualRefresh();

  const logSystemPatternMutation = useLogSystemPattern({
    onSuccess: () => {
      setIsCreating(false);
    }
  });

  // Get unique tags from patterns
  const allTags = Array.from(
    new Set(
      Array.isArray(patterns)
        ? patterns.flatMap((pattern: any) => (pattern.tags as string[]) || [])
        : []
    )
  ) as string[];

  // Simple client-side search since we don't have FTS for patterns yet
  const displayedPatterns = Array.isArray(patterns)
    ? patterns.filter((pattern: any) => 
        searchQuery.length === 0 || 
        pattern.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pattern.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pattern.tags || []).some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              System Patterns
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Architectural patterns and coding standards
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
              ➕ Add Pattern
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search patterns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
              {displayedPatterns.length} pattern{displayedPatterns.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-gray-500 dark:text-gray-400 py-1">Filter by tags:</span>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setSelectedTags(prev => 
                      prev.includes(tag) 
                        ? prev.filter(t => t !== tag)
                        : [...prev, tag]
                    );
                  }}
                  className={`px-3 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-full cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Create Pattern Modal */}
        {isCreating && (
          <CreatePatternModal
            onCancel={() => setIsCreating(false)}
            onSubmit={(data) => logSystemPatternMutation.mutate(data)}
            isSubmitting={logSystemPatternMutation.isPending}
          />
        )}

        {/* Patterns List */}
        <div className="space-y-4">
          {isLoading && <LoadingState />}
          
          {isError && (
            <ErrorState error={error} onRetry={refreshAll} />
          )}

          {displayedPatterns && displayedPatterns.length === 0 && !isLoading && (
            <EmptyState searchQuery={searchQuery} />
          )}

          {displayedPatterns.map((pattern: any) => (
            <PatternCard key={pattern.id} pattern={pattern} onRefresh={refetchPatterns} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Pattern Card Component
function PatternCard({ pattern, onRefresh }: { pattern: any; onRefresh: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: pattern.name || '',
    description: pattern.description || '',
    tags: (pattern.tags || []).join(', ')
  });

  // Smart constraint detection - name change creates new record
  const nameChanged = isEditing && editFormData.name !== pattern.name;
  const willCreateNewRecord = nameChanged;

  // Get linked items for this pattern (always enabled for display)
  const { data: linkedItems, refetch: refetchLinked } = useLinkedItems('system_pattern', pattern.id.toString());

  const logSystemPatternMutation = useLogSystemPattern({
    onSuccess: async () => {
      setIsEditing(false);
      // Explicit refetch to match detail page pattern
      await onRefresh();
    }
  });

  const deleteSystemPatternMutation = useDeleteSystemPattern({
    onSuccess: () => {
      // Pattern deleted successfully
    }
  });

  const deleteLinkMutation = useDeleteLink({
    onSuccess: () => {
      refetchLinked();
    }
  });

  const handleStartEdit = () => {
    setEditFormData({
      name: pattern.name || '',
      description: pattern.description || '',
      tags: (pattern.tags || []).join(', ')
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    logSystemPatternMutation.mutate({
      name: editFormData.name,
      description: editFormData.description || undefined,
      tags: editFormData.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean)
    });
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete pattern "${pattern.name}"?`)) {
      deleteSystemPatternMutation.mutate(pattern.id);
    }
  };

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500">
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              Edit System Pattern #{pattern.id}
            </h4>
            {willCreateNewRecord && (
              <div className="flex items-center gap-2 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded text-amber-800 dark:text-amber-200 text-xs">
                <span className="text-amber-600 dark:text-amber-400">⚠️</span>
                <span>Will create new record</span>
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pattern Name *
              <span
                className="text-blue-500 cursor-help text-xs"
                title="Unique field: Changing the name creates a new pattern. See Docs → Unique Constraints Guide for details."
              >
                ℹ️
              </span>
              {nameChanged && (
                <span
                  className="text-amber-500 cursor-help"
                  title="Name changed: Will create new pattern. Original pattern and links preserved."
                >
                  ⚠️
                </span>
              )}
            </label>
            <input
              type="text"
              value={editFormData.name}
              onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
              className={`w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                nameChanged
                  ? 'border-amber-300 dark:border-amber-600 focus:ring-amber-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
              }`}
              placeholder="Pattern name"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
              <span
                className="text-green-500 cursor-help text-xs"
                title="Safe to update: Description changes update the existing pattern without affecting links."
              >
                ✅
              </span>
            </label>
            <textarea
              rows={4}
              value={editFormData.description}
              onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Pattern description and usage"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags
              <span
                className="text-green-500 cursor-help text-xs"
                title="Safe to update: Tag changes update the existing pattern without affecting links."
              >
                ✅
              </span>
            </label>
            <input
              type="text"
              value={editFormData.tags}
              onChange={(e) => setEditFormData(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="architecture, design, backend (comma-separated)"
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
              disabled={logSystemPatternMutation.isPending}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              🔗 Add Link
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                disabled={logSystemPatternMutation.isPending}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={logSystemPatternMutation.isPending || !editFormData.name.trim()}
                className={`px-4 py-2 text-sm text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer ${
                  willCreateNewRecord
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {logSystemPatternMutation.isPending
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
              currentItemType="system_pattern"
              currentItemId={pattern.id.toString()}
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
          <Link
            href={`/patterns/${pattern.id}`}
            className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
          >
            {pattern.name}
          </Link>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
            <span>#{pattern.id}</span>
            <span>•</span>
            <span>{new Date(pattern.timestamp).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {pattern.tags?.map((tag: string) => (
            <span
              key={tag}
              className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="flex justify-start items-center mt-4">
        <div className="flex gap-1">
          <button
            onClick={handleStartEdit}
            disabled={logSystemPatternMutation.isPending}
            className="p-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Edit pattern"
          >
            ✏️
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteSystemPatternMutation.isPending}
            className="p-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Delete pattern"
          >
            🗑️
          </button>
        </div>
      </div>

      {pattern.description && (
        <div className="mb-3">
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            {isExpanded ? pattern.description : pattern.description.slice(0, 300)}
            {!isExpanded && pattern.description.length > 300 && '...'}
          </p>
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
                className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full cursor-pointer hover:bg-green-200 dark:hover:bg-green-800"
                title={`${link.relationship_type} → ${link.target_item_type} #${link.target_item_id}`}
              >
                {link.relationship_type}
              </span>
            ))}
          </div>
        </div>
      )}

      {pattern.description?.length > 300 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 dark:text-blue-400 text-sm hover:underline cursor-pointer mt-2"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

// Create Pattern Modal
function CreatePatternModal({
  onCancel,
  onSubmit,
  isSubmitting
}: {
  onCancel: () => void;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      description: formData.description || undefined,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Log New System Pattern
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pattern Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Unique pattern name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Pattern description and usage guidelines"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="architecture, design, backend (comma-separated)"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Pattern'}
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
      <p className="text-gray-600 dark:text-gray-400 mt-2">Loading patterns...</p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: any; onRetry: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-4">⚠️</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Failed to Load Patterns
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        {error?.message || 'An error occurred while loading patterns'}
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
      <div className="text-6xl mb-4">🏗️</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {searchQuery ? 'No patterns found' : 'No system patterns yet'}
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        {searchQuery 
          ? `Try adjusting your search terms or filters` 
          : 'Start by logging your first system pattern'
        }
      </p>
    </div>
  );
}