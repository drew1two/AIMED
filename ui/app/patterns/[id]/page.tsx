"use client";

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSystemPatternItem, useLinkedItems, useDeleteSystemPattern } from '@/shared/conport/hooks';
import { getConportClient } from '@/shared/conport/client';
import RelatedItemsSection from '@/app/components/RelatedItemsSection';

export default function PatternDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const patternId = parseInt(id);
  
  const { data: pattern, isLoading, isError, error, refetch } = useSystemPatternItem(patternId);
  const { data: linkedItems, isLoading: linkedItemsLoading, refetch: refetchLinked } = useLinkedItems('system_pattern', id);
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Smart constraint detection - name change creates new record, other changes update existing
  const nameChanged = pattern && editedName !== pattern.name;
  const willCreateNewRecord = nameChanged;

  const deleteSystemPatternMutation = useDeleteSystemPattern({
    onSuccess: () => {
      router.push('/patterns');
    }
  });
  
  // Initialize edit state when pattern data loads
  useState(() => {
    if (pattern && !isEditing) {
      setEditedName(pattern.name || '');
      setEditedDescription(pattern.description || '');
      setEditedTags(pattern.tags ? [...pattern.tags] : []);
    }
  });

  const handleEdit = () => {
    if (pattern) {
      setEditedName(pattern.name || '');
      setEditedDescription(pattern.description || '');
      setEditedTags(pattern.tags ? [...pattern.tags] : []);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!pattern || !editedName.trim()) return;
    
    setIsSaving(true);
    try {
      const client = getConportClient();
      
      await client.logSystemPattern({
        name: editedName.trim(),
        description: editedDescription.trim() || undefined,
        tags: editedTags.length > 0 ? editedTags : undefined
      });
      
      if (willCreateNewRecord) {
        alert('Name changed: A new pattern has been created with your changes. The original pattern remains with its links intact. You can delete the old one if no longer needed.');
      }
      
      // Refresh the data
      await refetch();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save system pattern:', error);
      alert('Failed to save system pattern. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (pattern) {
      setEditedName(pattern.name || '');
      setEditedDescription(pattern.description || '');
      setEditedTags(pattern.tags ? [...pattern.tags] : []);
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
    if (confirm(`Are you sure you want to delete system pattern "${pattern.name?.slice(0, 50)}..."?`)) {
      deleteSystemPatternMutation.mutate(pattern.id);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState error={error} />;
  }

  if (!pattern) {
    return <NotFoundState type="System Pattern" id={id} />;
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
              System Pattern Detail
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Pattern #{pattern.id}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Created: {new Date(pattern.timestamp).toLocaleDateString()}
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
              <div className="flex gap-2 items-center">
                {willCreateNewRecord && (
                  <div className="flex items-center gap-2 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded text-amber-800 dark:text-amber-200 text-sm">
                    <span className="text-amber-600 dark:text-amber-400">⚠️</span>
                    <span className="text-xs">Will create new record</span>
                  </div>
                )}
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editedName.trim()}
                  className={`px-3 py-1 text-sm text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer ${
                    willCreateNewRecord
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isSaving
                    ? (willCreateNewRecord ? 'Creating New...' : 'Saving...')
                    : (willCreateNewRecord ? 'Save as New' : 'Save')
                  }
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
                disabled={deleteSystemPatternMutation.isPending}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {deleteSystemPatternMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </div>

        {/* Pattern Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2 flex-wrap">
              {pattern.tags?.map((tag: string) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-sm bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-lg"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(pattern.timestamp).toLocaleString()}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                Pattern Name
                {isEditing && (
                  <span
                    className="text-blue-500 cursor-help text-sm"
                    title="Unique field: Changing the name creates a new pattern. See Docs → Unique Constraints Guide for details."
                  >
                    ℹ️
                  </span>
                )}
                {isEditing && nameChanged && (
                  <span
                    className="text-amber-500 cursor-help"
                    title="Name changed: Will create new pattern. Original pattern and links preserved. See Docs for guidance."
                  >
                    ⚠️
                  </span>
                )}
              </h3>
              {isEditing ? (
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className={`w-full p-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-blue-500 ${
                    nameChanged
                      ? 'border-amber-300 dark:border-amber-600 focus:ring-amber-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }`}
                  placeholder="Enter pattern name..."
                />
              ) : (
                <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed font-medium">
                  {pattern.name}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Description
              </h3>
              {isEditing ? (
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical min-h-[120px]"
                  placeholder="Enter pattern description (optional)..."
                />
              ) : (
                pattern.description && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {pattern.description}
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
                    <span className="text-gray-900 dark:text-white">#{pattern.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Name: </span>
                    <span className="text-gray-900 dark:text-white">{pattern.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Created: </span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(pattern.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Time: </span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(pattern.timestamp).toLocaleTimeString()}
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
                        className="px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editedTags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded flex items-center gap-1"
                        >
                          {tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="ml-1 text-orange-600 dark:text-orange-300 hover:text-orange-800 dark:hover:text-orange-100 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {pattern.tags && pattern.tags.length > 0 ? (
                      pattern.tags.map((tag: string) => (
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
              currentItemType="system_pattern"
              currentItemId={id}
              onRefresh={async () => { await refetchLinked(); }}
              isEditing={isEditing}
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Loading pattern details...</p>
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
          Error Loading Pattern
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error?.message || 'Failed to load pattern details'}
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