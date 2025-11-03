'use client';

import React, { useState } from 'react';
import {
  NODE_STYLES,
  EDGE_STYLES,
  PROGRESS_STATUS_COLORS,
  GraphData,
  FocusMode
} from '../../../shared/conport/graph-types';

type LoadingOverlayProps = {
  isLoading: boolean;
  focusMode: FocusMode;
};

export function LoadingOverlay({ isLoading, focusMode }: LoadingOverlayProps) {
  if (!isLoading) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/30 pointer-events-none select-none">
      <div className="text-center">
        <div className="text-6xl mb-4">🕸️</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Loading Knowledge Graph...
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {focusMode.enabled
            ? `Fetching focused data (${focusMode.hopDepth} hops from ${focusMode.centerNodeId})`
            : 'Fetching AIMED data and building relationships'}
        </p>
      </div>
    </div>
  );
}

type ErrorOverlayProps = {
  error: unknown;
  onRetry?: () => void;
};

export function ErrorOverlay({ error, onRetry }: ErrorOverlayProps) {
  if (!error) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-black/50 z-10">
      <div className="text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Failed to Load Graph Data
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

type NoDataOverlayProps = {
  graphData: GraphData | null;
  isLoading: boolean;
  error: unknown;
  focusMode: FocusMode;
};

export function NoDataOverlay({ graphData, isLoading, error, focusMode }: NoDataOverlayProps) {
  if (isLoading || error) return null;
  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <div className="text-center bg-white/60 dark:bg-black/40 rounded-md px-4 py-3">
          <div className="text-4xl mb-2">📊</div>
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
            No Graph Data Available
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {focusMode.enabled
              ? `No connections found within ${focusMode.hopDepth} hops of ${focusMode.centerNodeId}`
              : 'No AIMED data found or all node types are disabled.'}
          </p>
        </div>
      </div>
    );
  }
  return null;
}

type ControlsOverlayProps = {
  nodesCount: number;
  edgesCount: number;
};

export function ControlsOverlay({ nodesCount, edgesCount }: ControlsOverlayProps) {
  return (
    <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 pointer-events-none select-none">
      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <div>🖱️ Click to select • Double-click to focus</div>
        <div>🔍 Mouse wheel to zoom • Drag to pan</div>
        <div>⚙️ Right-click an edge to edit/delete</div>
        <div>📊 {nodesCount} nodes • {edgesCount} edges</div>
      </div>
    </div>
  );
}

export function LegendOverlay() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 pointer-events-auto select-none max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-gray-900 dark:text-white">Legend</h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
        >
          {isExpanded ? 'Minimize' : 'Expand'}
        </button>
      </div>
      
      {/* Node Types - Always visible */}
      <div className="space-y-1 mb-3">
        {Object.entries(NODE_STYLES).map(([type, style]) => (
          <div key={type} className="flex items-center text-xs text-gray-600 dark:text-gray-400">
            <div
              className="w-4 h-4 rounded-full mr-2 flex items-center justify-center text-white text-xs"
              style={{ backgroundColor: style.color }}
            >
              {style.icon}
            </div>
            {type.replace('_', ' ')}
          </div>
        ))}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <>
          {/* Progress Status Colors */}
          <div className="mb-3">
            <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Progress Status</h5>
            <div className="space-y-1">
              {Object.entries(PROGRESS_STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center text-xs">
                  <div
                    className="w-3 h-3 rounded mr-2"
                    style={{ backgroundColor: color }}
                  />
                  <span style={{ color }}>{status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Edge Styles */}
          <div>
            <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Relationship Types</h5>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {Object.entries(EDGE_STYLES).map(([relationship, style]) => (
                <div key={relationship} className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                  <svg width="20" height="8" className="mr-2 flex-shrink-0">
                    <line
                      x1="0"
                      y1="4"
                      x2="20"
                      y2="4"
                      stroke={style.color}
                      strokeWidth={style.width}
                      strokeDasharray={style.dashArray}
                    />
                  </svg>
                  <span className="text-xs" style={{ color: style.color }}>
                    {relationship.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type LinkModeIndicatorProps = {
  enabled: boolean;
  sourceNodeId: string | null;
};

export function LinkModeIndicator({ enabled, sourceNodeId }: LinkModeIndicatorProps) {
  if (!enabled) return null;
  return (
    <div className="absolute top-4 right-4 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-2 rounded-lg shadow-lg">
      <div className="text-sm font-medium">Link Creation Mode</div>
      <div className="text-xs mt-1">
        {sourceNodeId ? 'Click target node to create link' : 'Click source node to start'}
      </div>
      <div className="text-[11px] mt-1 opacity-80">
        Right-click an edge to edit/delete links
      </div>
    </div>
  );
}

type SpacingControlsOverlayProps = {
  linkDistance: number;
  onLinkDistanceChange: (distance: number) => void;
  chargeStrength: number;
  onChargeStrengthChange: (strength: number) => void;
  collisionRadius: number;
  onCollisionRadiusChange: (radius: number) => void;
  clusterTightness?: number;
  onClusterTightnessChange?: (tightness: number) => void;
};

export function SpacingControlsOverlay({
  linkDistance,
  onLinkDistanceChange,
  chargeStrength,
  onChargeStrengthChange,
  collisionRadius,
  onCollisionRadiusChange,
  clusterTightness,
  onClusterTightnessChange
}: SpacingControlsOverlayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 pointer-events-auto select-none min-w-48">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-gray-900 dark:text-white">Spacing Controls</h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>
      
      {/* Always show compact controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-600 dark:text-gray-400">Distance</label>
          <input
            type="range"
            min="20"
            max="150"
            value={linkDistance}
            onChange={(e) => onLinkDistanceChange(Number(e.target.value))}
            className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <span className="text-xs text-gray-500 w-8 text-right">{linkDistance}</span>
        </div>
        
        {isExpanded && (
          <>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Repulsion</label>
              <input
                type="range"
                min="10"
                max="200"
                value={Math.abs(chargeStrength)}
                onChange={(e) => onChargeStrengthChange(-Number(e.target.value))}
                className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <span className="text-xs text-gray-500 w-8 text-right">{Math.abs(chargeStrength)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Collision</label>
              <input
                type="range"
                min="1"
                max="15"
                value={collisionRadius}
                onChange={(e) => onCollisionRadiusChange(Number(e.target.value))}
                className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <span className="text-xs text-gray-500 w-8 text-right">{collisionRadius}</span>
            </div>

            {clusterTightness !== undefined && onClusterTightnessChange && (
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600 dark:text-gray-400">Cluster</label>
                <input
                  type="range"
                  min="0.05"
                  max="0.5"
                  step="0.01"
                  value={clusterTightness}
                  onChange={(e) => onClusterTightnessChange(Number(e.target.value))}
                  className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{clusterTightness.toFixed(2)}</span>
              </div>
            )}
            
            <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <div>• Distance: space between connected nodes</div>
              <div>• Repulsion: how much nodes push apart</div>
              <div>• Collision: minimum node spacing</div>
              {clusterTightness !== undefined && (
                <div>• Cluster: initial node grouping (0.05=tight, 0.5=spread)</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}