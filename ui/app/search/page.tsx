"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useSearchDecisions,
  useSearchProgress,
  useSearchPatterns,
  useSearchContext,
  useSearchCustomData,
  useSemanticSearch
} from '@/shared/conport/hooks';

export default function SearchPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'decisions' | 'progress' | 'patterns' | 'context' | 'custom'>('all');
  const [activeTab, setActiveTab] = useState<'decisions' | 'progress' | 'patterns' | 'context' | 'custom'>('decisions');

  // Search across different item types when query exists - enable based on searchType
  const { data: decisionsResults, isLoading: decisionsLoading } = useSearchDecisions(
    { query_term: searchQuery, limit: 10 },
    { enabled: searchQuery.length > 0 && (searchType === 'all' || searchType === 'decisions') }
  );

  const { data: progressResults, isLoading: progressLoading } = useSearchProgress(
    searchQuery,
    { top_k: 10 },
    { enabled: searchQuery.length > 0 && (searchType === 'all' || searchType === 'progress') }
  );

  const { data: patternsResults, isLoading: patternsLoading } = useSearchPatterns(
    searchQuery,
    { top_k: 10 },
    { enabled: searchQuery.length > 0 && (searchType === 'all' || searchType === 'patterns') }
  );

  const { data: contextResults, isLoading: contextLoading } = useSearchContext(
    searchQuery,
    { top_k: 10 },
    { enabled: searchQuery.length > 0 && (searchType === 'all' || searchType === 'context') }
  );

  const { data: customResults, isLoading: customLoading } = useSearchCustomData(
    searchQuery,
    { top_k: 10 },
    { enabled: searchQuery.length > 0 && (searchType === 'all' || searchType === 'custom') }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Auto-select the appropriate tab based on search type
    if (searchType === 'decisions') setActiveTab('decisions');
    else if (searchType === 'progress') setActiveTab('progress');
    else if (searchType === 'patterns') setActiveTab('patterns');
    else if (searchType === 'context') setActiveTab('context');
    else if (searchType === 'custom') setActiveTab('custom');
    // For 'all', keep the current active tab
  };

  // Auto-switch tabs when search type changes
  React.useEffect(() => {
    if (searchType === 'decisions') setActiveTab('decisions');
    else if (searchType === 'progress') setActiveTab('progress');
    else if (searchType === 'patterns') setActiveTab('patterns');
    else if (searchType === 'context') setActiveTab('context');
    else if (searchType === 'custom') setActiveTab('custom');
  }, [searchType]);

  const hasResults = searchQuery.length > 0 && (
    (searchType === 'all' || searchType === 'decisions') && decisionsResults && decisionsResults.length > 0 ||
    (searchType === 'all' || searchType === 'progress') && progressResults && progressResults.length > 0 ||
    (searchType === 'all' || searchType === 'patterns') && patternsResults && patternsResults.length > 0 ||
    (searchType === 'all' || searchType === 'context') && contextResults && contextResults.length > 0 ||
    (searchType === 'all' || searchType === 'custom') && customResults && customResults.length > 0
  );

  const isSearching =
    ((searchType === 'all' || searchType === 'decisions') && decisionsLoading) ||
    ((searchType === 'all' || searchType === 'progress') && progressLoading) ||
    ((searchType === 'all' || searchType === 'patterns') && patternsLoading) ||
    ((searchType === 'all' || searchType === 'context') && contextLoading) ||
    ((searchType === 'all' || searchType === 'custom') && customLoading);

  const showNoResults = searchQuery.length > 0 && !isSearching && !hasResults;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Search AIMED
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Search across decisions, progress items, patterns, and context
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for decisions, progress items, patterns, or context..."
                  className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className="text-lg">🔍</span>
                  Search
                </span>
              </button>
            </div>

            {/* Search Type Selector */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Search in:
                </label>
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as 'all' | 'decisions' | 'progress' | 'patterns' | 'context' | 'custom')}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
                >
                  <option value="all">All Items</option>
                  <option value="decisions">Decisions Only</option>
                  <option value="progress">Progress Only</option>
                  <option value="patterns">Patterns Only</option>
                  <option value="context">Context Only</option>
                  <option value="custom">Custom Data Only</option>
                </select>
              </div>
            </div>
          </form>
        </div>

        {/* Search Results */}
        {searchQuery.length === 0 ? (
          <SearchGuide />
        ) : (
          <div className="space-y-6">
            {/* Loading State */}
            {isSearching && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Searching...</p>
              </div>
            )}

            {/* Results Tabs */}
            {(hasResults || showNoResults) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <nav className="flex space-x-8 px-6">
                    <button
                      onClick={() => setActiveTab('decisions')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'decisions'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      Decisions ({decisionsResults?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('progress')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                        activeTab === 'progress'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      Progress ({progressResults?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('patterns')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                        activeTab === 'patterns'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      Patterns ({patternsResults?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('context')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                        activeTab === 'context'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      Context ({contextResults?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('custom')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                        activeTab === 'custom'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      Custom Data ({customResults?.length || 0})
                    </button>
                  </nav>
                </div>

                <div className="p-6">
                  {activeTab === 'decisions' && (
                    <div className="space-y-4">
                      {showNoResults ? (
                        <NoResultsState query={searchQuery} type="decisions" />
                      ) : (
                        decisionsResults?.map((decision: any) => (
                          <DecisionSearchResult 
                            key={decision.id} 
                            decision={decision} 
                            onClick={() => router.push(`/decisions/${decision.id}`)}
                            searchQuery={searchQuery}
                          />
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === 'progress' && (
                    <div className="space-y-4">
                      {showNoResults ? (
                        <NoResultsState query={searchQuery} type="progress items" />
                      ) : (
                        progressResults?.map((item: any, index: number) => {
                          const id = (item.metadata && item.metadata.conport_item_id) || item.item_id || item.id;
                          return (
                            <ProgressSearchResult
                              key={id || `progress-search-${index}`}
                              item={item}
                              onClick={() => {
                                if (id) router.push(`/progress/${id}`);
                              }}
                              searchQuery={searchQuery}
                            />
                          );
                        })
                      )}
                    </div>
                  )}

                  {activeTab === 'patterns' && (
                    <div className="space-y-4">
                      {showNoResults ? (
                        <NoResultsState query={searchQuery} type="patterns" />
                      ) : (
                        patternsResults?.map((item: any, index: number) => {
                          const id = (item.metadata && item.metadata.conport_item_id) || item.item_id || item.id;
                          return (
                            <PatternSearchResult
                              key={id || `pattern-search-${index}`}
                              item={item}
                              onClick={() => {
                                if (id) router.push(`/patterns/${id}`);
                              }}
                              searchQuery={searchQuery}
                            />
                          );
                        })
                      )}
                    </div>
                  )}

                  {activeTab === 'context' && (
                    <div className="space-y-4">
                      {showNoResults ? (
                        <NoResultsState query={searchQuery} type="context items" />
                      ) : (
                        contextResults?.map((item: any, index: number) => {
                          const id = (item.metadata && item.metadata.conport_item_id) || item.item_id || item.id;
                          const rawType = (item?.metadata?.category || item?.context_type || item?.category) as string | undefined;
                          const normalizedType =
                            rawType && (['product','product_context'].includes(String(rawType)) ? 'product'
                              : (['active','active_context'].includes(String(rawType)) ? 'active' : null));
                          const path = normalizedType ? `/context/${normalizedType}` : `/context`;
                          return (
                            <ContextSearchResult
                              key={id || `context-search-${index}`}
                              item={item}
                              searchQuery={searchQuery}
                              onClick={() => router.push(path)}
                            />
                          );
                        })
                      )}
                    </div>
                  )}

                  {activeTab === 'custom' && (
                    <div className="space-y-4">
                      {showNoResults ? (
                        <NoResultsState query={searchQuery} type="custom data items" />
                      ) : (
                        customResults?.map((item: any, index: number) => {
                          const id = (item.metadata && item.metadata.conport_item_id) || item.item_id || item.id;
                          return (
                            <CustomDataSearchResult
                              key={id || `custom-search-${index}`}
                              item={item}
                              searchQuery={searchQuery}
                              onClick={() => {
                                if (id) router.push(`/custom/${id}`);
                              }}
                            />
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function SearchGuide() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
      <div className="text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Search AIMED Knowledge
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Enter a search term to find relevant information across your project
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
        <SearchTypeCard
          icon="⚡"
          title="Decisions"
          description="Search decision summaries, rationale, and implementation details"
          examples={["architecture", "database", "framework"]}
        />
        <SearchTypeCard
          icon="✅"
          title="Progress"
          description="Find task descriptions and status updates"
          examples={["completed", "bug fix", "feature"]}
        />
        <SearchTypeCard
          icon="🏗️"
          title="Patterns"
          description="Search system patterns and coding standards"
          examples={["MVC", "authentication", "validation"]}
        />
        <SearchTypeCard
          icon="🕒"
          title="Context"
          description="Search product and active context information"
          examples={["goals", "requirements", "focus"]}
        />
      </div>
    </div>
  );
}

function SearchTypeCard({ icon, title, description, examples }: {
  icon: string;
  title: string;
  description: string;
  examples: string[];
}) {
  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="text-center mb-3">
        <span className="text-2xl">{icon}</span>
      </div>
      <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-center">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 text-center">
        {description}
      </p>
      <div className="space-y-1">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Examples:</p>
        {examples.map((example) => (
          <div key={example} className="text-xs bg-gray-50 dark:bg-gray-700 rounded px-2 py-1">
            {example}
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionSearchResult({ decision, onClick, searchQuery }: {
  decision: any;
  onClick: () => void;
  searchQuery: string;
}) {
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div 
      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
            Decision #{decision.id}
          </span>
          {decision.tags?.map((tag: string) => (
            <span key={tag} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
              {tag}
            </span>
          ))}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(decision.timestamp).toLocaleDateString()}
        </span>
      </div>
      
      <h3 className="font-medium text-gray-900 dark:text-white mb-2">
        {highlightText(decision.summary, searchQuery)}
      </h3>
      
      {decision.rationale && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {highlightText(decision.rationale.substring(0, 150) + '...', searchQuery)}
        </p>
      )}
    </div>
  );
}

function ProgressSearchResult({ item, onClick, searchQuery }: {
  item: any;
  onClick: () => void;
  searchQuery: string;
}) {
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={`highlight-${index}`} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  // Handle semantic search results structure - data is in metadata
  const metadata = item.metadata || {};
  const description = metadata.description_snippet || metadata.description || 'No description available';
  const status = metadata.status || 'Unknown';
  const id = metadata.conport_item_id || item.item_id || item.id;
  const timestamp = metadata.timestamp_created || metadata.timestamp;

  return (
    <div
      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
            Progress #{id || 'N/A'}
          </span>
          {status && status !== 'Unknown' && (
            <span className={`px-2 py-1 text-xs rounded ${
              status === 'DONE' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
              status === 'IN_PROGRESS' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
              'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}>
              {status}
            </span>
          )}
        </div>
        {timestamp && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(timestamp).toLocaleDateString()}
          </span>
        )}
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
        {highlightText(description.length > 150 ? description.substring(0, 150) + '...' : description, searchQuery)}
      </p>
    </div>
  );
}

function PatternSearchResult({ item, onClick, searchQuery }: {
  item: any;
  onClick: () => void;
  searchQuery: string;
}) {
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={`pattern-highlight-${index}`} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  // Handle semantic search results structure - data is in metadata
  const metadata = item.metadata || {};
  const name = metadata.name || 'Unknown Pattern';
  const description = metadata.description_snippet || metadata.description || item.snippet || 'No description available';
  const id = metadata.conport_item_id || item.item_id || item.id;
  const tags = metadata.tags
    ? (Array.isArray(metadata.tags)
       ? metadata.tags
       : (typeof metadata.tags === 'string'
          ? metadata.tags.split(', ')
          : []))
    : []; // Handle array, string, or other types safely
  const timestamp = metadata.timestamp_created || metadata.timestamp;

  return (
    <div
      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
            Pattern #{id || 'N/A'}
          </span>
          {tags.map((tag: string, index: number) => (
            <span key={`pattern-tag-${index}-${tag}`} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
              {tag}
            </span>
          ))}
        </div>
        {timestamp && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(timestamp).toLocaleDateString()}
          </span>
        )}
      </div>
      
      <h3 className="font-medium text-gray-900 dark:text-white mb-2">
        {highlightText(name, searchQuery)}
      </h3>
      
      {description && description !== 'No description available' && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {highlightText(description.length > 150 ? description.substring(0, 150) + '...' : description, searchQuery)}
        </p>
      )}
    </div>
  );
}

function ContextSearchResult({ item, searchQuery, onClick }: {
  item: any;
  searchQuery: string;
  onClick: () => void;
}) {
  const highlightText = (text: string, query: string) => {
    if (!text || !query) return text || '';
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={`context-highlight-${index}`} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  const metadata = item?.metadata || {};
  const rawType = (metadata.category || item?.context_type || item?.category || 'context') as string;
  const normalizedType =
    ['product', 'product_context'].includes(String(rawType)) ? 'product' :
    (['active', 'active_context'].includes(String(rawType)) ? 'active' : String(rawType));
  const typeLabel = normalizedType === 'product' ? 'Product' :
                    normalizedType === 'active' ? 'Active' : 'Context';

  const title: string = (metadata.name || metadata.key || `${typeLabel} Context`) as string;

  const snippetRaw =
    metadata.description_snippet ??
    metadata.description ??
    item?.content_text_snippet ??
    (typeof item?.content_text === 'string' ? item.content_text : undefined) ??
    (metadata.content ? (typeof metadata.content === 'string' ? metadata.content : JSON.stringify(metadata.content)) : undefined) ??
    item?.snippet;

  const snippet = typeof snippetRaw === 'string'
    ? (snippetRaw.length > 150 ? `${snippetRaw.slice(0, 150)}...` : snippetRaw)
    : '';

  const timestamp = metadata.timestamp_created || metadata.timestamp || item?.timestamp_updated || item?.timestamp;

  return (
    <div
      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded">
            Context
          </span>
          {typeLabel && typeLabel !== 'Context' && (
            <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              {typeLabel}
            </span>
          )}
        </div>
        {timestamp && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(timestamp).toLocaleDateString()}
          </span>
        )}
      </div>
      
      {title && (
        <h3 className="font-medium text-gray-900 dark:text-white mb-2">
          {highlightText(title, searchQuery)}
        </h3>
      )}
      
      {snippet && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {highlightText(snippet, searchQuery)}
        </p>
      )}
    </div>
  );
}

function CustomDataSearchResult({ item, searchQuery, onClick }: {
  item: any;
  searchQuery: string;
  onClick: () => void;
}) {
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={`custom-highlight-${index}`} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  // Handle FTS results for custom data - data is in metadata
  const metadata = item.metadata || {};
  const category = metadata.category || 'Unknown Category';
  const key = metadata.key || 'Unknown Key';
  const snippet = metadata.description_snippet || 'No content available';
  const id = metadata.conport_item_id || item.item_id || item.id;
  const timestamp = metadata.timestamp_created || metadata.timestamp;

  return (
    <div
      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 rounded">
            📦 Custom #{id || 'N/A'}
          </span>
          {category && category !== 'Unknown Category' && (
            <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
              {category}
            </span>
          )}
        </div>
        {timestamp && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(timestamp).toLocaleDateString()}
          </span>
        )}
      </div>
      
      {key && key !== 'Unknown Key' && (
        <h3 className="font-medium text-gray-900 dark:text-white mb-2">
          {highlightText(key, searchQuery)}
        </h3>
      )}
      
      {snippet && snippet !== 'No content available' && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {highlightText(snippet.length > 150 ? snippet.substring(0, 150) + '...' : snippet, searchQuery)}
        </p>
      )}
    </div>
  );
}

function NoResultsState({ query, type }: { query: string; type: string }) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-4">🔍</div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        No {type} found
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        No {type} match your search for "{query}"
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
        Try different keywords or check other tabs
      </p>
    </div>
  );
}