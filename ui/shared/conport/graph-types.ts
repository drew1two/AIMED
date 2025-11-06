/**
 * Graph Data Model for ConPort Knowledge Graph Visualization
 *
 * This module defines the data structures for visualizing ConPort entities
 * and their relationships as an interactive knowledge graph.
 */

import { SimulationNodeDatum } from 'd3-force';
import { debugWarn } from './client';

// Base node interface that all node types extend
export interface BaseGraphNode extends SimulationNodeDatum {
  id: string;           // Unique identifier (e.g., "decision-12", "progress-16")
  type: NodeType;       // The type of ConPort entity
  title: string;        // Display name/summary
  description?: string; // Longer description for details view
  timestamp: string;    // ISO timestamp of creation
  x?: number;          // Layout position X (for D3.js)
  y?: number;          // Layout position Y (for D3.js)
  fx?: number;         // Fixed X position (for dragging)
  fy?: number;         // Fixed Y position (for dragging)
}

// Specific node types with their unique properties
export interface DecisionNode extends BaseGraphNode {
  type: 'decision';
  summary: string;
  rationale?: string;
  implementation_details?: string;
  tags: string[];
}

export interface ProgressNode extends BaseGraphNode {
  type: 'progress';
  status: ProgressStatus;
  parent_id?: number;  // For hierarchical progress tracking
  tags?: string[];
}

export interface SystemPatternNode extends BaseGraphNode {
  type: 'system_pattern';
  name: string;
  tags: string[];
}

export interface CustomDataNode extends BaseGraphNode {
  type: 'custom_data';
  category: string;
  key: string;
  value: any;
}

// Union type for all possible nodes
export type GraphNode = DecisionNode | ProgressNode | SystemPatternNode | CustomDataNode;

// Node type enum
export type NodeType = 'decision' | 'progress' | 'system_pattern' | 'custom_data';

// Progress status enum
export type ProgressStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

// Graph edge representing relationships between nodes
export interface GraphEdge {
  id: string;                    // Unique edge ID
  source: string;               // Source node ID
  target: string;               // Target node ID
  relationship_type: RelationshipType;
  description?: string;         // Optional edge description
  timestamp: string;           // When the relationship was created
}

// Relationship types from ConPort (aligned with mem4sprint schema)
export type RelationshipType =
  | 'blocked_by'
  | 'documented_in'
  | 'builds_on'
  | 'implements'
  | 'verifies'
  | 'depends_on'
  | 'produces'
  | 'consumes'
  | 'derived_from'
  | 'related_to'
  | 'clarifies'
  | 'resolves'
  | 'tracks';

// Complete graph data structure
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Node visual styling configuration
export interface NodeStyle {
  radius: number;
  color: string;
  icon: string;
  strokeColor: string;
  strokeWidth: number;
}

// Visual configuration for different node types
export const NODE_STYLES: Record<NodeType, NodeStyle> = {
  decision: {
    radius: 20,
    color: '#3B82F6',      // Blue
    icon: '📋',
    strokeColor: '#1E40AF',
    strokeWidth: 2
  },
  progress: {
    radius: 18,
    color: '#10B981',      // Green
    icon: '📈',
    strokeColor: '#059669',
    strokeWidth: 2
  },
  system_pattern: {
    radius: 22,
    color: '#8B5CF6',      // Purple
    icon: '🔧',
    strokeColor: '#7C3AED',
    strokeWidth: 2
  },
  custom_data: {
    radius: 16,
    color: '#06B6D4',      // Cyan (was Amber - changed to avoid conflict with IN_PROGRESS)
    icon: '📄',
    strokeColor: '#0891B2',
    strokeWidth: 2
  }
};

// Progress status visual styling
export const PROGRESS_STATUS_COLORS: Record<ProgressStatus, string> = {
  'TODO': '#6B7280',       // Gray
  'IN_PROGRESS': '#F59E0B', // Amber
  'DONE': '#10B981'        // Green
};

// Relationship type visual styling
export interface EdgeStyle {
  color: string;
  width: number;
  dashArray?: string;
}

export const EDGE_STYLES: Record<RelationshipType, EdgeStyle> = {
  blocked_by: { color: '#DC2626', width: 3 },
  builds_on: { color: '#16A085', width: 2, dashArray: '3,1' },
  clarifies: { color: '#14B8A6', width: 1, dashArray: '3,3' },
  consumes: { color: '#EC4899', width: 1, dashArray: '3,3' },
  depends_on: { color: '#EF4444', width: 2 },
  derived_from: { color: '#84CC16', width: 1, dashArray: '4,2' },
  documented_in: { color: '#cfdd30ff', width: 2, dashArray: '3,1' },
  implements: { color: '#3B82F6', width: 2 },
  produces: { color: '#F59E0B', width: 2, dashArray: '5,5' },
  related_to: { color: '#6B7280', width: 1 },
  resolves: { color: '#059669', width: 2 },
  tracks: { color: '#8B5CF6', width: 2 },
  verifies: { color: '#10B981', width: 2 }
};

// Filter configuration
export interface GraphFilters {
  nodeTypes: Set<NodeType>;
  relationshipTypes: Set<RelationshipType>;
  progressStatuses: Set<ProgressStatus>;
  tags: Set<string>;
  hopDepth: number;
}

// Focus mode configuration
export interface FocusMode {
  enabled: boolean;
  centerNodeId?: string;
  hopDepth: number;
  visibleNodeIds: Set<string>;
}

// Graph layout configuration
export interface LayoutConfig {
  type: 'force' | 'hierarchical' | 'circular';
  strength: number;
  distance: number;
  iterations: number;
}

// Transform ConPort entities to graph nodes
export function createDecisionNode(decision: any): DecisionNode {
  return {
    id: `decision-${decision.id}`,
    type: 'decision',
    title: decision.summary,
    summary: decision.summary,
    description: decision.rationale,
    rationale: decision.rationale,
    implementation_details: decision.implementation_details,
    tags: decision.tags || [],
    timestamp: decision.timestamp
  };
}

export function createProgressNode(progress: any): ProgressNode {
  return {
    id: `progress-${progress.id}`,
    type: 'progress',
    title: progress.description,
    description: progress.description,
    status: progress.status,
    parent_id: progress.parent_id,
    timestamp: progress.timestamp
  };
}

export function createSystemPatternNode(pattern: any): SystemPatternNode {
  return {
    id: `pattern-${pattern.id}`,
    type: 'system_pattern',
    title: pattern.name,
    name: pattern.name,
    description: pattern.description,
    tags: pattern.tags || [],
    timestamp: pattern.timestamp
  };
}

export function createCustomDataNode(customData: any): CustomDataNode {
  return {
    id: `custom-${encodeURIComponent(customData.category)}:${encodeURIComponent(customData.key)}`,
    type: 'custom_data',
    title: `${customData.category}: ${customData.key}`,
    category: customData.category,
    key: customData.key,
    value: customData.value,
    description: typeof customData.value === 'string' ? customData.value : JSON.stringify(customData.value, null, 2),
    timestamp: customData.timestamp
  };
}

export function createGraphEdge(link: any): GraphEdge | null {
  // Transform item types to match node ID formats
  const transformItemType = (itemType: string) => {
    if (itemType === 'progress_entry') return 'progress';
    if (itemType === 'custom_data') return 'custom';
    if (itemType === 'system_pattern') return 'pattern';
    return itemType;
  };

  // Special handling for custom_data items - use category:key format
  const createSourceId = (itemType: string, itemId: string): string | null => {
    if (itemType === 'custom_data') {
      // Handle both numeric IDs (old format) and category:key format (new format)
      if (/^\d+$/.test(itemId)) {
        // Numeric ID format - this is invalid for graph display, return null to skip this link
        debugWarn(`[GraphEdge] Skipping link with numeric custom_data ID: ${itemId} (old format not supported)`);
        return null;
      }
      // For custom data, itemId should be "category:key" format
      // Convert to "custom-category:key" format to match createCustomDataNode
      return `custom-${itemId}`;
    }
    return `${transformItemType(itemType)}-${itemId}`;
  };

  const sourceId = createSourceId(link.source_item_type, link.source_item_id);
  const targetId = createSourceId(link.target_item_type, link.target_item_id);
  
  // Skip the entire link if either endpoint can't be resolved
  if (sourceId === null || targetId === null) {
    return null;
  }

  // SAFETY: Normalize relationship type to lowercase for graph compatibility
  // This handles both uppercase legacy data and mixed-case user input
  const normalizedRelationType = (link.relationship_type || 'related_to').toLowerCase();
  
  return {
    id: `link-${link.id}`,
    source: sourceId,
    target: targetId,
    relationship_type: normalizedRelationType as RelationshipType,
    description: link.description,
    timestamp: link.timestamp
  };
}