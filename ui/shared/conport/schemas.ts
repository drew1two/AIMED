// Auto-generated ConPort schemas from get_conport_schema
// Generated on: 2025-08-14T05:09:28.289Z
import { z } from "zod";

// ==================== COMMON SCHEMAS ====================

export const WorkspaceIdSchema = z.object({
  workspace_id: z.string()
});
export type WorkspaceIdType = z.infer<typeof WorkspaceIdSchema>;

// ==================== CONTEXT SCHEMAS ====================

// get_product_context & get_active_context
export const GetContextArgsSchema = z.object({
  workspace_id: z.string()
});
export type GetContextArgsType = z.infer<typeof GetContextArgsSchema>;

// update_product_context & update_active_context
export const UpdateContextArgsSchema = z.object({
  workspace_id: z.string(),
  content: z.record(z.string(), z.any()).optional().nullable(),
  patch_content: z.record(z.string(), z.any()).optional().nullable()
});
export type UpdateContextArgsType = z.infer<typeof UpdateContextArgsSchema>;

// ==================== DECISION SCHEMAS ====================

// log_decision
export const LogDecisionArgsSchema = z.object({
  workspace_id: z.string(),
  summary: z.string().min(1),
  rationale: z.string().optional().nullable(),
  implementation_details: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable()
});
export type LogDecisionArgsType = z.infer<typeof LogDecisionArgsSchema>;

// get_decisions
export const GetDecisionsArgsSchema = z.object({
  workspace_id: z.string(),
  limit: z.number().int().min(1).optional().nullable(),
  tags_filter_include_all: z.array(z.string()).optional().nullable(),
  tags_filter_include_any: z.array(z.string()).optional().nullable()
});
export type GetDecisionsArgsType = z.infer<typeof GetDecisionsArgsSchema>;

// search_decisions_fts
export const SearchDecisionsArgsSchema = z.object({
  workspace_id: z.string(),
  query_term: z.string().min(1),
  limit: z.number().int().min(1).default(10)
});
export type SearchDecisionsArgsType = z.infer<typeof SearchDecisionsArgsSchema>;

// update_decision
export const UpdateDecisionArgsSchema = z.object({
  workspace_id: z.string(),
  decision_id: z.number().int().min(1),
  summary: z.string().min(1).optional().nullable(),
  rationale: z.string().optional().nullable(),
  implementation_details: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable()
});
export type UpdateDecisionArgsType = z.infer<typeof UpdateDecisionArgsSchema>;

// delete_decision_by_id
export const DeleteDecisionByIdArgsSchema = z.object({
  workspace_id: z.string(),
  decision_id: z.number().int().min(1)
});
export type DeleteDecisionByIdArgsType = z.infer<typeof DeleteDecisionByIdArgsSchema>;

// ==================== PROGRESS SCHEMAS ====================

// log_progress
export const LogProgressArgsSchema = z.object({
  workspace_id: z.string(),
  status: z.string(),
  description: z.string().min(1),
  parent_id: z.number().int().optional().nullable(),
  linked_item_type: z.string().optional().nullable(),
  linked_item_id: z.string().optional().nullable(),
  link_relationship_type: z.string().default("relates_to_progress")
});
export type LogProgressArgsType = z.infer<typeof LogProgressArgsSchema>;

// get_progress
export const GetProgressArgsSchema = z.object({
  workspace_id: z.string(),
  status_filter: z.string().optional().nullable(),
  parent_id_filter: z.number().int().optional().nullable(),
  limit: z.number().int().min(1).optional().nullable()
});
export type GetProgressArgsType = z.infer<typeof GetProgressArgsSchema>;

// update_progress
export const UpdateProgressArgsSchema = z.object({
  workspace_id: z.string(),
  progress_id: z.number().int().min(1),
  status: z.string().optional().nullable(),
  description: z.string().min(1).optional().nullable(),
  parent_id: z.number().int().optional().nullable()
});
export type UpdateProgressArgsType = z.infer<typeof UpdateProgressArgsSchema>;

// delete_progress_by_id
export const DeleteProgressByIdArgsSchema = z.object({
  workspace_id: z.string(),
  progress_id: z.number().int().min(1)
});
export type DeleteProgressByIdArgsType = z.infer<typeof DeleteProgressByIdArgsSchema>;

// search_progress_fts
export const SearchProgressArgsSchema = z.object({
  workspace_id: z.string(),
  query_term: z.string().min(1),
  limit: z.number().int().min(1).default(10)
});
export type SearchProgressArgsType = z.infer<typeof SearchProgressArgsSchema>;

// ==================== SYSTEM PATTERN SCHEMAS ====================

// log_system_pattern
export const LogSystemPatternArgsSchema = z.object({
  workspace_id: z.string(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable()
});
export type LogSystemPatternArgsType = z.infer<typeof LogSystemPatternArgsSchema>;

// get_system_patterns
export const GetSystemPatternsArgsSchema = z.object({
  workspace_id: z.string(),
  limit: z.number().int().min(1).optional().nullable(),
  tags_filter_include_all: z.array(z.string()).optional().nullable(),
  tags_filter_include_any: z.array(z.string()).optional().nullable()
});
export type GetSystemPatternsArgsType = z.infer<typeof GetSystemPatternsArgsSchema>;

// delete_system_pattern_by_id
export const DeleteSystemPatternByIdArgsSchema = z.object({
  workspace_id: z.string(),
  pattern_id: z.number().int().min(1)
});
export type DeleteSystemPatternByIdArgsType = z.infer<typeof DeleteSystemPatternByIdArgsSchema>;

// search_system_patterns_fts
export const SearchSystemPatternsArgsSchema = z.object({
  workspace_id: z.string(),
  query_term: z.string().min(1),
  limit: z.number().int().min(1).default(10)
});
export type SearchSystemPatternsArgsType = z.infer<typeof SearchSystemPatternsArgsSchema>;

// ==================== CUSTOM DATA SCHEMAS ====================

// log_custom_data
export const LogCustomDataArgsSchema = z.object({
  workspace_id: z.string(),
  category: z.string().min(1),
  key: z.string().min(1),
  value: z.any()
});
export type LogCustomDataArgsType = z.infer<typeof LogCustomDataArgsSchema>;

// get_custom_data
export const GetCustomDataArgsSchema = z.object({
  workspace_id: z.string(),
  category: z.string().optional().nullable(),
  key: z.string().optional().nullable()
});
export type GetCustomDataArgsType = z.infer<typeof GetCustomDataArgsSchema>;

// delete_custom_data
export const DeleteCustomDataArgsSchema = z.object({
  workspace_id: z.string(),
  category: z.string().min(1),
  key: z.string().min(1)
});
export type DeleteCustomDataArgsType = z.infer<typeof DeleteCustomDataArgsSchema>;

// search_custom_data_value_fts
export const SearchCustomDataValueArgsSchema = z.object({
  workspace_id: z.string(),
  query_term: z.string().min(1),
  category_filter: z.string().optional().nullable(),
  limit: z.number().int().min(1).default(10)
});
export type SearchCustomDataValueArgsType = z.infer<typeof SearchCustomDataValueArgsSchema>;

// search_project_glossary_fts
export const SearchProjectGlossaryArgsSchema = z.object({
  workspace_id: z.string(),
  query_term: z.string().min(1),
  limit: z.number().int().min(1).default(10)
});
export type SearchProjectGlossaryArgsType = z.infer<typeof SearchProjectGlossaryArgsSchema>;

// search_context_fts
export const SearchContextArgsSchema = z.object({
  workspace_id: z.string(),
  query_term: z.string().min(1),
  limit: z.number().int().min(1).default(10)
});
export type SearchContextArgsType = z.infer<typeof SearchContextArgsSchema>;

// ==================== LINKING SCHEMAS ====================

// link_conport_items
export const LinkConportItemsArgsSchema = z.object({
  workspace_id: z.string(),
  source_item_type: z.string(),
  source_item_id: z.string(),
  target_item_type: z.string(),
  target_item_id: z.string(),
  relationship_type: z.string(),
  description: z.string().optional().nullable()
});
export type LinkConportItemsArgsType = z.infer<typeof LinkConportItemsArgsSchema>;

// get_linked_items
export const GetLinkedItemsArgsSchema = z.object({
  workspace_id: z.string(),
  item_type: z.string(),
  item_id: z.string(),
  relationship_type_filter: z.string().optional().nullable(),
  linked_item_type_filter: z.string().optional().nullable(),
  limit: z.number().int().min(1).optional().nullable()
});
export type GetLinkedItemsArgsType = z.infer<typeof GetLinkedItemsArgsSchema>;

// get_items_by_references
export const GetItemsByReferencesArgsSchema = z.object({
  workspace_id: z.string(),
  references: z.array(z.object({
    type: z.string(),
    id: z.string()
  })).optional().nullable(),
  linked_items_result: z.array(z.record(z.string(), z.any())).optional().nullable()
});
export type GetItemsByReferencesArgsType = z.infer<typeof GetItemsByReferencesArgsSchema>;

// update_link
export const UpdateLinkArgsSchema = z.object({
  workspace_id: z.string(),
  link_id: z.number().int().min(1),
  relationship_type: z.string().optional().nullable(),
  description: z.string().optional().nullable()
});
export type UpdateLinkArgsType = z.infer<typeof UpdateLinkArgsSchema>;

// delete_link_by_id
export const DeleteLinkByIdArgsSchema = z.object({
  workspace_id: z.string(),
  link_id: z.number().int().min(1)
});
export type DeleteLinkByIdArgsType = z.infer<typeof DeleteLinkByIdArgsSchema>;

// ==================== UTILITY SCHEMAS ====================

// batch_log_items
export const BatchLogItemsArgsSchema = z.object({
  workspace_id: z.string(),
  item_type: z.string(),
  items: z.array(z.record(z.string(), z.any()))
});
export type BatchLogItemsArgsType = z.infer<typeof BatchLogItemsArgsSchema>;

// get_item_history
export const GetItemHistoryArgsSchema = z.object({
  workspace_id: z.string(),
  item_type: z.string(),
  limit: z.number().int().min(1).optional().nullable(),
  before_timestamp: z.string().datetime().optional().nullable(),
  after_timestamp: z.string().datetime().optional().nullable(),
  version: z.number().int().min(1).optional().nullable()
});
export type GetItemHistoryArgsType = z.infer<typeof GetItemHistoryArgsSchema>;

// get_conport_schema
export const GetConportSchemaArgsSchema = z.object({
  workspace_id: z.string()
});
export type GetConportSchemaArgsType = z.infer<typeof GetConportSchemaArgsSchema>;

// get_recent_activity_summary
export const GetRecentActivitySummaryArgsSchema = z.object({
  workspace_id: z.string(),
  hours_ago: z.number().int().min(1).optional().nullable(),
  since_timestamp: z.string().datetime().optional().nullable(),
  limit_per_type: z.number().int().min(1).default(5)
});
export type GetRecentActivitySummaryArgsType = z.infer<typeof GetRecentActivitySummaryArgsSchema>;

// semantic_search_conport
export const SemanticSearchConportArgsSchema = z.object({
  workspace_id: z.string(),
  query_text: z.string().min(1),
  top_k: z.number().int().min(1).max(25).default(5),
  filter_item_types: z.array(z.string()).optional().nullable(),
  filter_tags_include_any: z.array(z.string()).optional().nullable(),
  filter_tags_include_all: z.array(z.string()).optional().nullable(),
  filter_custom_data_categories: z.array(z.string()).optional().nullable()
});
export type SemanticSearchConportArgsType = z.infer<typeof SemanticSearchConportArgsSchema>;

// ==================== WORKSPACE DETECTION SCHEMAS ====================

// get_workspace_detection_info
export const GetWorkspaceDetectionInfoArgsSchema = z.object({
  start_path: z.string().optional().nullable()
});
export type GetWorkspaceDetectionInfoArgsType = z.infer<typeof GetWorkspaceDetectionInfoArgsSchema>;

// ==================== EXPORT/IMPORT SCHEMAS ====================

// export_conport_to_markdown
export const ExportConportToMarkdownArgsSchema = z.object({
  workspace_id: z.string(),
  output_path: z.string().optional().nullable()
});
export type ExportConportToMarkdownArgsType = z.infer<typeof ExportConportToMarkdownArgsSchema>;

// import_markdown_to_conport
export const ImportMarkdownToConportArgsSchema = z.object({
  workspace_id: z.string(),
  input_path: z.string().optional().nullable()
});
export type ImportMarkdownToConportArgsType = z.infer<typeof ImportMarkdownToConportArgsSchema>;

// ==================== TOOL REGISTRY ====================

// Complete mapping of all ConPort tools to their argument schemas
export const ToolArgSchemas = {
  // Context
  get_product_context: GetContextArgsSchema,
  update_product_context: UpdateContextArgsSchema,
  get_active_context: GetContextArgsSchema,
  update_active_context: UpdateContextArgsSchema,
  
  // Decisions
  log_decision: LogDecisionArgsSchema,
  get_decisions: GetDecisionsArgsSchema,
  search_decisions_fts: SearchDecisionsArgsSchema,
  update_decision: UpdateDecisionArgsSchema,
  delete_decision_by_id: DeleteDecisionByIdArgsSchema,
  
  // Progress
  log_progress: LogProgressArgsSchema,
  get_progress: GetProgressArgsSchema,
  update_progress: UpdateProgressArgsSchema,
  delete_progress_by_id: DeleteProgressByIdArgsSchema,
  search_progress_fts: SearchProgressArgsSchema,
  
  // System Patterns
  log_system_pattern: LogSystemPatternArgsSchema,
  get_system_patterns: GetSystemPatternsArgsSchema,
  delete_system_pattern_by_id: DeleteSystemPatternByIdArgsSchema,
  search_system_patterns_fts: SearchSystemPatternsArgsSchema,
  
  // Custom Data
  log_custom_data: LogCustomDataArgsSchema,
  get_custom_data: GetCustomDataArgsSchema,
  delete_custom_data: DeleteCustomDataArgsSchema,
  search_custom_data_value_fts: SearchCustomDataValueArgsSchema,
  search_project_glossary_fts: SearchProjectGlossaryArgsSchema,
  search_context_fts: SearchContextArgsSchema,
  
  // Linking
  link_conport_items: LinkConportItemsArgsSchema,
  get_linked_items: GetLinkedItemsArgsSchema,
  get_items_by_references: GetItemsByReferencesArgsSchema,
  update_link: UpdateLinkArgsSchema,
  delete_link_by_id: DeleteLinkByIdArgsSchema,
  
  // Utilities
  batch_log_items: BatchLogItemsArgsSchema,
  get_item_history: GetItemHistoryArgsSchema,
  get_conport_schema: GetConportSchemaArgsSchema,
  get_recent_activity_summary: GetRecentActivitySummaryArgsSchema,
  semantic_search_conport: SemanticSearchConportArgsSchema,
  
  // Workspace Detection
  get_workspace_detection_info: GetWorkspaceDetectionInfoArgsSchema,
  
  // Export/Import
  export_conport_to_markdown: ExportConportToMarkdownArgsSchema,
  import_markdown_to_conport: ImportMarkdownToConportArgsSchema
} as const;

export type ToolName = keyof typeof ToolArgSchemas;
export type ToolArgs<T extends ToolName> = z.infer<typeof ToolArgSchemas[T]>;

// ==================== RESPONSE SCHEMAS ====================

// Common response patterns (these would need to be inferred from actual API responses)
export const ConportSuccessResponseSchema = z.object({
  status: z.literal("success"),
  message: z.string().optional(),
  data: z.any().optional()
});

export const ConportErrorResponseSchema = z.object({
  status: z.literal("error"),
  message: z.string(),
  error_code: z.string().optional()
});

export const ConportResponseSchema = z.union([
  ConportSuccessResponseSchema,
  ConportErrorResponseSchema,
  z.any() // For direct data responses
]);

export type ConportResponseType = z.infer<typeof ConportResponseSchema>;