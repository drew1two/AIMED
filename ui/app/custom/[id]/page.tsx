"use client";

import React, { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomData, useLogCustomData, useDeleteCustomData, useLinkedItems } from '@/shared/conport/hooks';
import RelatedItemsSection from '@/app/components/RelatedItemsSection';

interface CustomDataItem {
  id: number;
  category: string;
  key: string;
  value: any;
  timestamp: string;
}

export default function CustomDataDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  // Parse category and key from the ID (format: custom-category:key)
  // Remove the "custom-" prefix and then split on ':'
  const decodedId = decodeURIComponent(id);
  const actualId = decodedId.startsWith('custom-') ? decodedId.substring(7) : decodedId;
  const [category, key] = actualId.includes(':') ? actualId.split(':') : [actualId, ''];
  
  const { data: customDataList, isLoading, isError, error, refetch } = useCustomData();
  const logCustomData = useLogCustomData();
  const deleteCustomData = useDeleteCustomData();
  
  // Find the specific item in the list
  const customDataItem = customDataList?.find((item: any) =>
    item.category === category && item.key === key
  );
  
  // Fixed: Query linked items using numeric ID (consistent with other entry types)
  // Backend now supports both numeric ID and category:key format for custom data
  const customDataItemId = customDataItem?.id?.toString() || '';
  const { data: linkedItems, isLoading: linkedItemsLoading, refetch: refetchLinked } = useLinkedItems(
    'custom_data',
    customDataItemId,
    {},
    { enabled: !!customDataItem }
  );
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editedCategory, setEditedCategory] = useState('');
  const [editedKey, setEditedKey] = useState('');
  const [editedValue, setEditedValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Smart constraint detection - category OR key change creates new record, value-only changes update existing
  const categoryChanged = customDataItem && editedCategory !== customDataItem.category;
  const keyChanged = customDataItem && editedKey !== customDataItem.key;
  const willCreateNewRecord = categoryChanged || keyChanged;
  
  // Initialize edit state when data loads
  useEffect(() => {
    if (customDataItem && !isEditing) {
      setEditedCategory(customDataItem.category || '');
      setEditedKey(customDataItem.key || '');
      setEditedValue(typeof customDataItem.value === 'string' ? customDataItem.value : JSON.stringify(customDataItem.value, null, 2));
    }
  }, [customDataItem, isEditing]);

  const handleEdit = () => {
    if (customDataItem) {
      setEditedCategory(customDataItem.category || '');
      setEditedKey(customDataItem.key || '');
      setEditedValue(typeof customDataItem.value === 'string' ? customDataItem.value : JSON.stringify(customDataItem.value, null, 2));
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!editedCategory.trim() || !editedKey.trim()) return;
    
    setIsSaving(true);
    try {
      let parsedValue: any;
      try {
        // Try to parse as JSON first
        parsedValue = JSON.parse(editedValue);
      } catch {
        // If it fails, treat as plain string
        parsedValue = editedValue;
      }
      
      await logCustomData.mutateAsync({
        category: editedCategory.trim(),
        key: editedKey.trim(),
        value: parsedValue
      });
      
      // If category or key changed, redirect to new URL
      if (editedCategory !== category || editedKey !== key) {
        alert('Category or key changed: A new custom data entry has been created. The original entry and its links remain intact. You can delete the old one if no longer needed.');
        const newId = `custom-${encodeURIComponent(editedCategory)}:${encodeURIComponent(editedKey)}`;
        router.push(`/custom/${newId}`);
      } else {
        await refetch();
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to save custom data:', error);
      alert('Failed to save custom data. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!customDataItem) return;
    
    const confirmed = confirm(`Are you sure you want to delete this custom data item?\nCategory: ${customDataItem.category}\nKey: ${customDataItem.key}`);
    if (!confirmed) return;
    
    setIsDeleting(true);
    try {
      await deleteCustomData.mutateAsync({
        category: customDataItem.category,
        key: customDataItem.key
      });
      
      alert('Custom data item deleted successfully.');
      router.push('/custom');
    } catch (error) {
      console.error('Failed to delete custom data:', error);
      alert('Failed to delete custom data. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    if (customDataItem) {
      setEditedCategory(customDataItem.category || '');
      setEditedKey(customDataItem.key || '');
      setEditedValue(typeof customDataItem.value === 'string' ? customDataItem.value : JSON.stringify(customDataItem.value, null, 2));
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState error={error} />;
  }

  if (!customDataItem) {
    return <NotFoundState category={category} keyName={key} />;
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
              Custom Data Detail
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {customDataItem.category} / {customDataItem.key}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Updated: {new Date(customDataItem.timestamp).toLocaleDateString()}
            </div>
            {!isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
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
                  disabled={isSaving || !editedCategory.trim() || !editedKey.trim()}
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
          </div>
        </div>

        {/* Custom Data Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  Category
                  {isEditing && (
                    <span
                      className="text-blue-500 cursor-help text-sm"
                      title="Unique field: Changing the category creates a new entry. See Docs → Unique Constraints Guide for details."
                    >
                      ℹ️
                    </span>
                  )}
                  {isEditing && categoryChanged && (
                    <span
                      className="text-amber-500 cursor-help"
                      title="Category changed: Will create new entry. Original entry and links preserved. See Docs for guidance."
                    >
                      ⚠️
                    </span>
                  )}
                </h3>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedCategory}
                    onChange={(e) => setEditedCategory(e.target.value)}
                    className={`w-full p-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-blue-500 ${
                      categoryChanged
                        ? 'border-amber-300 dark:border-amber-600 focus:ring-amber-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                    }`}
                    placeholder="Enter category..."
                  />
                ) : (
                  <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                    {customDataItem.category}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  Key
                  {isEditing && (
                    <span
                      className="text-blue-500 cursor-help text-sm"
                      title="Unique field: Changing the key creates a new entry. See Docs → Unique Constraints Guide for details."
                    >
                      ℹ️
                    </span>
                  )}
                  {isEditing && keyChanged && (
                    <span
                      className="text-amber-500 cursor-help"
                      title="Key changed: Will create new entry. Original entry and links preserved. See Docs for guidance."
                    >
                      ⚠️
                    </span>
                  )}
                </h3>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedKey}
                    onChange={(e) => setEditedKey(e.target.value)}
                    className={`w-full p-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-blue-500 ${
                      keyChanged
                        ? 'border-amber-300 dark:border-amber-600 focus:ring-amber-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                    }`}
                    placeholder="Enter key..."
                  />
                ) : (
                  <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                    {customDataItem.key}
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                Value
                {isEditing && (
                  <span
                    className="text-green-500 cursor-help text-sm"
                    title="Safe to update: Value changes update the existing entry without affecting links."
                  >
                    ✅
                  </span>
                )}
              </h3>
              {isEditing ? (
                <textarea
                  value={editedValue}
                  onChange={(e) => setEditedValue(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical min-h-[200px] font-mono text-sm"
                  placeholder="Enter value (JSON or plain text)..."
                />
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 overflow-auto">
                  <pre className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                    {typeof customDataItem.value === 'string'
                      ? customDataItem.value
                      : JSON.stringify(customDataItem.value, null, 2)
                    }
                  </pre>
                </div>
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
                    <span className="text-gray-900 dark:text-white">#{customDataItem.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Updated: </span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(customDataItem.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Time: </span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(customDataItem.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Value Type
                </h3>
                <div className="text-sm">
                  <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                    {typeof customDataItem.value === 'object' && customDataItem.value !== null ? 'JSON Object' : typeof customDataItem.value}
                  </span>
                </div>
              </div>
            </div>

            {/* Related Items Section */}
            <RelatedItemsSection
              linkedItems={linkedItems || []}
              currentItemType="custom_data"
              currentItemId={customDataItemId}
              onRefresh={async () => { await refetchLinked(); }}
              isEditing={isEditing}
              currentItemData={customDataItem}
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Loading custom data...</p>
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
          Error Loading Custom Data
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error?.message || 'Failed to load custom data details'}
        </p>
      </div>
    </div>
  );
}

function NotFoundState({ category, keyName }: { category: string; keyName: string }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">🔍</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Custom Data Not Found
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Custom data with category "{category}" and key "{keyName}" could not be found.
        </p>
      </div>
    </div>
  );
}