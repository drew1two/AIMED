'use client';

import type React from 'react';
import {
  GraphNode,
  GraphEdge,
  NODE_STYLES,
  PROGRESS_STATUS_COLORS,
  RelationshipType,
  FocusMode,
  EDGE_STYLES
} from '../../../shared/conport/graph-types';

export type DrawerDeps = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  filteredDataRef: React.MutableRefObject<{ nodes: GraphNode[]; edges: any[] }>;
  hiddenEdgeIdsRef: React.MutableRefObject<Set<string>>;
  optimisticEdgesRef: React.MutableRefObject<any[]>;
  propsRef: React.MutableRefObject<{
    selectedNodeId: string | null;
    focusMode: FocusMode;
    linkMode: boolean;
    linkCreationState: { sourceNodeId: string | null; isCreatingLink: boolean };
    searchMatchingIds: Set<string>;
  }>;
  transformRef: React.MutableRefObject<{ x: number; y: number; k: number }>;
};

/**
 * Factory returning a stable draw function that renders the graph to canvas.
 * Reads current data and UI state from provided refs to avoid stale closures.
 */
export function createDrawer(deps: DrawerDeps) {
  return function drawGraph() {
    const canvas = deps.canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const { nodes, edges } = deps.filteredDataRef.current;
    const baseEdges = (edges as any[]).filter((e: any) => !deps.hiddenEdgeIdsRef.current.has((e as any).id));

    // Avoid drawing duplicate optimistic edges when a real edge with same endpoints+relationship exists
    const optimisticFiltered = (deps.optimisticEdgesRef.current as any[]).filter((oe: any) => {
      const osid = typeof oe.source === 'string' ? oe.source : (oe.source as any)?.id;
      const otid = typeof oe.target === 'string' ? oe.target : (oe.target as any)?.id;
      return !baseEdges.some((be: any) => {
        const bsid = typeof be.source === 'string' ? be.source : (be.source as any)?.id;
        const btid = typeof be.target === 'string' ? be.target : (be.target as any)?.id;
        return bsid === osid && btid === otid && be.relationship_type === oe.relationship_type;
      });
    });
    const edgesToDraw = (baseEdges as any[]).concat(optimisticFiltered);

    const {
      selectedNodeId,
      focusMode,
      linkMode: currentLinkMode,
      linkCreationState: currentLinkCreationState,
      searchMatchingIds
    } = deps.propsRef.current;

    // Clear canvas
    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transform
    const transform = deps.transformRef.current;
    context.translate(transform.x, transform.y);
    context.scale(transform.k, transform.k);

    // Draw edges first
    edgesToDraw.forEach(edge => {
      const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as any).id;
      const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as any).id;

      const sourceNode = nodes.find(n => n.id === sourceId);
      const targetNode = nodes.find(n => n.id === targetId);

      if (!sourceNode || !targetNode || !sourceNode.x || !sourceNode.y || !targetNode.x || !targetNode.y) return;

      const edgeStyle = EDGE_STYLES[(edge.relationship_type as RelationshipType)] ?? EDGE_STYLES['related_to'];

      context.strokeStyle = edgeStyle.color;
      context.lineWidth = edgeStyle.width;

      if (edgeStyle.dashArray) {
        const dashArray = edgeStyle.dashArray.split(',').map(Number);
        context.setLineDash(dashArray);
      } else {
        context.setLineDash([]);
      }

      context.beginPath();
      context.moveTo(sourceNode.x!, sourceNode.y!);
      context.lineTo(targetNode.x!, targetNode.y!);
      context.stroke();
    });

    // Draw nodes
    nodes.forEach(node => {
      if (!node.x || !node.y) return;

      const style = NODE_STYLES[node.type];
      const isSelected = selectedNodeId === node.id;
      const isFocusCenter = focusMode.enabled && focusMode.centerNodeId === node.id;
      const isLinkSource = currentLinkCreationState.sourceNodeId === node.id;
      const isSearchMatch = searchMatchingIds.has(node.id);

      // Node color (different for progress status)
      let fillColor = style.color;
      if (node.type === 'progress') {
        const status = (node as any).status as import('../../../shared/conport/graph-types').ProgressStatus;
        fillColor = PROGRESS_STATUS_COLORS[status];
      }

      // Special styling for various states (order matters - later styles override earlier ones)
      let strokeColor = style.strokeColor;
      let lineWidth = style.strokeWidth;

      if (isSearchMatch) {
        strokeColor = '#F59E0B'; // Amber for search matches
        lineWidth = 3;
      }
      if (isSelected) {
        strokeColor = '#FF6B35'; // Orange for selected (overrides search)
        lineWidth = 3;
      } else if (isFocusCenter) {
        strokeColor = '#10B981'; // Green for focus center (overrides search)
        lineWidth = 3;
      } else if (isLinkSource) {
        strokeColor = '#DC2626'; // Red for link source (highest priority)
        lineWidth = 4;
      }

      // Draw node circle
      context.fillStyle = fillColor;
      context.strokeStyle = strokeColor;
      context.lineWidth = lineWidth;

      context.beginPath();
      context.arc(node.x, node.y, style.radius, 0, 2 * Math.PI);
      context.fill();
      context.stroke();

      // Draw icon (simplified - using text)
      context.fillStyle = 'white';
      context.font = `${style.radius}px system-ui`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(style.icon, node.x, node.y);

      // Draw label
      context.fillStyle = '#374151';
      context.font = '12px system-ui';
      context.textAlign = 'center';
      context.textBaseline = 'top';

      const label = node.title.length > 30 ? node.title.substring(0, 30) + '...' : node.title;
      context.fillText(label, node.x, node.y + style.radius + 5);

      // Draw link creation indicator
      if (isLinkSource && currentLinkCreationState.isCreatingLink) {
        context.fillStyle = 'rgba(220, 38, 38, 0.2)';
        context.beginPath();
        context.arc(node.x, node.y, style.radius + 8, 0, 2 * Math.PI);
        context.fill();
      }
    });

    context.restore();
  };
}