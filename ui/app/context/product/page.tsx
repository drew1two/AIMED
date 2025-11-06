"use client";

import { useRouter } from 'next/navigation';
import { useProductContext, useUpdateProductContext } from '@/shared/conport/hooks';
import { useState } from 'react';

export default function ProductContextPage() {
  const router = useRouter();
  const { data: productContext, isLoading, isError, error, refetch } = useProductContext();
  const [showRaw, setShowRaw] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContext, setEditedContext] = useState<Record<string, any>>({});
  const [editMode, setEditMode] = useState<'json' | 'form'>('form');

  const updateProductContextMutation = useUpdateProductContext({
    onSuccess: () => {
      setIsEditing(false);
      setEditedContext({});
      // Force immediate refetch to show updated data
      refetch();
    }
  });

  const handleStartEdit = () => {
    setEditedContext({ ...productContext });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContext({});
  };

  const handleSave = () => {
    // Always use content for full context replacement
    // The hook already handles cache invalidation properly
    updateProductContextMutation.mutate({ content: editedContext });
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditedContext(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddField = () => {
    const fieldName = prompt('Enter field name:');
    if (fieldName && fieldName.trim()) {
      handleFieldChange(fieldName.trim(), '');
    }
  };

  const handleRemoveField = (field: string) => {
    if (confirm(`Remove "${field}" field?`)) {
      const { [field]: removed, ...rest } = editedContext as Record<string, any>;
      setEditedContext(rest);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState error={error} />;
  }

  const contextData = productContext || {};
  const hasContent = Object.keys(contextData).length > 0;

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
              Product Context
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Overall project goals, features, and architecture
            </p>
          </div>
          <div className="flex gap-2">
            {!isEditing && (
              <>
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                >
                  {showRaw ? 'Formatted' : 'Raw JSON'}
                </button>
                <button
                  onClick={handleStartEdit}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  ✏️ Edit
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button
                  onClick={() => setEditMode(editMode === 'json' ? 'form' : 'json')}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer"
                >
                  {editMode === 'json' ? 'Form' : 'JSON'} Mode
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={updateProductContextMutation.isPending}
                  className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateProductContextMutation.isPending}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {updateProductContextMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Context Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {hasContent ? 'Configured' : 'Empty'}
              </span>
            </div>
            {productContext?.version && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Version {productContext.version}
              </div>
            )}
          </div>

          {!hasContent && !isEditing ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Product Context Defined
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                The product context has not been configured yet.
              </p>
              <button
                onClick={handleStartEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Create Product Context
              </button>
            </div>
          ) : isEditing ? (
            <EditingInterface
              editedContext={editedContext}
              editMode={editMode}
              onFieldChange={handleFieldChange}
              onAddField={handleAddField}
              onRemoveField={handleRemoveField}
              setEditedContext={setEditedContext}
            />
          ) : showRaw ? (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Raw JSON Data
              </h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto text-sm">
{JSON.stringify(contextData, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(contextData).map(([key, value]) => (
                <div key={key}>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 capitalize">
                    {key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    {typeof value === 'string' ? (
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {value}
                      </p>
                    ) : Array.isArray(value) ? (
                      <ul className="space-y-2">
                        {value.map((item, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                            <span className="text-gray-700 dark:text-gray-300">
                              {typeof item === 'string' ? item : JSON.stringify(item)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : typeof value === 'object' && value !== null ? (
                      <div className="space-y-2">
                        {Object.entries(value as Record<string, any>).map(([subKey, subValue]) => (
                          <div key={subKey} className="border-l-2 border-gray-300 dark:border-gray-600 pl-3">
                            <div className="font-medium text-gray-900 dark:text-white text-sm">
                              {subKey.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}:
                            </div>
                            <div className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                              {typeof subValue === 'string' ? subValue : JSON.stringify(subValue)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-700 dark:text-gray-300">
                        {String(value)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {productContext?.timestamp && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Last updated: {new Date(productContext.timestamp).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Editing Interface Component
function EditingInterface({
  editedContext,
  editMode,
  onFieldChange,
  onAddField,
  onRemoveField,
  setEditedContext
}: {
  editedContext: Record<string, any>;
  editMode: 'json' | 'form';
  onFieldChange: (field: string, value: any) => void;
  onAddField: () => void;
  onRemoveField: (field: string) => void;
  setEditedContext: (context: Record<string, any>) => void;
}) {
  const [jsonError, setJsonError] = useState<string>('');

  if (editMode === 'json') {
    const handleJsonChange = (value: string) => {
      try {
        const parsed = JSON.parse(value);
        setEditedContext(parsed);
        setJsonError('');
      } catch (error) {
        setJsonError('Invalid JSON format');
      }
    };

    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Edit JSON Data
        </h3>
        {jsonError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-300 text-sm">{jsonError}</p>
          </div>
        )}
        <textarea
          rows={20}
          className="w-full p-4 bg-gray-900 text-gray-100 rounded-lg font-mono text-sm border border-gray-600"
          defaultValue={JSON.stringify(editedContext, null, 2)}
          onChange={(e) => handleJsonChange(e.target.value)}
          placeholder="Enter valid JSON..."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Edit Product Context
        </h3>
        <button
          onClick={onAddField}
          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors cursor-pointer"
        >
          + Add Field
        </button>
      </div>
      
      <div className="space-y-4">
        {Object.entries(editedContext).map(([key, value]) => (
          <div key={key} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
              </label>
              <button
                onClick={() => onRemoveField(key)}
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded px-2 py-1 text-xs cursor-pointer"
              >
                Remove
              </button>
            </div>
            
            {Array.isArray(value) ? (
              <ArrayEditor
                value={value}
                onChange={(newValue) => onFieldChange(key, newValue)}
              />
            ) : typeof value === 'object' && value !== null ? (
              <ObjectEditor
                value={value}
                onChange={(newValue) => onFieldChange(key, newValue)}
              />
            ) : (
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={typeof value === 'string' ? value : JSON.stringify(value)}
                onChange={(e) => onFieldChange(key, e.target.value)}
                placeholder={`Enter ${key}...`}
              />
            )}
          </div>
        ))}
        
        {Object.keys(editedContext).length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No fields yet. Click "Add Field" to get started.
          </div>
        )}
      </div>
    </div>
  );
}

// Array Editor Component
function ArrayEditor({ value, onChange }: { value: any[]; onChange: (value: any[]) => void }) {
  const handleItemChange = (index: number, newValue: string) => {
    const newArray = [...value];
    newArray[index] = newValue;
    onChange(newArray);
  };

  const addItem = () => {
    onChange([...value, '']);
  };

  const removeItem = (index: number) => {
    const newArray = value.filter((_, i) => i !== index);
    onChange(newArray);
  };

  return (
    <div className="space-y-2">
      {value.map((item, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            value={typeof item === 'string' ? item : JSON.stringify(item)}
            onChange={(e) => handleItemChange(index, e.target.value)}
            placeholder={`Item ${index + 1}`}
          />
          <button
            onClick={() => removeItem(index)}
            className="px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
      >
        + Add Item
      </button>
    </div>
  );
}

// Object Editor Component
function ObjectEditor({ value, onChange }: { value: Record<string, any>; onChange: (value: Record<string, any>) => void }) {
  const handleFieldChange = (key: string, newValue: string) => {
    onChange({
      ...value,
      [key]: newValue
    });
  };

  const addField = () => {
    const fieldName = prompt('Enter field name:');
    if (fieldName && fieldName.trim()) {
      onChange({
        ...value,
        [fieldName.trim()]: ''
      });
    }
  };

  const removeField = (key: string) => {
    const { [key]: removed, ...rest } = value;
    onChange(rest);
  };

  return (
    <div className="space-y-2 bg-gray-50 dark:bg-gray-800 p-3 rounded">
      {Object.entries(value).map(([key, val]) => (
        <div key={key} className="flex gap-2">
          <div className="w-1/3">
            <input
              type="text"
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={key}
              readOnly
              placeholder="Key"
            />
          </div>
          <div className="flex-1">
            <input
              type="text"
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={typeof val === 'string' ? val : JSON.stringify(val)}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              placeholder="Value"
            />
          </div>
          <button
            onClick={() => removeField(key)}
            className="px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={addField}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
      >
        + Add Field
      </button>
    </div>
  );
}

// Helper Components
function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Loading product context...</p>
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
          Error Loading Product Context
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error?.message || 'Failed to load product context'}
        </p>
      </div>
    </div>
  );
}