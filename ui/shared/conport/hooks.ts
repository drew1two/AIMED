// TanStack Query hooks for ConPort MCP integration
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { getConportClient, ConportQueryKeys, ConportClient } from "./client";
import type {
  GetRecentActivitySummaryArgsType,
  GetProgressArgsType,
  LogProgressArgsType,
  UpdateProgressArgsType,
  GetDecisionsArgsType,
  LogDecisionArgsType,
  UpdateDecisionArgsType,
  SearchDecisionsArgsType,
  UpdateContextArgsType,
  UpdateLinkArgsType,
  DeleteLinkByIdArgsType
} from "./schemas";

// ==================== ACTIVITY SUMMARY HOOKS ====================

export function useRecentActivitySummary(
  options: Partial<GetRecentActivitySummaryArgsType> = {},
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: ConportQueryKeys.activitySummary(options),
    queryFn: () => client.getRecentActivitySummary(options),
    // refetchInterval: 3000, // Temporarily disabled for debugging
    staleTime: 30000, // Increased stale time while debugging
    ...queryOptions
  });
}

// ==================== PROGRESS HOOKS ====================

export function useProgress(
  filters: Partial<GetProgressArgsType> = {},
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: ConportQueryKeys.progressList(filters),
    queryFn: () => client.getProgress(filters),
    staleTime: 5000, // Progress doesn't change as frequently
    ...queryOptions
  });
}

export function useLogProgress(
  mutationOptions?: UseMutationOptions<any, Error, Omit<LogProgressArgsType, "workspace_id">>
) {
  const queryClient = useQueryClient();
  const client = getConportClient();

  return useMutation({
    mutationFn: (args: Omit<LogProgressArgsType, "workspace_id">) =>
      client.logProgress(args),
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      // Execute hook's cache invalidation first
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.progress() });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
      await queryClient.refetchQueries({ queryKey: ConportQueryKeys.progress(), type: 'active' });
      
      // Then call component's onSuccess if provided
      await mutationOptions?.onSuccess?.(data, variables, context);
    },
  });
}

export function useUpdateProgress(
  mutationOptions?: UseMutationOptions<any, Error, Omit<UpdateProgressArgsType, "workspace_id">>
) {
  const queryClient = useQueryClient();
  const client = getConportClient();

  return useMutation({
    mutationFn: (args: Omit<UpdateProgressArgsType, "workspace_id">) =>
      client.updateProgress(args),
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      // Execute hook's cache invalidation first
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.progress() });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
      await queryClient.refetchQueries({ queryKey: ConportQueryKeys.progress(), type: 'active' });
      
      // Then call component's onSuccess if provided
      await mutationOptions?.onSuccess?.(data, variables, context);
    },
  });
}

export function useDeleteProgress(
  mutationOptions?: UseMutationOptions<any, Error, number>
) {
  const queryClient = useQueryClient();
  const client = getConportClient();

  return useMutation({
    mutationFn: (progressId: number) => client.deleteProgress(progressId),
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      // Execute hook's cache invalidation first
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.progress() });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
      await queryClient.refetchQueries({ queryKey: ConportQueryKeys.progress(), type: 'active' });
      
      // Then call component's onSuccess if provided
      await mutationOptions?.onSuccess?.(data, variables, context);
    },
  });
}

// ==================== INDIVIDUAL ITEM HOOKS ====================

export function useProgressItem(
  id: number | string,
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  const progressId = typeof id === 'string' ? parseInt(id) : id;
  
  return useQuery({
    queryKey: ConportQueryKeys.progressItem(progressId),
    queryFn: () => client.getProgressById(progressId),
    enabled: !isNaN(progressId),
    staleTime: 30000,
    ...queryOptions
  });
}

export function useDecisionItem(
  id: number | string,
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  const decisionId = typeof id === 'string' ? parseInt(id) : id;
  
  return useQuery({
    queryKey: ConportQueryKeys.decisionItem(decisionId),
    queryFn: () => client.getDecisionById(decisionId),
    enabled: !isNaN(decisionId),
    staleTime: 30000,
    ...queryOptions
  });
}

export function useSystemPatternItem(
  id: number | string,
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  const patternId = typeof id === 'string' ? parseInt(id) : id;
  
  return useQuery({
    queryKey: ConportQueryKeys.patternItem(patternId),
    queryFn: () => client.getSystemPatternById(patternId),
    enabled: !isNaN(patternId),
    staleTime: 30000,
    ...queryOptions
  });
}

export function useLinkedItems(
  itemType: string,
  itemId: string,
  options: any = {},
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: ConportQueryKeys.linkedItems(itemType, itemId),
    queryFn: () => client.getLinkedItems(itemType, itemId, options),
    enabled: !!itemType && !!itemId,
    staleTime: 30000,
    ...queryOptions
  });
}

// ==================== DECISION HOOKS ====================

export function useDecisions(
  filters: Partial<GetDecisionsArgsType> = {},
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: ConportQueryKeys.decisionsList(filters),
    queryFn: () => client.getDecisions(filters),
    staleTime: 10000, // Decisions are more stable
    ...queryOptions
  });
}

export function useLogDecision(
  mutationOptions?: UseMutationOptions<any, Error, Omit<LogDecisionArgsType, "workspace_id">>
) {
  const queryClient = useQueryClient();
  const client = getConportClient();

  return useMutation({
    mutationFn: (args: Omit<LogDecisionArgsType, "workspace_id">) =>
      client.logDecision(args),
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      // Execute hook's cache invalidation first
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.decisions() });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
      await queryClient.refetchQueries({ queryKey: ConportQueryKeys.decisions(), type: 'active' });
      
      // Then call component's onSuccess if provided
      await mutationOptions?.onSuccess?.(data, variables, context);
    },
  });
}

export function useUpdateDecision(
  mutationOptions?: UseMutationOptions<any, Error, Omit<UpdateDecisionArgsType, "workspace_id">>
) {
  const queryClient = useQueryClient();
  const client = getConportClient();

  return useMutation({
    mutationFn: (args: Omit<UpdateDecisionArgsType, "workspace_id">) =>
      client.updateDecision(args),
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      // Execute hook's cache invalidation first
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.decisions() });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
      await queryClient.refetchQueries({ queryKey: ConportQueryKeys.decisions(), type: 'active' });
      
      // Then call component's onSuccess if provided
      await mutationOptions?.onSuccess?.(data, variables, context);
    },
  });
}

export function useSearchDecisions(
  searchArgs: Omit<SearchDecisionsArgsType, "workspace_id">,
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: [...ConportQueryKeys.decisions(), "search", searchArgs],
    queryFn: () => client.searchDecisions(searchArgs),
    enabled: searchArgs.query_term.length > 0, // Only search if there's a query
    staleTime: 30000, // Search results can be cached longer
    ...queryOptions
  });
}

export function useDeleteDecision(
  mutationOptions?: UseMutationOptions<any, Error, number>
) {
  const queryClient = useQueryClient();
  const client = getConportClient();

  return useMutation({
    mutationFn: (decisionId: number) =>
      client.deleteDecision(decisionId),
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      // Execute hook's cache invalidation first
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.decisions() });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
      await queryClient.refetchQueries({ queryKey: ConportQueryKeys.decisions(), type: 'active' });
      
      // Then call component's onSuccess if provided
      await mutationOptions?.onSuccess?.(data, variables, context);
    },
  });
}

// ==================== SEARCH HOOKS ====================

export function useSemanticSearch(
  queryText: string,
  options: any = {},
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: [...ConportQueryKeys.all, "semantic_search", queryText, options],
    queryFn: () => client.semanticSearch(queryText, options),
    enabled: queryText.length > 0,
    staleTime: 30000,
    ...queryOptions
  });
}

export function useSearchProgress(
  queryText: string,
  options: any = {},
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: [...ConportQueryKeys.progress(), "search", queryText, options],
    queryFn: () => client.searchProgress(queryText, options),
    enabled: queryText.length > 0,
    staleTime: 30000,
    ...queryOptions
  });
}

export function useSearchPatterns(
  queryText: string,
  options: any = {},
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: [...ConportQueryKeys.patterns(), "search", queryText, options],
    queryFn: () => client.searchPatterns(queryText, options),
    enabled: queryText.length > 0,
    staleTime: 30000,
    ...queryOptions
  });
}

export function useSearchContext(
  queryText: string,
  options: any = {},
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  // Bump this when changing the client.searchContext transform shape
  const TRANSFORM_VERSION = 2;

  return useQuery({
    // Include transform version to bust stale caches and ensure new mapping is used
    queryKey: [...ConportQueryKeys.context(), "search", TRANSFORM_VERSION, queryText, options],
    queryFn: () => client.searchContext(queryText, options),
    enabled: queryText.length > 0,
    staleTime: 30000,
    ...queryOptions
  });
}

export function useSearchCustomData(
  queryText: string,
  options: any = {},
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: [...ConportQueryKeys.all, "custom_search", queryText, options],
    queryFn: () => client.searchCustomData(queryText, options),
    enabled: queryText.length > 0,
    staleTime: 30000,
    ...queryOptions
  });
}

// ==================== CUSTOM DATA HOOKS ====================

export function useCustomData(
  category?: string,
  key?: string,
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: [...ConportQueryKeys.all, "custom_data", category, key],
    queryFn: () => client.getCustomData(category, key),
    staleTime: 30000, // Custom data is quite stable
    ...queryOptions
  });
}

export function useLogCustomData(
  mutationOptions?: UseMutationOptions<any, Error, { category: string; key: string; value: any }>
) {
  const queryClient = useQueryClient();
  const client = getConportClient();

  return useMutation({
    mutationFn: ({ category, key, value }: { category: string; key: string; value: any }) =>
      client.logCustomData(category, key, value),
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      // Execute hook's cache invalidation first
      await queryClient.invalidateQueries({ queryKey: [...ConportQueryKeys.all, "custom_data"] });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
      await queryClient.refetchQueries({ queryKey: [...ConportQueryKeys.all, "custom_data"], type: 'active' });
      
      // Then call component's onSuccess if provided
      await mutationOptions?.onSuccess?.(data, variables, context);
    },
  });
}

export function useDeleteCustomData(
  mutationOptions?: UseMutationOptions<any, Error, { category: string; key: string }>
) {
  const queryClient = useQueryClient();
  const client = getConportClient();

  return useMutation({
    mutationFn: ({ category, key }: { category: string; key: string }) =>
      client.deleteCustomData(category, key),
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      // Execute hook's cache invalidation first
      await queryClient.invalidateQueries({ queryKey: [...ConportQueryKeys.all, "custom_data"] });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
      await queryClient.refetchQueries({ queryKey: [...ConportQueryKeys.all, "custom_data"], type: 'active' });
      
      // Then call component's onSuccess if provided
      await mutationOptions?.onSuccess?.(data, variables, context);
    },
  });
}

export function useAllCustomDataByIdDesc(
  limit?: number,
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: [...ConportQueryKeys.all, "custom_data_by_id_desc", limit],
    queryFn: () => client.getAllCustomDataByIdDesc(limit),
    staleTime: 30000, // Custom data is quite stable
    ...queryOptions
  });
}

// ==================== SYSTEM PATTERNS HOOKS ====================

export function useSystemPatterns(
  filters: any = {},
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: [...ConportQueryKeys.patterns(), "list", filters],
    queryFn: () => client.getSystemPatterns(filters),
    staleTime: 30000, // Patterns are quite stable
    ...queryOptions
  });
}

export function useLogSystemPattern(
  mutationOptions?: UseMutationOptions<any, Error, { name: string; description?: string; tags?: string[] }>
) {
  const queryClient = useQueryClient();
  const client = getConportClient();

  return useMutation({
    mutationFn: (args: { name: string; description?: string; tags?: string[] }) =>
      client.logSystemPattern(args),
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      // Execute hook's cache invalidation first
      await queryClient.invalidateQueries({ queryKey: [...ConportQueryKeys.patterns()] });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
      await queryClient.refetchQueries({ queryKey: [...ConportQueryKeys.patterns()], type: 'active' });
      
      // Then call component's onSuccess if provided
      await mutationOptions?.onSuccess?.(data, variables, context);
    },
  });
}

export function useDeleteSystemPattern(
  mutationOptions?: UseMutationOptions<any, Error, number>
) {
  const queryClient = useQueryClient();
  const client = getConportClient();

  return useMutation({
    mutationFn: (patternId: number) =>
      client.deleteSystemPattern(patternId),
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      // Execute hook's cache invalidation first
      await queryClient.invalidateQueries({ queryKey: [...ConportQueryKeys.patterns()] });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
      await queryClient.refetchQueries({ queryKey: [...ConportQueryKeys.patterns()], type: 'active' });
      
      // Then call component's onSuccess if provided
      await mutationOptions?.onSuccess?.(data, variables, context);
    },
  });
}

// ==================== CONTEXT HOOKS ====================

export function useProductContext(
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: ConportQueryKeys.productContext(),
    queryFn: () => client.getProductContext(),
    staleTime: 60000, // Product context changes less frequently
    ...queryOptions
  });
}

export function useActiveContext(
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: ConportQueryKeys.activeContext(),
    queryFn: () => client.getActiveContext(),
    staleTime: 30000, // Active context changes more frequently than product
    ...queryOptions
  });
}

export function useUpdateProductContext(
  mutationOptions?: UseMutationOptions<any, Error, { content?: Record<string, any>; patch?: Record<string, any> }>
) {
  const queryClient = useQueryClient();
  const client = getConportClient();

  return useMutation({
    mutationFn: ({ content, patch }: { content?: Record<string, any>; patch?: Record<string, any> }) => 
      client.updateProductContext(content, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ConportQueryKeys.productContext() });
      queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
    },
    ...mutationOptions
  });
}

export function useUpdateActiveContext(
  mutationOptions?: UseMutationOptions<any, Error, { content?: Record<string, any>; patch?: Record<string, any> }>
) {
  const queryClient = useQueryClient();
  const client = getConportClient();

  return useMutation({
    mutationFn: ({ content, patch }: { content?: Record<string, any>; patch?: Record<string, any> }) => 
      client.updateActiveContext(content, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activeContext() });
      queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
    },
    ...mutationOptions
  });
}

// ==================== UTILITY HOOKS ====================

export function useRefreshAll() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ConportQueryKeys.all });
  };
}

export function useManualRefresh() {
  const queryClient = useQueryClient();

  return {
    refreshActivity: () => queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() }),
    refreshProgress: () => queryClient.invalidateQueries({ queryKey: ConportQueryKeys.progress() }),
    refreshDecisions: () => queryClient.invalidateQueries({ queryKey: ConportQueryKeys.decisions() }),
    refreshContext: () => queryClient.invalidateQueries({ queryKey: ConportQueryKeys.context() }),
    refreshAll: () => queryClient.invalidateQueries({ queryKey: ConportQueryKeys.all })
  };
}

// ==================== ERROR HANDLING HOOK ====================

export function useConportErrorHandler() {
  return (error: unknown) => {
    console.error("ConPort Error:", error);
    // Could integrate with toast notifications here
    // Could also log errors to ConPort using log_custom_data
  };
}

// ==================== WORKSPACE MANAGEMENT HOOKS ====================

export function useWorkspaceId() {
  const client = getConportClient();
  return (client as any).workspaceId; // Type assertion needed since workspaceId is private
}

// ==================== OPTIMISTIC UPDATES HELPERS ====================

export const ConportOptimisticHelpers = {
  // Helper for optimistic progress updates
  updateProgressOptimistically: (
    queryClient: ReturnType<typeof useQueryClient>,
    progressId: number,
    updates: Partial<{ status: string; description: string }>
  ) => {
    queryClient.setQueryData(
      ConportQueryKeys.progressList(),
      (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((item: any) => 
          item.id === progressId ? { ...item, ...updates } : item
        );
      }
    );
  },

  // Helper for optimistic progress creation
  addProgressOptimistically: (
    queryClient: ReturnType<typeof useQueryClient>,
    newProgress: { status: string; description: string; id?: number }
  ) => {
    const tempId = Date.now(); // Temporary ID
    queryClient.setQueryData(
      ConportQueryKeys.progressList(),
      (old: any) => {
        if (!old || !Array.isArray(old)) return [{ ...newProgress, id: tempId }];
        return [{ ...newProgress, id: tempId }, ...old];
      }
    );
    return tempId;
  }
};

// ==================== GRAPH HOOKS ====================

export function useGraphData(
  options: {
    includeDecisions?: boolean;
    includeProgress?: boolean;
    includeSystemPatterns?: boolean;
    includeCustomData?: boolean;
    limit?: number;
  } = {},
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: ConportQueryKeys.graphData(options),
    queryFn: () => client.getGraphData(options),
    staleTime: 30000, // 30 seconds
    ...queryOptions
  });
}

export function useFocusedGraphData(
  centerNodeType: string | null,
  centerNodeId: string | null,
  hopDepth: number = 2,
  enabled: boolean = true,
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: ConportQueryKeys.focusedGraphData(
      centerNodeType || '',
      centerNodeId || '',
      hopDepth
    ),
    queryFn: () => {
      if (!centerNodeType || !centerNodeId) {
        throw new Error('Center node type and ID are required for focused graph data');
      }
      return client.getFocusedGraphData(centerNodeType, centerNodeId, hopDepth);
    },
    enabled: enabled && !!centerNodeType && !!centerNodeId,
    staleTime: 30000, // 30 seconds
    ...queryOptions
  });
}

export function useAllLinks(
  queryOptions?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn">
) {
  const client = getConportClient();
  
  return useQuery({
    queryKey: ConportQueryKeys.allLinks(),
    queryFn: () => client.getAllLinks(),
    staleTime: 30000, // 30 seconds
    ...queryOptions
  });
}

export function useCreateLink(
  mutationOptions?: UseMutationOptions<any, Error, {
    sourceType: string;
    sourceId: string;
    targetType: string;
    targetId: string;
    relationshipType: string;
    description?: string;
  }>
) {
  const client = getConportClient();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({
      sourceType,
      sourceId,
      targetType,
      targetId,
      relationshipType,
      description
    }: {
      sourceType: string;
      sourceId: string;
      targetType: string;
      targetId: string;
      relationshipType: string;
      description?: string;
    }) => {
      return client.createLink(
        sourceType,
        sourceId,
        targetType,
        targetId,
        relationshipType,
        description
      );
    },
    onSuccess: async () => {
      // Invalidate and immediately refetch graph-related queries so canvas updates without manual refresh
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.graph() });
      await queryClient.invalidateQueries({ queryKey: [...ConportQueryKeys.all, "linked"] });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
      await queryClient.refetchQueries({ queryKey: ConportQueryKeys.graph(), type: 'active' });
      await queryClient.refetchQueries({ queryKey: [...ConportQueryKeys.all, "linked"], type: 'active' });
    },
    ...mutationOptions
  });
}

export function useUpdateLink(
  mutationOptions?: UseMutationOptions<any, Error, Omit<UpdateLinkArgsType, "workspace_id">>
) {
  const client = getConportClient();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (args: Omit<UpdateLinkArgsType, "workspace_id">) =>
      client.updateLink(args),
    onSuccess: async () => {
      // Invalidate and immediately refetch graph queries
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.graph() });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.allLinks() });
      await queryClient.invalidateQueries({ queryKey: [...ConportQueryKeys.all, "linked"] });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
      await queryClient.refetchQueries({ queryKey: ConportQueryKeys.graph(), type: 'active' });
      await queryClient.refetchQueries({ queryKey: ConportQueryKeys.allLinks(), type: 'active' });
      await queryClient.refetchQueries({ queryKey: [...ConportQueryKeys.all, "linked"], type: 'active' });
    },
    ...mutationOptions
  });
}

export function useDeleteLink(
  mutationOptions?: UseMutationOptions<any, Error, Omit<DeleteLinkByIdArgsType, "workspace_id">>
) {
  const client = getConportClient();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (args: Omit<DeleteLinkByIdArgsType, "workspace_id">) =>
      client.deleteLink(args),
    onSuccess: async () => {
      // Invalidate and immediately refetch graph queries
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.graph() });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.allLinks() });
      await queryClient.invalidateQueries({ queryKey: [...ConportQueryKeys.all, "linked"] });
      await queryClient.invalidateQueries({ queryKey: ConportQueryKeys.activity() });
      await queryClient.refetchQueries({ queryKey: ConportQueryKeys.graph(), type: 'active' });
      await queryClient.refetchQueries({ queryKey: ConportQueryKeys.allLinks(), type: 'active' });
      await queryClient.refetchQueries({ queryKey: [...ConportQueryKeys.all, "linked"], type: 'active' });
    },
    ...mutationOptions
  });
}

// ==================== GRAPH DATA TRANSFORMATION ====================

import {
  DecisionNode,
  ProgressNode,
  SystemPatternNode,
  CustomDataNode,
  GraphNode,
  GraphEdge,
  GraphData,
  createDecisionNode,
  createProgressNode,
  createSystemPatternNode,
  createCustomDataNode,
  createGraphEdge
} from './graph-types';

/**
 * Transform ConPort data into GraphData format for the visualization
 */
export function transformConportToGraphData(data: {
  decisions: any[];
  progress: any[];
  systemPatterns: any[];
  customData: any[];
  links: any[];
}): GraphData {

  const nodes: GraphNode[] = [
    ...data.decisions.map((decision) => createDecisionNode(decision)),
    ...data.progress.map((progress) => createProgressNode(progress)),
    ...data.systemPatterns.map((pattern) => createSystemPatternNode(pattern)),
    ...data.customData.map((custom) => createCustomDataNode(custom))
  ];

  const edges: GraphEdge[] = data.links
    .map((link) => createGraphEdge(link))
    .filter((edge): edge is GraphEdge => edge !== null);


  return { nodes, edges };
}