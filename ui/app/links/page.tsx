"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAllLinks, useUpdateLink, useDeleteLink } from '@/shared/conport/hooks';
import { EDGE_STYLES } from '@/shared/conport/graph-types';

export default function LinksPage() {
  const router = useRouter();
  const { data: links, isLoading, error, refetch } = useAllLinks();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter links based on search and tags
  const filteredLinks = React.useMemo(() => {
    if (!links) return [];
    
    return links.filter((link: any) => {
      // Search filter
      const matchesSearch = !searchQuery || 
        link.source_item_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.target_item_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.relationship_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Tag filter (could be enhanced if links have tags in the future)
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => link.relationship_type?.toLowerCase().includes(tag.toLowerCase()));
      
      return matchesSearch && matchesTags;
    });
  }, [links, searchQuery, selectedTags]);

  // Get unique relationship types for filtering
  const relationshipTypes = React.useMemo(() => {
    if (!links) return [];
    const types = [...new Set(links.map((link: any) => link.relationship_type))];
    return types.filter(Boolean).sort() as string[];
  }, [links]);

  const handleLinkClick = (linkId: number) => {
    router.push(`/links/${linkId}`);
  };

  const handleRefresh = () => {
    refetch();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Error loading links
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>{error.message}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleRefresh}
                    className="bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-3 py-1 rounded text-sm hover:bg-red-200 dark:hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                🔗 Knowledge Graph Links
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage relationships between ConPort items
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium cursor-pointer disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <span className={`text-lg ${isLoading ? 'animate-spin' : ''}`}>🔄</span>
                  Refresh
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search links by type, relationship, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {relationshipTypes.map((type: string) => (
                <button
                  key={type}
                  onClick={() => {
                    if (selectedTags.includes(type)) {
                      setSelectedTags(selectedTags.filter(t => t !== type));
                    } else {
                      setSelectedTags([...selectedTags, type]);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium cursor-pointer transition-colors ${
                    selectedTags.includes(type)
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <span className="text-xl">🔗</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Links</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {links?.length || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <span className="text-xl">📊</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Filtered Results</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {filteredLinks.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <span className="text-xl">🏷️</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Relationship Types</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {relationshipTypes.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Links List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Knowledge Graph Links
            </h2>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Loading links...</p>
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-4">🔗</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {links?.length === 0 ? 'No links found' : 'No matching links'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {links?.length === 0 
                  ? 'Links between ConPort items will appear here once created.'
                  : 'Try adjusting your search criteria or filters.'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLinks.map((link: any) => (
                <LinkCard
                  key={link.id}
                  link={link}
                  onClick={() => handleLinkClick(link.id)}
                  onRefetch={refetch}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Link Card Component with Edit/Delete functionality
function LinkCard({ link, onClick, onRefetch }: { link: any; onClick: () => void; onRefetch: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    relationship_type: link.relationship_type || '',
    description: link.description || ''
  });

  const updateLinkMutation = useUpdateLink({
    onSuccess: () => {
      setIsEditing(false);
      // Refetch to show updated data
      onRefetch();
    }
  });

  const deleteLinkMutation = useDeleteLink({
    onSuccess: () => {
      // Link deleted successfully - refetch to update the list
      onRefetch();
    }
  });

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditFormData({
      relationship_type: link.relationship_type || '',
      description: link.description || ''
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    updateLinkMutation.mutate({
      link_id: link.id,
      relationship_type: editFormData.relationship_type,
      description: editFormData.description || undefined
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete link #${link.id}?`)) {
      deleteLinkMutation.mutate({ link_id: link.id });
    }
  };

  if (isEditing) {
    return (
      <div className="p-6 bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500">
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              Edit Link #{link.id}
            </h4>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Relationship Type *
            </label>
            <select
              value={editFormData.relationship_type}
              onChange={(e) => setEditFormData(prev => ({ ...prev, relationship_type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {(Object.keys(EDGE_STYLES) as Array<keyof typeof EDGE_STYLES>).map((relType) => (
                <option key={relType as string} value={relType as string}>
                  {(relType as string).replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={editFormData.description}
              onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Optional description of the relationship"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={handleCancelEdit}
              disabled={updateLinkMutation.isPending}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateLinkMutation.isPending || !editFormData.relationship_type.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {updateLinkMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              Link #{link.id}
            </span>
            <span className={`px-2 py-1 text-xs rounded ${
              link.relationship_type === 'implements' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
              link.relationship_type === 'blocks' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
              link.relationship_type === 'relates_to' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
              'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}>
              {link.relationship_type}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
              {link.source_item_type}#{link.source_item_id}
            </span>
            <span>→</span>
            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
              {link.target_item_type}#{link.target_item_id}
            </span>
          </div>
          
          {link.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {link.description}
            </p>
          )}
        </div>
        <div className="ml-4 text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(link.timestamp).toLocaleDateString()}
          </p>
        </div>
      </div>
      
      {/* Edit/Delete buttons - consistent with Decisions/Progress pages */}
      <div className="flex justify-start items-center mt-4">
        <div className="flex gap-1">
          <button
            onClick={handleStartEdit}
            disabled={updateLinkMutation.isPending}
            className="p-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Edit link"
          >
            ✏️
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteLinkMutation.isPending}
            className="p-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Delete link"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}