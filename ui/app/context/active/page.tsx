"use client";

import { useRouter } from 'next/navigation';
import { useActiveContext, useUpdateActiveContext } from '@/shared/conport/hooks';
import { useState } from 'react';

// Editing Interface Component for Active Context
interface ActiveContextEditingInterfaceProps {
  editedContext: Record<string, any>;
  editMode: 'json' | 'form';
  onFieldChange: (key: string, value: any) => void;
  onAddField: () => void;
  onRemoveField: (key: string) => void;
  onAddIssue: () => void;
  onRemoveIssue: (index: number) => void;
  onEditIssue: (index: number, value: string) => void;
  setEditedContext: (context: Record<string, any>) => void;
}

function ActiveContextEditingInterface({
  editedContext,
  editMode,
  onFieldChange,
  onAddField,
  onRemoveField,
  onAddIssue,
  onRemoveIssue,
  onEditIssue,
  setEditedContext
}: ActiveContextEditingInterfaceProps) {
  const [newFieldKey, setNewFieldKey] = useState('');
  const [editingIssueIndex, setEditingIssueIndex] = useState<number | null>(null);
  const [tempIssueValue, setTempIssueValue] = useState('');

  if (editMode === 'json') {
    return (
      <div>
        <textarea
          value={JSON.stringify(editedContext, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setEditedContext(parsed);
            } catch (error) {
              // Keep the text but don't update context on invalid JSON
            }
          }}
          className="w-full h-96 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
          placeholder="Enter JSON context data..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Focus Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          🎯 Current Focus
        </label>
        <textarea
          value={editedContext.current_focus || ''}
          onChange={(e) => onFieldChange('current_focus', e.target.value)}
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          rows={3}
          placeholder="What is the current focus of work?"
        />
      </div>

      {/* Open Issues Array Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
          ⚠️ Open Issues
          <button
            onClick={onAddIssue}
            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors cursor-pointer"
          >
            Add Issue
          </button>
        </label>
        <div className="space-y-2">
          {(editedContext.open_issues || []).map((issue: string, index: number) => (
            <div key={index} className="flex items-center gap-2">
              {editingIssueIndex === index ? (
                <>
                  <input
                    type="text"
                    value={tempIssueValue}
                    onChange={(e) => setTempIssueValue(e.target.value)}
                    className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Describe the issue..."
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      onEditIssue(index, tempIssueValue);
                      setEditingIssueIndex(null);
                      setTempIssueValue('');
                    }}
                    className="px-2 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingIssueIndex(null);
                      setTempIssueValue('');
                    }}
                    className="px-2 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="flex-1 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30"
                    onClick={() => {
                      setEditingIssueIndex(index);
                      setTempIssueValue(issue);
                    }}
                  >
                    {issue}
                  </div>
                  <button
                    onClick={() => onRemoveIssue(index)}
                    className="px-2 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 cursor-pointer"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Other Dynamic Fields */}
      {Object.entries(editedContext).map(([key, value]) => {
        if (key === 'current_focus' || key === 'open_issues') {
          return null;
        }

        return (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
              {key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
              <button
                onClick={() => onRemoveField(key)}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors cursor-pointer"
              >
                Remove Field
              </button>
            </label>
            {Array.isArray(value) ? (
              <textarea
                value={value.join('\n')}
                onChange={(e) => onFieldChange(key, e.target.value.split('\n').filter(line => line.trim()))}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                rows={Math.max(3, value.length)}
                placeholder="One item per line..."
              />
            ) : typeof value === 'object' && value !== null ? (
              <textarea
                value={JSON.stringify(value, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    onFieldChange(key, parsed);
                  } catch (error) {
                    // Keep the text but don't update on invalid JSON
                  }
                }}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                rows={Math.max(3, JSON.stringify(value, null, 2).split('\n').length)}
                placeholder="Enter JSON object..."
              />
            ) : (
              <textarea
                value={String(value)}
                onChange={(e) => onFieldChange(key, e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                rows={3}
                placeholder="Enter value..."
              />
            )}
          </div>
        );
      })}

      {/* Add New Field */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newFieldKey}
            onChange={(e) => setNewFieldKey(e.target.value)}
            placeholder="New field name..."
            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <button
            onClick={() => {
              if (newFieldKey.trim()) {
                onFieldChange(newFieldKey.trim(), '');
                setNewFieldKey('');
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Add Field
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActiveContextPage() {
  const router = useRouter();
  const [showRaw, setShowRaw] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContext, setEditedContext] = useState<Record<string, any>>({});
  const [editMode, setEditMode] = useState<'json' | 'form'>('form');

  const { data: activeContext, isLoading, isError, error, refetch } = useActiveContext();

  const updateActiveContextMutation = useUpdateActiveContext({
    onSuccess: () => {
      setIsEditing(false);
      setEditedContext({});
      // Force immediate refetch to show updated data
      refetch();
    }
  });

  const handleStartEdit = () => {
    setEditedContext({ ...activeContext });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContext({});
  };

  const handleSave = () => {
    // Always use content for full context replacement
    // The hook already handles cache invalidation properly
    updateActiveContextMutation.mutate({ content: editedContext });
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

  const handleAddIssue = () => {
    const issue = prompt('Enter new issue:');
    if (issue && issue.trim()) {
      const currentIssues = editedContext.open_issues || [];
      handleFieldChange('open_issues', [...currentIssues, issue.trim()]);
    }
  };

  const handleRemoveIssue = (index: number) => {
    const currentIssues = editedContext.open_issues || [];
    const newIssues = currentIssues.filter((_: any, i: number) => i !== index);
    handleFieldChange('open_issues', newIssues);
  };

  const handleEditIssue = (index: number, newValue: string) => {
    const currentIssues = editedContext.open_issues || [];
    const newIssues = [...currentIssues];
    newIssues[index] = newValue;
    handleFieldChange('open_issues', newIssues);
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState error={error} />;
  }

  const contextData = activeContext || {};
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
              Active Context
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Current working focus, recent changes, and open issues
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
                  className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors cursor-pointer"
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
                  disabled={updateActiveContextMutation.isPending}
                  className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateActiveContextMutation.isPending}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {updateActiveContextMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Context Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {hasContent ? 'Active Session' : 'No Active Session'}
              </span>
            </div>
            {activeContext?.version && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Version {activeContext.version}
              </div>
            )}
          </div>

          {!hasContent && !isEditing ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Active Context Defined
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                The active context has not been set for this session.
              </p>
              <button
                onClick={handleStartEdit}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors cursor-pointer"
              >
                Create Active Context
              </button>
            </div>
          ) : isEditing ? (
            <ActiveContextEditingInterface
              editedContext={editedContext}
              editMode={editMode}
              onFieldChange={handleFieldChange}
              onAddField={handleAddField}
              onRemoveField={handleRemoveField}
              onAddIssue={handleAddIssue}
              onRemoveIssue={handleRemoveIssue}
              onEditIssue={handleEditIssue}
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
              {/* Special handling for common active context fields */}
              {contextData.current_focus && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    🎯 Current Focus
                  </h3>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-l-4 border-blue-500">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {contextData.current_focus}
                    </p>
                  </div>
                </div>
              )}

              {contextData.open_issues && Array.isArray(contextData.open_issues) && contextData.open_issues.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    ⚠️ Open Issues
                  </h3>
                  <div className="space-y-2">
                    {contextData.open_issues.map((issue: any, index: number) => (
                      <div key={index} className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border-l-4 border-red-500">
                        <p className="text-gray-700 dark:text-gray-300">
                          {typeof issue === 'string' ? issue : JSON.stringify(issue)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Render other fields */}
              {Object.entries(contextData).map(([key, value]) => {
                // Skip fields we've already rendered specially
                if (key === 'current_focus' || key === 'open_issues') {
                  return null;
                }
                
                return (
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
                              <span className="text-orange-600 dark:text-orange-400 mt-1">•</span>
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
                );
              })}
            </div>
          )}

          {activeContext?.timestamp && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Last updated: {new Date(activeContext.timestamp).toLocaleString()}
              </div>
            </div>
          )}
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
        <p className="text-gray-600 dark:text-gray-400 mt-2">Loading active context...</p>
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
          Error Loading Active Context
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error?.message || 'Failed to load active context'}
        </p>
      </div>
    </div>
  );
}