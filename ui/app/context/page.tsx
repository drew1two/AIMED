"use client";

import { useRouter } from 'next/navigation';
import { useProductContext, useActiveContext } from '@/shared/conport/hooks';

export default function ContextPage() {
  const router = useRouter();
  const { data: productContext, isLoading: productLoading } = useProductContext();
  const { data: activeContext, isLoading: activeLoading } = useActiveContext();

  if (productLoading || activeLoading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Context Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage project and session context information
          </p>
        </div>

        {/* Context Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Context Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <span className="text-xl">🏗️</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Product Context
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Project goals, features, and architecture
                  </p>
                </div>
              </div>
            </div>

            <div
              className="space-y-3 cursor-pointer"
              onClick={() => router.push('/context/product')}
            >
              {productContext && Object.keys(productContext).length > 0 ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {Object.keys(productContext).slice(0, 3).map((key) => (
                      <div key={key} className="flex">
                        <span className="text-gray-500 dark:text-gray-400 font-medium min-w-0 flex-shrink-0 mr-2">
                          {key}:
                        </span>
                        <span className="text-gray-700 dark:text-gray-300 truncate">
                          {typeof productContext[key] === 'string' 
                            ? productContext[key].substring(0, 60) + (productContext[key].length > 60 ? '...' : '')
                            : JSON.stringify(productContext[key]).substring(0, 60) + '...'
                          }
                        </span>
                      </div>
                    ))}
                    {Object.keys(productContext).length > 3 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        +{Object.keys(productContext).length - 3} more fields
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No product context defined yet
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Status: {productContext ? 'Configured' : 'Not Set'}
              </span>
              <button
                onClick={() => router.push('/context/product')}
                className="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
              >
                View Details
              </button>
            </div>
          </div>

          {/* Active Context Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <span className="text-xl">⚡</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Active Context
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Current focus and session state
                  </p>
                </div>
              </div>
            </div>

            <div
              className="space-y-3 cursor-pointer"
              onClick={() => router.push('/context/active')}
            >
              {activeContext && Object.keys(activeContext).length > 0 ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {Object.keys(activeContext).slice(0, 3).map((key) => (
                      <div key={key} className="flex">
                        <span className="text-gray-500 dark:text-gray-400 font-medium min-w-0 flex-shrink-0 mr-2">
                          {key}:
                        </span>
                        <span className="text-gray-700 dark:text-gray-300 truncate">
                          {typeof activeContext[key] === 'string' 
                            ? activeContext[key].substring(0, 60) + (activeContext[key].length > 60 ? '...' : '')
                            : JSON.stringify(activeContext[key]).substring(0, 60) + '...'
                          }
                        </span>
                      </div>
                    ))}
                    {Object.keys(activeContext).length > 3 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        +{Object.keys(activeContext).length - 3} more fields
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No active context defined yet
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Status: {activeContext ? 'Active' : 'Not Set'}
              </span>
              <button
                onClick={() => router.push('/context/active')}
                className="text-green-600 dark:text-green-400 font-medium hover:text-green-700 dark:hover:text-green-300 cursor-pointer"
              >
                View Details
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Context Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => router.push('/context/product')}
                className="flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
              >
                <span className="text-lg">📝</span>
                Edit Product Context
              </button>
              <button
                onClick={() => router.push('/context/active')}
                className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer"
              >
                <span className="text-lg">⚡</span>
                Update Active Context
              </button>
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              >
                <span className="text-lg">📊</span>
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-400 mt-4">Loading context information...</p>
      </div>
    </div>
  );
}