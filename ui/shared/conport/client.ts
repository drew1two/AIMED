// ConPort MCP Client implementation with TanStack Query integration
import { z } from "zod";
import type {
  ToolName,
  ToolArgs,
  ConportResponseType,
  GetRecentActivitySummaryArgsType,
  GetProgressArgsType,
  LogProgressArgsType,
  UpdateProgressArgsType,
  GetContextArgsType,
  UpdateContextArgsType,
  LogDecisionArgsType,
  GetDecisionsArgsType,
  SearchDecisionsArgsType,
  UpdateLinkArgsType,
  DeleteLinkByIdArgsType
} from "./schemas";
import { ToolArgSchemas } from "./schemas";

// ==================== DEBUG CONTROL ====================

// Cache for debug state from ui-cache preference API
let debugStateCache: boolean | null = null;
let debugStateInitialized = false;

/**
 * Initialize debug state from ui-cache preference API
 * This connects to the Navigation.tsx toggle ("Workspace Info")
 */
const initializeDebugState = async (): Promise<void> => {
  if (debugStateInitialized || typeof window === 'undefined') return;
  
  try {
    // Import WorkspaceManager to get current workspace
    const workspaceId = await WorkspaceManager.getDetected();
    if (!workspaceId) return;
    
    // Fetch from MCP server's ui-cache preference API
    const response = await fetch(
      `/api/get-workspace-mcp-port`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      const serverUrl = data.env_vars?.mcp_server_url?.replace('/mcp/', '') || 'http://localhost:8020';
      
      // Now fetch the actual debug preference
      const prefResponse = await fetch(
        `${serverUrl}/api/ui-cache/preference?workspace_id=${encodeURIComponent(workspaceId)}&preference_key=show_workspace_debug`
      );
      
      if (prefResponse.ok) {
        const prefData = await prefResponse.json();
        if (prefData.success && prefData.value && prefData.value.data !== undefined) {
          debugStateCache = prefData.value.data === true;
        }
      }
    }
  } catch (error) {
    // Silently fail - debug state will default to false
  } finally {
    debugStateInitialized = true;
  }
};

/**
 * Check if debug mode is enabled
 * Must be in development mode AND user has toggled "Workspace Info" on
 */
const isDebugEnabled = (): boolean => {
  // Must be in development mode
  if (process.env.NODE_ENV !== 'development') return false;
  
  // Return cached state (false until initialized)
  return debugStateCache === true;
};

const debugLog = (...args: any[]): void => {
  if (isDebugEnabled()) {
    console.log(...args);
  }
};

const debugWarn = (...args: any[]): void => {
  if (isDebugEnabled()) {
    console.warn(...args);
  }
};

/**
 * User feedback logging - always visible in development to confirm actions
 * Use for messages like "Saved position", "Deleted item", etc.
 */
const userLog = (...args: any[]): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};

const userWarn = (...args: any[]): void => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(...args);
  }
};

// Initialize debug state on module load (client-side only)
if (typeof window !== 'undefined') {
  initializeDebugState();
  
  // Listen for debug toggle events from Navigation.tsx
  window.addEventListener('debugInfoToggle', ((event: CustomEvent) => {
    debugStateCache = event.detail === true;
  }) as EventListener);
}

// ==================== CONFIG ====================

// FIXED: Remove dependency on shared environment variable to prevent workspace isolation contamination
// const DEFAULT_WORKSPACE_ID_ENV = (process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID as string | undefined) ?? undefined;

// Helper function to discover workspace-specific environment variables from ui-cache
const discoverWorkspaceEnvVars = async (workspaceId: string): Promise<{
  workspace_id: string;
  mcp_server_url: string;
  env_vars: any;
}> => {
  if (typeof window === "undefined") {
    // Server-side: use environment variable fallback
    return {
      workspace_id: workspaceId || "",
      mcp_server_url: process.env.NEXT_PUBLIC_CONPORT_SERVER_URL || "http://localhost:8020/mcp/",
      env_vars: null
    };
  }
  
  // Client-side: try to read consolidated environment variables from UI cache
  try {
    const response = await fetch('/api/get-workspace-mcp-port', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.env_vars && typeof data.env_vars === 'object') {
        const hostname = window.location.hostname;
        
        // Use consolidated environment variables
        const envVars = data.env_vars;
        const port = envVars.mcp_server_port || 8020;
        
        // Check if we should use WSL2 IP or localhost
        let serverUrl;
        if (envVars.wsl2_ip && hostname !== 'localhost' && hostname !== '127.0.0.1') {
          serverUrl = `http://${envVars.wsl2_ip}:${port}/mcp/`;
        } else {
          serverUrl = `http://${hostname}:${port}/mcp/`;
        }
        
        debugLog('Discovered consolidated environment variables:', {
          workspace_id: envVars.workspace_id,
          mcp_server_url: serverUrl,
          source: data.source
        });
        
        return {
          workspace_id: envVars.workspace_id,
          mcp_server_url: serverUrl,
          env_vars: envVars
        };
      }
      
      // Fallback to backward compatibility
      if (data.port && typeof data.port === 'number') {
        const hostname = window.location.hostname;
        return {
          workspace_id: data.workspace_id || workspaceId,
          mcp_server_url: `http://${hostname}:${data.port}/mcp/`,
          env_vars: null
        };
      }
    }
  } catch (error) {
    console.warn('Failed to discover workspace environment variables, using defaults:', error);
  }
  
  // Fallback to defaults
  return {
    workspace_id: workspaceId || "",
    mcp_server_url: `http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:8020/mcp/`,
    env_vars: null
  };
};

export const CONPORT_CONFIG = {
  SERVER_URL: (process.env.NEXT_PUBLIC_CONPORT_SERVER_URL as string | undefined) || "http://localhost:8020/mcp/",
  WORKSPACE_STORAGE_KEY: "conport_workspace_id",
  DEFAULT_WORKSPACE_ID: undefined, // FIXED: No longer use shared env var
  POLLING_INTERVAL: 3000, // 3 seconds
} as const;

// ==================== TYPES ====================

export interface ConportMCPRequest {
  jsonrpc: "2.0";
  id: number;
  method: "tools/call";
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface ConportMCPResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    content?: Array<{
      type: "text";
      text: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface ConportClientOptions {
  baseURL?: string;
  workspaceId?: string;
  timeout?: number;
}

// ==================== WORKSPACE MANAGEMENT ====================

export const WorkspaceManager = {
  get(): string {
    if (typeof window === "undefined") {
      // Server-side: Return empty string, let server auto-detect
      return "";
    }
    
    // Client-side: Check session storage first
    const stored = sessionStorage.getItem(CONPORT_CONFIG.WORKSPACE_STORAGE_KEY);
    if (stored) return stored;
    
    // FIXED: No longer fall back to shared environment variable
    // Return empty string - let the API call provide the workspace_id
    return "";
  },

  async getDetected(): Promise<string> {
    // First check if we have a stored workspace
    const stored = this.get();
    if (stored) {
      return stored;
    }
    
    // FIXED: Use direct API call instead of creating new ConportClient to prevent session proliferation
    try {
      const response = await fetch('/api/get-workspace-mcp-port', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: "" }) // Empty workspace for detection
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.env_vars?.workspace_id) {
          // Cache the detected workspace
          this.set(data.env_vars.workspace_id);
          return data.env_vars.workspace_id;
        }
      }
    } catch (error) {
      console.warn("Failed to get workspace detection via API:", error);
    }
    
    // Final fallback to static method
    return this.get();
  },

  set(workspaceId: string): void {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(CONPORT_CONFIG.WORKSPACE_STORAGE_KEY, workspaceId);
    }
  },

  clear(): void {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(CONPORT_CONFIG.WORKSPACE_STORAGE_KEY);
    }
  }
};

// ==================== ERROR HANDLING ====================

export class ConportError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ConportError";
  }
}

export class ConportNetworkError extends ConportError {
  constructor(message: string, cause?: unknown) {
    super(message, "NETWORK_ERROR", cause);
    this.name = "ConportNetworkError";
  }
}

export class ConportValidationError extends ConportError {
  constructor(message: string, cause?: unknown) {
    super(message, "VALIDATION_ERROR", cause);
    this.name = "ConportValidationError";
  }
}

// Normalize front-end node type prefixes to server item_type values
function normalizeItemType(type: string): string {
  switch (type) {
    case 'progress':
    case 'progress_entry':
      return 'progress_entry';
    case 'pattern':
    case 'system_pattern':
      return 'system_pattern';
    case 'custom':
    case 'custom_data':
      return 'custom_data';
    default:
      return type;
  }
}

// ==================== CORE CLIENT ====================

export class ConportClient {
  private baseURL: string;
  private workspaceId: string;
  private timeout: number;
  private sessionId: string | null = null;
  private requestCounter = 0;
  private static serverSessions: Map<string, string> = new Map();
  private static globalRequestCounter = 0;

  constructor(options: ConportClientOptions = {}) {
    const envUrl = process.env.NEXT_PUBLIC_CONPORT_SERVER_URL as string | undefined;
    const dynamicUrl =
      (typeof window !== "undefined")
        ? (envUrl ?? `http://${window.location.hostname}:8020/mcp/`)
        : (envUrl ?? "http://localhost:8020/mcp/");
    this.baseURL = options.baseURL || dynamicUrl;
    
    // Normalize workspace ID to match server format (forward slashes, lowercase drive)
    const rawWorkspaceId = options.workspaceId || WorkspaceManager.get();
    this.workspaceId = this.normalizeWorkspaceId(rawWorkspaceId);
    this.timeout = options.timeout || 10000;
    
    // Initialize workspace detection and URL discovery on client-side
    if (typeof window !== "undefined") {
      this.initializeWorkspace();
    }
  }

  private normalizeWorkspaceId(workspaceId: string): string {
    if (!workspaceId) return workspaceId;
    
    // Convert backslashes to forward slashes and lowercase drive letter
    let normalized = workspaceId.replace(/\\/g, '/');
    
    // Handle Windows drive letters: C:\ -> c:/
    if (/^[A-Z]:\//.test(normalized)) {
      normalized = normalized.charAt(0).toLowerCase() + normalized.slice(1);
    }
    
    return normalized;
  }

  private async initializeWorkspace() {
    try {
      // Bootstrap workspace_id if we don't have one
      if (!this.workspaceId) {
        const detectedWorkspace = await WorkspaceManager.getDetected();
        if (detectedWorkspace) {
          this.workspaceId = detectedWorkspace;
          debugLog('Auto-detected workspace:', detectedWorkspace);
        }
      }
      
      // Now try to get ui-cache environment variables
      if (this.workspaceId) {
        try {
          const envVars = await discoverWorkspaceEnvVars(this.workspaceId);
          
          // Update workspace_id with authoritative value from ui-cache (should match)
          if (envVars.workspace_id && envVars.workspace_id !== this.workspaceId) {
            debugLog('Updated workspace_id from ui-cache:', {
              old: this.workspaceId,
              new: envVars.workspace_id
            });
            this.workspaceId = envVars.workspace_id;
            WorkspaceManager.set(envVars.workspace_id);
          }
          
          // Update MCP server URL with authoritative value from ui-cache
          if (envVars.mcp_server_url && envVars.mcp_server_url !== this.baseURL) {
            debugLog('Updated MCP server URL from ui-cache:', {
              old: this.baseURL,
              new: envVars.mcp_server_url
            });
            this.baseURL = envVars.mcp_server_url;
          }
        } catch (error) {
          debugWarn('Failed to discover workspace environment variables:', error);
        }
      } else {
        debugWarn('No workspace_id available after detection');
      }
    } catch (error) {
      debugWarn('Failed to initialize workspace:', error);
    }
  }

  /**
   * Public method to get the correctly configured server URL for direct API calls
   * Ensures workspace initialization completes before returning URL
   */
  async getServerUrl(): Promise<string> {
    // Ensure workspace is initialized (will update baseURL if needed)
    if (typeof window !== "undefined") {
      await this.initializeWorkspace();
    }
    
    // Return base URL without /mcp/ suffix for direct API calls
    return this.baseURL.replace('/mcp/', '').replace('/mcp', '');
  }

  /**
   * Parse Server-Sent Events (SSE) response format
   */
  private parseSSEResponse(responseText: string): any {
    const lines = responseText.trim().split('\n');
    let eventData = '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        eventData = line.substring(6); // Remove 'data: ' prefix
        break;
      }
    }
    
    if (eventData) {
      try {
        return JSON.parse(eventData);
      } catch (error) {
        throw new ConportError(`Failed to parse SSE data: ${eventData}`);
      }
    }
    
    throw new ConportError("No data found in SSE response");
  }

  /**
   * Initialize or get session ID for MCP HTTP protocol
   * FIXED: Use per-server session storage to support multiple workspace MCP servers
   * FIXED: Ensure workspace initialization completes before making requests to prevent CORS failures
   */
  private async ensureSession(): Promise<string> {
    // CRITICAL FIX: Ensure workspace initialization completes first to avoid stale requests to wrong port
    if (typeof window !== "undefined") {
      await this.initializeWorkspace();
    }
    
    // FIRST: Try to reuse session for this specific MCP server URL
    const cachedSession = ConportClient.serverSessions.get(this.baseURL);
    if (cachedSession) {
      this.sessionId = cachedSession;
      debugLog('Reusing MCP session for server:', { baseURL: this.baseURL, sessionId: this.sessionId });
      return this.sessionId;
    }
    
    // SECOND: Try instance session (fallback for same-server requests)
    if (this.sessionId) {
      ConportClient.serverSessions.set(this.baseURL, this.sessionId);
      debugLog('Caching existing session for server:', { baseURL: this.baseURL, sessionId: this.sessionId });
      return this.sessionId;
    }

    try {
      // Step 1: Send initialize request
      const initResponse = await fetch(this.baseURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: ++this.requestCounter,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "ConPort Web Dashboard",
              version: "1.0.0"
            }
          }
        })
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        throw new ConportError(`HTTP ${initResponse.status}: ${errorText}`);
      }

      // Parse the SSE response
      const responseText = await initResponse.text();
      const initResult = this.parseSSEResponse(responseText);

      if (initResult.error) {
        throw new ConportError(`MCP initialization error: ${initResult.error.message}`);
      }

      if (!initResult.result) {
        throw new ConportError('Invalid MCP initialization response: missing result');
      }

      // Extract session ID from the initialization result
      // FastMCP StreamableHTTP may include session info in the response
      let sessionId: string | null = null;
      
      // Check common places where session ID might be provided
      if (initResult.result.sessionId) {
        sessionId = initResult.result.sessionId;
      } else if (initResult.sessionId) {
        sessionId = initResult.sessionId;
      } else if (initResult.result._meta?.sessionId) {
        sessionId = initResult.result._meta.sessionId;
      }

      if (!sessionId) {
        // Extract session ID from response headers (this is where FastMCP puts it)
        const headerSessionId = initResponse.headers.get("mcp-session-id") ||
                               initResponse.headers.get("x-session-id") ||
                               initResponse.headers.get("session-id");
        if (headerSessionId) {
          sessionId = headerSessionId;
        }
      }

      if (!sessionId) {
        // If still no session ID, the server might be using cookies or another mechanism
        sessionId = `fallback-session-${Date.now()}`;
      }

      this.sessionId = sessionId;
      ConportClient.serverSessions.set(this.baseURL, sessionId); // Store session per-server
      debugLog('Created new MCP session for server:', { baseURL: this.baseURL, sessionId });

      // Step 2: Send initialized notification to complete handshake
      const initializedResponse = await fetch(this.baseURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          // Include session ID header for the initialized notification
          ...(this.sessionId && { "mcp-session-id": this.sessionId })
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
          params: {}
        })
      });

      // Check that initialized notification was successful
      if (!initializedResponse.ok) {
        this.sessionId = null;
        const errorText = await initializedResponse.text();
        throw new ConportError(`Failed to complete MCP initialization: HTTP ${initializedResponse.status}: ${errorText}`);
      }

      // Wait for the initialized response to complete
      await initializedResponse.text();
      
      // CRITICAL FIX: Wait for server to mark session as fully initialized
      // The FastMCP server needs time to process the initialization sequence
      // before tool calls can be made (prevents -32602 "Invalid request parameters")
      await new Promise(resolve => setTimeout(resolve, 250));

      return this.sessionId;
    } catch (error) {
      // FIXED: Don't reset session on transient failures, only on auth failures
      debugWarn('MCP session initialization failed, will retry:', error);
      throw new ConportNetworkError(
        `Failed to initialize MCP session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Execute a ConPort MCP tool call
   */
  async call<T extends ToolName>(
    toolName: T,
    args: ToolArgs<T>
  ): Promise<any> {
    // Validate arguments using Zod schema
    const schema = ToolArgSchemas[toolName];
    let validatedArgs: ToolArgs<T>;
    
    try {
      validatedArgs = schema.parse(args) as ToolArgs<T>;
    } catch (error) {
      throw new ConportValidationError(
        `Invalid arguments for ${toolName}: ${error instanceof Error ? error.message : 'Unknown validation error'}`,
        error
      );
    }

    // CRITICAL FIX: Ensure workspace initialization completes BEFORE workspace_id injection
    if (typeof window !== "undefined") {
      await this.initializeWorkspace();
    }

    // Ensure workspace_id is set (only for tools that expect it) - NOW this.workspaceId is populated
    if ('workspace_id' in validatedArgs && !validatedArgs.workspace_id) {
      validatedArgs = { ...validatedArgs, workspace_id: this.workspaceId };
    }

    // Ensure we have a session (reuse existing if possible)
    const sessionId = await this.ensureSession();

    const request: ConportMCPRequest = {
      jsonrpc: "2.0",
      id: ++ConportClient.globalRequestCounter, // Use global counter for better session tracking
      method: "tools/call",
      params: {
        name: toolName,
        arguments: validatedArgs
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.baseURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          // Include session ID header for FastMCP StreamableHTTP (exact header name from bug report)
          ...(this.sessionId && { "mcp-session-id": this.sessionId })
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        
        // Reset session on auth errors (clear both instance and server-specific session)
        if (response.status === 401 || response.status === 403) {
          this.sessionId = null;
          ConportClient.serverSessions.delete(this.baseURL);
          debugWarn('Cleared MCP session due to auth error for server:', this.baseURL);
        }
        throw new ConportNetworkError(
          `HTTP ${response.status}: ${errorText}`
        );
      }

      // Parse SSE response format
      const responseText = await response.text();
      const data = this.parseSSEResponse(responseText);

      // Handle MCP error responses
      if (data.error) {
        throw new ConportError(
          data.error.message || "Unknown MCP error",
          data.error.code?.toString() || "UNKNOWN_ERROR"
        );
      }

      // Parse response content - look for both content array and structuredContent
      if (data.result?.structuredContent) {
        return data.result.structuredContent;
      }
      
      if (data.result?.content && data.result.content.length > 0) {
        const textContent = data.result.content[0].text;
        try {
          return JSON.parse(textContent);
        } catch {
          return textContent; // Return as string if not JSON
        }
      }

      return data.result || null;
    } catch (error) {
      if (error instanceof ConportError) {
        throw error;
      }
      
      if (error instanceof Error && error.name === "AbortError") {
        throw new ConportNetworkError("Request timeout");
      }

      throw new ConportNetworkError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  // ==================== CONVENIENCE METHODS ====================

  // Context Methods
  async getProductContext() {
    return this.call("get_product_context", { workspace_id: this.workspaceId });
  }

  async updateProductContext(content?: Record<string, any>, patch?: Record<string, any>) {
    return this.call("update_product_context", {
      workspace_id: this.workspaceId,
      content,
      patch_content: patch
    });
  }

  async getActiveContext() {
    return this.call("get_active_context", { workspace_id: this.workspaceId });
  }

  async updateActiveContext(content?: Record<string, any>, patch?: Record<string, any>) {
    return this.call("update_active_context", {
      workspace_id: this.workspaceId,
      content,
      patch_content: patch
    });
  }

  // Progress Methods
  async getProgress(options: Partial<GetProgressArgsType> = {}) {
    const result = await this.call("get_progress", {
      workspace_id: this.workspaceId,
      ...options
    });
    
    // Extract the actual progress array from the MCP response structure
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (result.result && Array.isArray(result.result)) {
        return result.result;
      }
    }
    
    // Fallback if structure is different
    if (Array.isArray(result)) {
      return result;
    }
    
    return [];
  }

  async logProgress(args: Omit<LogProgressArgsType, "workspace_id">) {
    return this.call("log_progress", {
      workspace_id: this.workspaceId,
      ...args
    });
  }

  async updateProgress(args: Omit<UpdateProgressArgsType, "workspace_id">) {
    return this.call("update_progress", {
      workspace_id: this.workspaceId,
      ...args
    });
  }

  // Decision Methods
  async getDecisions(options: Partial<GetDecisionsArgsType> = {}) {
    const result = await this.call("get_decisions", {
      workspace_id: this.workspaceId,
      ...options
    });
    
    // Extract the actual decisions array from the MCP response structure
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (result.result && Array.isArray(result.result)) {
        return result.result;
      }
    }
    
    // Fallback if structure is different
    if (Array.isArray(result)) {
      return result;
    }
    
    return [];
  }

  async logDecision(args: Omit<LogDecisionArgsType, "workspace_id">) {
    return this.call("log_decision", {
      workspace_id: this.workspaceId,
      ...args
    });
  }

  async updateDecision(args: { decision_id: number; summary?: string | null; rationale?: string | null; implementation_details?: string | null; tags?: string[] | null }) {
    // Convert null values to undefined to match MCP expectations
    const cleanedArgs = {
      decision_id: args.decision_id,
      summary: args.summary ?? undefined,
      rationale: args.rationale ?? undefined,
      implementation_details: args.implementation_details ?? undefined,
      tags: args.tags ?? undefined
    };
    
    return this.call("update_decision", {
      workspace_id: this.workspaceId,
      ...cleanedArgs
    });
  }

  async searchDecisions(args: Omit<SearchDecisionsArgsType, "workspace_id">) {
    const result = await this.call("search_decisions_fts", {
      workspace_id: this.workspaceId,
      ...args
    });
    
    // Extract the actual search results array from the MCP response structure
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (result.result && Array.isArray(result.result)) {
        return result.result;
      }
    }
    
    // Fallback if structure is different
    if (Array.isArray(result)) {
      return result;
    }
    
    return [];
  }

  // Individual Item Methods
  async getProgressById(progressId: number) {
    const allProgress = await this.getProgress({ limit: 100 }); // Get more items to find the one we need
    if (Array.isArray(allProgress)) {
      const item = allProgress.find((p: any) => p.id === progressId);
      return item || null;
    }
    return null;
  }

  async getDecisionById(decisionId: number) {
    const allDecisions = await this.getDecisions({ limit: 100 }); // Get more items to find the one we need
    if (Array.isArray(allDecisions)) {
      const item = allDecisions.find((d: any) => d.id === decisionId);
      return item || null;
    }
    return null;
  }

  // System Patterns Methods
  async getSystemPatterns(options: any = {}) {
    const result = await this.call("get_system_patterns", {
      workspace_id: this.workspaceId,
      ...options
    });
    
    // Extract the actual patterns array from the MCP response structure
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (result.result && Array.isArray(result.result)) {
        return result.result;
      }
    }
    
    // Fallback if structure is different
    if (Array.isArray(result)) {
      return result;
    }
    
    return [];
  }

  async getSystemPatternById(patternId: number) {
    const allPatterns = await this.getSystemPatterns({ limit: 100 });
    if (Array.isArray(allPatterns)) {
      const item = allPatterns.find((p: any) => p.id === patternId);
      return item || null;
    }
    return null;
  }

  // Linked Items Methods
  async getLinkedItems(itemType: string, itemId: string, options: any = {}) {
    const result = await this.call("get_linked_items", {
      workspace_id: this.workspaceId,
      item_type: normalizeItemType(itemType),
      item_id: itemId,
      ...options
    });
    
    // Extract the actual linked items array from the MCP response structure
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (result.result && Array.isArray(result.result)) {
        return result.result;
      }
    }
    
    // Fallback if structure is different
    if (Array.isArray(result)) {
      return result;
    }
    
    return [];
  }

  // Activity Summary
  async getRecentActivitySummary(options: Partial<GetRecentActivitySummaryArgsType> = {}) {
    const result = await this.call("get_recent_activity_summary", {
      workspace_id: this.workspaceId,
      limit_per_type: 5,
      ...options
    });
    
    // Extract the actual activity summary from the MCP response structure
    if (result && typeof result === 'object') {
      // Activity summary has a different structure - it's an object with arrays
      if (result.result) {
        return result.result;
      }
    }
    
    return result || {};
  }

  // Search Methods
  async semanticSearch(queryText: string, options: any = {}) {
    const result = await this.call("semantic_search_conport", {
      workspace_id: this.workspaceId,
      query_text: queryText,
      top_k: options.top_k || 5,
      filter_item_types: options.filter_item_types,
      filter_tags_include_any: options.filter_tags_include_any,
      filter_tags_include_all: options.filter_tags_include_all,
      filter_custom_data_categories: options.filter_custom_data_categories,
      ...options
    });
    
    // Extract the actual search results array from the MCP response structure
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (result.result && Array.isArray(result.result)) {
        return result.result;
      }
    }
    
    // Fallback if structure is different
    if (Array.isArray(result)) {
      return result;
    }
    
    return [];
  }

  async searchProgress(queryText: string, options: any = {}) {
    // Use FTS search for progress entries
    const result = await this.call("search_progress_fts", {
      workspace_id: this.workspaceId,
      query_term: queryText,
      limit: options.top_k || 10,
      ...options
    });
    
    // Transform FTS results to match the expected semantic search format
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (result.result && Array.isArray(result.result)) {
        return result.result.map((item: any) => ({
          metadata: {
            conport_item_id: item.id,
            conport_item_type: 'progress_entry',
            description: item.description,
            description_snippet: item.description?.substring(0, 100) + (item.description?.length > 100 ? '...' : ''),
            status: item.status,
            timestamp_created: item.timestamp_created
          },
          distance: 0.5 // FTS results are relevant, so use a good distance
        }));
      }
    }
    
    return Array.isArray(result) ? result.map((item: any) => ({
      metadata: {
        conport_item_id: item.id,
        conport_item_type: 'progress_entry',
        description: item.description,
        description_snippet: item.description?.substring(0, 100) + (item.description?.length > 100 ? '...' : ''),
        status: item.status,
        timestamp_created: item.timestamp_created
      },
      distance: 0.5
    })) : [];
  }

  async searchPatterns(queryText: string, options: any = {}) {
    // Use FTS search for system patterns
    const result = await this.call("search_system_patterns_fts", {
      workspace_id: this.workspaceId,
      query_term: queryText,
      limit: options.top_k || 10,
      ...options
    });
    
    // Transform FTS results to match the expected semantic search format
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (result.result && Array.isArray(result.result)) {
        return result.result.map((item: any) => ({
          metadata: {
            conport_item_id: item.id,
            conport_item_type: 'system_pattern',
            name: item.name,
            description: item.description,
            description_snippet: item.description?.substring(0, 100) + (item.description?.length > 100 ? '...' : ''),
            tags: item.tags,
            timestamp_created: item.timestamp_created
          },
          distance: 0.5 // FTS results are relevant, so use a good distance
        }));
      }
    }
    
    return Array.isArray(result) ? result.map((item: any) => ({
      metadata: {
        conport_item_id: item.id,
        conport_item_type: 'system_pattern',
        name: item.name,
        description: item.description,
        description_snippet: item.description?.substring(0, 100) + (item.description?.length > 100 ? '...' : ''),
        tags: item.tags,
        timestamp_created: item.timestamp_created
      },
      distance: 0.5
    })) : [];
  }

  async searchContext(queryText: string, options: any = {}) {
    // Use FTS search for context entries
    const result = await this.call("search_context_fts", {
      workspace_id: this.workspaceId,
      query_term: queryText,
      limit: options.top_k || 10,
      ...options
    });

    const mapItem = (item: any) => {
      const rawType = item?.context_type || item?.category || item?.metadata?.category || 'context';
      const normalizedType =
        ['product', 'product_context'].includes(String(rawType)) ? 'product' :
        (['active', 'active_context'].includes(String(rawType)) ? 'active' : String(rawType));
      const name =
        normalizedType === 'product' ? 'Product Context' :
        (normalizedType === 'active' ? 'Active Context' : 'Context');

      // Prefer server-provided snippet; fallback to content_text or JSON content
      let snippetSource: string | null =
        item?.content_text_snippet ??
        (typeof item?.content_text === 'string' ? item.content_text : null);

      if (!snippetSource && item?.content) {
        try {
          const jsonStr = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
          snippetSource = jsonStr;
        } catch {
          snippetSource = null;
        }
      }

      const snippet = snippetSource
        ? (snippetSource.length > 100 ? snippetSource.slice(0, 100) + '...' : snippetSource)
        : '';

      return {
        metadata: {
          conport_item_id: normalizedType, // stable id for routing/tagging
          conport_item_type: 'context',
          category: normalizedType,        // 'product' | 'active'
          key: name,                       // human-friendly heading
          name,
          description_snippet: snippet,
          timestamp_created: item?.timestamp || item?.timestamp_updated
        },
        distance: 0.5
      };
    };

    // Transform FTS results to match the expected semantic search format
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (result.result && Array.isArray(result.result)) {
        return result.result.map(mapItem);
      }
    }

    return Array.isArray(result) ? result.map(mapItem) : [];
  }

  async searchCustomData(queryText: string, options: any = {}) {
    // Use FTS search for custom data entries
    const result = await this.call("search_custom_data_value_fts", {
      workspace_id: this.workspaceId,
      query_term: queryText,
      limit: options.top_k || 10,
      ...options
    });
    
    // Transform FTS results to match the expected semantic search format
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (result.result && Array.isArray(result.result)) {
        return result.result.map((item: any) => ({
          metadata: {
            conport_item_id: `${encodeURIComponent(item.category)}:${encodeURIComponent(item.key)}`, // Fix: Use category:key format for URL routing
            conport_item_type: 'custom_data',
            category: item.category,
            key: item.key,
            description_snippet: typeof item.value === 'string' ? item.value.substring(0, 100) + '...' : JSON.stringify(item.value).substring(0, 100) + '...',
            timestamp_created: item.timestamp
          },
          distance: 0.5 // FTS results are relevant, so use a good distance
        }));
      }
    }
    
    return Array.isArray(result) ? result.map((item: any) => ({
      metadata: {
        conport_item_id: `${encodeURIComponent(item.category)}:${encodeURIComponent(item.key)}`, // Fix: Use category:key format for URL routing
        conport_item_type: 'custom_data',
        category: item.category,
        key: item.key,
        description_snippet: typeof item.value === 'string' ? item.value.substring(0, 100) + '...' : JSON.stringify(item.value).substring(0, 100) + '...',
        timestamp_created: item.timestamp
      },
      distance: 0.5
    })) : [];
  }

  // Custom Data Methods
  async getCustomData(category?: string, key?: string) {
    const result = await this.call("get_custom_data", {
      workspace_id: this.workspaceId,
      category,
      key
    });
    
    // Extract the actual custom data array from the MCP response structure
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (result.result && Array.isArray(result.result)) {
        return result.result;
      }
    }
    
    // Fallback if structure is different
    if (Array.isArray(result)) {
      return result;
    }
    
    return [];
  }

  async logCustomData(category: string, key: string, value: any) {
    return this.call("log_custom_data", {
      workspace_id: this.workspaceId,
      category,
      key,
      value
    });
  }

  async deleteCustomData(category: string, key: string) {
    return this.call("delete_custom_data", {
      workspace_id: this.workspaceId,
      category,
      key
    });
  }

  // Delete Methods
  async deleteDecision(decisionId: number) {
    return this.call("delete_decision_by_id", {
      workspace_id: this.workspaceId,
      decision_id: decisionId
    });
  }

  async deleteProgress(progressId: number) {
    return this.call("delete_progress_by_id", {
      workspace_id: this.workspaceId,
      progress_id: progressId
    });
  }

  async deleteSystemPattern(patternId: number) {
    return this.call("delete_system_pattern_by_id", {
      workspace_id: this.workspaceId,
      pattern_id: patternId
    });
  }

  // System Pattern Methods
  async logSystemPattern(args: { name: string; description?: string; tags?: string[] }) {
    return this.call("log_system_pattern", {
      workspace_id: this.workspaceId,
      ...args
    });
  }

  // Utility Methods
  async getConportSchema() {
    return this.call("get_conport_schema", { workspace_id: this.workspaceId });
  }

  // Export/Import Methods
  async exportConportToMarkdown(options: { output_path?: string } = {}) {
    return this.call("export_conport_to_markdown", {
      workspace_id: this.workspaceId,
      output_path: options.output_path
    });
  }

  async importMarkdownToConport(options: { input_path?: string } = {}) {
    return this.call("import_markdown_to_conport", {
      workspace_id: this.workspaceId,
      input_path: options.input_path
    });
  }

  // ==================== GRAPH DATA METHODS ====================

  /**
   * Fetch all graph data (nodes and edges) for knowledge graph visualization
   */
  async getGraphData(options: {
    includeDecisions?: boolean;
    includeProgress?: boolean;
    includeSystemPatterns?: boolean;
    includeCustomData?: boolean;
    limit?: number;
  } = {}) {
    const {
      includeDecisions = true,
      includeProgress = true,
      includeSystemPatterns = true,
      includeCustomData = true,
      limit = 100
    } = options;

    try {
      // 1) Fetch node sets first (in parallel)
      const nodePromises: Promise<any>[] = [];
      if (includeDecisions) nodePromises.push(this.getDecisions({ limit }));
      if (includeProgress) nodePromises.push(this.getProgress({ limit }));
      if (includeSystemPatterns) nodePromises.push(this.getSystemPatterns({ limit }));
      if (includeCustomData) nodePromises.push(this.getCustomData());

      const nodeResults = await Promise.all(nodePromises);
      let idx = 0;
      const decisions = includeDecisions ? (nodeResults[idx++] || []) : [];
      const progress = includeProgress ? (nodeResults[idx++] || []) : [];
      const systemPatterns = includeSystemPatterns ? (nodeResults[idx++] || []) : [];
      const customData = includeCustomData ? (nodeResults[idx++] || []) : [];

      debugLog('[GraphData] Fetched nodes:', {
        decisions: decisions.length,
        progress: progress.length,
        systemPatterns: systemPatterns.length,
        customData: customData.length
      });

      // 2) Build links by querying linked items for each node we actually loaded
      const linkFetches: Promise<any>[] = [];
      const enqueue = (items: any[], type: string) => {
        debugLog(`[GraphData] Enqueuing ${items.length} ${type} items for link fetching`);
        for (const it of items) {
          const idStr = (it?.id ?? it?.item_id ?? '').toString();
          if (!idStr) continue;
          debugLog(`[GraphData] Fetching links for ${type}:${idStr}`);
          linkFetches.push(this.getLinkedItems(type, idStr, { limit: 100 }));
        }
      };
      enqueue(decisions, 'decision');
      enqueue(progress, 'progress_entry');       // server expects progress_entry
      enqueue(systemPatterns, 'system_pattern'); // server expects system_pattern
      enqueue(customData, 'custom_data');        // Enable custom data linking

      debugLog(`[GraphData] Total link fetch requests: ${linkFetches.length}`);

      let links: any[] = [];
      if (linkFetches.length) {
        const settled = await Promise.allSettled(linkFetches);
        debugLog(`[GraphData] Link fetch results:`, settled.map(s => s.status));
        
        for (const s of settled) {
          if (s.status === 'fulfilled' && Array.isArray(s.value)) {
            debugLog(`[GraphData] Found ${s.value.length} links from one fetch`);
            links.push(...s.value);
          } else if (s.status === 'rejected') {
            debugWarn(`[GraphData] Link fetch failed:`, s.reason);
          }
        }
        
        debugLog(`[GraphData] Total links before deduplication: ${links.length}`);
        
        // Deduplicate links
        const seen = new Set<string>();
        links = links.filter((l: any) => {
          const key = `${l.source_item_type}|${l.source_item_id}|${l.target_item_type}|${l.target_item_id}|${l.relationship_type}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        
        debugLog(`[GraphData] Links after deduplication: ${links.length}`);
        debugLog(`[GraphData] Final links:`, links);
        
        // Debug each link structure
        if (isDebugEnabled()) {
          links.forEach((link, idx) => {
            debugLog(`[GraphData] Link ${idx + 1}:`, {
              source: `${link.source_item_type}:${link.source_item_id}`,
              target: `${link.target_item_type}:${link.target_item_id}`,
              relationship: link.relationship_type,
              full_link: link
            });
          });
        }
      }

      return {
        decisions: Array.isArray(decisions) ? decisions : [],
        progress: Array.isArray(progress) ? progress : [],
        systemPatterns: Array.isArray(systemPatterns) ? systemPatterns : [],
        customData: Array.isArray(customData) ? customData : [],
        links
      };
    } catch (error) {
      throw new ConportError(
        `Failed to fetch graph data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GRAPH_DATA_ERROR',
        error
      );
    }
  }

  /**
   * Get all links/relationships in the workspace
   * Note: This is a helper method since ConPort doesn't have a direct "get all links" endpoint
   * We'll need to collect links from various sources
   */
  async getAllLinks() {
    try {
      // First, get recent activity which includes links
      const activity = await this.getRecentActivitySummary({ limit_per_type: 100 });
      debugLog('Activity data for links:', activity);
      
      if (activity && activity.recent_links_created && Array.isArray(activity.recent_links_created)) {
        debugLog('Found links in activity:', activity.recent_links_created.length);
        return activity.recent_links_created;
      }
      
      // If no links in activity, try to get some sample links by checking linked items
      debugLog('No links in activity, trying sample links approach...');
      const sampleLinks = await this.getSampleLinks();
      if (sampleLinks.length > 0) {
        debugLog('Found sample links:', sampleLinks.length);
        return sampleLinks;
      }
      
      debugWarn('No links found through any method');
      return [];
    } catch (error) {
      // If that doesn't work, we'll start with empty links and build them as we discover relationships
      console.error('Error fetching links:', error);
      return [];
    }
  }

  /**
   * Get sample links by checking linked items for a few sample nodes
   * This is a fallback when no links are found in activity summary
   */
  async getSampleLinks() {
    try {
      const allLinks: any[] = [];
      debugLog('Fetching sample links from linked items...');
      
      // Get more sample nodes to check their links - increase from 5 to 25 to catch more links
      const decisions = await this.getDecisions({ limit: 25 });
      const progress = await this.getProgress({ limit: 25 });
      const patterns = await this.getSystemPatterns({ limit: 25 });
      
      debugLog('Sample nodes:', {
        decisions: decisions.length,
        progress: progress.length,
        patterns: patterns.length
      });
      
      // Check links for decisions
      for (const decision of decisions) {
        try {
          const links = await this.getLinkedItems('decision', decision.id.toString(), { limit: 10 });
          debugLog(`Links for decision ${decision.id}:`, links.length);
          allLinks.push(...links);
        } catch (error) {
          debugWarn(`Error fetching links for decision ${decision.id}:`, error);
        }
      }
      
      // Check links for progress
      for (const item of progress) {
        try {
          const links = await this.getLinkedItems('progress_entry', item.id.toString(), { limit: 10 });
          debugLog(`Links for progress ${item.id}:`, links.length);
          allLinks.push(...links);
        } catch (error) {
          debugWarn(`Error fetching links for progress ${item.id}:`, error);
        }
      }
      
      // Check links for patterns
      for (const pattern of patterns) {
        try {
          const links = await this.getLinkedItems('system_pattern', pattern.id.toString(), { limit: 10 });
          debugLog(`Links for pattern ${pattern.id}:`, links.length);
          allLinks.push(...links);
        } catch (error) {
          debugWarn(`Error fetching links for pattern ${pattern.id}:`, error);
        }
      }
      
      debugLog('Total links before deduplication:', allLinks.length);
      
      // Remove duplicates
      const uniqueLinks = allLinks.filter((link, index, self) =>
        index === self.findIndex(l =>
          l.source_item_type === link.source_item_type &&
          l.source_item_id === link.source_item_id &&
          l.target_item_type === link.target_item_type &&
          l.target_item_id === link.target_item_id
        )
      );
      
      debugLog('Unique links after deduplication:', uniqueLinks.length);
      return uniqueLinks;
    } catch (error) {
      debugWarn('Error in getSampleLinks:', error);
      return [];
    }
  }


  /**
   * Get focused graph data centered on a specific node with hop expansion
   */
  async getFocusedGraphData(centerNodeType: string, centerNodeId: string, hopDepth: number = 2) {
    try {
      // Start with the center node
      const visitedNodes = new Set<string>();
      const startType = normalizeItemType(centerNodeType);
      const nodesQueue: Array<{type: string, id: string, depth: number}> = [
        { type: startType, id: centerNodeId, depth: 0 }
      ];
      
      const allNodes: any[] = [];
      const allLinks: any[] = [];

      while (nodesQueue.length > 0) {
        const current = nodesQueue.shift()!;
        const nodeKey = `${current.type}-${current.id}`;
        
        if (visitedNodes.has(nodeKey) || current.depth > hopDepth) {
          continue;
        }
        
        visitedNodes.add(nodeKey);

        // Fetch the current node data
        let nodeData = null;
        try {
          switch (current.type) {
            case 'decision':
              nodeData = await this.getDecisionById(parseInt(current.id));
              break;
            case 'progress':
            case 'progress_entry': // Handle both naming conventions
              nodeData = await this.getProgressById(parseInt(current.id));
              break;
            case 'pattern':
            case 'system_pattern':
              nodeData = await this.getSystemPatternById(parseInt(current.id));
              break;
            case 'custom':
            case 'custom_data':
              const customData = await this.getCustomData();
              nodeData = Array.isArray(customData) ? customData.find((d: any) => d.id?.toString() === current.id) : null;
              break;
          }

          if (nodeData) {
            allNodes.push(nodeData);
          }
        } catch (error) {
          console.warn(`Could not fetch node ${nodeKey}:`, error);
        }

        // If we haven't reached max depth, explore linked nodes
        if (current.depth < hopDepth) {
          try {
            const linkedItems = await this.getLinkedItems(normalizeItemType(current.type), current.id, { limit: 50 });
            
            if (Array.isArray(linkedItems)) {
              for (const link of linkedItems) {
                allLinks.push(link);
                
                // Add linked nodes to the queue for exploration
                const sourceKey = `${link.source_item_type}-${link.source_item_id}`;
                const targetKey = `${link.target_item_type}-${link.target_item_id}`;
                
                if (!visitedNodes.has(sourceKey)) {
                  nodesQueue.push({
                    type: link.source_item_type,
                    id: link.source_item_id,
                    depth: current.depth + 1
                  });
                }
                
                if (!visitedNodes.has(targetKey)) {
                  nodesQueue.push({
                    type: link.target_item_type,
                    id: link.target_item_id,
                    depth: current.depth + 1
                  });
                }
              }
            }
          } catch (error) {
            console.warn(`Could not fetch linked items for ${nodeKey}:`, error);
          }
        }
      }

      return {
        decisions: allNodes.filter(n => n && (n.summary !== undefined)), // decisions have summary
        progress: allNodes.filter(n => n && (n.status !== undefined)), // progress has status
        systemPatterns: allNodes.filter(n => n && (n.name !== undefined && n.description !== undefined)), // patterns have name
        customData: allNodes.filter(n => n && (n.category !== undefined && n.key !== undefined)), // custom data has category/key
        links: allLinks
      };
    } catch (error) {
      throw new ConportError(
        `Failed to fetch focused graph data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FOCUSED_GRAPH_DATA_ERROR',
        error
      );
    }
  }

  /**
   * Create a link between two ConPort items
   * Normalizes item types and coerces IDs to strings to match server expectations.
   */
  async createLink(
    sourceType: string,
    sourceId: string,
    targetType: string,
    targetId: string,
    relationshipType: string,
    description?: string
  ) {
    const normalizedSourceType = normalizeItemType(sourceType);
    const normalizedTargetType = normalizeItemType(targetType);
    const sid = String(sourceId ?? "").trim();
    const tid = String(targetId ?? "").trim();
    const rel = String(relationshipType ?? "").trim();

    if (!sid || !tid || !rel) {
      throw new ConportValidationError(
        "createLink: missing required args (sourceId, targetId, relationshipType)"
      );
    }

    return this.call("link_conport_items", {
      workspace_id: this.workspaceId,
      source_item_type: normalizedSourceType,
      source_item_id: sid,
      target_item_type: normalizedTargetType,
      target_item_id: tid,
      relationship_type: rel,
      description
    });
  }

  /**
   * Update a link between two ConPort items
   */
  async updateLink(args: Omit<UpdateLinkArgsType, "workspace_id">) {
    return this.call("update_link", {
      workspace_id: this.workspaceId,
      ...args
    });
  }

  /**
   * Delete a link by its ID
   */
  async deleteLink(args: Omit<DeleteLinkByIdArgsType, "workspace_id">) {
    return this.call("delete_link_by_id", {
      workspace_id: this.workspaceId,
      ...args
    });
  }
}

// ==================== SINGLETON INSTANCE ====================

let defaultClient: ConportClient | null = null;

export function getConportClient(options?: ConportClientOptions): ConportClient {
  if (!defaultClient) {
    defaultClient = new ConportClient(options);
  }
  return defaultClient;
}

export function resetConportClient(): void {
  defaultClient = null;
}

// ==================== REACT QUERY HELPERS ====================

export const ConportQueryKeys = {
  all: ["conport"] as const,
  context: () => [...ConportQueryKeys.all, "context"] as const,
  productContext: () => [...ConportQueryKeys.context(), "product"] as const,
  activeContext: () => [...ConportQueryKeys.context(), "active"] as const,
  progress: () => [...ConportQueryKeys.all, "progress"] as const,
  progressList: (filters?: Partial<GetProgressArgsType>) =>
    [...ConportQueryKeys.progress(), "list", filters] as const,
  progressItem: (id: number) =>
    [...ConportQueryKeys.progress(), "item", id] as const,
  decisions: () => [...ConportQueryKeys.all, "decisions"] as const,
  decisionsList: (filters?: Partial<GetDecisionsArgsType>) =>
    [...ConportQueryKeys.decisions(), "list", filters] as const,
  decisionItem: (id: number) =>
    [...ConportQueryKeys.decisions(), "item", id] as const,
  patterns: () => [...ConportQueryKeys.all, "patterns"] as const,
  patternItem: (id: number) =>
    [...ConportQueryKeys.patterns(), "item", id] as const,
  linkedItems: (itemType: string, itemId: string) =>
    [...ConportQueryKeys.all, "linked", itemType, itemId] as const,
  activity: () => [...ConportQueryKeys.all, "activity"] as const,
  activitySummary: (options?: Partial<GetRecentActivitySummaryArgsType>) =>
    [...ConportQueryKeys.activity(), "summary", options] as const,
  graph: () => [...ConportQueryKeys.all, "graph"] as const,
  graphData: (options?: any) =>
    [...ConportQueryKeys.graph(), "data", options] as const,
  focusedGraphData: (centerNodeType: string, centerNodeId: string, hopDepth?: number) =>
    [...ConportQueryKeys.graph(), "focused", centerNodeType, centerNodeId, hopDepth] as const,
  allLinks: () => [...ConportQueryKeys.graph(), "links"] as const,
} as const;

// ==================== EXPORTS ====================

export default ConportClient;
export { CONPORT_CONFIG as default_config };

// Export debug utilities for use across UI components
export { debugLog, debugWarn, isDebugEnabled, userLog, userWarn };
