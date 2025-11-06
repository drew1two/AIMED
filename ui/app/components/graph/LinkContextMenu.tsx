'use client';

import React, { useState, useEffect } from 'react';
import { EDGE_STYLES } from '../../../shared/conport/graph-types';
import { debugLog } from '../../../shared/conport/client';

export type LinkContextMenuEdge = {
  id: string;
  source: string | { id: string };
  target: string | { id: string };
  relationship_type: string;
  description?: string;
};

type LinkContextMenuProps = {
  visible: boolean;
  x: number;
  y: number;
  // If multiple edges are near the click, provide them here to let user pick one
  edges: LinkContextMenuEdge[] | null;
  // If a single edge is selected for edit/delete, provide it here
  linkData: LinkContextMenuEdge | null;
  // Current relationship type selection
  editRelType?: string;
  onChangeRelType?: (rel: string) => void;

  // Link creation mode support
  linkMode?: boolean;
  sourceNodeId?: string | null;
  targetNodeId?: string | null;
  onCreateLink?: (relationshipType: string, description?: string) => void;

  // Callbacks
  onSelectEdge: (edge: LinkContextMenuEdge) => void;
  onSave: (description?: string) => void;
  onCancel: () => void;
  onDelete: () => void;
};

export default function LinkContextMenu({
  visible,
  x,
  y,
  edges,
  linkData,
  editRelType,
  onChangeRelType,
  linkMode,
  sourceNodeId,
  targetNodeId,
  onCreateLink,
  onSelectEdge,
  onSave,
  onCancel,
  onDelete
}: LinkContextMenuProps) {
  const [localRel, setLocalRel] = useState<string>(editRelType || 'relates_to');
  const [localDescription, setLocalDescription] = useState<string>(linkData?.description || '');
  // Initialize with the first relationship type from EDGE_STYLES instead of hardcoding 'relates_to'
  const [createLinkRel, setCreateLinkRel] = useState<string>(() => {
    const firstRelType = Object.keys(EDGE_STYLES)[0];
    return firstRelType || 'relates_to';
  });
  const [createLinkDescription, setCreateLinkDescription] = useState<string>('');

  useEffect(() => {
    setLocalRel(editRelType || (linkData?.relationship_type ?? 'relates_to'));
    setLocalDescription(linkData?.description || '');
  }, [editRelType, linkData]);

  if (!visible) return null;

  const getNodeId = (node: string | { id: string }) =>
    typeof node === 'string' ? node : (node?.id ?? '');

  debugLog('🔗 LINK_CREATION_FIX: LinkContextMenu render - linkMode:', linkMode, 'sourceNodeId:', sourceNodeId, 'targetNodeId:', targetNodeId);

  return (
    <div
      className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-2 z-50"
      style={{ left: x, top: y, minWidth: '220px' }}
    >
      {/* Link Creation Mode - Complete (both nodes selected) */}
      {linkMode && sourceNodeId && targetNodeId && onCreateLink ? (
        <>
          <div className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300">
            Create Link: {sourceNodeId} → {targetNodeId}
          </div>
          <div className="px-4 py-2 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Relationship Type
              </label>
              <select
                value={createLinkRel}
                onChange={(e) => setCreateLinkRel(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200"
              >
                {(Object.keys(EDGE_STYLES) as Array<keyof typeof EDGE_STYLES>).map((rt) => (
                  <option key={rt as string} value={rt as string}>
                    {(rt as string).replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (optional)
              </label>
              <textarea
                value={createLinkDescription}
                onChange={(e) => setCreateLinkDescription(e.target.value)}
                placeholder="Describe the relationship..."
                className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 resize-none"
                rows={2}
              />
            </div>
          </div>
          <div className="px-4 py-2 flex items-center gap-2">
            <button
              onClick={() => onCreateLink && onCreateLink(createLinkRel, createLinkDescription || undefined)}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Create Link
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </>
      ) : null}

      {/* Link Creation Mode - Source Selected (waiting for target) */}
      {linkMode && sourceNodeId && !targetNodeId ? (
        <>
          <div className="px-4 py-2 text-xs font-medium text-blue-700 dark:text-blue-300">
            ✓ Selected: {sourceNodeId}
          </div>
          <div className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
            Now right-click the target node to create a link
          </div>
          <div className="px-4 py-2">
            <button
              onClick={onCancel}
              className="w-full px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel Selection
            </button>
          </div>
        </>
      ) : null}

      {/* Multi-edge selection list */}
      {!(linkMode && sourceNodeId && targetNodeId) && edges && !linkData ? (
        <div className="max-h-64 overflow-y-auto">
          <div className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300">
            Select a link
          </div>
          {edges.map((edge) => {
            const sid = getNodeId(edge.source);
            const tid = getNodeId(edge.target);
            return (
              <button
                key={edge.id}
                onClick={() => onSelectEdge(edge)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {sid} → {tid} ({edge.relationship_type})
              </button>
            );
          })}
          <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
          <button
            onClick={onCancel}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {/* Single-edge actions with relationship dropdown */}
      {!(linkMode && sourceNodeId && targetNodeId) && linkData ? (
        <>
          <div className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300">
            Edit relationship
          </div>
          <div className="px-4 py-2 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Relationship Type
              </label>
              <select
                value={localRel || linkData.relationship_type}
                onChange={(e) => {
                  setLocalRel(e.target.value);
                  onChangeRelType?.(e.target.value);
                }}
                className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200"
              >
                {(Object.keys(EDGE_STYLES) as Array<keyof typeof EDGE_STYLES>).map((rt) => (
                  <option key={rt as string} value={rt as string}>
                    {(rt as string).replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (optional)
              </label>
              <textarea
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                placeholder="Describe the relationship..."
                className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 resize-none"
                rows={2}
              />
            </div>
          </div>
          <div className="px-4 py-2 flex items-center gap-2">
            <button
              onClick={() => onSave(localDescription || undefined)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={onDelete}
              className="ml-auto px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              Delete
            </button>
          </div>
          {linkData.description && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                {linkData.description.length > 80
                  ? linkData.description.substring(0, 80) + '...'
                  : linkData.description}
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}