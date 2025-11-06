"use client";

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProgressItem, useLinkedItems, useDeleteProgress } from '@/shared/conport/hooks';
import { getConportClient } from '@/shared/conport/client';
import RelatedItemsSection from '@/app/components/RelatedItemsSection';

export default function ProgressDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const progressId = parseInt(id);
  
  const { data: progress, isLoading, isError, error, refetch } = useProgressItem(progressId);
  const { data: linkedItems, isLoading: linkedItemsLoading, refetch: refetchLinked } = useLinkedItems('progress_entry', id);
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [editedStatus, setEditedStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const deleteProgressMutation = useDeleteProgress({
    onSuccess: () => {
      router.push('/progress');
    }
  });
  
  // Initialize edit state when progress data loads
  useState(() => {
    if (progress && !isEditing) {
      setEditedDescription(progress.description || '');
      setEditedStatus(progress.status || '');
    }
  });

  const handleEdit = () => {
    if (progress) {
      setEditedDescription(progress.description || '');
      setEditedStatus(progress.status || '');
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!progress || !editedDescription.trim()) return;
    
    setIsSaving(true);
    try {
      const client = getConportClient();
      await client.updateProgress({
        progress_id: progressId,
        description: editedDescription.trim(),
        status: editedStatus
      });
      
      // Refresh the data
      await refetch();
      await refetchLinked();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update progress:', error);
      alert('Failed to update progress. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (progress) {
      setEditedDescription(progress.description || '');
      setEditedStatus(progress.status || '');
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete progress item "${progress.description?.slice(0, 50)}..."?`)) {
      deleteProgressMutation.mutate(progress.id);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState error={error} />;
  }

  if (!progress) {
    return <NotFoundState type="Progress" id={id} />;
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
              Progress Detail
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Progress #{progress.id}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Created: {new Date(progress.timestamp).toLocaleDateString()}
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
                  disabled={isSaving || !editedDescription.trim()}
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
                disabled={deleteProgressMutation.isPending}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {deleteProgressMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </div>

        {/* Progress Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            {isEditing ? (
              <div className="flex items-center gap-4">
                <select
                  value={editedStatus}
                  onChange={(e) => setEditedStatus(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="TODO">TODO</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="DONE">DONE</option>
                </select>
                <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
              </div>
            ) : (
              <StatusBadge status={progress.status} />
            )}
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(progress.timestamp).toLocaleString()}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Description
              </h3>
              {isEditing ? (
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical min-h-[100px]"
                  placeholder="Enter progress description..."
                />
              ) : (
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {progress.description}
                </p>
              )}
            </div>

            {progress.parent_id && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Parent Task
                </h3>
                <div 
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                  onClick={() => router.push(`/progress/${progress.parent_id}`)}
                >
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Parent Task: #{progress.parent_id}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Click to view parent task
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">ID: </span>
                    <span className="text-gray-900 dark:text-white">#{progress.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Status: </span>
                    <span className="text-gray-900 dark:text-white">{progress.status}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Created: </span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(progress.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Time: </span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(progress.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Related Items Section */}
            <RelatedItemsSection
              linkedItems={linkedItems || []}
              currentItemType="progress_entry"
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
    <span className={`px-3 py-2 text-sm rounded-lg font-medium ${getStatusStyle(status)}`}>
      {status}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Loading progress details...</p>
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
          Error Loading Progress
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error?.message || 'Failed to load progress details'}
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