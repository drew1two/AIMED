"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TextareaAutosize from "react-textarea-autosize";
import { getConportClient } from "../../../shared/conport/client";
import styles from "./markdown.module.css";

type MarkdownFile = {
  name: string;
  path: string;
  category?: string;
};

export default function ProjectDocsPage() {
  const [files, setFiles] = useState<MarkdownFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<MarkdownFile | null>(null);
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportPath, setExportPath] = useState("conport_markdown_export");
  const [showExportConfig, setShowExportConfig] = useState(false);

  // Load files on mount
  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/markdown-files');
      if (!response.ok) throw new Error('Failed to load markdown files');
      const data = await response.json();
      setFiles(data.files || []);
      
      // Load export path from response if available
      if (data.exportPath) {
        setExportPath(data.exportPath);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFileContent = async (file: MarkdownFile) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/markdown-files/${encodeURIComponent(file.path)}`);
      if (!response.ok) throw new Error('Failed to load file content');
      const data = await response.json();
      setContent(data.content);
      setEditContent(data.content);
      setSelectedFile(file);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const saveFileContent = async () => {
    if (!selectedFile) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/markdown-files/${encodeURIComponent(selectedFile.path)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent })
      });
      
      if (!response.ok) throw new Error('Failed to save file');
      
      setContent(editContent);
      setIsEditing(false);
      alert('File saved successfully! Use "Import to ConPort" to sync changes to the database.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToMarkdown = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const client = getConportClient();
      await client.exportConportToMarkdown({ output_path: exportPath });
      
      // Reload files after export
      await loadFiles();
      alert(`Successfully exported ConPort data to ${exportPath}/`);
    } catch (err: any) {
      setError(err.message);
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const importFromMarkdown = async () => {
    if (!confirm('This will sync markdown file changes back to the ConPort database. Continue?')) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const client = getConportClient();
      await client.importMarkdownToConport({ input_path: exportPath });
      alert('Successfully imported markdown changes to ConPort database!');
    } catch (err: any) {
      setError(err.message);
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Group files by category
  const groupedFiles = files.reduce((acc, file) => {
    const category = file.category || 'Core';
    if (!acc[category]) acc[category] = [];
    acc[category].push(file);
    return acc;
  }, {} as Record<string, MarkdownFile[]>);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            📝 Project Documentation
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and edit your exported ConPort markdown files
          </p>
        </div>

        {/* Action Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3">
              <button
                onClick={exportToMarkdown}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                📤 Export from ConPort
              </button>
              {/* Import button hidden - creates duplicate entries. Keep code for future fix.
              <button
                onClick={importFromMarkdown}
                disabled={isLoading || files.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                📥 Import to ConPort
              </button>
              */}
              <button
                onClick={loadFiles}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                🔄 Refresh
              </button>
            </div>
            <button
              onClick={() => setShowExportConfig(!showExportConfig)}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              ⚙️ Configure Path
            </button>
          </div>

          {/* Export Path Configuration */}
          {showExportConfig && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Export Directory Path (relative to workspace)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={exportPath}
                  onChange={(e) => setExportPath(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="conport_markdown_export"
                />
                <button
                  onClick={() => setShowExportConfig(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This path will be saved per workspace for future exports
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* File Browser Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Files ({files.length})
              </h2>
              
              {isLoading && files.length === 0 ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">Loading...</p>
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                    No markdown files found
                  </p>
                  <button
                    onClick={exportToMarkdown}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Export from ConPort
                  </button>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {Object.entries(groupedFiles).map(([category, categoryFiles]) => (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {category}
                      </h3>
                      <div className="space-y-1">
                        {categoryFiles.map((file) => (
                          <button
                            key={file.path}
                            onClick={() => loadFileContent(file)}
                            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                              selectedFile?.path === file.path
                                ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {file.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Content Viewer/Editor */}
          <div className="lg:col-span-3">
            {selectedFile ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                {/* File Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedFile.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedFile.path}</p>
                  </div>
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => {
                            setEditContent(content);
                            setIsEditing(false);
                          }}
                          disabled={isLoading}
                          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveFileContent}
                          disabled={isLoading || editContent === content}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {isEditing ? (
                    <div>
                      <TextareaAutosize
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm min-h-[400px]"
                        placeholder="Edit markdown content..."
                      />
                      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        💡 Tip: After saving, use "Import to ConPort" to sync changes back to the database
                      </div>
                    </div>
                  ) : (
                    <div className={styles.markdown}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <div className="text-6xl mb-4">📄</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No File Selected
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {files.length > 0 
                    ? 'Select a file from the sidebar to view or edit'
                    : 'Export ConPort data to create markdown files'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}