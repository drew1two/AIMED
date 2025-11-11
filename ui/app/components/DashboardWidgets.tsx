"use client";

import React, { useState } from 'react';

// Micro-metrics Widget Component
export function MicroMetricsWidget({ activity }: { activity: any }) {
  // Calculate progress metrics
  const progressData = activity?.recent_progress_entries || [];
  const doneCount = progressData.filter((item: any) => item.status === 'DONE').length;
  const inProgressCount = progressData.filter((item: any) => item.status === 'IN_PROGRESS').length;
  const todoCount = progressData.filter((item: any) => item.status === 'TODO').length;
  const totalCount = progressData.length;
  
  const completionRatio = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const inProgressRatio = totalCount > 0 ? (inProgressCount / totalCount) * 100 : 0;
  
  // Calculate activity metrics
  const decisionCount = (activity?.recent_decisions || []).length;
  const progressCount = (activity?.recent_progress_entries || []).length;
  const patternCount = (activity?.recent_system_patterns || []).length;
  const customDataCount = (activity?.recent_custom_data || []).length;
  const linkCount = (activity?.recent_links_created || []).length;
  
  return (
    <div className="lg:col-span-2 xl:col-span-1">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📊 Micro-metrics
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Progress Ring */}
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-2">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 32 32">
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-gray-200 dark:text-gray-700"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 14}`}
                  strokeDashoffset={`${2 * Math.PI * 14 * (1 - completionRatio / 100)}`}
                  className="text-green-500 transition-all duration-300"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  {Math.round(completionRatio)}%
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Completion</p>
          </div>
          
          {/* Status Distribution */}
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <div className="flex space-x-1">
                <div className="w-3 h-8 bg-green-500 rounded-sm" title={`Done: ${doneCount}`}></div>
                <div className="w-3 h-6 bg-yellow-500 rounded-sm" title={`In Progress: ${inProgressCount}`}></div>
                <div className="w-3 h-4 bg-gray-400 rounded-sm" title={`Todo: ${todoCount}`}></div>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Progress Status Split</p>
          </div>
          
          {/* Activity Sparklines */}
          <div className="text-center">
            <div className="flex justify-center items-end space-x-1 mb-2 h-8">
              <div className="w-2 bg-blue-400 rounded-sm" style={{ height: `${Math.max(4, (decisionCount / Math.max(decisionCount, progressCount, patternCount, customDataCount, linkCount, 1)) * 32)}px` }} title={`Decisions: ${decisionCount}`}></div>
              <div className="w-2 bg-green-400 rounded-sm" style={{ height: `${Math.max(4, (progressCount / Math.max(decisionCount, progressCount, patternCount, customDataCount, linkCount, 1)) * 32)}px` }} title={`Progress: ${progressCount}`}></div>
              <div className="w-2 bg-orange-400 rounded-sm" style={{ height: `${Math.max(4, (patternCount / Math.max(decisionCount, progressCount, patternCount, customDataCount, linkCount, 1)) * 32)}px` }} title={`Patterns: ${patternCount}`}></div>
              <div className="w-2 bg-pink-400 rounded-sm" style={{ height: `${Math.max(4, (customDataCount / Math.max(decisionCount, progressCount, patternCount, customDataCount, linkCount, 1)) * 32)}px` }} title={`Custom Data: ${customDataCount}`}></div>
              <div className="w-2 bg-purple-400 rounded-sm" style={{ height: `${Math.max(4, (linkCount / Math.max(decisionCount, progressCount, patternCount, customDataCount, linkCount, 1)) * 32)}px` }} title={`Links: ${linkCount}`}></div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Activity</p>
          </div>
          
          {/* Quick Stats */}
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {totalCount}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Total Tasks</p>
          </div>
        </div>
        
        {/* Activity Summary */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="font-semibold text-green-600 dark:text-green-400">{doneCount}</div>
              <div className="text-gray-500">Done</div>
            </div>
            <div>
              <div className="font-semibold text-yellow-600 dark:text-yellow-400">{inProgressCount}</div>
              <div className="text-gray-500">Active</div>
            </div>
            <div>
              <div className="font-semibold text-gray-600 dark:text-gray-400">{todoCount}</div>
              <div className="text-gray-500">Todo</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tag Heatmap Widget Component  
export function TagHeatmapWidget({ 
  activity, 
  pollingEnabled, 
  pollingInterval, 
  onPollingToggle, 
  onPollingIntervalChange 
}: { 
  activity: any;
  pollingEnabled: boolean;
  pollingInterval: number;
  onPollingToggle: (enabled: boolean) => void;
  onPollingIntervalChange: (interval: number) => void;
}) {
  // Aggregate all tags from decisions and patterns
  const tagCounts = new Map<string, number>();
  
  // Count tags from decisions
  activity?.recent_decisions?.forEach((decision: any) => {
    decision.tags?.forEach((tag: string) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  
  // Count tags from patterns
  activity?.recent_system_patterns?.forEach((pattern: any) => {
    pattern.tags?.forEach((tag: string) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  const sortedTags = Array.from(tagCounts.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 20); // Show top 20 tags

  const maxCount = Math.max(...Array.from(tagCounts.values()));

  return (
    <div className="lg:col-span-2 xl:col-span-1">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Tag Frequency Heatmap
        </h3>
        <div className="flex flex-wrap gap-2">
          {sortedTags.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No tags found</p>
          ) : (
            sortedTags.map(([tag, count]) => {
              const intensity = count / maxCount;
              const opacity = Math.max(0.3, intensity);
              return (
                <span
                  key={tag}
                  className="px-3 py-1 text-xs rounded-full cursor-pointer hover:scale-105 transition-transform"
                  style={{
                    backgroundColor: `rgba(59, 130, 246, ${opacity})`,
                    color: intensity > 0.6 ? 'white' : '#1f2937'
                  }}
                  title={`${tag}: ${count} uses`}
                >
                  {tag} ({count})
                </span>
              );
            })
          )}
        </div>
        
        {/* Polling Controls */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={pollingEnabled}
                  onChange={(e) => onPollingToggle(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500"
                />
                Auto-refresh
              </label>
              {pollingEnabled && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  Every {pollingInterval / 1000}s
                </span>
              )}
              {!pollingEnabled && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  Paused
                </span>
              )}
            </div>
            
            {pollingEnabled && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">
                  Interval:
                </label>
                <select
                  value={pollingInterval}
                  onChange={(e) => onPollingIntervalChange(parseInt(e.target.value))}
                  className="text-xs px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                >
                  <option value={1000}>1s</option>
                  <option value={3000}>3s</option>
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                  <option value={30000}>30s</option>
                  <option value={60000}>1m</option>
                </select>
              </div>
            )}
          </div>
          
          <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
            <div>Period: {activity?.summary_period_start && formatDate(activity.summary_period_start)} - {activity?.summary_period_end && formatDate(activity.summary_period_end)}</div>
            <div>Last updated: {new Date().toLocaleTimeString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Utility function
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}