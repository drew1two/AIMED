'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GraphNode } from '../../../shared/conport/graph-types';

interface SearchOverlayProps {
  nodes: GraphNode[];
  onSearchResults: (matchingNodeIds: Set<string>) => void;
  onClearSearch: () => void;
  onSelectNode?: (nodeId: string) => void;
  onCenterNode?: (nodeId: string) => void;
}

export function SearchOverlay({ nodes, onSearchResults, onClearSearch, onSelectNode, onCenterNode }: SearchOverlayProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  // Draggable state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 }); // Ref for immediate synchronous access
  const overlayRef = useRef<HTMLDivElement>(null);

  // Search logic - matches across multiple node fields
  const performSearch = useCallback((query: string): Set<string> => {
    if (!query.trim()) {
      return new Set();
    }

    const lowerQuery = query.toLowerCase();
    const matchingIds = new Set<string>();

    nodes.forEach(node => {
      let matches = false;

      // Search in title (all nodes have this)
      if (node.title.toLowerCase().includes(lowerQuery)) {
        matches = true;
      }

      // Search in description (if exists)
      if (node.description && node.description.toLowerCase().includes(lowerQuery)) {
        matches = true;
      }

      if (matches) {
        matchingIds.add(node.id);
      }
    });

    return matchingIds;
  }, [nodes]);

  // Handle search input changes with real-time results
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    
    const matchingIds = performSearch(query);
    onSearchResults(matchingIds);
    setShowResults(query.trim().length > 0 && matchingIds.size > 0);
  }, [performSearch, onSearchResults]);

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    onSearchResults(new Set());
    onClearSearch();
    setShowResults(false);
  }, [onSearchResults, onClearSearch]);

  // Handle node selection from results list
  const handleNodeSelect = useCallback((nodeId: string) => {
    // Keep all search results highlighted (don't change the search highlighting)
    // const matchingIds = performSearch(searchQuery);
    // onSearchResults(matchingIds); // Keep all search results highlighted
    
    // Select the node in the main interface
    if (onSelectNode) {
      onSelectNode(nodeId);
    }
    // Center the view on this node
    if (onCenterNode) {
      onCenterNode(nodeId);
    }
    // Keep the results dropdown visible so user can click other results
    // setShowResults(false); // Don't hide the results
  }, [onSelectNode, onCenterNode]);

  // Keyboard shortcut to toggle search (Ctrl/Cmd + F)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        setIsVisible(true);
      }
      if (event.key === 'Escape' && isVisible) {
        event.preventDefault();
        setIsVisible(false);
        handleClearSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, handleClearSearch]);

  // Draggable functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!overlayRef.current) return;
    
    setIsDragging(true);
    const rect = overlayRef.current.getBoundingClientRect();
    
    // FIXED: Proper handling of transition from CSS-positioned to absolute-positioned
    // On first drag, position.x/y are 0, but we need to use the actual current position
    let currentX, currentY;
    
    if (position.x !== 0 || position.y !== 0) {
      // Already been dragged before - use stored position
      currentX = position.x;
      currentY = position.y;
    } else {
      // First drag - overlay is CSS positioned, use actual current screen position
      currentX = rect.left;
      currentY = rect.top;
    }
    
    const dragStartValues = {
      x: e.clientX - currentX,
      y: e.clientY - currentY
    };
    
    // CRITICAL FIX: Use ref for immediate synchronous update
    dragStartRef.current = dragStartValues;
    setDragStart(dragStartValues); // Keep state in sync for other purposes
    
    // Prevent text selection during drag
    e.preventDefault();
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !overlayRef.current) return;
    
    // CRITICAL FIX: Use ref value for immediate access during drag
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    
    // Constrain to viewport bounds
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const overlayWidth = 320; // w-80 = 320px
    const overlayHeight = overlayRef.current.getBoundingClientRect().height;
    
    // CRITICAL FIX: Account for CSS vs actual positioning offset
    // When position.y is 0, CSS uses top: 64px but element renders at different position
    // We need to adjust newY to account for this offset
    const cssTop = 64; // Hard-coded CSS top value when position.y === 0
    const actualTop = overlayRef.current?.getBoundingClientRect().top || 0;
    const cssOffset = position.y === 0 ? (actualTop - cssTop) : 0;
    
    const adjustedY = newY - cssOffset;
    
    const constrainedPosition = {
      x: Math.max(0, Math.min(newX, viewportWidth - overlayWidth)),
      y: Math.max(0, Math.min(adjustedY, viewportHeight - overlayHeight))
    };
    
    setPosition(constrainedPosition);
  }, [isDragging]); // Remove dragStart dependency since we use ref

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <>
      {/* Toggle button - positioned to not interfere with existing UI */}
      <div className="absolute top-4 right-80 z-10">
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow text-sm font-medium text-gray-700 dark:text-gray-200"
          title="Search nodes (Ctrl+F)"
        >
          🔍 Search
        </button>
      </div>

      {/* Search overlay - draggable with fixed width */}
      {isVisible && (
        <div
          ref={overlayRef}
          className="absolute z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg w-80"
          style={{
            left: position.x !== 0 ? position.x : 'auto',
            top: position.y !== 0 ? position.y : 64, // 16 * 4 = 64px from top
            right: position.x !== 0 ? 'auto' : 320, // 80 * 4 = 320px from right
            cursor: isDragging ? 'grabbing' : 'default'
          }}
        >
          <div
            className="flex items-center gap-2 p-4 pb-3 cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
          >
            <h3 className="font-medium text-gray-900 dark:text-gray-100">🔍 Search Graph</h3>
            <div className="text-xs text-gray-500 dark:text-gray-400 ml-1">(drag to move)</div>
            <button
              onClick={() => {setIsVisible(false); handleClearSearch();}}
              className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              title="Close search"
            >
              ✕
            </button>
          </div>
          
          <div className="px-4 pb-4">
          
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search nodes by title, description, tags..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Search results list */}
            {showResults && (
              <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700">
                {Array.from(performSearch(searchQuery)).map(nodeId => {
                  const node = nodes.find(n => n.id === nodeId);
                  if (!node) return null;
                  
                  return (
                    <button
                      key={nodeId}
                      onClick={() => handleNodeSelect(nodeId)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-600"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{node.type === 'decision' ? '📋' : node.type === 'progress' ? '📈' : node.type === 'system_pattern' ? '🔧' : '📄'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {node.title}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                            {node.type.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {searchQuery && !showResults && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {performSearch(searchQuery).size} node(s) found
              </div>
            )}

            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              <div>• Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+F</kbd> to open search</div>
              <div>• Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Esc</kbd> to close</div>
              {showResults && <div>• Click a result to center and highlight it</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}