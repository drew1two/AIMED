'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { zoom, zoomTransform, zoomIdentity } from 'd3-zoom';
import { drag } from 'd3-drag';
import { select } from 'd3-selection';
import { pointer } from 'd3-selection';
import {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphFilters,
  FocusMode,
  NODE_STYLES,
  EDGE_STYLES,
  PROGRESS_STATUS_COLORS,
  NodeType,
  RelationshipType
} from '../../shared/conport/graph-types';
import { useGraphData, useFocusedGraphData, transformConportToGraphData, useCreateLink, useUpdateLink, useDeleteLink } from '../../shared/conport/hooks';
import { getConportClient, WorkspaceManager, debugLog, userLog, userWarn } from '../../shared/conport/client';
import { createDrawer } from './graph/draw';
import { LoadingOverlay, ErrorOverlay, NoDataOverlay, ControlsOverlay, LegendOverlay, LinkModeIndicator, SpacingControlsOverlay } from './graph/Overlays';
import { SearchOverlay } from './graph/SearchOverlay';
import LinkContextMenu, { type LinkContextMenuEdge } from './graph/LinkContextMenu';
import LinkCreationMenu from './graph/LinkCreationMenu';
import {
  getMousePositionFromEvent,
  findNodeAtPosition,
  findEdgeNearPosition,
  buildEdgesToTest,
  makeRealLinkIdResolver,
  type EdgeLike
} from './graph/interactions';

interface GraphCanvasProps {
  filters: GraphFilters;
  focusMode: FocusMode;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  onNodeFocus: (nodeId: string) => void;
  linkMode: boolean;
  onLinkCreate?: (sourceId: string, targetId: string, relationshipType: string, description?: string) => void;
  onLinkEdit?: (linkId: number, relationshipType?: string, description?: string) => void;
  onLinkDelete?: (linkId: number) => void;
}

export function GraphCanvas({
  filters,
  focusMode,
  selectedNodeId,
  onNodeSelect,
  onNodeFocus,
  linkMode,
  onLinkCreate,
  onLinkEdit,
  onLinkDelete
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isContainerReady, setIsContainerReady] = useState(false);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const filteredDataRef = useRef<{ nodes: GraphNode[], edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const stableNodesRef = useRef<Map<string, GraphNode>>(new Map());
  const stableEdgesRef = useRef<Map<string, GraphEdge>>(new Map());
  // Preserve last known node positions across filter changes
  const lastPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Track last counts to adjust simulation reheat strength
  const lastCountsRef = useRef<{ nodes: number; edges: number }>({ nodes: 0, edges: 0 });
  // Store props in refs to avoid re-render dependencies (declared after state below)
  const zoomBehaviorRef = useRef<any>(null);
  const dragBehaviorRef = useRef<any>(null);
  const hasFitOnceRef = useRef(false);
  const initializationTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasInitializedSimulationRef = useRef(false);
  const isSearchCenteringRef = useRef(false);
  const isCenteringRef = useRef(false);
  // Removed duplicate debugLog - now using shared debugLog from client.ts that checks ui-cache preference
  
  
  // Node position persistence
  const savedPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const pendingSaveRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  // Simulation parameters persistence
  const savedSimulationParamsRef = useRef<Map<string, number>>(new Map());
  const pendingParamSaveRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  // Simulation parameters using refs to avoid React re-render cycles
  const simulationParamsRef = useRef({
    linkDistance: 30,     // More space between connected nodes
    chargeStrength: -15, // Gentler repulsion for smoother initial layout
    collisionRadius: 3,   // Larger collision radius to prevent overlap
    clusterTightness: 0.1 // Initial clustering factor (0.05 = very tight, 0.3 = very spread)
  });

  // Local UI state for spacing controls (keeps sliders responsive without triggering simulation restarts)
  const [controlsUI, setControlsUI] = useState(() => ({
    linkDistance: simulationParamsRef.current.linkDistance,
    chargeStrength: simulationParamsRef.current.chargeStrength,
    collisionRadius: simulationParamsRef.current.collisionRadius,
    clusterTightness: simulationParamsRef.current.clusterTightness
  }));
  
  // Link creation state
  const [linkCreationState, setLinkCreationState] = useState<{
    sourceNodeId: string | null;
    isCreatingLink: boolean;
  }>({
    sourceNodeId: null,
    isCreatingLink: false
  });
  
  // Search state - matching node IDs for visual highlighting
  const [searchMatchingIds, setSearchMatchingIds] = useState<Set<string>>(new Set());
  
  // Props ref including link state for drawGraph (avoids stale closures)
  const propsRef = useRef<{
    selectedNodeId: string | null;
    focusMode: FocusMode;
    linkMode: boolean;
    linkCreationState: { sourceNodeId: string | null; isCreatingLink: boolean };
    searchMatchingIds: Set<string>;
  }>({ selectedNodeId, focusMode, linkMode, linkCreationState, searchMatchingIds });
  
  // Context menu state for edge interactions (supports multi-edge selection)
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    linkId: number | null;
    linkData: GraphEdge | null;
    edges: GraphEdge[] | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    linkId: null,
    linkData: null,
    edges: null
  });

  // Relationship type being edited in the context menu
  const [editRelType, setEditRelType] = useState<string>('');
  
  // Link creation menu (choose relationship type after selecting target)
  const [linkCreateUI, setLinkCreateUI] = useState<{
    visible: boolean;
    x: number;
    y: number;
    sourceId: string | null;
    targetId: string | null;
    relType: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    sourceId: null,
    targetId: null,
    relType: 'relates_to'
  });

  // Optimistic edges cache and hidden-edge filter for instant UI feedback
  const optimisticEdgesRef = useRef<GraphEdge[]>([]);
  const hiddenEdgeIdsRef = useRef<Set<string>>(new Set());

  // Use modular resolveRealLinkId function
  const resolveRealLinkId = makeRealLinkIdResolver(stableEdgesRef);

  // Position persistence functions
  const loadNodePositions = useCallback(async () => {
    try {
      const client = getConportClient();
      const workspaceId = encodeURIComponent(WorkspaceManager.get());
      
      // Get server URL from ConportClient which reads from env_vars.json (no hardcoded fallbacks)
      const serverUrl = (await client.getServerUrl()).endsWith('/') ? (await client.getServerUrl()).slice(0, -1) : (await client.getServerUrl());
      
      // Direct API call to MCP server (no proxy)
      const targetUrl = `${serverUrl}/api/ui-cache/preference?workspace_id=${workspaceId}&preference_key=graphnodepositions`;
      debugLog(`[GraphCanvas] Direct API call: ${targetUrl}`);
      const response = await fetch(targetUrl);
      const result = await response.json();
      
      if (result.success && result.value && result.value.data) {
        const positions = new Map<string, { x: number; y: number }>();
        const migratedData = result.value.data;
        
        // Transform migrated data format to match existing expectations
        Object.entries(migratedData).forEach(([key, item]: [string, any]) => {
          if (item.value && typeof item.value.x === 'number' && typeof item.value.y === 'number') {
            positions.set(key, { x: item.value.x, y: item.value.y });
          }
        });
        savedPositionsRef.current = positions;
        debugLog(`[Graph] Loaded ${positions.size} saved node positions from UI cache`);
      }
    } catch (error) {
      userWarn('[Graph] Failed to load saved node positions from UI cache:', error);
    }
  }, []);

  const saveNodePosition = useCallback(async (nodeId: string, x: number, y: number) => {
    try {
      savedPositionsRef.current.set(nodeId, { x, y });
      
      // Debounce saves to avoid excessive API calls
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
      }
      
      pendingSaveRef.current = setTimeout(async () => {
        try {
          const clientForSave = getConportClient();
          const workspaceId = encodeURIComponent(WorkspaceManager.get());
          
          // Get server URL from ConportClient which reads from env_vars.json
          const serverUrl = (await clientForSave.getServerUrl()).endsWith('/') ? (await clientForSave.getServerUrl()).slice(0, -1) : (await clientForSave.getServerUrl());
          
          // Get current positions, update with new position, then save all
          const currentTargetUrl = `${serverUrl}/api/ui-cache/preference?workspace_id=${workspaceId}&preference_key=graphnodepositions`;
          debugLog(`[GraphCanvas] Loading current positions: ${currentTargetUrl}`);
          const currentResponse = await fetch(currentTargetUrl);
          const currentResult = await currentResponse.json();
          
          const currentData = currentResult.success && currentResult.value ? currentResult.value : { data: {} };
          if (!currentData.data) currentData.data = {};
          
          // Update the specific node position
          currentData.data[nodeId] = {
            value: { x, y, timestamp: new Date().toISOString() },
            timestamp: new Date().toISOString(),
            migrated_from_category: "GraphNodePositions"
          };
          
          // Save the updated data (direct POST to server)
          const saveTargetUrl = `${serverUrl}/api/ui-cache/preference?workspace_id=${workspaceId}&preference_key=graphnodepositions`;
          debugLog(`[GraphCanvas] Saving positions: ${saveTargetUrl}`);
          const saveResponse = await fetch(saveTargetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentData)
          });
          
          const saveResult = await saveResponse.json();
          if (saveResult.success) {
            userLog(`[Graph] Saved position for node ${nodeId}: (${Math.round(x)}, ${Math.round(y)}) to UI cache`);
          } else {
            userWarn(`[Graph] Failed to save position for node ${nodeId}:`, saveResult.error);
          }
        } catch (error) {
          userWarn(`[Graph] Failed to save position for node ${nodeId}:`, error);
        }
      }, 1000); // Save after 1 second of inactivity
    } catch (error) {
      userWarn('[Graph] Error in saveNodePosition:', error);
    }
  }, []);

  // Load saved simulation parameters
  const loadSimulationParams = useCallback(async () => {
    try {
      const client = getConportClient();
      const workspaceId = encodeURIComponent(WorkspaceManager.get());
      
      // Get server URL from ConportClient which reads from env_vars.json
      const serverUrl = (await client.getServerUrl()).endsWith('/') ? (await client.getServerUrl()).slice(0, -1) : (await client.getServerUrl());
      
      // Direct API call to MCP server (no proxy)
      const targetUrl = `${serverUrl}/api/ui-cache/preference?workspace_id=${workspaceId}&preference_key=graphsimulationparams`;
      debugLog(`[GraphCanvas] Direct API call: ${targetUrl}`);
      const response = await fetch(targetUrl);
      const result = await response.json();
      
      if (result.success && result.value && result.value.data) {
        const params = new Map<string, number>();
        const migratedData = result.value.data;
        
        // Transform migrated data format to match existing expectations
        Object.entries(migratedData).forEach(([key, item]: [string, any]) => {
          if (item.value && typeof item.value === 'number') {
            params.set(key, item.value);
          }
        });
        savedSimulationParamsRef.current = params;
        
        // Update simulationParamsRef with loaded values
        const loadedLinkDistance = params.get('linkDistance') ?? 30;
        const loadedChargeStrength = params.get('chargeStrength') ?? -15;
        const loadedCollisionRadius = params.get('collisionRadius') ?? 3;
        const loadedClusterTightness = params.get('clusterTightness') ?? 0.1;
        
        simulationParamsRef.current = {
          linkDistance: loadedLinkDistance,
          chargeStrength: loadedChargeStrength,
          collisionRadius: loadedCollisionRadius,
          clusterTightness: loadedClusterTightness
        };
        
        // Update UI state to match loaded values
        setControlsUI({
          linkDistance: loadedLinkDistance,
          chargeStrength: loadedChargeStrength,
          collisionRadius: loadedCollisionRadius,
          clusterTightness: loadedClusterTightness
        });
        
        debugLog(`[Graph] Loaded simulation parameters from UI cache:`, simulationParamsRef.current);
      }
    } catch (error) {
      userWarn('[Graph] Failed to load saved simulation parameters from UI cache:', error);
    }
  }, []);

  const saveSimulationParam = useCallback(async (param: string, value: number) => {
    try {
      savedSimulationParamsRef.current.set(param, value);
      
      // Debounce saves to avoid excessive API calls
      if (pendingParamSaveRef.current) {
        clearTimeout(pendingParamSaveRef.current);
      }
      
      pendingParamSaveRef.current = setTimeout(async () => {
        try {
          const workspaceId = encodeURIComponent(WorkspaceManager.get());
          
          // Use the API route which reads from env_vars.json to get correct server URL
          const response = await fetch('/api/get-workspace-mcp-port', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceId: WorkspaceManager.get() })
          });
          const data = await response.json();
          const serverUrl = data.env_vars?.conport_server_url?.replace('/mcp/', '') || `http://${window.location.hostname}:${data.port || 8020}`;
          
          // Get current simulation params, update with new param, then save all
          const currentTargetUrl = `${serverUrl}/api/ui-cache/preference?workspace_id=${workspaceId}&preference_key=graphsimulationparams`;
          debugLog(`[GraphCanvas] Loading current simulation params: ${currentTargetUrl}`);
          const currentResponse = await fetch(currentTargetUrl);
          const currentResult = await currentResponse.json();
          
          const currentData = currentResult.success && currentResult.value ? currentResult.value : { data: {} };
          if (!currentData.data) currentData.data = {};
          
          // Update the specific simulation parameter
          currentData.data[param] = {
            value: value,
            timestamp: new Date().toISOString(),
            migrated_from_category: "GraphSimulationParams"
          };
          
          // Save the updated data (direct POST to server)
          const saveTargetUrl = `${serverUrl}/api/ui-cache/preference?workspace_id=${workspaceId}&preference_key=graphsimulationparams`;
          debugLog(`[GraphCanvas] Saving simulation params: ${saveTargetUrl}`);
          const saveResponse = await fetch(saveTargetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentData)
          });
          
          const saveResult = await saveResponse.json();
          if (saveResult.success) {
            userLog(`[Graph] Saved simulation parameter ${param}: ${value} to UI cache`);
          } else {
            userWarn(`[Graph] Failed to save simulation parameter ${param}:`, saveResult.error);
          }
        } catch (error) {
          userWarn(`[Graph] Failed to save simulation parameter ${param}:`, error);
        }
      }, 1000); // Save after 1 second of inactivity
    } catch (error) {
      userWarn('[Graph] Error in saveSimulationParam:', error);
    }
  }, []);

  // Function to update simulation parameters without React re-render (with debouncing)
  const updateSimulationParam = useCallback((param: keyof typeof simulationParamsRef.current, value: number) => {
    if (!simulationRef.current) return;
    
    simulationParamsRef.current[param] = value;
    
    // Apply the specific parameter change
    switch (param) {
      case 'linkDistance':
        if (linkForceRef.current) {
          linkForceRef.current.distance(value);
        }
        break;
      case 'chargeStrength':
        simulationRef.current.force('charge', forceManyBody().strength(value));
        break;
      case 'collisionRadius':
        simulationRef.current.force('collision', forceCollide().radius((d: any) => {
          const style = NODE_STYLES[d.type as NodeType];
          return style.radius + value;
        }));
        break;
    }
    
    // Save the parameter
    saveSimulationParam(param, value);
    
    // Parameter changes - simulation is already warm, just give it a small boost
    const currentAlpha = simulationRef.current.alpha();
    if (currentAlpha < 0.02) {
      simulationRef.current.alpha(0.02); // Small boost for parameter responsiveness
    }
  }, [saveSimulationParam]);

  // UI handlers to keep slider values in sync without coupling to React state elsewhere
  const handleLinkDistanceUIChange = useCallback((distance: number) => {
    setControlsUI(prev => (prev.linkDistance === distance ? prev : { ...prev, linkDistance: distance }));
    updateSimulationParam('linkDistance', distance);
  }, [updateSimulationParam]);

  const handleChargeStrengthUIChange = useCallback((strength: number) => {
    setControlsUI(prev => (prev.chargeStrength === strength ? prev : { ...prev, chargeStrength: strength }));
    updateSimulationParam('chargeStrength', strength);
  }, [updateSimulationParam]);

  const handleCollisionRadiusUIChange = useCallback((radius: number) => {
    setControlsUI(prev => (prev.collisionRadius === radius ? prev : { ...prev, collisionRadius: radius }));
    updateSimulationParam('collisionRadius', radius);
  }, [updateSimulationParam]);

  const handleClusterTightnessUIChange = useCallback((tightness: number) => {
    setControlsUI(prev => (prev.clusterTightness === tightness ? prev : { ...prev, clusterTightness: tightness }));
    // Store the value but don't trigger simulation restart - clustering only affects new nodes
    simulationParamsRef.current.clusterTightness = tightness;
    saveSimulationParam('clusterTightness', tightness);
  }, [saveSimulationParam]);

  // Helper: remove an edge visually (optimistic UI) and update simulation/link force
  const removeEdgeVisual = (edgeId: string) => {
    try {
      // Hide by id for renderer and hit-testing
      hiddenEdgeIdsRef.current.add(edgeId);

      // Remove from stable map
      if (stableEdgesRef.current.has(edgeId)) {
        stableEdgesRef.current.delete(edgeId);
      }

      // Remove from optimistic cache if present
      try {
        optimisticEdgesRef.current = (optimisticEdgesRef.current as any[]).filter((e: any) => e.id !== edgeId);
      } catch {}

      // Remove from filtered ref list
      const { nodes, edges } = filteredDataRef.current;
      filteredDataRef.current = {
        nodes,
        edges: (edges as any[]).filter((e: any) => e.id !== edgeId)
      };

      // Update d3 link force with current edges (minus hidden)
      const lf = (linkForceRef.current ||= (simulationRef.current?.force('link') as any));
      if (lf && typeof lf.links === 'function') {
        const visibleEdges = (filteredDataRef.current.edges as any[]).filter((e: any) => !hiddenEdgeIdsRef.current.has(e.id));
        lf.links(visibleEdges);
      }

      // Nudge simulation and redraw
      if (simulationRef.current) {
        simulationRef.current.alpha(0.02).alphaTarget(0.001).restart();
      }
      drawGraph();
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        try { console.warn('[Graph] removeEdgeVisual failed', e); } catch {}
      }
    }
  };
  
// Handlers for modular overlays/menus
const handleSelectEdgeFromMenu = useCallback((edge: LinkContextMenuEdge) => {
  try {
    const lid = resolveRealLinkId(edge as any);
    setContextMenu(prev => ({ ...prev, linkId: lid, linkData: edge as any, edges: null }));
    setEditRelType(edge.relationship_type);
  } catch {}
}, []);

const handleSaveContextEdit = useCallback(() => {
  try {
    if (contextMenu.linkId && onLinkEdit) {
      const nextType = editRelType || contextMenu.linkData?.relationship_type || 'relates_to';
      onLinkEdit(contextMenu.linkId, nextType);
    }
  } finally {
    setContextMenu(prev => ({ ...prev, visible: false, linkData: null, linkId: null, edges: null }));
  }
}, [contextMenu.linkId, contextMenu.linkData, editRelType, onLinkEdit]);

const handleCancelContextMenu = useCallback(() => {
  setContextMenu(prev => ({ ...prev, visible: false, linkData: null, linkId: null, edges: null }));
}, []);

const handleDeleteSelectedLink = useCallback(() => {
  const edge: any = contextMenu.linkData;
  if (!edge) return;

  const sid = typeof edge.source === 'string' ? edge.source : (edge.source as any)?.id;
  const tid = typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id;
  const rtype = edge.relationship_type;

  // Hide clicked edge and duplicates (optimistic or real)
  try { removeEdgeVisual(edge.id); } catch {}
  try {
    // Hide real duplicates in base edges
    const baseEdges = (filteredDataRef.current.edges as any[]) || [];
    baseEdges
      .filter((e: any) => {
        const esid = typeof e.source === 'string' ? e.source : (e.source as any)?.id;
        const etid = typeof e.target === 'string' ? e.target : (e.target as any)?.id;
        return esid === sid && etid === tid && e.relationship_type === rtype && e.id !== edge.id;
      })
      .forEach((e: any) => removeEdgeVisual(e.id));
    // Remove any matching optimistic edges
    optimisticEdgesRef.current = (optimisticEdgesRef.current as any[]).filter((e: any) => {
      const esid = typeof e.source === 'string' ? e.source : (e.source as any)?.id;
      const etid = typeof e.target === 'string' ? e.target : (e.target as any)?.id;
      const match = esid === sid && etid === tid && e.relationship_type === rtype;
      if (match) hiddenEdgeIdsRef.current.add(e.id);
      return !match;
    });
  } catch {}

  try { drawGraph(); } catch {}

  let resolvedId = contextMenu.linkId ?? resolveRealLinkId(edge);
  if (resolvedId && onLinkDelete) {
    if (confirm('Are you sure you want to delete this link?')) {
      onLinkDelete(resolvedId);
    }
  } else {
    // Retry shortly after data refetch to capture the real id that may arrive after optimistic create
    setTimeout(() => {
      try {
        const real = (filteredDataRef.current.edges as any[]).find((e: any) => {
          const esid = typeof e.source === 'string' ? e.source : (e.source as any)?.id;
          const etid = typeof e.target === 'string' ? e.target : (e.target as any)?.id;
          return esid === sid && etid === tid && e.relationship_type === rtype && /^link-\d+$/.test(e.id);
        });
        if (real && onLinkDelete) {
          const n = parseInt(String(real.id).replace('link-', ''), 10);
          if (Number.isFinite(n)) onLinkDelete(n);
        }
      } catch {}
    }, 250);
  }

  setContextMenu(prev => ({ ...prev, visible: false, linkData: null, linkId: null, edges: null }));
}, [contextMenu.linkData, contextMenu.linkId, onLinkDelete]);

const handleCreateLinkFromMenu = useCallback(() => {
  if (onLinkCreate && linkCreateUI.sourceId && linkCreateUI.targetId) {
    try {
      const parseNodeId = (nodeId: string) => {
        const [prefix, ...rest] = nodeId.split('-');
        const id = rest.join('-');
        let itemType = prefix;
        if (prefix === 'pattern') itemType = 'system_pattern';
        if (prefix === 'custom') itemType = 'custom_data';
        if (prefix === 'progress') itemType = 'progress_entry';
        return { itemType, id };
      };
      const source = parseNodeId(linkCreateUI.sourceId);
      const target = parseNodeId(linkCreateUI.targetId);

      // Invoke server create
      onLinkCreate(
        linkCreateUI.sourceId,
        linkCreateUI.targetId,
        linkCreateUI.relType,
        `Link from ${source.itemType} ${source.id} to ${target.itemType} ${target.id}`
      );

      // Optimistically draw new edge immediately
      try {
        optimisticEdgesRef.current.push({
          id: `link-temp-${Date.now()}`,
          source: linkCreateUI.sourceId,
          target: linkCreateUI.targetId,
          relationship_type: linkCreateUI.relType as RelationshipType,
          timestamp: new Date().toISOString()
        } as any);
        drawGraph();
      } catch {}

    } catch (e) {
      console.error('[Graph] LinkMode: create via menu error', e);
    }
  }
  // Reset UI and link creation state
  setLinkCreateUI(prev => ({ ...prev, visible: false }));
  setLinkCreationState({ sourceNodeId: null, isCreatingLink: false });
  onNodeSelect(null);
}, [onLinkCreate, linkCreateUI, onNodeSelect]);

const handleCancelCreateLinkMenu = useCallback(() => {
  setLinkCreateUI(prev => ({ ...prev, visible: false }));
}, []);
  // Extract node type and ID from center node ID for focus mode
  const centerNodeType = focusMode.centerNodeId ? focusMode.centerNodeId.split('-')[0] : null;
  const centerNodeId = focusMode.centerNodeId ? focusMode.centerNodeId.split('-').slice(1).join('-') : null;

  // DEBUG: Focus input parsing
  // Fetch graph data - either all data or focused data based on focus mode
  const { data: allGraphData, isLoading: isLoadingAll, error: errorAll } = useGraphData({
    includeDecisions: filters.nodeTypes.has('decision'),
    includeProgress: filters.nodeTypes.has('progress'),
    includeSystemPatterns: filters.nodeTypes.has('system_pattern'),
    includeCustomData: filters.nodeTypes.has('custom_data'),
    limit: 100
  });
  
  
  const { data: focusedGraphData, isLoading: isLoadingFocused, error: errorFocused } = useFocusedGraphData(
    centerNodeType,
    centerNodeId,
    focusMode.hopDepth || 2,
    focusMode.enabled
  );
  
  // Transform ConPort data to graph format (memoized to avoid unnecessary restarts)
  const graphData = useMemo(() => {
    if (focusMode.enabled && focusedGraphData) {
      return transformConportToGraphData(focusedGraphData);
    }
    if (allGraphData) {
      return transformConportToGraphData(allGraphData);
    }
    return null;
  }, [focusMode.enabled, focusedGraphData, allGraphData]);

  
  // Determine current loading and error state
  const isLoading = focusMode.enabled ? isLoadingFocused : isLoadingAll;
  const error = focusMode.enabled ? errorFocused : errorAll;

  // Create stable filtered data with object reference preservation
  const updateFilteredData = useCallback(() => {
    if (!graphData) {
      filteredDataRef.current = { nodes: [], edges: [] };
      return;
    }
      
    const filteredNodes = graphData.nodes.filter(node => {
      // Node type filter
      if (!filters.nodeTypes.has(node.type)) return false;
      
      // Progress status filter for progress nodes
      if (node.type === 'progress' && !filters.progressStatuses.has(node.status)) return false;
      
      // Focus mode filter
      if (focusMode.enabled && focusMode.visibleNodeIds.size > 0) {
        return focusMode.visibleNodeIds.has(node.id);
      }
      
      return true;
    });
    
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    
    const filteredEdges = graphData.edges.filter((edge) => {
      // Handle both string IDs and D3.js object references
      const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as any).id;
      const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as any).id;
      
      
      // Only show edges between visible nodes
      if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return false;
      
      // Relationship type filter
      if (!filters.relationshipTypes.has(edge.relationship_type)) return false;
      
      return true;
    });
    
    
    // Preserve existing node objects and their simulation state (x, y, etc.)
    const stableNodes: GraphNode[] = [];
    filteredNodes.forEach(node => {
      const existingNode = stableNodesRef.current.get(node.id);
      if (existingNode) {
        // Update existing node data but preserve simulation properties
        Object.assign(existingNode, node);
        stableNodes.push(existingNode);
      } else {
        // New node - restore saved position first, then last position, otherwise seed near center
        const saved = savedPositionsRef.current.get(node.id);
        const lastPos = lastPositionsRef.current.get(node.id);
        
        if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
          // Use saved position from ConPort
          node.x = saved.x;
          node.y = saved.y;
        } else if (lastPos && typeof lastPos.x === 'number' && typeof lastPos.y === 'number') {
          // Fall back to temporary last position
          node.x = lastPos.x + (Math.random() - 0.5) * 10;
          node.y = lastPos.y + (Math.random() - 0.5) * 10;
        } else if (typeof node.x !== 'number' || typeof node.y !== 'number') {
          // Start nodes using controllable clustering factor
          const centerX = dimensions.width / 2;
          const centerY = dimensions.height / 2;
          const maxOffset = Math.min(dimensions.width, dimensions.height) * simulationParamsRef.current.clusterTightness;
          node.x = centerX + (Math.random() - 0.5) * maxOffset;
          node.y = centerY + (Math.random() - 0.5) * maxOffset;
        }
        stableNodesRef.current.set(node.id, node);
        stableNodes.push(node);
      }
    });
    
    // Clean up nodes that are no longer filtered (but remember last positions)
    const currentNodeIds = new Set(filteredNodes.map(n => n.id));
    for (const [nodeId, node] of stableNodesRef.current) {
      if (!currentNodeIds.has(nodeId)) {
        if (typeof node.x === 'number' && typeof node.y === 'number') {
          lastPositionsRef.current.set(nodeId, { x: node.x, y: node.y });
        }
        stableNodesRef.current.delete(nodeId);
      }
    }
    
    // Build quick lookup for node objects
    const nodeByIdMap = new Map<string, GraphNode>();
    stableNodes.forEach(n => nodeByIdMap.set(n.id, n));

    // Handle edges similarly, but force source/target to be node objects (not strings)
    const stableEdges: any[] = [];
    filteredEdges.forEach(edge => {
      const existingEdge = stableEdgesRef.current.get(edge.id) as any;

      const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as any).id;
      const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as any).id;
      const sourceNode = nodeByIdMap.get(sourceId);
      const targetNode = nodeByIdMap.get(targetId);

      // Skip edges whose endpoints aren't currently visible
      if (!sourceNode || !targetNode) return;

      if (existingEdge) {
        // Preserve object refs and update attributes
        existingEdge.relationship_type = edge.relationship_type;
        existingEdge.description = edge.description;
        existingEdge.timestamp = edge.timestamp;
        existingEdge.source = sourceNode as any;
        existingEdge.target = targetNode as any;
        stableEdges.push(existingEdge);
      } else {
        const newEdge: any = { ...edge, source: sourceNode, target: targetNode };
        stableEdgesRef.current.set(edge.id, newEdge);
        stableEdges.push(newEdge);
      }
    });

    // Clean up edges that are no longer filtered
    const currentEdgeIds = new Set(filteredEdges.map(e => e.id));
    for (const [edgeId, edge] of stableEdgesRef.current) {
      if (!currentEdgeIds.has(edgeId)) {
        stableEdgesRef.current.delete(edgeId);
      }
    }

    // Store the stable filtered data in the ref
    filteredDataRef.current = { nodes: stableNodes, edges: stableEdges };
    
  }, [graphData, filters, focusMode, dimensions]);

  // D3 force simulation
  const simulationRef = useRef<any>(null);
  // Cache link force to safely update links without rebuilding the force (prevents d3 from touching strings)
  const linkForceRef = useRef<any>(null);
// Drawer ref (delegated renderer)
const drawGraphRef = useRef<() => void>(() => {});
useEffect(() => {
  // Initialize drawer once; reads from refs so no deps required
  drawGraphRef.current = createDrawer({
    canvasRef,
    filteredDataRef,
    hiddenEdgeIdsRef,
    optimisticEdgesRef,
    propsRef,
    transformRef
  });
  try { drawGraphRef.current(); } catch {}
}, []);
  // Initialize simulation - wait for container readiness, data, and loaded positions
  useEffect(() => {
    if (!canvasRef.current || !isContainerReady || !graphData) {
      return;
    }

    // CRITICAL FIX: Prevent multiple initialization runs during navigation
    // Check if simulation already exists and is healthy
    if (simulationRef.current) {
      // Just ensure warmth and center force are correct
      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      simulationRef.current.force('center', forceCenter(cx, cy));
      simulationRef.current.alphaTarget(0.001);
      return;
    }

    const initializeGraphWithPositions = async () => {
      // First, ensure saved positions and simulation parameters are loaded
      await Promise.all([loadNodePositions(), loadSimulationParams()]);
      
      // Update the filtered data with position info
      updateFilteredData();
      const { nodes, edges } = filteredDataRef.current;
      if (nodes.length === 0) {
        return;
      }

    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;

    // If a simulation already exists (shouldn't happen due to check above, but safety net)
    if (simulationRef.current) {
      simulationRef.current.force('center', forceCenter(cx, cy));
      simulationRef.current.alphaTarget(0.001);
      return;
    }

    // Seed initial positions using controllable clustering factor
    nodes.forEach((n: any) => {
      if (typeof n.x !== 'number' || typeof n.y !== 'number') {
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;
        const maxOffset = Math.min(dimensions.width, dimensions.height) * simulationParamsRef.current.clusterTightness;
        n.x = centerX + (Math.random() - 0.5) * maxOffset;
        n.y = centerY + (Math.random() - 0.5) * maxOffset;
      }
    });

      // Create simulation with stable node references and calm forces
    simulationRef.current = forceSimulation(nodes)
      // Initialize and cache the link force so we can update links safely later
      .force('link', (linkForceRef.current = forceLink(edges).id((d: any) => (d as any).id).distance(simulationParamsRef.current.linkDistance)))
      .force('charge', forceManyBody().strength(simulationParamsRef.current.chargeStrength))
      .force('center', forceCenter(cx, cy).strength(0.1)) // Very weak center force to avoid clustering
      .force('collision', forceCollide().radius((d: any) => {
        const style = NODE_STYLES[d.type as NodeType];
        return style.radius + simulationParamsRef.current.collisionRadius;
      }))
      .on('tick', () => {
        try {
          drawGraph();
        } catch (e) {
          console.error('[Graph] drawGraph tick error', e);
        }
      })
      // Start with higher alpha for better initial spread, then settle to warm state
      .alpha(0.8)
      .alphaTarget(0.001); // Minimal but non-zero target keeps it alive
        
      // Simulation created successfully
    };

    // Initialize the graph with proper load order
    initializeGraphWithPositions();

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null; // Clear the ref so new simulation can be created
      }
      // Clear pending saves on cleanup
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
      }
    };
  }, [dimensions, isContainerReady, graphData, loadNodePositions, loadSimulationParams]); // Wait for container and data


  // Update simulation data when filters change - but avoid unnecessary restarts
  useEffect(() => {
    if (!simulationRef.current) return;
    
    // Update filtered data
    updateFilteredData();
    // Reconcile optimistic caches with fresh server data
    optimisticEdgesRef.current = [];
    hiddenEdgeIdsRef.current.clear();
    const { nodes, edges } = filteredDataRef.current;

    if (nodes.length === 0) {
  // When no nodes are visible, clear simulation safely to avoid d3 errors and keep UI responsive
  simulationRef.current.nodes([]);
  const lf = (linkForceRef.current ||= (simulationRef.current.force('link') as any));
  if (lf && typeof lf.links === 'function') {
    lf.links([]);
  }
  drawGraph();
  return;
}
    
    // Seed positions for any brand-new nodes using controllable clustering factor
    nodes.forEach((n: any) => {
      if (typeof n.x !== 'number' || typeof n.y !== 'number') {
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;
        const maxOffset = Math.min(dimensions.width, dimensions.height) * simulationParamsRef.current.clusterTightness;
        n.x = centerX + (Math.random() - 0.5) * maxOffset;
        n.y = centerY + (Math.random() - 0.5) * maxOffset;
      }
    });
    
    // Update simulation with stable node references
    simulationRef.current.nodes(nodes);
    const lf1 = (linkForceRef.current ||= (simulationRef.current.force('link') as any));
    if (lf1 && typeof lf1.links === 'function') {
      lf1.links(edges);
    }
    
    // Data source changed: choose alpha based on change magnitude
    try {
      const prev = lastCountsRef.current;
      const deltaNodes = Math.abs(nodes.length - prev.nodes);
      const deltaEdges = Math.abs(edges.length - prev.edges);
      let alpha = 0.02;
      if (deltaNodes > 10 || deltaEdges > 20) alpha = 0.25;
      else if (deltaNodes > 3 || deltaEdges > 5) alpha = 0.08;
      
      simulationRef.current.alpha(alpha).alphaTarget(0.001).restart();
      lastCountsRef.current = { nodes: nodes.length, edges: edges.length };
    } catch {
      simulationRef.current.alpha(0.06).alphaTarget(0.001).restart();
      lastCountsRef.current = { nodes: nodes.length, edges: edges.length };
    }
  }, [graphData]); // Runs only when underlying data actually changes (memoized)
  
  // Separate effect for filter/focus changes that might need simulation restart
  useEffect(() => {
    if (!simulationRef.current) return;
    
    // Update filtered data
    updateFilteredData();
    const { nodes, edges } = filteredDataRef.current;

    if (nodes.length === 0) {
  // When no nodes are visible, clear simulation safely to avoid d3 errors and keep UI responsive
  simulationRef.current.nodes([]);
  const lf = (linkForceRef.current ||= (simulationRef.current.force('link') as any));
  if (lf && typeof lf.links === 'function') {
    lf.links([]);
  }
  drawGraph();
  return;
}
    
    // Update simulation with stable node references
    simulationRef.current.nodes(nodes);
    const lf2 = (linkForceRef.current ||= (simulationRef.current.force('link') as any));
    if (lf2 && typeof lf2.links === 'function') {
      lf2.links(edges);
    }

    
    
    // Restart with alpha based on change magnitude to quickly de-jumble after filter toggles
    try {
      const prev = lastCountsRef.current;
      const deltaNodes = Math.abs(nodes.length - prev.nodes);
      const deltaEdges = Math.abs(edges.length - prev.edges);
      let alpha = 0.02;
      if (deltaNodes > 10 || deltaEdges > 20) alpha = 0.25;
      else if (deltaNodes > 3 || deltaEdges > 5) alpha = 0.08;
      simulationRef.current.alpha(alpha).alphaTarget(0.001).restart();
      lastCountsRef.current = { nodes: nodes.length, edges: edges.length };
    } catch {
      simulationRef.current.alpha(0.06).alphaTarget(0.001).restart();
      lastCountsRef.current = { nodes: nodes.length, edges: edges.length };
    }
  }, [filters, focusMode]);

  // Pure visual updates - no simulation interference
  // Removed separate draw on selectedNodeId to avoid stale props; handled below

  // Update props ref whenever props change (no re-render of drawGraph)
  // Update props ref and redraw synchronously on UI-only changes
  useEffect(() => {
    propsRef.current = { selectedNodeId, focusMode, linkMode, linkCreationState, searchMatchingIds };
    drawGraph();
  }, [selectedNodeId, focusMode, linkMode, linkCreationState, searchMatchingIds]);

  // Draw the graph on canvas - stable reference, no dependencies on changing props
  const drawGraph = useCallback(() => {
    try {
      drawGraphRef.current && drawGraphRef.current();
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        try { console.warn('[Graph] drawGraph error', e); } catch {}
      }
    }
  }, []);

  // Handle canvas resize and container readiness
  useEffect(() => {
    const handleResize = () => {
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect?.();
      let width = rect?.width ?? 0;
      let height = rect?.height ?? 0;

      // Fallbacks when rect is 0 (e.g., layout not settled yet)
      if (width <= 0 || height <= 0) {
        const parent = el.parentElement as HTMLElement | null;
        const parentRect = parent?.getBoundingClientRect?.();
        width = width <= 0 ? (parentRect?.width ?? parent?.clientWidth ?? window.innerWidth) : width;
        height = height <= 0 ? (parentRect?.height ?? parent?.clientHeight ?? (window.innerHeight - 120)) : height;
      }

      // Final minimums to avoid zeros
      width = Math.max(1, Math.floor(width));
      height = Math.max(1, Math.floor(height));

      const newDimensions = { width, height };

      setDimensions(newDimensions);
      setIsContainerReady(true);
      };

    // Clear any existing timeout
    if (initializationTimeoutRef.current) {
      clearTimeout(initializationTimeoutRef.current);
    }

    // Try immediate resize detection
    handleResize();

    // Fallback: retry after a short delay to handle cases where container isn't immediately sized
    initializationTimeoutRef.current = setTimeout(() => {
      handleResize();
    }, 100);

    // Observe container size changes reliably (fix for stuck "Initializing graph canvas...")
    let ro: ResizeObserver | null = null;
    try {
      if (containerRef.current && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => handleResize());
        ro.observe(containerRef.current);
      }
    } catch (e) {
      console.warn('[Graph] ResizeObserver not available or failed:', e);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
      if (ro) {
        try { ro.disconnect(); } catch {}
      }
    };
  }, []);

// Ensure container readiness after data loads (handles initial mount when container isn't in DOM during loading)
useEffect(() => {
  if (isLoading || !graphData) return;
  const el = containerRef.current;
  if (!el) return;

  const rect = el.getBoundingClientRect?.();
  let width = rect?.width ?? el.clientWidth ?? window.innerWidth;
  let height = rect?.height ?? el.clientHeight ?? (window.innerHeight - 120);

  width = Math.max(1, Math.floor(width));
  height = Math.max(1, Math.floor(height));

  setDimensions({ width, height });
  if (!isContainerReady) {
    setIsContainerReady(true);
    
  }
}, [isLoading, graphData]);
  // Set canvas dimensions - only when container is ready
  useEffect(() => {
    if (canvasRef.current && isContainerReady && dimensions.width > 0 && dimensions.height > 0) {
      const canvas = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = dimensions.width * dpr;
      canvas.height = dimensions.height * dpr;
      canvas.style.width = `${dimensions.width}px`;
      canvas.style.height = `${dimensions.height}px`;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.scale(dpr, dpr);
      }
      
      // Ensure we redraw after canvas is properly sized
      requestAnimationFrame(() => {
        drawGraph();
      });
    }
  }, [dimensions, isContainerReady]);

  // Mouse interaction helpers using modular functions
  const getMousePosition = (event: MouseEvent) => {
    return getMousePositionFromEvent(canvasRef.current, transformRef.current, event);
  };

  const findNodeAtGraphPosition = (x: number, y: number) => {
    const { nodes } = filteredDataRef.current;
    return findNodeAtPosition(nodes, x, y);
  };

  const findEdgeAtGraphPosition = (x: number, y: number) => {
    const { edges, nodes } = filteredDataRef.current;
    const edgesToTest = buildEdgesToTest(edges as EdgeLike[], hiddenEdgeIdsRef.current, optimisticEdgesRef.current as EdgeLike[]);
    return findEdgeNearPosition(x, y, nodes, edgesToTest, 10);
  };

  // Handle mouse clicks - wrap in useCallback to prevent recreation
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    const pos = getMousePosition(event);
    if (!pos) return;
    if (process.env.NODE_ENV !== 'production') {
      try { console.debug('[Graph] canvas click', { linkMode, linkCreationState, pos }); } catch {}
    }
 
    // Close any open menus on click
    setContextMenu(prev => ({ ...prev, visible: false }));
    setLinkCreateUI(prev => ({ ...prev, visible: false }));
 
    const clickedNode = findNodeAtGraphPosition(pos.x, pos.y);
    const clickedEdge = findEdgeAtGraphPosition(pos.x, pos.y);
 
    if (process.env.NODE_ENV !== 'production') {
      try { console.debug('[Graph] hitTest', { clickedNode: clickedNode?.id ?? null, clickedEdge: (clickedEdge as any)?.id ?? null }); } catch {}
    }
 
    if (linkMode && clickedNode) {
      // Handle link creation mode
      if (!linkCreationState.sourceNodeId) {
        // First click - select source node
        setLinkCreationState({
          sourceNodeId: clickedNode.id,
          isCreatingLink: true
        });
        if (process.env.NODE_ENV !== 'production') {
          try { console.debug('[Graph] LinkMode: source selected', { source: clickedNode.id }); } catch {}
        }
        // Suppress Node Details while in link mode
        onNodeSelect(null);
      } else if (clickedNode.id !== linkCreationState.sourceNodeId) {
        // Second click - open relationship picker
        setLinkCreateUI({
          visible: true,
          x: (event as any).clientX ?? 0,
          y: (event as any).clientY ?? 0,
          sourceId: linkCreationState.sourceNodeId,
          targetId: clickedNode.id,
          relType: 'relates_to'
        });
        if (process.env.NODE_ENV !== 'production') {
          try { console.debug('[Graph] LinkMode: open link creation menu', { source: linkCreationState.sourceNodeId, target: clickedNode.id }); } catch {}
        }
        // Keep Node Details closed while picking relationship
        onNodeSelect(null);
      } else {
        // Clicked same node - cancel link creation
        setLinkCreationState({
          sourceNodeId: null,
          isCreatingLink: false
        });
        if (process.env.NODE_ENV !== 'production') {
          try { console.debug('[Graph] LinkMode: canceled (same node clicked)', { node: clickedNode.id }); } catch {}
        }
        // Keep Node Details closed in link mode
        onNodeSelect(null);
      }
    } else if (clickedNode) {
      // Normal node selection
      onNodeSelect(clickedNode.id);
      
      // Double click to focus (only when not in link mode)
      if (event.detail === 2 && !linkMode) {
        onNodeFocus(clickedNode.id);
      }
    } else if (clickedEdge) {
      // Edge clicked - could be for selection or context menu
      debugLog('Edge clicked:', clickedEdge);
    } else {
      // Clicked empty space
      onNodeSelect(null);
      setLinkCreationState({
        sourceNodeId: null,
        isCreatingLink: false
      });
      if (process.env.NODE_ENV !== 'production') {
        try { console.debug('[Graph] LinkMode: reset on empty space click'); } catch {}
      }
    }
  }, [onNodeSelect, onNodeFocus, linkMode, linkCreationState, onLinkCreate]);

  // Handle right-click context menu for edges
  const handleCanvasContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
    const pos = getMousePosition(event);
    if (!pos) return;

    const { edges, nodes } = filteredDataRef.current;
    // Use same visibility logic as drawGraph for hit testing
    const baseEdges = (edges as any[]).filter((e: any) => !hiddenEdgeIdsRef.current.has((e as any).id));
    const edgesToTest = (baseEdges as any[]).concat(optimisticEdgesRef.current as any[]);

    // Prefer real edges (server-backed) where possible
    const isRealLinkId = (id: string) => /^link-\d+$/.test(id);
    const resolveRealLinkId = (edge: any): number | null => {
      try {
        if (isRealLinkId(edge.id)) return parseInt((edge.id as string).replace('link-', ''), 10);
        // fallback: find matching real edge by endpoints + relationship
        const sid = typeof edge.source === 'string' ? edge.source : (edge.source as any).id;
        const tid = typeof edge.target === 'string' ? edge.target : (edge.target as any).id;
        for (const e of (Array.from(stableEdgesRef.current.values()) as any[])) {
          const esid = typeof e.source === 'string' ? e.source : (e.source as any).id;
          const etid = typeof e.target === 'string' ? e.target : (e.target as any).id;
          if (esid === sid && etid === tid && e.relationship_type === edge.relationship_type && isRealLinkId(e.id)) {
            return parseInt((e.id as string).replace('link-', ''), 10);
          }
        }
      } catch {}
      return null;
    };

    // Collect all edges near the click (within 10px of line segment)
    const edgesNear = edgesToTest.filter(edge => {
      const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as any).id;
      const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as any).id;
      const sourceNode = nodes.find(n => n.id === sourceId);
      const targetNode = nodes.find(n => n.id === targetId);
      if (!sourceNode || !targetNode || !sourceNode.x || !sourceNode.y || !targetNode.x || !targetNode.y) return false;

      const A = pos.x - sourceNode.x;
      const B = pos.y - sourceNode.y;
      const C = targetNode.x - sourceNode.x;
      const D = targetNode.y - sourceNode.y;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      if (lenSq === 0) return false;

      const param = dot / lenSq;
      let xx, yy;
      if (param < 0) {
        xx = sourceNode.x; yy = sourceNode.y;
      } else if (param > 1) {
        xx = targetNode.x; yy = targetNode.y;
      } else {
        xx = sourceNode.x + param * C;
        yy = sourceNode.y + param * D;
      }
      const dx = pos.x - xx;
      const dy = pos.y - yy;
      return Math.sqrt(dx * dx + dy * dy) <= 10;
    });

    if (edgesNear.length > 1) {
      // Show selection list
      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        linkId: null,
        linkData: null,
        edges: edgesNear
      });
      return;
    }

    if (edgesNear.length === 1) {
      const clickedEdge = edgesNear[0];
      const linkId = resolveRealLinkId(clickedEdge);
      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        linkId,
        linkData: clickedEdge,
        edges: null
      });
      setEditRelType(clickedEdge.relationship_type);
      return;
    }

    // If no edge near the click, see if a node was right-clicked; if so, list all its incident edges
    const clickedNode = findNodeAtGraphPosition(pos.x, pos.y);
    if (clickedNode) {
      const nodeEdges = edgesToTest.filter(edge => {
        const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as any).id;
        const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as any).id;
        return sourceId === clickedNode.id || targetId === clickedNode.id;
      });
      if (nodeEdges.length > 0) {
        setContextMenu({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          linkId: null,
          linkData: null,
          edges: nodeEdges
        });
        return;
      }
    }

    // Nothing actionable; close any existing menu
    setContextMenu(prev => ({ ...prev, visible: false, edges: null, linkId: null, linkData: null }));
  }, []);

  // Setup zoom behavior - wait for container readiness
  useEffect(() => {
    if (!canvasRef.current || !isContainerReady) return;

    const canvas = select(canvasRef.current);
    
    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('start', (event: any) => {
        const se = event?.sourceEvent as any;
        })
      .on('zoom', (event: any) => {
        const se = event?.sourceEvent as any;
        try {
          // Clean up floating point precision errors
          const cleanTransform = {
            x: Math.abs(event.transform.x) < 1e-10 ? 0 : event.transform.x,
            y: Math.abs(event.transform.y) < 1e-10 ? 0 : event.transform.y,
            k: Math.abs(event.transform.k - 1) < 1e-10 ? 1 : event.transform.k
          };
          
          // Update transform ref directly (no React re-render)
          transformRef.current = cleanTransform;
        } catch (e) {
          console.error('[Graph] Zoom handler error', e);
        } finally {
          // Trigger redraw manually regardless
          drawGraph();
        }
      })
      .on('end', (event: any) => {
        const se = event?.sourceEvent as any;
        })
      .filter((event: any) => {
        const type = event?.type;
        const pointerType = (event as any)?.pointerType;
        const button = (event as any)?.button;
        let allow = true;

        // Check if we're over a node - if so, don't allow zoom/pan for drag events
        if (type === 'mousedown' || type === 'pointerdown' || type === 'touchstart') {
          const pos = getMousePosition(event);
          if (pos) {
            const nodeAtPos = findNodeAtGraphPosition(pos.x, pos.y);
            if (nodeAtPos && !linkMode) {
              return false; // Don't allow zoom/pan when over a node (unless in link mode)
            }
          }
        }

        // Wheel zoom always allowed
        if (type === 'wheel') {
          allow = true;
        } else if (type === 'pointerdown') {
          // Primary button or touch/pen
          allow = pointerType === 'touch' || pointerType === 'pen' || button === 0;
        } else if (type === 'pointermove') {
          allow = true;
        } else if (type === 'mousedown') {
          allow = button === 0;
        } else if (type === 'mousemove') {
          allow = true;
        } else if (type === 'touchstart' || type === 'touchmove') {
          allow = true;
        } else if (type === 'dblclick') {
          allow = false;
        } else {
          allow = true;
        }

        return allow;
      });

    // Store zoom behavior for programmatic transforms
    zoomBehaviorRef.current = zoomBehavior;

    // Initialize with identity transform and sync with our ref
    const initialTransform = zoomIdentity;
    transformRef.current = { x: 0, y: 0, k: 1 };
    
    canvas.call(zoomBehavior);
    
    // Apply initial transform to ensure D3 and our ref are synchronized
    canvas.call(zoomBehavior.transform, initialTransform);
    
    // Setup drag behavior for nodes
    const dragBehavior = drag<HTMLCanvasElement, unknown>()
      .on('start', (event: any) => {
        const pos = getMousePosition(event.sourceEvent);
        if (!pos) return;
        
        const draggedNode = findNodeAtGraphPosition(pos.x, pos.y);
        if (!draggedNode) return;
        
        // Fix the node position during drag
        draggedNode.fx = draggedNode.x;
        draggedNode.fy = draggedNode.y;
        
        // GENTLE REVIVAL: Only nudge simulation if it's truly dead, avoid aggressive restart
        if (simulationRef.current) {
          const currentAlpha = simulationRef.current.alpha();
          const currentTarget = simulationRef.current.alphaTarget();
          
          // Only revive if completely dead (much more conservative)
          if (currentAlpha < 0.005 && currentTarget < 0.001) {
            simulationRef.current.alpha(0.02);
          }
          // Keep the existing alphaTarget (0.001) - don't change it during drag
        }
      })
      .on('drag', (event: any) => {
        const pos = getMousePosition(event.sourceEvent);
        if (!pos) return;
        
        // Find the node being dragged by checking which node has fx/fy set
        const draggedNode = filteredDataRef.current.nodes.find(n =>
          typeof n.fx === 'number' && typeof n.fy === 'number'
        );
        
        if (draggedNode) {
          // Update the fixed position
          draggedNode.fx = pos.x;
          draggedNode.fy = pos.y;
          
          // Force redraw without restarting simulation
          drawGraph();
        }
      })
      .on('end', (event: any) => {
        const pos = getMousePosition(event.sourceEvent);
        if (!pos) return;
        
        // Find the node that was being dragged
        const draggedNode = filteredDataRef.current.nodes.find(n =>
          typeof n.fx === 'number' && typeof n.fy === 'number'
        );
        
        if (draggedNode && typeof draggedNode.fx === 'number' && typeof draggedNode.fy === 'number') {
          // Save the final position
          saveNodePosition(draggedNode.id, draggedNode.fx, draggedNode.fy);
          
          // Unfix the node so the simulation can continue naturally
          draggedNode.fx = undefined;
          draggedNode.fy = undefined;
          
          // Keep simulation at its minimal warm state - no changes needed
        }
      })
      .filter((event: any) => {
        // Only allow drag on nodes, not on empty space or edges
        const pos = getMousePosition(event);
        if (!pos) return false;
        
        const nodeAtPos = findNodeAtGraphPosition(pos.x, pos.y);
        return nodeAtPos !== undefined && !linkMode; // Don't drag when in link mode
      });

    // Store drag behavior for later cleanup
    dragBehaviorRef.current = dragBehavior;
    
    // Apply drag behavior to canvas
    canvas.call(dragBehavior);
    
    // Add click and context menu handlers
    canvas.on('click', handleCanvasClick);
    canvas.on('contextmenu', handleCanvasContextMenu);

    return () => {
      canvas.on('.zoom', null);
      canvas.on('.drag', null);
      canvas.on('click', null);
      canvas.on('contextmenu', null);
    };
  }, [isContainerReady]); // CRITICAL FIX: Remove handleCanvasClick/contextMenu deps to prevent re-runs on search clicks

  // Function to center view on a specific node
  const centerOnNode = useCallback((nodeId: string) => {
    const node = filteredDataRef.current.nodes.find(n => n.id === nodeId);
    if (!node || typeof node.x !== 'number' || typeof node.y !== 'number') {
      return;
    }

    const canvas = canvasRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!canvas || !zoomBehavior) {
      return;
    }

    // Calculate transform to center the node
    const canvasRect = canvas.getBoundingClientRect();
    const centerX = canvasRect.width / 2;
    const centerY = canvasRect.height / 2;

    // Current transform
    const currentTransform = transformRef.current;

    // Calculate new transform to center the node
    const newX = centerX - node.x * currentTransform.k;
    const newY = centerY - node.y * currentTransform.k;

    // Create proper D3 transform using zoomIdentity
    const newTransform = zoomIdentity
      .translate(newX, newY)
      .scale(currentTransform.k);

    // Update transform ref
    transformRef.current = { x: newX, y: newY, k: currentTransform.k };
    
    // Apply the transform using D3's proper API
    const canvasSelection = select(canvas);
    canvasSelection.call(zoomBehavior.transform, newTransform);
    
    // Redraw to reflect the new view
    drawGraph();
  }, [drawGraph]);

  // Loading overlay is rendered inside the canvas container to preserve interactions

  // Error overlay is rendered inside the canvas container to preserve interactions

  // No-data overlay is rendered inside the canvas container to preserve interactions

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-gray-50 dark:bg-gray-900">
      <canvas
        ref={canvasRef}
        className="cursor-move"
        style={{ display: 'block', touchAction: 'none' }}
      />
      
      <LoadingOverlay isLoading={isLoading} focusMode={focusMode} />
      
      <ErrorOverlay error={error} onRetry={() => window.location.reload()} />
      
      <NoDataOverlay graphData={graphData} isLoading={isLoading} error={error} focusMode={focusMode} />
      
      {/* Controls overlay */}
      <ControlsOverlay
        nodesCount={filteredDataRef.current.nodes.length}
        edgesCount={filteredDataRef.current.edges.length}
      />

      <SpacingControlsOverlay
        linkDistance={controlsUI.linkDistance}
        onLinkDistanceChange={handleLinkDistanceUIChange}
        chargeStrength={controlsUI.chargeStrength}
        onChargeStrengthChange={handleChargeStrengthUIChange}
        collisionRadius={controlsUI.collisionRadius}
        onCollisionRadiusChange={handleCollisionRadiusUIChange}
      />
      
      <LegendOverlay />
      {/* Context Menu for Links */}
      <LinkContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        edges={contextMenu.edges as any}
        linkData={contextMenu.linkData as any}
        editRelType={editRelType}
        onChangeRelType={(rel) => setEditRelType(rel)}
        onSelectEdge={handleSelectEdgeFromMenu}
        onSave={handleSaveContextEdit}
        onCancel={handleCancelContextMenu}
        onDelete={handleDeleteSelectedLink}
      />
      

      <LinkCreationMenu
        visible={linkMode && linkCreateUI.visible}
        x={linkCreateUI.x}
        y={linkCreateUI.y}
        relType={linkCreateUI.relType}
        onRelTypeChange={(rel) => setLinkCreateUI(prev => ({ ...prev, relType: rel }))}
        onCreate={handleCreateLinkFromMenu}
        onCancel={handleCancelCreateLinkMenu}
      />

       <LinkModeIndicator enabled={linkMode} sourceNodeId={linkCreationState.sourceNodeId} />

       {/* Search overlay with full integration */}
       <SearchOverlay
         nodes={filteredDataRef.current.nodes}
         onSearchResults={setSearchMatchingIds}
         onClearSearch={() => setSearchMatchingIds(new Set())}
         onSelectNode={onNodeSelect}
         onCenterNode={centerOnNode}
       />

    </div>
  );
}

// Export as default as well
export default GraphCanvas;