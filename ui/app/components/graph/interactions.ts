'use client';

import type React from 'react';
import {
  GraphNode,
  FocusMode,
  NODE_STYLES
} from '../../../shared/conport/graph-types';

export type Transform = { x: number; y: number; k: number };

export type EdgeLike = {
  id: string;
  source: string | { id: string };
  target: string | { id: string };
  relationship_type?: string;
  description?: string;
  timestamp?: string;
};

export type InteractionPropsSnapshot = {
  selectedNodeId: string | null;
  focusMode: FocusMode;
  linkMode: boolean;
  linkCreationState: { sourceNodeId: string | null; isCreatingLink: boolean };
};

/**
 * Get graph-space mouse coordinates from a DOM MouseEvent
 */
export function getMousePositionFromEvent(
  canvas: HTMLCanvasElement | null,
  transform: Transform,
  event: MouseEvent
): { x: number; y: number } | null {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left - transform.x) / transform.k;
  const y = (event.clientY - rect.top - transform.y) / transform.k;
  return { x, y };
}

/**
 * Find node at a given graph-space position using circular hit test w/ node radius.
 */
export function findNodeAtPosition(nodes: GraphNode[], x: number, y: number): GraphNode | undefined {
  return nodes.find((node) => {
    if (typeof node.x !== 'number' || typeof node.y !== 'number') return false;
    const style = NODE_STYLES[node.type];
    const dx = x - node.x;
    const dy = y - node.y;
    return Math.sqrt(dx * dx + dy * dy) <= style.radius;
  });
}

/**
 * Utility: squared distance between point P and segment AB, with closest point.
 */
export function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const A = px - ax;
  const B = py - ay;
  const C = bx - ax;
  const D = by - ay;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  if (lenSq === 0) {
    // Degenerate segment
    return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  }
  const t = Math.max(0, Math.min(1, dot / lenSq));
  const xx = ax + t * C;
  const yy = ay + t * D;
  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Build list of edges to test for hit-testing:
 * - exclude hidden edges
 * - include optimistic edges that are not duplicates of visible real edges
 */
export function buildEdgesToTest(
  filteredEdges: EdgeLike[],
  hiddenEdgeIds: Set<string>,
  optimisticEdges: EdgeLike[]
): EdgeLike[] {
  const baseEdges = filteredEdges.filter((e) => !hiddenEdgeIds.has(e.id));

  const optimisticFiltered = optimisticEdges.filter((oe) => {
    const osid = typeof oe.source === 'string' ? oe.source : (oe.source?.id ?? '');
    const otid = typeof oe.target === 'string' ? oe.target : (oe.target?.id ?? '');
    return !baseEdges.some((be) => {
      const bsid = typeof be.source === 'string' ? be.source : (be.source as any)?.id;
      const btid = typeof be.target === 'string' ? be.target : (be.target as any)?.id;
      return bsid === osid && btid === otid && be.relationship_type === oe.relationship_type;
    });
  });

  return baseEdges.concat(optimisticFiltered);
}

/**
 * Find an edge near the given graph-space point within tolerance px.
 */
export function findEdgeNearPosition(
  x: number,
  y: number,
  nodes: GraphNode[],
  edgesToTest: EdgeLike[],
  tolerance: number = 10
): EdgeLike | undefined {
  return edgesToTest.find((edge) => {
    const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as any).id;
    const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as any).id;
    const sourceNode = nodes.find((n) => n.id === sourceId);
    const targetNode = nodes.find((n) => n.id === targetId);
    if (
      !sourceNode ||
      !targetNode ||
      typeof sourceNode.x !== 'number' ||
      typeof sourceNode.y !== 'number' ||
      typeof targetNode.x !== 'number' ||
      typeof targetNode.y !== 'number'
    ) {
      return false;
    }

    const dist = pointToSegmentDistance(x, y, sourceNode.x, sourceNode.y, targetNode.x, targetNode.y);
    return dist <= tolerance;
  });
}

/**
 * Helper to normalize node/edge id extraction
 */
export function getId(value: string | { id: string } | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : (value.id ?? '');
}

/**
 * Create a resolver that attempts to extract a real numeric link id from an edge-like object.
 * Returns null if not resolvable.
 */
export function makeRealLinkIdResolver(
  stableEdgesRef: React.MutableRefObject<Map<string, any>>
): (edge: EdgeLike) => number | null {
  const isRealLinkId = (id: string) => /^link-\d+$/.test(id);

  return (edge: EdgeLike): number | null => {
    try {
      if (edge.id && isRealLinkId(edge.id)) {
        const n = parseInt(edge.id.replace('link-', ''), 10);
        return Number.isFinite(n) ? n : null;
      }
      // fallback: find matching real edge by endpoints + relationship
      const sid = getId(edge.source);
      const tid = getId(edge.target);
      for (const e of Array.from(stableEdgesRef.current.values()) as any[]) {
        const esid = getId(e.source);
        const etid = getId(e.target);
        if (esid === sid && etid === tid && e.relationship_type === edge.relationship_type && isRealLinkId(e.id)) {
          const n = parseInt(String(e.id).replace('link-', ''), 10);
          return Number.isFinite(n) ? n : null;
        }
      }
    } catch {
      // ignore
    }
    return null;
  };
}