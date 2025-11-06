"use client";

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDecisionItem, useLinkedItems, useDeleteDecision } from '@/shared/conport/hooks';
import { getConportClient, debugLog } from '@/shared/conport/client';
import RelatedItemsSection from '@/app/components/RelatedItemsSection';

export default function DecisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const decisionId = parseInt(id);
  
  const { data: decision, isLoading, isError, error, refetch } = useDecisionItem(decisionId);
  const { data: linkedItems, isLoading: linkedItemsLoading, refetch: refetchLinked } = useLinkedItems('decision', id);
  
  // DEBUG: Track linkedItems state
  debugLog('🔍 DecisionDetailPage linkedItems:', {
    linkedItems,
    linkedItemsType: typeof linkedItems,
    linkedItemsArray: Array.isArray(linkedItems),
    linkedItemsLength: linkedItems?.length,
    linkedItemsLoading,
    currentItemType: 'decision',
    currentItemId: id
  });
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [editedRationale, setEditedRationale] = useState('');
  const [editedImplementationDetails, setEditedImplementationDetails] = useState('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const deleteDecisionMutation = useDeleteDecision({
    onSuccess: () => {
      router.push('/decisions');
    }
  });
  
  // Initialize edit state when decision data loads
  useState(() => {
    if (decision && !isEditing) {
      setEditedSummary(decision.summary || '');
      setEditedRationale(decision.rationale || '');
      setEditedImplementationDetails(decision.implementation_details || '');
      setEditedTags(decision.tags ? [...decision.tags] : []);
    }
  });

  const handleEdit = () => {
    if (decision) {
      setEditedSummary(decision.summary || '');
      setEditedRationale(decision.rationale || '');
      setEditedImplementationDetails(decision.implementation_details || '');
      setEditedTags(decision.tags ? [...decision.tags] : []);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!decision || !editedSummary.trim()) return;
    
    setIsSaving(true);
    try {
      const client = getConportClient();
      
      // Use the new updateDecision functionality
      await client.updateDecision({
        decision_id: decisionId,
        summary: editedSummary.trim(),
        rationale: editedRationale.trim() || undefined,
        implementation_details: editedImplementationDetails.trim() || undefined,
        tags: editedTags.length > 0 ? editedTags : undefined
      });
      
      // Refresh the data
      await refetch();
      await refetchLinked();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update decision:', error);
      alert('Failed to update decision. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (decision) {
      setEditedSummary(decision.summary || '');
      setEditedRationale(decision.rationale || '');
      setEditedImplementationDetails(decision.implementation_details || '');
      setEditedTags(decision.tags ? [...decision.tags] : []);
    }
    setIsEditing(false);
  };

  const addTag = () => {
    if (newTag.trim() && !editedTags.includes(newTag.trim())) {
      setEditedTags([...editedTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEditedTags(editedTags.filter(tag => tag !== tagToRemove));
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete decision "${decision.summary?.slice(0, 50)}..."?`)) {
      deleteDecisionMutation.mutate(decision.id);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState error={error} />;
  }

  if (!decision) {
    return <NotFoundState type="Decision" id={id} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            ← Back
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Decision Detail
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Decision #{decision.id}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Created: {new Date(decision.timestamp).toLocaleDateString()}
            </div>
            {!isEditing && (
              <button
                onClick={handleEdit}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Edit
              </button>
            )}
            {isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editedSummary.trim()}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
            {!isEditing && (
              <button
                onClick={handleDelete}
                disabled={deleteDecisionMutation.isPending}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {deleteDecisionMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </div>

        {/* Decision Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2 flex-wrap">
              {decision.tags?.map((tag: string) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(decision.timestamp).toLocaleString()}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Summary
              </h3>
              {isEditing ? (
                <textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical min-h-[80px]"
                  placeholder="Enter decision summary..."
                />
              ) : (
                <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                  {decision.summary}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Rationale
              </h3>
              {isEditing ? (
                <textarea
                  value={editedRationale}
                  onChange={(e) => setEditedRationale(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical min-h-[100px]"
                  placeholder="Enter rationale (optional)..."
                />
              ) : (
                decision.rationale && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {decision.rationale}
                    </p>
                  </div>
                )
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Implementation Details
              </h3>
              {isEditing ? (
                <textarea
                  value={editedImplementationDetails}
                  onChange={(e) => setEditedImplementationDetails(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical min-h-[100px]"
                  placeholder="Enter implementation details (optional)..."
                />
              ) : (
                decision.implementation_details && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-l-4 border-blue-500">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {decision.implementation_details}
                    </p>
                  </div>
                )
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">ID: </span>
                    <span className="text-gray-900 dark:text-white">#{decision.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Created: </span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(decision.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Time: </span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(decision.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Tags
                </h3>
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addTag()}
                        className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Add a tag..."
                      />
                      <button
                        onClick={addTag}
                        className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editedTags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded flex items-center gap-1"
                        >
                          {tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="ml-1 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {decision.tags && decision.tags.length > 0 ? (
                      decision.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400 text-sm">No tags</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Related Items Section */}
            <RelatedItemsSection
              linkedItems={linkedItems || []}
              currentItemType="decision"
              currentItemId={id}
              onRefresh={async () => { await refetchLinked(); }}
              isEditing={isEditing}
              isLoading={linkedItemsLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Loading decision details...</p>
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: any }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Error Loading Decision
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error?.message || 'Failed to load decision details'}
        </p>
      </div>
    </div>
  );
}

function NotFoundState({ type, id }: { type: string; id: string }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">🔍</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {type} Not Found
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {type} with ID #{id} could not be found.
        </p>
      </div>
    </div>
  );
}