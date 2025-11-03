"use client";

import { useRouter } from 'next/navigation';
import { useState, useEffect, use } from 'react';
import { getConportClient } from '../../../shared/conport/client';

export default function LinkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const linkId = parseInt(id);
  
  const [link, setLink] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // Fetch real link data from ConPort
    const fetchLinkData = async () => {
      try {
        setIsLoading(true);
        setIsError(false);
        
        const client = getConportClient();
        // Get recent activity summary which includes links
        const activity = await client.getRecentActivitySummary({ limit_per_type: 100 });
        
        let foundLink = null;
        if (activity?.recent_links_created) {
          foundLink = activity.recent_links_created.find((l: any) => l.id === linkId);
        }
        
        if (foundLink) {
          setLink(foundLink);
        } else {
          // Link not found in database
          setLink(null);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch link data:', error);
        setIsError(true);
        setIsLoading(false);
      }
    };

    if (!isNaN(linkId)) {
      fetchLinkData();
    } else {
      setIsLoading(false);
      setIsError(true);
    }
  }, [linkId]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState error={null} />;
  }

  if (!link) {
    return <NotFoundState type="Link" id={id} />;
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
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Link Detail
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Link #{link.id}
            </p>
          </div>
        </div>

        {/* Link Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <span className="px-3 py-2 text-sm bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-lg font-medium">
              {link.relationship_type}
            </span>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(link.timestamp).toLocaleString()}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Relationship
              </h3>
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
                <div className="flex items-center justify-center space-x-4">
                  <div className="text-center">
                    <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-lg font-medium">
                      {link.source_item_type}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      #{link.source_item_id}
                    </div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="text-2xl">→</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">
                      {link.relationship_type}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-4 py-2 rounded-lg font-medium">
                      {link.target_item_type}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      #{link.target_item_id}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {link.description && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Description
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {link.description}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Source Item
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Type: </span>
                    <span className="text-gray-900 dark:text-white">{link.source_item_type}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">ID: </span>
                    <span className="text-gray-900 dark:text-white">#{link.source_item_id}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Target Item
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Type: </span>
                    <span className="text-gray-900 dark:text-white">{link.target_item_type}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">ID: </span>
                    <span className="text-gray-900 dark:text-white">#{link.target_item_id}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Link Details
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Link ID: </span>
                  <span className="text-gray-900 dark:text-white">#{link.id}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Created: </span>
                  <span className="text-gray-900 dark:text-white">
                    {new Date(link.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Time: </span>
                  <span className="text-gray-900 dark:text-white">
                    {new Date(link.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
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
        <p className="text-gray-600 dark:text-gray-400 mt-2">Loading link details...</p>
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
          Error Loading Link
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error?.message || 'Failed to load link details'}
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