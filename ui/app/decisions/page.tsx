"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useDecisions,
  useLogDecision,
  useUpdateDecision,
  useSearchDecisions,
  useManualRefresh,
  useDeleteDecision,
  useLinkedItems,
  useDeleteLink
} from "../../shared/conport/hooks";
import LinkItemsModal from "../components/LinkItemsModal";

export default function DecisionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Query hooks
  const { data: decisions, isLoading, isError, error, refetch: refetchDecisions } = useDecisions(
    { limit: 1000, tags_filter_include_any: selectedTags.length > 0 ? selectedTags : undefined }
  );
  
  const { data: searchResults, isLoading: isSearching } = useSearchDecisions(
    { query_term: searchQuery, limit: 10 },
    { enabled: searchQuery.length > 2 }
  );
  
  const logDecisionMutation = useLogDecision({
    onSuccess: () => {
      setIsCreating(false);
    }
  });

  const { refreshDecisions } = useManualRefresh();

  // Get unique tags from decisions
  const allTags = Array.from(
    new Set(
      Array.isArray(decisions)
        ? decisions.flatMap((decision: any) => (decision.tags as string[]) || [])
        : []
    )
  ) as string[];

  const displayedDecisions = searchQuery.length > 2
    ? (Array.isArray(searchResults) ? searchResults : [])
    : (Array.isArray(decisions) ? decisions : []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Decisions
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Architectural and implementation decisions
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={refreshDecisions}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              ➕ Add Decision
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search decisions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
              {searchQuery.length > 2 ? `Search: ${isSearching ? 'Searching...' : `${searchResults?.length || 0} results`}` : `${decisions?.length || 0} decisions`}
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
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
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
                  className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-full"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Create Decision Modal */}
        {isCreating && (
          <CreateDecisionModal
            onSubmit={(data) => logDecisionMutation.mutate(data)}
            onCancel={() => setIsCreating(false)}
            isSubmitting={logDecisionMutation.isPending}
          />
        )}

        {/* Decisions List */}
        <div className="space-y-4">
          {isLoading && <LoadingState />}
          
          {isError && (
            <ErrorState error={error} onRetry={refreshDecisions} />
          )}

          {displayedDecisions && displayedDecisions.length === 0 && !isLoading && (
            <EmptyState searchQuery={searchQuery} />
          )}

          {displayedDecisions.map((decision: any) => (
            <DecisionCard key={decision.id} decision={decision} onRefresh={refetchDecisions} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Decision Card Component
function DecisionCard({ decision, onRefresh }: { decision: any; onRefresh: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    summary: decision.summary || '',
    rationale: decision.rationale || '',
    implementation_details: decision.implementation_details || '',
    tags: (decision.tags || []).join(', ')
  });

  // Get linked items for this decision (always enabled for display)
  const { data: linkedItems, refetch: refetchLinked } = useLinkedItems('decision', decision.id.toString());

  const updateDecisionMutation = useUpdateDecision({
    onSuccess: async () => {
      setIsEditing(false);
      // Explicit refetch to match detail page pattern
      await onRefresh();
    }
  });

  const deleteDecisionMutation = useDeleteDecision({
    onSuccess: () => {
      // Decision deleted successfully
    }
  });

  const deleteLinkMutation = useDeleteLink({
    onSuccess: () => {
      refetchLinked();
    }
  });

  const handleStartEdit = () => {
    setEditFormData({
      summary: decision.summary || '',
      rationale: decision.rationale || '',
      implementation_details: decision.implementation_details || '',
      tags: (decision.tags || []).join(', ')
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    // Update the existing decision (preserves ID and links)
    updateDecisionMutation.mutate({
      decision_id: decision.id,
      summary: editFormData.summary,
      rationale: editFormData.rationale || undefined,
      implementation_details: editFormData.implementation_details || undefined,
      tags: editFormData.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean)
    });
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete decision "${decision.summary}"?`)) {
      deleteDecisionMutation.mutate(decision.id);
    }
  };

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500">
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              Edit Decision #{decision.id}
            </h4>
            <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
              Editing Decision #{decision.id}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Summary *
            </label>
            <input
              type="text"
              value={editFormData.summary}
              onChange={(e) => setEditFormData(prev => ({ ...prev, summary: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Brief summary of the decision"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rationale
            </label>
            <textarea
              rows={3}
              value={editFormData.rationale}
              onChange={(e) => setEditFormData(prev => ({ ...prev, rationale: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Why was this decision made?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Implementation Details
            </label>
            <textarea
              rows={3}
              value={editFormData.implementation_details}
              onChange={(e) => setEditFormData(prev => ({ ...prev, implementation_details: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="How will this be implemented?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags
            </label>
            <input
              type="text"
              value={editFormData.tags}
              onChange={(e) => setEditFormData(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="architecture, ui, backend (comma-separated)"
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
              disabled={updateDecisionMutation.isPending}
              className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              🔗 Add Link
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                disabled={updateDecisionMutation.isPending}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateDecisionMutation.isPending || !editFormData.summary.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {updateDecisionMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Link Items Modal */}
          {showLinkModal && (
            <LinkItemsModal
              isOpen={showLinkModal}
              onClose={() => setShowLinkModal(false)}
              currentItemType="decision"
              currentItemId={decision.id.toString()}
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
            href={`/decisions/${decision.id}`}
            className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
          >
            {decision.summary}
          </Link>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
            <span>#{decision.id}</span>
            <span>•</span>
            <span>{new Date(decision.timestamp).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {decision.tags?.map((tag: string) => (
            <span
              key={tag}
              className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
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
            disabled={updateDecisionMutation.isPending}
            className="p-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Edit decision"
          >
            ✏️
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteDecisionMutation.isPending}
            className="p-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Delete decision"
          >
            🗑️
          </button>
        </div>
      </div>

      {decision.rationale && (
        <div className="mb-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rationale:</h4>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            {isExpanded ? decision.rationale : decision.rationale.slice(0, 200)}
            {!isExpanded && decision.rationale.length > 200 && '...'}
          </p>
        </div>
      )}

      {decision.implementation_details && (
        <div className="mb-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Implementation:</h4>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            {isExpanded ? decision.implementation_details : decision.implementation_details.slice(0, 200)}
            {!isExpanded && decision.implementation_details.length > 200 && '...'}
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
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800"
                title={`${link.relationship_type} → ${link.target_item_type} #${link.target_item_id}`}
              >
                {link.relationship_type}
              </span>
            ))}
          </div>
        </div>
      )}

      {(decision.rationale?.length > 200 || decision.implementation_details?.length > 200) && (
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

// Create Decision Modal
function CreateDecisionModal({
  onSubmit,
  onCancel,
  isSubmitting
}: {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState({
    summary: '',
    rationale: '',
    implementation_details: '',
    tags: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Log New Decision
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Summary *
            </label>
            <input
              type="text"
              required
              value={formData.summary}
              onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Brief summary of the decision"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rationale
            </label>
            <textarea
              rows={3}
              value={formData.rationale}
              onChange={(e) => setFormData(prev => ({ ...prev, rationale: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Why was this decision made?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Implementation Details
            </label>
            <textarea
              rows={3}
              value={formData.implementation_details}
              onChange={(e) => setFormData(prev => ({ ...prev, implementation_details: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="How will this be implemented?"
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
              placeholder="architecture, ui, backend (comma-separated)"
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
              disabled={isSubmitting || !formData.summary.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Save Decision'}
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
      <p className="text-gray-600 dark:text-gray-400 mt-2">Loading decisions...</p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: any; onRetry: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-4">⚠️</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Failed to Load Decisions
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        {error?.message || 'An error occurred while loading decisions'}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">📋</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {searchQuery ? 'No decisions found' : 'No decisions yet'}
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        {searchQuery 
          ? `Try adjusting your search terms or filters` 
          : 'Start by logging your first architectural decision'
        }
      </p>
    </div>
  );
}