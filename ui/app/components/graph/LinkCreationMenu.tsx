'use client';

import React from 'react';
import { EDGE_STYLES } from '../../../shared/conport/graph-types';
import { debugLog } from '../../../shared/conport/client';

type LinkCreationMenuProps = {
  visible: boolean;
  x: number;
  y: number;
  relType: string;
  onRelTypeChange: (type: string) => void;
  onCreate: () => void;
  onCancel: () => void;
};

export default function LinkCreationMenu({
  visible,
  x,
  y,
  relType,
  onRelTypeChange,
  onCreate,
  onCancel
}: LinkCreationMenuProps) {
  debugLog('🔗 LINK_CREATION_FIX: LinkCreationMenu render - props:', {
    visible,
    x,
    y,
    relType
  });
  
  if (!visible) {
    debugLog('🔗 LINK_CREATION_FIX: LinkCreationMenu not visible - returning null');
    return null;
  }

  debugLog('🔗 LINK_CREATION_FIX: LinkCreationMenu rendering at position:', { x, y });

  return (
    <div
      className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-2 z-50"
      style={{ left: x, top: y, minWidth: '260px' }}
    >
      <div className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300">
        Create relationship
      </div>
      <div className="px-4 py-2">
        <select
          value={relType}
          onChange={(e) => onRelTypeChange(e.target.value)}
          className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200"
        >
          {(Object.keys(EDGE_STYLES) as Array<keyof typeof EDGE_STYLES>).map((rt) => (
            <option key={rt as string} value={rt as string}>
              {(rt as string).replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      <div className="px-4 py-2 flex items-center gap-2">
        <button
          onClick={onCreate}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
    </div>
  );
}