import warnings
import sys

# Suppress websocket deprecation warnings that occur at import time - MUST BE FIRST
warnings.filterwarnings("ignore", category=DeprecationWarning, module="websockets.legacy")
warnings.filterwarnings("ignore", category=DeprecationWarning, module="uvicorn.protocols.websockets.websockets_impl")
warnings.filterwarnings("ignore", message="websockets.legacy is deprecated")
warnings.filterwarnings("ignore", message="websockets.server.WebSocketServerProtocol is deprecated")

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging.handlers
import argparse
import os
import time
from typing import Dict, Any, Optional, AsyncIterator, List, Annotated, Union
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

# FastMCP imports (corrected)
from fastmcp import FastMCP
from pydantic import Field
from fastmcp import Context

# Initialize FastMCP server
mcp = FastMCP("Context Portal MCP Server")

# Local imports
try:
    from .handlers import mcp_handlers  # We will adapt these
    from .db import database, models  # models for tool argument types
    from .db.database import ensure_alembic_files_exist  # Import the provisioning function
    from .core import exceptions  # For custom exceptions if FastMCP doesn't map them
    from .core.workspace_detector import resolve_workspace_id, WorkspaceDetector  # Import workspace detection
    from .core import ui_cache, mcp_cache  # Import UI cache functions and MCP cache
except ImportError:
    import os
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
    from src.context_portal_mcp.handlers import mcp_handlers
    from src.context_portal_mcp.db import database, models
    from src.context_portal_mcp.db.database import ensure_alembic_files_exist
    from src.context_portal_mcp.core import exceptions
    from src.context_portal_mcp.core.workspace_detector import resolve_workspace_id, WorkspaceDetector
    from src.context_portal_mcp.core import ui_cache, mcp_cache


# --- Output Capture Helpers (workspace-scoped, best-effort) ---
def _maybe_capture_and_annotate(workspace_id: str, tool_name: str, result: Any) -> Any:
    """If capture enabled, write result; add capture_file when result is a dict.

    For list results, shape is preserved; filename is stored in output_capture.last_capture_file
    via the cache for visibility through get_output_capture_status.
    """
    if not workspace_id:
        return result

    capture_file = mcp_cache.write_captured_result(workspace_id, tool_name, result)
    if capture_file and isinstance(result, dict):
        # Avoid mutating caller-owned dict unexpectedly
        annotated = dict(result)
        annotated["capture_file"] = capture_file
        return annotated
    return result

log = logging.getLogger(__name__)

# Debug helpers (will be redefined based on --debug flag)
def debug_print(message, level="INFO"):
    """Debug print function - will be silenced unless --debug is used"""
    print(f"[main:{level}] {message}", file=sys.stderr)

def setup_logging(args: argparse.Namespace):
    """Configures logging based on command-line arguments."""
    log_format = '%(asctime)s - %(levelname)s - %(name)s - %(message)s'
    root_logger = logging.getLogger()
    # Clear any existing handlers to avoid duplicates
    if root_logger.hasHandlers():
        root_logger.handlers.clear()

    root_logger.setLevel(getattr(logging, args.log_level.upper()))

    # Add file handler if specified and workspace_id is available
    if args.log_file and args.workspace_id:
        try:
            log_file_path = args.log_file
            if not os.path.isabs(log_file_path):
                # This is a bit of a chicken-and-egg problem. We need the config to know the base path,
                # but the config isn't fully set up yet. We can read the args directly.
                if args.base_path:
                    base_path = Path(args.base_path).expanduser()
                    sanitized_workspace_id = args.workspace_id.replace('/', '_').replace('\\', '_')
                    log_dir = base_path / sanitized_workspace_id / "logs"
                    log_file_path = log_dir / os.path.basename(args.log_file)
                else:
                    base_path = args.workspace_id
                    log_file_path = os.path.join(base_path, "context_portal_aimed", log_file_path)

            log_dir = os.path.dirname(log_file_path)
            if log_dir and not os.path.exists(log_dir):
                os.makedirs(log_dir, exist_ok=True)
            
            file_handler = logging.handlers.RotatingFileHandler(
                log_file_path,
                maxBytes=10 * 1024 * 1024,  # 10 MB
                backupCount=5
            )
            file_handler.setFormatter(logging.Formatter(log_format))
            root_logger.addHandler(file_handler)
            log.info(f"File logging configured to: {log_file_path}")
        except Exception as e:
            # Use a temporary basic config to log this error
            logging.basicConfig()
            log.error(f"Failed to set up file logging to {args.log_file}: {e}")
    elif args.log_file:
        log.warning(f"Log file '{args.log_file}' requested, but no --workspace_id provided at startup. File logging will be deferred.")

    # Only add console handler if not in stdio mode
    if args.mode != "stdio":
        console_handler = logging.StreamHandler(sys.stderr)
        console_handler.setFormatter(logging.Formatter(log_format))
        
        # Set console handler to show only warnings and above unless --debug is used
        if hasattr(args, 'debug') and args.debug:
            console_handler.setLevel(logging.DEBUG)
            debug_print("Console logging configured with DEBUG level")
        else:
            console_handler.setLevel(logging.WARNING)
            debug_print("Console logging configured with WARNING level (use --debug for verbose output)")
            
        root_logger.addHandler(console_handler)

# --- Lifespan Management for FastMCP ---
# Global flag to ensure database cleanup only happens once
_shutdown_completed = False
_shutdown_lock = None

@asynccontextmanager
async def conport_lifespan(server: FastMCP) -> AsyncIterator[None]:
    """Manage application lifecycle for ConPort."""
    global _shutdown_completed, _shutdown_lock
    
    # Initialize shutdown lock on first use
    if _shutdown_lock is None:
        import asyncio
        _shutdown_lock = asyncio.Lock()
    
    log.info("ConPort FastMCP server lifespan starting.")
    # Database initialization is handled by get_db_connection on first access per workspace.
    # No explicit global startup needed for DB here unless we want to pre-connect to a default.
    try:
        yield None  # Server runs
    finally:
        # FIXED: Ensure database cleanup only happens once, not once per transport session
        async with _shutdown_lock:
            if not _shutdown_completed:
                log.info("ConPort FastMCP server lifespan shutting down. Closing all DB connections.")
                database.close_all_connections()
                _shutdown_completed = True
            # else: already cleaned up, skip silently

# --- FastMCP Server Instance ---
# Version from pyproject.toml would be ideal here, or define centrally
CONPORT_VERSION = "0.3.8"

conport_mcp = FastMCP(
    name="ConPort", # Pass name directly
    lifespan=conport_lifespan
)

# --- Create MCP ASGI App First ---
# Create the MCP ASGI app - this is KEY for proper FastMCP mounting
# Specify path as "/" since we're mounting at /mcp - the mount point becomes the base
mcp_app = conport_mcp.http_app(path="/")

# --- FastAPI App ---
# The FastAPI app will be the main ASGI app, and FastMCP will be mounted onto it.
# CRITICAL: Pass the MCP app's lifespan to FastAPI for proper session manager initialization
app = FastAPI(
    title="ConPort MCP Server Wrapper",
    version=CONPORT_VERSION,
    lifespan=mcp_app.lifespan  # ← This line is essential for FastMCP to work properly!
)

# --- Adapt and Register Tools with FastMCP ---
# We use our Pydantic models as input_schema for robust validation.

@conport_mcp.tool(name="get_product_context", description="Retrieves the overall project goals, features, and architecture.")
async def tool_get_product_context(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context
) -> Dict[str, Any]:
    try:
        # Construct the Pydantic model for the handler
        pydantic_args = models.GetContextArgs(workspace_id=workspace_id)
        result = mcp_handlers.handle_get_product_context(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "get_product_context", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in get_product_context handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for get_product_context: {e}. Received workspace_id: {workspace_id}")
        raise exceptions.ContextPortalError(f"Server error processing get_product_context: {type(e).__name__}")

@conport_mcp.tool(name="update_product_context", description="Updates the product context. Accepts full `content` (object) or `patch_content` (object) for partial updates (use `__DELETE__` as a value in patch to remove a key).")
async def tool_update_product_context(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context, # MCPContext should typically be last, but let's keep other args grouped
    content: Annotated[Optional[Dict[str, Any]], Field(description="The full new context content as a dictionary. Overwrites existing.")] = None,
    patch_content: Annotated[Optional[Dict[str, Any]], Field(description="A dictionary of changes to apply to the existing context (add/update keys).")] = None
) -> Dict[str, Any]:
    try:
        # Pydantic model UpdateContextArgs will be validated by FastMCP based on annotations.
        # We still need to construct it for the handler.
        # The model's own validator will check 'content' vs 'patch_content'.
        pydantic_args = models.UpdateContextArgs(
            workspace_id=workspace_id,
            content=content,
            patch_content=patch_content
        )
        return mcp_handlers.handle_update_product_context(pydantic_args)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in update_product_context handler: {e}")
        raise
    except ValueError as e: # Catch Pydantic validation errors from UpdateContextArgs
        log.error(f"Validation error for update_product_context: {e}. Args: workspace_id={workspace_id}, content_present={content is not None}, patch_content_present={patch_content is not None}")
        raise exceptions.ContextPortalError(f"Invalid arguments for update_product_context: {e}")
    except Exception as e:
        log.error(f"Error processing args for update_product_context: {e}. Args: workspace_id={workspace_id}, content_present={content is not None}, patch_content_present={patch_content is not None}")
        raise exceptions.ContextPortalError(f"Server error processing update_product_context: {type(e).__name__}")

@conport_mcp.tool(name="get_active_context", description="Retrieves the current working focus, recent changes, and open issues.")
async def tool_get_active_context(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context
) -> Dict[str, Any]:
    try:
        pydantic_args = models.GetContextArgs(workspace_id=workspace_id)
        result = mcp_handlers.handle_get_active_context(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "get_active_context", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in get_active_context handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for get_active_context: {e}. Received workspace_id: {workspace_id}")
        raise exceptions.ContextPortalError(f"Server error processing get_active_context: {type(e).__name__}")


@conport_mcp.tool(name="set_output_capture", description="Enables/disables workspace-scoped output capture for tool results.")
async def tool_set_output_capture(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    enabled: Annotated[bool, Field(description="Enable/disable capture")] ,
    ctx: Context,
    base_filename: Annotated[Optional[str], Field(description="Base filename for captured JSON (sanitized, .json enforced)")] = "results.json",
    timestamp_tz: Annotated[Optional[str], Field(description="Timezone label for timestamps; default UTC")] = "UTC",
) -> Dict[str, Any]:
    try:
        config = mcp_cache.set_output_capture_config(
            workspace_id=workspace_id,
            enabled=enabled,
            base_filename=base_filename,
            timestamp_tz=timestamp_tz,
        )
        return {"status": "success", "output_capture": config}
    except Exception as e:
        log.error(f"Error in set_output_capture: {e}")
        raise exceptions.ContextPortalError(f"Server error processing set_output_capture: {type(e).__name__}")


@conport_mcp.tool(name="get_output_capture_status", description="Retrieves workspace-scoped output capture configuration and last captured file.")
async def tool_get_output_capture_status(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context,
) -> Dict[str, Any]:
    try:
        config = mcp_cache.get_output_capture_config(workspace_id)
        return {"status": "success", "output_capture": config}
    except Exception as e:
        log.error(f"Error in get_output_capture_status: {e}")
        raise exceptions.ContextPortalError(f"Server error processing get_output_capture_status: {type(e).__name__}")


@conport_mcp.tool(
    name="start_output_capture",
    description=(
        "Convenience tool: enable output capture for the workspace. "
        "Captured results are written (best-effort) to `<workspace_id>/conport-aimed_output/` with a timestamped filename."
    ),
)
async def tool_start_output_capture(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context,
    base_filename: Annotated[Optional[str], Field(description="Base filename for captured JSON (sanitized, .json enforced)")] = "results.json",
    timestamp_tz: Annotated[Optional[str], Field(description="Timezone label for timestamps; default UTC")] = "UTC",
) -> Dict[str, Any]:
    """Alias for set_output_capture(enabled=True, ...)."""
    try:
        config = mcp_cache.set_output_capture_config(
            workspace_id=workspace_id,
            enabled=True,
            base_filename=base_filename,
            timestamp_tz=timestamp_tz,
        )
        return {"status": "success", "output_capture": config}
    except Exception as e:
        log.error(f"Error in start_output_capture: {e}")
        raise exceptions.ContextPortalError(f"Server error processing start_output_capture: {type(e).__name__}")


@conport_mcp.tool(
    name="stop_output_capture",
    description="Convenience tool: disable output capture for the workspace.",
)
async def tool_stop_output_capture(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context,
) -> Dict[str, Any]:
    """Alias for set_output_capture(enabled=False, ...)."""
    try:
        current = mcp_cache.get_output_capture_config(workspace_id)
        config = mcp_cache.set_output_capture_config(
            workspace_id=workspace_id,
            enabled=False,
            base_filename=current.get("base_filename") or "results.json",
            timestamp_tz=current.get("timestamp_tz") or "UTC",
        )
        return {"status": "success", "output_capture": config}
    except Exception as e:
        log.error(f"Error in stop_output_capture: {e}")
        raise exceptions.ContextPortalError(f"Server error processing stop_output_capture: {type(e).__name__}")


@conport_mcp.tool(
    name="get_output_capture_help",
    description=(
        "Returns built-in usage guidance and examples for output capture. "
        "This is intentionally a tool (not project data) so an MCP client/LLM can discover how to use output capture reliably."
    ),
)
async def tool_get_output_capture_help(ctx: Context) -> Dict[str, Any]:
    """Self-describing tool: returns stable instructions/examples for output capture."""
    return _build_output_capture_help_payload()


def _build_output_capture_help_payload() -> Dict[str, Any]:
    """Build stable instructions/examples for output capture.

    Kept as a plain function so it can be called from tests without going through FastMCP's
    `FunctionTool` wrapper.
    """
    return {
        "feature": "output_capture",
        "summary": (
            "When output capture is enabled for a workspace, ConPort will (best-effort) write tool results to a timestamped JSON file. "
            "The tool still returns its normal response; capture is additive."
        ),
        "how_it_works": {
            "toggle": "Use start_output_capture/stop_output_capture (or set_output_capture/get_output_capture_status).",
            "where_files_go": "<workspace_id>/conport-aimed_output/",
            "filename_rules": {
                "base_filename": "User-supplied base_filename is sanitized and forced to end with .json",
                "timestamp": "UTC timestamp (YYYYMMDD_HHMMSS_mmm) is appended before .json",
                "example": "results_20251230_103211_893.json",
            },
            "response_annotation": {
                "dict_results": "If a tool returns an object (dict), ConPort adds capture_file to the returned object.",
                "list_results": "If a tool returns a list, the list shape is preserved; use get_output_capture_status.output_capture.last_capture_file to find the last written file.",
            },
            "persistence": "Workspace-scoped config is stored in <workspace_id>/context_portal_aimed/mcp-cache/output_capture.json",
        },
        "quick_start_examples": [
            {
                "title": "Enable capture, run a tool, then disable capture",
                "steps": [
                    {
                        "tool": "start_output_capture",
                        "args": {"workspace_id": "/ABS/PATH/TO/WORKSPACE", "base_filename": "results.json"},
                    },
                    {
                        "tool": "get_product_context",
                        "args": {"workspace_id": "/ABS/PATH/TO/WORKSPACE"},
                        "note": "If capture is enabled, the returned object will include capture_file.",
                    },
                    {"tool": "stop_output_capture", "args": {"workspace_id": "/ABS/PATH/TO/WORKSPACE"}},
                ],
            },
            {
                "title": "Check capture status / last written file",
                "steps": [
                    {"tool": "get_output_capture_status", "args": {"workspace_id": "/ABS/PATH/TO/WORKSPACE"}},
                ],
            },
        ],
        "notes": {
            "no_llm_required": True,
            "security": (
                "Captured outputs are written to a fixed workspace-local directory (<workspace_id>/conport-aimed_output/) "
                "to avoid arbitrary filesystem writes."
            ),
        },
    }

@conport_mcp.tool(name="update_active_context", description="Updates the active context. Accepts full `content` (object) or `patch_content` (object) for partial updates (use `__DELETE__` as a value in patch to remove a key).")
async def tool_update_active_context(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context,
    content: Annotated[Optional[Dict[str, Any]], Field(description="The full new context content as a dictionary. Overwrites existing.")] = None,
    patch_content: Annotated[Optional[Dict[str, Any]], Field(description="A dictionary of changes to apply to the existing context (add/update keys).")] = None
) -> Dict[str, Any]:
    try:
        pydantic_args = models.UpdateContextArgs(
            workspace_id=workspace_id,
            content=content,
            patch_content=patch_content
        )
        return mcp_handlers.handle_update_active_context(pydantic_args)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in update_active_context handler: {e}")
        raise
    except ValueError as e: # Catch Pydantic validation errors from UpdateContextArgs
        log.error(f"Validation error for update_active_context: {e}. Args: workspace_id={workspace_id}, content_present={content is not None}, patch_content_present={patch_content is not None}")
        raise exceptions.ContextPortalError(f"Invalid arguments for update_active_context: {e}")
    except Exception as e:
        log.error(f"Error processing args for update_active_context: {e}. Args: workspace_id={workspace_id}, content_present={content is not None}, patch_content_present={patch_content is not None}")
        raise exceptions.ContextPortalError(f"Server error processing update_active_context: {type(e).__name__}")

@conport_mcp.tool(name="log_decision", description="Logs an architectural or implementation decision.")
async def tool_log_decision(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    summary: Annotated[str, Field(min_length=1, description="A concise summary of the decision")],
    ctx: Context,
    rationale: Annotated[Optional[str], Field(description="The reasoning behind the decision")] = None,
    implementation_details: Annotated[Optional[str], Field(description="Details about how the decision will be/was implemented")] = None,
    tags: Annotated[Optional[List[str]], Field(description="Optional tags for categorization")] = None
) -> Dict[str, Any]:
    try:
        pydantic_args = models.LogDecisionArgs(
            workspace_id=workspace_id,
            summary=summary,
            rationale=rationale,
            implementation_details=implementation_details,
            tags=tags
        )
        return mcp_handlers.handle_log_decision(pydantic_args)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in log_decision handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for log_decision: {e}. Args: workspace_id={workspace_id}, summary='{summary}'")
        raise exceptions.ContextPortalError(f"Server error processing log_decision: {type(e).__name__}")

@conport_mcp.tool(name="get_decisions", description="Retrieves logged decisions.")
async def tool_get_decisions(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context,
    limit: Annotated[Optional[int], Field(description="Maximum number of decisions to return (most recent first)")] = None,
    tags_filter_include_all: Annotated[Optional[List[str]], Field(description="Filter: items must include ALL of these tags.")] = None,
    tags_filter_include_any: Annotated[Optional[List[str]], Field(description="Filter: items must include AT LEAST ONE of these tags.")] = None
) -> List[Dict[str, Any]]:
    try:
        # The model's own validator will check tag filter exclusivity.
        pydantic_args = models.GetDecisionsArgs(
            workspace_id=workspace_id,
            limit=limit,
            tags_filter_include_all=tags_filter_include_all,
            tags_filter_include_any=tags_filter_include_any
        )
        result = mcp_handlers.handle_get_decisions(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "get_decisions", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in get_decisions handler: {e}")
        raise
    except ValueError as e: # Catch Pydantic validation errors
        log.error(f"Validation error for get_decisions: {e}. Args: workspace_id={workspace_id}, limit={limit}, tags_all={tags_filter_include_all}, tags_any={tags_filter_include_any}")
        raise exceptions.ContextPortalError(f"Invalid arguments for get_decisions: {e}")
    except Exception as e:
        log.error(f"Error processing args for get_decisions: {e}. Args: workspace_id={workspace_id}, limit={limit}, tags_all={tags_filter_include_all}, tags_any={tags_filter_include_any}")
        raise exceptions.ContextPortalError(f"Server error processing get_decisions: {type(e).__name__}")

@conport_mcp.tool(name="search_decisions_fts", description="Full-text search across decision fields (summary, rationale, details, tags).")
async def tool_search_decisions_fts(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    query_term: Annotated[str, Field(min_length=1, description="The term to search for in decisions.")],
    ctx: Context,
    limit: Annotated[Optional[int], Field(default=10, description="Maximum number of search results to return.")] = 10
) -> List[Dict[str, Any]]:
    try:
        pydantic_args = models.SearchDecisionsArgs(
            workspace_id=workspace_id,
            query_term=query_term,
            limit=limit
        )
        result = mcp_handlers.handle_search_decisions_fts(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "search_decisions_fts", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in search_decisions_fts handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for search_decisions_fts: {e}. Args: workspace_id={workspace_id}, query_term='{query_term}', limit={limit}")
        raise exceptions.ContextPortalError(f"Server error processing search_decisions_fts: {type(e).__name__}")

@conport_mcp.tool(name="update_decision", description="Updates an existing decision.")
async def tool_update_decision(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    decision_id: Annotated[int, Field(description="The ID of the decision to update.")],
    ctx: Context,
    summary: Annotated[Optional[str], Field(min_length=1, description="New summary for the decision")] = None,
    rationale: Annotated[Optional[str], Field(description="New rationale for the decision")] = None,
    implementation_details: Annotated[Optional[str], Field(description="New implementation details for the decision")] = None,
    tags: Annotated[Optional[List[str]], Field(description="New tags for the decision")] = None
) -> Dict[str, Any]:
    """
    MCP tool wrapper for update_decision.
    Validates arguments and calls the handler.
    """
    try:
        # The model's own validator will check at_least_one_field.
        pydantic_args = models.UpdateDecisionArgs(
            workspace_id=workspace_id,
            decision_id=decision_id,
            summary=summary,
            rationale=rationale,
            implementation_details=implementation_details,
            tags=tags
        )
        return mcp_handlers.handle_update_decision(pydantic_args)
    except exceptions.ContextPortalError as e: # Specific app errors
        log.error(f"Error in update_decision handler: {e}")
        raise
    except ValueError as e: # Catch Pydantic validation errors from UpdateDecisionArgs
        log.error(f"Validation error for update_decision: {e}. Args: workspace_id={workspace_id}, decision_id={decision_id}, summary_present={summary is not None}, rationale_present={rationale is not None}, implementation_details_present={implementation_details is not None}, tags_present={tags is not None}")
        raise exceptions.ContextPortalError(f"Invalid arguments for update_decision: {e}")
    except Exception as e: # Catch-all for other unexpected errors
        log.error(f"Unexpected error processing args for update_decision: {e}. Args: workspace_id={workspace_id}, decision_id={decision_id}")
        raise exceptions.ContextPortalError(f"Server error processing update_decision: {type(e).__name__} - {e}")

@conport_mcp.tool(name="search_progress_fts", description="Full-text search across progress entry fields (status and description).")
async def tool_search_progress_fts(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    query_term: Annotated[str, Field(min_length=1, description="The term to search for in progress entries.")],
    ctx: Context,
    limit: Annotated[Optional[int], Field(default=10, description="Maximum number of search results to return.")] = 10
) -> List[Dict[str, Any]]:
    try:
        pydantic_args = models.SearchProgressArgs(
            workspace_id=workspace_id,
            query_term=query_term,
            limit=limit
        )
        result = mcp_handlers.handle_search_progress_fts(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "search_progress_fts", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in search_progress_fts handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for search_progress_fts: {e}. Args: workspace_id={workspace_id}, query_term='{query_term}', limit={limit}")
        raise exceptions.ContextPortalError(f"Server error processing search_progress_fts: {type(e).__name__}")

@conport_mcp.tool(name="search_system_patterns_fts", description="Full-text search across system pattern fields (name, description, and tags).")
async def tool_search_system_patterns_fts(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    query_term: Annotated[str, Field(min_length=1, description="The term to search for in system patterns.")],
    ctx: Context,
    limit: Annotated[Optional[int], Field(default=10, description="Maximum number of search results to return.")] = 10
) -> List[Dict[str, Any]]:
    try:
        pydantic_args = models.SearchSystemPatternsArgs(
            workspace_id=workspace_id,
            query_term=query_term,
            limit=limit
        )
        result = mcp_handlers.handle_search_system_patterns_fts(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "search_system_patterns_fts", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in search_system_patterns_fts handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for search_system_patterns_fts: {e}. Args: workspace_id={workspace_id}, query_term='{query_term}', limit={limit}")
        raise exceptions.ContextPortalError(f"Server error processing search_system_patterns_fts: {type(e).__name__}")

@conport_mcp.tool(name="search_context_fts", description="Full-text search across context content (product and active contexts).")
async def tool_search_context_fts(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    query_term: Annotated[str, Field(min_length=1, description="The term to search for in contexts.")],
    ctx: Context,
    context_type_filter: Annotated[Optional[str], Field(description="Filter by context type: 'product' or 'active'")] = None,
    limit: Annotated[Optional[int], Field(default=10, description="Maximum number of search results to return.")] = 10
) -> List[Dict[str, Any]]:
    try:
        pydantic_args = models.SearchContextArgs(
            workspace_id=workspace_id,
            query_term=query_term,
            context_type_filter=context_type_filter,
            limit=limit
        )
        result = mcp_handlers.handle_search_context_fts(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "search_context_fts", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in search_context_fts handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for search_context_fts: {e}. Args: workspace_id={workspace_id}, query_term='{query_term}', context_type_filter='{context_type_filter}', limit={limit}")
        raise exceptions.ContextPortalError(f"Server error processing search_context_fts: {type(e).__name__}")

@conport_mcp.tool(name="log_progress", description="Logs a progress entry or task status.")
async def tool_log_progress(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    status: Annotated[str, Field(description="Current status (e.g., 'TODO', 'IN_PROGRESS', 'DONE')")],
    description: Annotated[str, Field(min_length=1, description="Description of the progress or task")],
    ctx: Context,
    parent_id: Annotated[Optional[int], Field(description="ID of the parent task, if this is a subtask")] = None,
    linked_item_type: Annotated[Optional[str], Field(description="Optional: Type of the ConPort item this progress entry is linked to (e.g., 'decision', 'system_pattern')")] = None,
    linked_item_id: Annotated[Optional[str], Field(description="Optional: ID/key of the ConPort item this progress entry is linked to (requires linked_item_type)")] = None,
    link_relationship_type: Annotated[str, Field(description="Relationship type for the automatic link, defaults to 'relates_to_progress'")] = "relates_to_progress"
) -> Dict[str, Any]:
    try:
        # The model's own validator will check linked_item_type vs linked_item_id.
        pydantic_args = models.LogProgressArgs(
            workspace_id=workspace_id,
            status=status,
            description=description,
            parent_id=parent_id,
            linked_item_type=linked_item_type,
            linked_item_id=linked_item_id,
            link_relationship_type=link_relationship_type
        )
        return mcp_handlers.handle_log_progress(pydantic_args)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in log_progress handler: {e}")
        raise
    except ValueError as e: # Catch Pydantic validation errors
        log.error(f"Validation error for log_progress: {e}. Args: workspace_id={workspace_id}, status='{status}'")
        raise exceptions.ContextPortalError(f"Invalid arguments for log_progress: {e}")
    except Exception as e:
        log.error(f"Error processing args for log_progress: {e}. Args: workspace_id={workspace_id}, status='{status}'")
        raise exceptions.ContextPortalError(f"Server error processing log_progress: {type(e).__name__}")

@conport_mcp.tool(name="get_progress", description="Retrieves progress entries.")
async def tool_get_progress(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context,
    status_filter: Annotated[Optional[str], Field(description="Filter entries by status")] = None,
    parent_id_filter: Annotated[Optional[int], Field(description="Filter entries by parent task ID")] = None,
    limit: Annotated[Optional[int], Field(description="Maximum number of entries to return (most recent first)")] = None
) -> List[Dict[str, Any]]:
    try:
        pydantic_args = models.GetProgressArgs(
            workspace_id=workspace_id,
            status_filter=status_filter,
            parent_id_filter=parent_id_filter,
            limit=limit
        )
        result = mcp_handlers.handle_get_progress(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "get_progress", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in get_progress handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for get_progress: {e}. Args: workspace_id={workspace_id}, status_filter='{status_filter}', parent_id_filter={parent_id_filter}, limit={limit}")
        raise exceptions.ContextPortalError(f"Server error processing get_progress: {type(e).__name__}")

@conport_mcp.tool(name="update_progress", description="Updates an existing progress entry.")
async def tool_update_progress(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    progress_id: Annotated[int, Field(description="The ID of the progress entry to update.")],
    ctx: Context,
    status: Annotated[Optional[str], Field(description="New status (e.g., 'TODO', 'IN_PROGRESS', 'DONE')")] = None,
    description: Annotated[Optional[str], Field(min_length=1, description="New description of the progress or task")] = None,
    parent_id: Annotated[Optional[int], Field(description="New ID of the parent task, if changing")] = None
) -> Dict[str, Any]:
    """
    MCP tool wrapper for update_progress.
    Validates arguments and calls the handler.
    """
    try:
        # The model's own validator will check at_least_one_field.
        pydantic_args = models.UpdateProgressArgs(
            workspace_id=workspace_id,
            progress_id=progress_id,
            status=status,
            description=description,
            parent_id=parent_id
        )
        return mcp_handlers.handle_update_progress(pydantic_args)
    except exceptions.ContextPortalError as e: # Specific app errors
        log.error(f"Error in update_progress handler: {e}")
        raise
    except ValueError as e: # Catch Pydantic validation errors from UpdateProgressArgs
        log.error(f"Validation error for update_progress: {e}. Args: workspace_id={workspace_id}, progress_id={progress_id}, status='{status}', description_present={description is not None}, parent_id={parent_id}")
        raise exceptions.ContextPortalError(f"Invalid arguments for update_progress: {e}")
    except Exception as e: # Catch-all for other unexpected errors
        log.error(f"Unexpected error processing args for update_progress: {e}. Args: workspace_id={workspace_id}, progress_id={progress_id}")
        raise exceptions.ContextPortalError(f"Server error processing update_progress: {type(e).__name__} - {e}")

@conport_mcp.tool(name="delete_progress_by_id", description="Deletes a progress entry by its ID.")
async def tool_delete_progress_by_id(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    progress_id: Annotated[int, Field(description="The ID of the progress entry to delete.")],
    ctx: Context
) -> Dict[str, Any]:
    """
    MCP tool wrapper for delete_progress_by_id.
    Validates arguments and calls the handler.
    """
    try:
        pydantic_args = models.DeleteProgressByIdArgs(
            workspace_id=workspace_id,
            progress_id=progress_id
        )
        return mcp_handlers.handle_delete_progress_by_id(pydantic_args)
    except exceptions.ContextPortalError as e: # Specific app errors
        log.error(f"Error in delete_progress_by_id handler: {e}")
        raise
    # No specific ValueError expected from this model's validation
    except Exception as e: # Catch-all for other unexpected errors
        log.error(f"Unexpected error processing args for delete_progress_by_id: {e}. Args: workspace_id={workspace_id}, progress_id={progress_id}")
        raise exceptions.ContextPortalError(f"Server error processing delete_progress_by_id: {type(e).__name__} - {e}")

@conport_mcp.tool(name="log_system_pattern", description="Logs or atomically updates a system/coding pattern. BEHAVIOR: Same name = UPDATE existing (preserves ID and links), Different name = INSERT new pattern. Uses atomic INSERT...ON CONFLICT to prevent link breakage.")
async def tool_log_system_pattern(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    name: Annotated[str, Field(min_length=1, description="Unique name for the system pattern")],
    ctx: Context,
    description: Annotated[Optional[str], Field(description="Description of the pattern")] = None,
    tags: Annotated[Optional[List[str]], Field(description="Optional tags for categorization")] = None
) -> Dict[str, Any]:
    try:
        pydantic_args = models.LogSystemPatternArgs(
            workspace_id=workspace_id,
            name=name,
            description=description,
            tags=tags
        )
        return mcp_handlers.handle_log_system_pattern(pydantic_args)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in log_system_pattern handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for log_system_pattern: {e}. Args: workspace_id={workspace_id}, name='{name}'")
        raise exceptions.ContextPortalError(f"Server error processing log_system_pattern: {type(e).__name__}")

@conport_mcp.tool(name="get_system_patterns", description="Retrieves system patterns.")
async def tool_get_system_patterns(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context,
    limit: Annotated[Optional[int], Field(description="Maximum number of patterns to return")] = None,
    tags_filter_include_all: Annotated[Optional[List[str]], Field(description="Filter: items must include ALL of these tags.")] = None,
    tags_filter_include_any: Annotated[Optional[List[str]], Field(description="Filter: items must include AT LEAST ONE of these tags.")] = None
) -> List[Dict[str, Any]]:
    try:
        # The model's own validator will check tag filter exclusivity.
        pydantic_args = models.GetSystemPatternsArgs(
            workspace_id=workspace_id,
            limit=limit,
            tags_filter_include_all=tags_filter_include_all,
            tags_filter_include_any=tags_filter_include_any
        )
        result = mcp_handlers.handle_get_system_patterns(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "get_system_patterns", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in get_system_patterns handler: {e}")
        raise
    except ValueError as e: # Catch Pydantic validation errors
        log.error(f"Validation error for get_system_patterns: {e}. Args: workspace_id={workspace_id}, tags_all={tags_filter_include_all}, tags_any={tags_filter_include_any}")
        raise exceptions.ContextPortalError(f"Invalid arguments for get_system_patterns: {e}")
    except Exception as e:
        log.error(f"Error processing args for get_system_patterns: {e}. Args: workspace_id={workspace_id}, tags_all={tags_filter_include_all}, tags_any={tags_filter_include_any}")
        raise exceptions.ContextPortalError(f"Server error processing get_system_patterns: {type(e).__name__}")

@conport_mcp.tool(name="log_custom_data", description="Stores or atomically updates a custom key-value entry under a category. BEHAVIOR: Same category+key = UPDATE existing (preserves ID and links), Different category/key = INSERT new entry. Uses atomic INSERT...ON CONFLICT to prevent link breakage. Value is JSON-serializable.")
async def tool_log_custom_data(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    category: Annotated[str, Field(min_length=1, description="Category for the custom data")],
    key: Annotated[str, Field(min_length=1, description="Key for the custom data (unique within category)")],
    value: Annotated[Any, Field(description="The custom data value (JSON serializable)")],
    ctx: Context
) -> Dict[str, Any]:
    try:
        pydantic_args = models.LogCustomDataArgs(
            workspace_id=workspace_id,
            category=category,
            key=key,
            value=value
        )
        return mcp_handlers.handle_log_custom_data(pydantic_args)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in log_custom_data handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for log_custom_data: {e}. Args: workspace_id={workspace_id}, category='{category}', key='{key}'")
        raise exceptions.ContextPortalError(f"Server error processing log_custom_data: {type(e).__name__}")

@conport_mcp.tool(name="get_custom_data", description="Retrieves custom data.")
async def tool_get_custom_data(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context,
    category: Annotated[Optional[str], Field(description="Filter by category")] = None,
    key: Annotated[Optional[str], Field(description="Filter by key (requires category)")] = None
) -> List[Dict[str, Any]]:
    try:
        pydantic_args = models.GetCustomDataArgs(
            workspace_id=workspace_id,
            category=category,
            key=key
        )
        result = mcp_handlers.handle_get_custom_data(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "get_custom_data", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in get_custom_data handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for get_custom_data: {e}. Args: workspace_id={workspace_id}, category='{category}', key='{key}'")
        raise exceptions.ContextPortalError(f"Server error processing get_custom_data: {type(e).__name__}")

@conport_mcp.tool(name="get_all_custom_data_by_id_desc", description="Retrieves all custom data entries sorted by ID descending (most recent first) for UI display.")
async def tool_get_all_custom_data_by_id_desc(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context,
    limit: Annotated[Optional[int], Field(description="Maximum number of entries to return (most recent first)")] = None
) -> List[Dict[str, Any]]:
    try:
        pydantic_args = models.GetAllCustomDataByIdDescArgs(
            workspace_id=workspace_id,
            limit=limit
        )
        result = mcp_handlers.handle_get_all_custom_data_by_id_desc(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "get_all_custom_data_by_id_desc", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in get_all_custom_data_by_id_desc handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for get_all_custom_data_by_id_desc: {e}. Args: workspace_id={workspace_id}, limit={limit}")
        raise exceptions.ContextPortalError(f"Server error processing get_all_custom_data_by_id_desc: {type(e).__name__}")

@conport_mcp.tool(name="delete_custom_data", description="Deletes a specific custom data entry.")
async def tool_delete_custom_data(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    category: Annotated[str, Field(min_length=1, description="Category of the data to delete")],
    key: Annotated[str, Field(min_length=1, description="Key of the data to delete")],
    ctx: Context
) -> Dict[str, Any]:
    try:
        pydantic_args = models.DeleteCustomDataArgs(
            workspace_id=workspace_id,
            category=category,
            key=key
        )
        return mcp_handlers.handle_delete_custom_data(pydantic_args)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in delete_custom_data handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for delete_custom_data: {e}. Args: workspace_id={workspace_id}, category='{category}', key='{key}'")
        raise exceptions.ContextPortalError(f"Server error processing delete_custom_data: {type(e).__name__}")
@conport_mcp.tool(name="search_project_glossary_fts", description="Full-text search within the 'ProjectGlossary' custom data category.")
async def tool_search_project_glossary_fts(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    query_term: Annotated[str, Field(min_length=1, description="The term to search for in the glossary.")],
    ctx: Context,
    limit: Annotated[Optional[int], Field(default=10, description="Maximum number of search results to return.")] = 10
) -> List[Dict[str, Any]]:
    try:
        pydantic_args = models.SearchProjectGlossaryArgs(
            workspace_id=workspace_id,
            query_term=query_term,
            limit=limit
        )
        result = mcp_handlers.handle_search_project_glossary_fts(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "search_project_glossary_fts", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in search_project_glossary_fts handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for search_project_glossary_fts: {e}. Args: workspace_id={workspace_id}, query_term='{query_term}', limit={limit}")
        raise exceptions.ContextPortalError(f"Server error processing search_project_glossary_fts: {type(e).__name__}")

@conport_mcp.tool(name="export_conport_to_markdown", description="Exports ConPort data to markdown files.")
async def tool_export_conport_to_markdown(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context,
    output_path: Annotated[Optional[str], Field(description="Optional output directory path relative to workspace_id. Defaults to './conport_export/' if not provided.")] = None
) -> Dict[str, Any]:
    try:
        pydantic_args = models.ExportConportToMarkdownArgs(
            workspace_id=workspace_id,
            output_path=output_path
        )
        return mcp_handlers.handle_export_conport_to_markdown(pydantic_args)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in export_conport_to_markdown handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for export_conport_to_markdown: {e}. Args: workspace_id={workspace_id}, output_path='{output_path}'")
        raise exceptions.ContextPortalError(f"Server error processing export_conport_to_markdown: {type(e).__name__}")

@conport_mcp.tool(name="import_markdown_to_conport", description="Imports data from markdown files into ConPort.")
async def tool_import_markdown_to_conport(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context,
    input_path: Annotated[Optional[str], Field(description="Optional input directory path relative to workspace_id containing markdown files. Defaults to './conport_export/' if not provided.")] = None
) -> Dict[str, Any]:
    try:
        pydantic_args = models.ImportMarkdownToConportArgs(
            workspace_id=workspace_id,
            input_path=input_path
        )
        return mcp_handlers.handle_import_markdown_to_conport(pydantic_args)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in import_markdown_to_conport handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for import_markdown_to_conport: {e}. Args: workspace_id={workspace_id}, input_path='{input_path}'")
        raise exceptions.ContextPortalError(f"Server error processing import_markdown_to_conport: {type(e).__name__}")

@conport_mcp.tool(name="link_conport_items", description="Creates a relationship link between two ConPort items, explicitly building out the project knowledge graph.")
async def tool_link_conport_items(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    source_item_type: Annotated[str, Field(description="Type of the source item")],
    source_item_id: Annotated[str, Field(description="ID or key of the source item")],
    target_item_type: Annotated[str, Field(description="Type of the target item")],
    target_item_id: Annotated[str, Field(description="ID or key of the target item")],
    relationship_type: Annotated[str, Field(description="Nature of the link")],
    ctx: Context,
    description: Annotated[Optional[str], Field(description="Optional description for the link")] = None
) -> Dict[str, Any]:
    try:
        pydantic_args = models.LinkConportItemsArgs(
            workspace_id=workspace_id,
            source_item_type=source_item_type,
            source_item_id=str(source_item_id), # Ensure string as per model
            target_item_type=target_item_type,
            target_item_id=str(target_item_id), # Ensure string as per model
            relationship_type=relationship_type,
            description=description
        )
        return mcp_handlers.handle_link_conport_items(pydantic_args)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in link_conport_items handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for link_conport_items: {e}. Args: workspace_id={workspace_id}, source_type='{source_item_type}', source_id='{source_item_id}'")
        raise exceptions.ContextPortalError(f"Server error processing link_conport_items: {type(e).__name__}")

@conport_mcp.tool(name="get_linked_items", description="Retrieves items linked to a specific item.")
async def tool_get_linked_items(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    item_type: Annotated[str, Field(description="Type of the item to find links for (e.g., 'decision')")],
    item_id: Annotated[str, Field(description="ID or key of the item to find links for")],
    ctx: Context,
    relationship_type_filter: Annotated[Optional[str], Field(description="Optional: Filter by relationship type")] = None,
    linked_item_type_filter: Annotated[Optional[str], Field(description="Optional: Filter by the type of the linked items")] = None,
    limit: Annotated[Optional[int], Field(description="Maximum number of links to return")] = None
) -> List[Dict[str, Any]]:
    try:
        pydantic_args = models.GetLinkedItemsArgs(
            workspace_id=workspace_id,
            item_type=item_type,
            item_id=str(item_id), # Ensure string as per model
            relationship_type_filter=relationship_type_filter,
            linked_item_type_filter=linked_item_type_filter,
            limit=limit
        )
        result = mcp_handlers.handle_get_linked_items(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "get_linked_items", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in get_linked_items handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for get_linked_items: {e}. Args: workspace_id={workspace_id}, item_type='{item_type}', item_id='{item_id}'")
        raise exceptions.ContextPortalError(f"Server error processing get_linked_items: {type(e).__name__}")

@conport_mcp.tool(name="get_items_by_references", description="Enhanced bulk item retrieval with dual interface: accepts direct type/ID references OR get_linked_items results for 1-hop knowledge graph expansion. Returns structured success/error status for each item with comprehensive error handling.")
async def tool_get_items_by_references(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context,
    references: Annotated[Optional[List[Dict[str, str]]], Field(description="List of {type, id} pairs to retrieve. Each dict should have 'type' and 'id' keys.")] = None,
    linked_items_result: Annotated[Optional[List[Dict[str, Any]]], Field(description="Result from get_linked_items to parse for item references. Alternative to 'references'.")] = None
) -> List[Dict[str, Any]]:
    try:
        pydantic_args = models.GetItemsByReferencesArgs(
            workspace_id=workspace_id,
            references=references,
            linked_items_result=linked_items_result
        )
        result = mcp_handlers.handle_get_items_by_references(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "get_items_by_references", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in get_items_by_references handler: {e}")
        raise
    except ValueError as e: # Catch Pydantic validation errors
        log.error(f"Validation error for get_items_by_references: {e}. Args: workspace_id={workspace_id}, references={references is not None}, linked_items_result={linked_items_result is not None}")
        raise exceptions.ContextPortalError(f"Invalid arguments for get_items_by_references: {e}")
    except Exception as e:
        log.error(f"Error processing args for get_items_by_references: {e}. Args: workspace_id={workspace_id}")
        raise exceptions.ContextPortalError(f"Server error processing get_items_by_references: {type(e).__name__}")

@conport_mcp.tool(name="search_custom_data_value_fts", description="Full-text search across all custom data values, categories, and keys.")
async def tool_search_custom_data_value_fts(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    query_term: Annotated[str, Field(min_length=1, description="The term to search for in custom data (category, key, or value).")],
    ctx: Context,
    category_filter: Annotated[Optional[str], Field(description="Optional: Filter results to this category after FTS.")] = None,
    limit: Annotated[Optional[int], Field(default=10, description="Maximum number of search results to return.")] = 10
) -> List[Dict[str, Any]]:
    try:
        pydantic_args = models.SearchCustomDataValueArgs(
            workspace_id=workspace_id,
            query_term=query_term,
            category_filter=category_filter,
            limit=limit
        )
        result = mcp_handlers.handle_search_custom_data_value_fts(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "search_custom_data_value_fts", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in search_custom_data_value_fts handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for search_custom_data_value_fts: {e}. Args: workspace_id={workspace_id}, query_term='{query_term}', category_filter='{category_filter}', limit={limit}")
        raise exceptions.ContextPortalError(f"Server error processing search_custom_data_value_fts: {type(e).__name__}")

@conport_mcp.tool(name="batch_log_items", description="Logs multiple items of the same type (e.g., decisions, progress entries) in a single call.")
async def tool_batch_log_items(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    item_type: Annotated[str, Field(description="Type of items to log (e.g., 'decision', 'progress_entry', 'system_pattern', 'custom_data')")],
    items: Annotated[List[Dict[str, Any]], Field(description="A list of dictionaries, each representing the arguments for a single item log.")],
    ctx: Context
) -> Dict[str, Any]:
    try:
        # Basic validation for items being a list is handled by Pydantic/FastMCP.
        # More complex validation (e.g. structure of dicts within items) happens in the handler.
        pydantic_args = models.BatchLogItemsArgs(
            workspace_id=workspace_id,
            item_type=item_type,
            items=items
        )
        return mcp_handlers.handle_batch_log_items(pydantic_args)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in batch_log_items handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for batch_log_items: {e}. Args: workspace_id={workspace_id}, item_type='{item_type}', num_items={len(items) if isinstance(items, list) else 'N/A'}")
        raise exceptions.ContextPortalError(f"Server error processing batch_log_items: {type(e).__name__}")

@conport_mcp.tool(name="get_item_history", description="Retrieves version history for Product or Active Context.")
async def tool_get_item_history(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    item_type: Annotated[str, Field(description="Type of the item: 'product_context' or 'active_context'")],
    ctx: Context,
    limit: Annotated[Optional[int], Field(description="Maximum number of history entries to return (most recent first)")] = None,
    before_timestamp: Annotated[Optional[datetime], Field(description="Return entries before this timestamp")] = None,
    after_timestamp: Annotated[Optional[datetime], Field(description="Return entries after this timestamp")] = None,
    version: Annotated[Optional[int], Field(description="Return a specific version")] = None
) -> List[Dict[str, Any]]:
    try:
        # The model's own validator will check item_type.
        pydantic_args = models.GetItemHistoryArgs(
            workspace_id=workspace_id,
            item_type=item_type,
            limit=limit,
            before_timestamp=before_timestamp,
            after_timestamp=after_timestamp,
            version=version
        )
        result = mcp_handlers.handle_get_item_history(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "get_item_history", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in get_item_history handler: {e}")
        raise
    except ValueError as e: # Catch Pydantic validation errors
        log.error(f"Validation error for get_item_history: {e}. Args: workspace_id={workspace_id}, item_type='{item_type}'")
        raise exceptions.ContextPortalError(f"Invalid arguments for get_item_history: {e}")
    except Exception as e:
        log.error(f"Error processing args for get_item_history: {e}. Args: workspace_id={workspace_id}, item_type='{item_type}'")
        raise exceptions.ContextPortalError(f"Server error processing get_item_history: {type(e).__name__}")

@conport_mcp.tool(name="delete_decision_by_id", description="Deletes a decision by its ID.")
async def tool_delete_decision_by_id(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    decision_id: Annotated[int, Field(description="The ID of the decision to delete.")],
    ctx: Context
) -> Dict[str, Any]:
    try:
        pydantic_args = models.DeleteDecisionByIdArgs(workspace_id=workspace_id, decision_id=decision_id)
        return mcp_handlers.handle_delete_decision_by_id(pydantic_args)
    except Exception as e:
        log.error(f"Error processing args for delete_decision_by_id: {e}. Args: workspace_id={workspace_id}, decision_id={decision_id}")
        raise exceptions.ContextPortalError(f"Server error processing delete_decision_by_id: {type(e).__name__}")

@conport_mcp.tool(name="delete_system_pattern_by_id", description="Deletes a system pattern by its ID.")
async def tool_delete_system_pattern_by_id(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    pattern_id: Annotated[int, Field(description="The ID of the system pattern to delete.")],
    ctx: Context
) -> Dict[str, Any]:
    try:
        pydantic_args = models.DeleteSystemPatternByIdArgs(workspace_id=workspace_id, pattern_id=pattern_id)
        return mcp_handlers.handle_delete_system_pattern_by_id(pydantic_args)
    except Exception as e:
        log.error(f"Error processing args for delete_system_pattern_by_id: {e}. Args: workspace_id={workspace_id}, pattern_id={pattern_id}")
        raise exceptions.ContextPortalError(f"Server error processing delete_system_pattern_by_id: {type(e).__name__}")

@conport_mcp.tool(name="get_conport_schema", description="Retrieves the schema of available ConPort tools and their arguments.")
async def tool_get_conport_schema(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context
) -> Dict[str, Dict[str, Any]]:
    try:
        pydantic_args = models.GetConportSchemaArgs(workspace_id=workspace_id)
        result = mcp_handlers.handle_get_conport_schema(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "get_conport_schema", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in get_conport_schema handler: {e}")
        raise
    except Exception as e:
        log.error(f"Error processing args for get_conport_schema: {e}. Args: workspace_id={workspace_id}")
        raise exceptions.ContextPortalError(f"Server error processing get_conport_schema: {type(e).__name__}")

@conport_mcp.tool(name="get_recent_activity_summary", description="Provides a summary of recent ConPort activity (new/updated items).")
async def tool_get_recent_activity_summary(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    ctx: Context,
    hours_ago: Annotated[Optional[int], Field(description="Look back this many hours for recent activity. Mutually exclusive with 'since_timestamp'.")] = None,
    since_timestamp: Annotated[Optional[datetime], Field(description="Look back for activity since this specific timestamp. Mutually exclusive with 'hours_ago'.")] = None,
    limit_per_type: Annotated[Optional[int], Field(default=5, description="Maximum number of recent items to show per activity type (e.g., 5 most recent decisions).")] = 5
) -> Dict[str, Any]:
    try:
        # The model's own validator will check hours_ago vs since_timestamp.
        pydantic_args = models.GetRecentActivitySummaryArgs(
            workspace_id=workspace_id,
            hours_ago=hours_ago,
            since_timestamp=since_timestamp,
            limit_per_type=limit_per_type
        )
        result = mcp_handlers.handle_get_recent_activity_summary(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "get_recent_activity_summary", result)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in get_recent_activity_summary handler: {e}")
        raise
    except ValueError as e: # Catch Pydantic validation errors
        log.error(f"Validation error for get_recent_activity_summary: {e}. Args: workspace_id={workspace_id}, hours_ago={hours_ago}, since_timestamp={since_timestamp}")
        raise exceptions.ContextPortalError(f"Invalid arguments for get_recent_activity_summary: {e}")
    except Exception as e:
        log.error(f"Error processing args for get_recent_activity_summary: {e}. Args: workspace_id={workspace_id}, hours_ago={hours_ago}, since_timestamp={since_timestamp}")
        raise exceptions.ContextPortalError(f"Server error processing get_recent_activity_summary: {type(e).__name__}")

@conport_mcp.tool(name="semantic_search_conport", description="Performs a semantic search across ConPort data.")
async def tool_semantic_search_conport(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    query_text: Annotated[str, Field(min_length=1, description="The natural language query text for semantic search.")],
    ctx: Context,
    top_k: Annotated[int, Field(default=5, ge=1, le=25, description="Number of top results to return.")] = 5,
    filter_item_types: Annotated[Optional[List[str]], Field(description="Optional list of item types to filter by (e.g., ['decision', 'custom_data']). Valid types: 'decision', 'system_pattern', 'custom_data', 'progress_entry'.")] = None,
    filter_tags_include_any: Annotated[Optional[List[str]], Field(description="Optional list of tags; results will include items matching any of these tags.")] = None,
    filter_tags_include_all: Annotated[Optional[List[str]], Field(description="Optional list of tags; results will include only items matching all of these tags.")] = None,
    filter_custom_data_categories: Annotated[Optional[List[str]], Field(description="Optional list of categories to filter by if 'custom_data' is in filter_item_types.")] = None
) -> List[Dict[str, Any]]:
    """MCP tool wrapper for semantic_search_conport.

    Validates arguments using SemanticSearchConportArgs and calls the handler.
    """
    try:
        # The model's own validators will check tag filters and custom_data_category_filter.
        pydantic_args = models.SemanticSearchConportArgs(
            workspace_id=workspace_id,
            query_text=query_text,
            top_k=top_k,
            filter_item_types=filter_item_types,
            filter_tags_include_any=filter_tags_include_any,
            filter_tags_include_all=filter_tags_include_all,
            filter_custom_data_categories=filter_custom_data_categories
        )
        # Ensure the handler is awaited if it's async
        result = await mcp_handlers.handle_semantic_search_conport(pydantic_args)
        return _maybe_capture_and_annotate(workspace_id, "semantic_search_conport", result)
    except exceptions.ContextPortalError as e: # Specific app errors
        log.error(f"Error in semantic_search_conport handler: {e}")
        raise
    except ValueError as e: # Catch Pydantic validation errors
        log.error(f"Validation error for semantic_search_conport: {e}. Args: workspace_id={workspace_id}, query_text='{query_text}'")
        raise exceptions.ContextPortalError(f"Invalid arguments for semantic_search_conport: {e}")
    except Exception as e: # Catch-all for other unexpected errors
        log.error(f"Unexpected error processing args for semantic_search_conport: {e}. Args: workspace_id={workspace_id}, query_text='{query_text}'")
        raise exceptions.ContextPortalError(f"Server error processing semantic_search_conport: {type(e).__name__} - {e}")

@conport_mcp.tool(name="get_workspace_detection_info", description="Provides detailed information about workspace detection for debugging and verification.")
async def tool_get_workspace_detection_info(
    ctx: Context,
    start_path: Annotated[Optional[str], Field(description="Starting directory for detection analysis (default: current directory)")] = None
) -> Dict[str, Any]:
    """
    MCP tool for getting workspace detection information.
    This tool helps debug workspace detection issues and verify the detection process.
    """
    try:
        detector = WorkspaceDetector(start_path)
        detection_info = detector.get_detection_info()
        
        # Add additional runtime information
        detection_info.update({
            'server_version': CONPORT_VERSION,
            'detection_timestamp': datetime.now().isoformat(),
            'auto_detection_available': True,
            'mcp_context_workspace': detector.detect_from_mcp_context()
        })
        
        result = detection_info
        return _maybe_capture_and_annotate(detection_info.get('workspace_id') or "", "get_workspace_detection_info", result)
    except Exception as e:
        log.error(f"Error in get_workspace_detection_info: {e}")
        raise exceptions.ContextPortalError(f"Server error getting workspace detection info: {type(e).__name__} - {e}")

@conport_mcp.tool(name="update_link", description="Updates an existing link between two ConPort items.")
async def tool_update_link(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    link_id: Annotated[int, Field(description="The ID of the link to update.")],
    ctx: Context,
    relationship_type: Annotated[Optional[str], Field(description="New relationship type for the link")] = None,
    description: Annotated[Optional[str], Field(description="New description for the link")] = None
) -> Dict[str, Any]:
    """MCP tool wrapper for update_link."""
    try:
        pydantic_args = models.UpdateLinkArgs(
            workspace_id=workspace_id,
            link_id=link_id,
            relationship_type=relationship_type,
            description=description
        )
        return mcp_handlers.handle_update_link(pydantic_args)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in update_link handler: {e}")
        raise
    except ValueError as e:
        log.error(f"Validation error for update_link: {e}. Args: workspace_id={workspace_id}, link_id={link_id}")
        raise exceptions.ContextPortalError(f"Invalid arguments for update_link: {e}")
    except Exception as e:
        log.error(f"Unexpected error processing args for update_link: {e}. Args: workspace_id={workspace_id}, link_id={link_id}")
        raise exceptions.ContextPortalError(f"Server error processing update_link: {type(e).__name__} - {e}")

@conport_mcp.tool(name="delete_link_by_id", description="Deletes a link by its ID.")
async def tool_delete_link_by_id(
    workspace_id: Annotated[str, Field(description="Identifier for the workspace (e.g., absolute path)")],
    link_id: Annotated[int, Field(description="The ID of the link to delete.")],
    ctx: Context
) -> Dict[str, Any]:
    """MCP tool wrapper for delete_link_by_id."""
    try:
        pydantic_args = models.DeleteLinkByIdArgs(
            workspace_id=workspace_id,
            link_id=link_id
        )
        return mcp_handlers.handle_delete_link_by_id(pydantic_args)
    except exceptions.ContextPortalError as e:
        log.error(f"Error in delete_link_by_id handler: {e}")
        raise
    except Exception as e:
        log.error(f"Unexpected error processing args for delete_link_by_id: {e}. Args: workspace_id={workspace_id}, link_id={link_id}")
        raise exceptions.ContextPortalError(f"Server error processing delete_link_by_id: {type(e).__name__} - {e}")

def build_dynamic_cors_regex() -> str:
    """Build CORS regex with RUNTIME dynamic WSL2 IP detection for fresh boot/IP changes."""
    # Start with localhost and standard private networks
    host_list = ["localhost", "127\\.0\\.0\\.1", "0\\.0\\.0\\.0"]
    
    # Add WSL2 private IP ranges (covers most WSL2 IP allocations)
    wsl2_ip_ranges = [
        "172\\.1[6-9]\\.[0-9]+\\.[0-9]+",  # 172.16.x.x - 172.19.x.x
        "172\\.2[0-9]\\.[0-9]+\\.[0-9]+",  # 172.20.x.x - 172.29.x.x
        "172\\.3[0-1]\\.[0-9]+\\.[0-9]+",  # 172.30.x.x - 172.31.x.x (common WSL2 range)
        "192\\.168\\.[0-9]+\\.[0-9]+"      # 192.168.x.x (alternative WSL2 range)
    ]
    host_list.extend(wsl2_ip_ranges)
    log.debug(f"Added WSL2 private IP ranges to CORS: {wsl2_ip_ranges}")
    
    # STILL attempt dynamic detection for specific IPs (runtime refresh)
    workspace_id = None
    try:
        import sys
        if '--workspace_id' in sys.argv:
            idx = sys.argv.index('--workspace_id')
            if idx + 1 < len(sys.argv):
                workspace_id = sys.argv[idx + 1]
    except Exception:
        pass
    
    # Get CURRENT WSL2 IP via runtime detection (fresh IP after reboot)
    try:
        import subprocess
        result = subprocess.run(['hostname', '-I'], capture_output=True, text=True, timeout=2)
        if result.returncode == 0:
            current_ips = result.stdout.strip().split()
            for ip in current_ips:
                if ip and '.' in ip and not ip.startswith('127.'):
                    escaped_current_ip = ip.replace('.', r'\.')
                    if escaped_current_ip not in '|'.join(host_list):
                        host_list.append(escaped_current_ip)
                        log.debug(f"Added current runtime WSL2 IP: {ip}")
    except Exception as e:
        log.debug(f"Failed to detect current WSL2 IP: {e}")
    
    # Also load cached IPs from env_vars.json (for recently detected IPs)
    if workspace_id:
        try:
            import json
            from pathlib import Path
            cache_dir = Path(workspace_id) / "context_portal_aimed" / "ui-cache"
            
            env_vars_file = cache_dir / "env_vars.json"
            if env_vars_file.exists():
                with open(env_vars_file) as f:
                    env_data = json.load(f)
                    env_vars = env_data.get("data", {})
                    
                    # Add cached WSL2 IPs
                    for ip_key in ["wsl2_ip", "wsl2_gateway_ip"]:
                        cached_ip = env_vars.get(ip_key)
                        if cached_ip and '.' in cached_ip:
                            escaped_ip = cached_ip.replace('.', r'\.')
                            if escaped_ip not in '|'.join(host_list):
                                host_list.append(escaped_ip)
                                log.debug(f"Added cached {ip_key}: {cached_ip}")
                                
        except Exception as e:
            log.debug(f"Failed to load cached WSL2 IPs: {e}")
    
    # Build pattern with all detected IPs
    cors_pattern = rf"http://({'|'.join(host_list)})(:\d+)?"
    log.debug(f"Dynamic CORS pattern with {len(host_list)} hosts: {cors_pattern}")
    return cors_pattern

# --- Dynamic CORS Middleware (Runtime WSL2 IP Detection) ---
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import re

class DynamicCORSMiddleware(BaseHTTPMiddleware):
    """Custom CORS middleware with runtime WSL2 IP detection for fresh session support."""
    
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        
        # Always allow same-origin requests
        if not origin:
            response = await call_next(request)
            return response
        
        # Build fresh CORS pattern on each request (handles WSL2 IP changes)
        allowed_pattern = self.build_fresh_cors_pattern()
        origin_allowed = re.match(allowed_pattern, origin) is not None
        
        # Handle preflight OPTIONS requests
        if request.method == "OPTIONS" and origin_allowed:
            response = Response(status_code=200)
            self.add_cors_headers(response, origin)
            return response
        
        # Handle regular requests
        response = await call_next(request)
        if origin_allowed:
            self.add_cors_headers(response, origin)
        
        return response
    
    def add_cors_headers(self, response: Response, origin: str):
        """Add CORS headers to response."""
        response.headers["access-control-allow-origin"] = origin
        response.headers["access-control-allow-credentials"] = "true"
        response.headers["access-control-allow-methods"] = "*"
        response.headers["access-control-allow-headers"] = "*"
        response.headers["access-control-expose-headers"] = "mcp-session-id"
    
    def build_fresh_cors_pattern(self) -> str:
        """Build CORS pattern with CURRENT WSL2 IP detection."""
        # Base hosts + WSL2 ranges
        host_list = [
            "localhost", "127\\.0\\.0\\.1", "0\\.0\\.0\\.0",
            # WSL2 common IP ranges
            "172\\.[1-3][0-9]\\.[0-9]+\\.[0-9]+",
            "192\\.168\\.[0-9]+\\.[0-9]+"
        ]
        
        # Get CURRENT WSL2 IP via hostname command (fresh detection)
        try:
            import subprocess
            result = subprocess.run(['hostname', '-I'], capture_output=True, text=True, timeout=1)
            if result.returncode == 0:
                current_ips = result.stdout.strip().split()
                for ip in current_ips:
                    if ip and '.' in ip and not ip.startswith('127.'):
                        escaped_ip = ip.replace('.', r'\.')
                        host_list.append(escaped_ip)
        except Exception:
            pass  # Fallback to ranges if detection fails
        
        return rf"http://({'|'.join(host_list)})(:\d+)?"

# Use custom dynamic CORS middleware instead of static FastAPI CORS
app.add_middleware(DynamicCORSMiddleware)

# --- Mount FastMCP Server ---
# This is the proper way to mount FastMCP - replaces our custom endpoint
app.mount("/mcp", mcp_app)

log.info("FastMCP server properly mounted at /mcp/ with lifespan management")

# --- Health Check Endpoint ---
@app.get("/")
async def read_root():
    return {"message": "ConPort MCP Server is running. MCP endpoint at /mcp/"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "server": "ConPort MCP"}

# --- UI Cache REST API Endpoints ---
# These endpoints provide clean separation between UI state and business data

@app.post("/api/ui-cache/kanban-positions/{workspace_id}")
async def save_kanban_positions(workspace_id: str, positions: Dict[str, list]):
    """Save kanban card positions to file-based UI cache."""
    try:
        ui_cache.save_kanban_positions(workspace_id, positions)
        log.info(f"Saved kanban positions for workspace: {workspace_id}")
        return {"success": True, "message": "Kanban positions saved successfully"}
    except Exception as e:
        log.error(f"Error saving kanban positions for {workspace_id}: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/ui-cache/kanban-positions/{workspace_id}")
async def load_kanban_positions(workspace_id: str):
    """Load kanban card positions from file-based UI cache."""
    try:
        positions = ui_cache.load_kanban_positions(workspace_id)
        log.info(f"Loaded kanban positions for workspace: {workspace_id}")
        return {"success": True, "positions": positions}
    except Exception as e:
        log.error(f"Error loading kanban positions for {workspace_id}: {e}")
        return {"success": False, "error": str(e), "positions": {"TODO": [], "IN_PROGRESS": [], "DONE": []}}

@app.post("/api/ui-cache/dashboard-settings/{workspace_id}")
async def save_dashboard_settings(workspace_id: str, settings: Dict[str, Any]):
    """Save dashboard settings to file-based UI cache."""
    try:
        ui_cache.save_dashboard_settings(workspace_id, settings)
        log.info(f"Saved dashboard settings for workspace: {workspace_id}")
        return {"success": True, "message": "Dashboard settings saved successfully"}
    except Exception as e:
        log.error(f"Error saving dashboard settings for {workspace_id}: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/ui-cache/dashboard-settings/{workspace_id}")
async def load_dashboard_settings(workspace_id: str):
    """Load dashboard settings from file-based UI cache."""
    try:
        settings = ui_cache.load_dashboard_settings(workspace_id)
        log.info(f"Loaded dashboard settings for workspace: {workspace_id}")
        return {"success": True, "settings": settings}
    except Exception as e:
        log.error(f"Error loading dashboard settings for {workspace_id}: {e}")
        return {"success": False, "error": str(e), "settings": {"polling_enabled": True, "polling_interval": 3000, "current_view": "activity", "saved_view": "all"}}

from pydantic import BaseModel

class UICacheRequest(BaseModel):
    """Request model for UI cache preference data."""
    pass  # Accept any JSON structure

# Path parameter endpoints (original)
@app.post("/api/ui-cache/preference/{workspace_id}/{preference_key}")
async def save_ui_preference(workspace_id: str, preference_key: str, preference_data: Dict[str, Any]):
    """Save any UI preference to file-based cache."""
    try:
        ui_cache.save_ui_preference(workspace_id, preference_key, preference_data)
        log.info(f"Saved UI preference '{preference_key}' for workspace: {workspace_id}")
        return {"success": True, "message": f"UI preference '{preference_key}' saved successfully"}
    except Exception as e:
        log.error(f"Error saving UI preference '{preference_key}' for {workspace_id}: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/ui-cache/preference/{workspace_id}/{preference_key}")
async def load_ui_preference(workspace_id: str, preference_key: str, default: Any = None):
    """Load any UI preference from file-based cache."""
    try:
        preference_value = ui_cache.load_ui_preference(workspace_id, preference_key, default)
        log.info(f"Loaded UI preference '{preference_key}' for workspace: {workspace_id}")
        return {"success": True, "value": preference_value}
    except Exception as e:
        log.error(f"Error loading UI preference '{preference_key}' for {workspace_id}: {e}")
        return {"success": False, "error": str(e), "value": default}

# Query parameter endpoints (for GraphCanvas.tsx and the dashboard (and anywhere else preferences could be get/set) via Next.js proxy)
from fastapi import Query

@app.post("/api/ui-cache/preference")
async def save_ui_preference_query(
    workspace_id: str = Query(..., description="Workspace identifier"),
    preference_key: str = Query(..., description="Preference key"),
    preference_data: Dict[str, Any] = None
):
    """Save any UI preference to file-based cache using query parameters."""
    try:
        from fastapi import Request
        # Get the actual request body since FastAPI doesn't auto-parse it in this context
        ui_cache.save_ui_preference(workspace_id, preference_key, preference_data)
        log.info(f"Saved UI preference '{preference_key}' for workspace: {workspace_id}")
        return {"success": True, "message": f"UI preference '{preference_key}' saved successfully"}
    except Exception as e:
        log.error(f"Error saving UI preference '{preference_key}' for {workspace_id}: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/ui-cache/preference")
async def load_ui_preference_query(
    workspace_id: str = Query(..., description="Workspace identifier"),
    preference_key: str = Query(..., description="Preference key")
):
    """Load any UI preference from file-based cache using query parameters."""
    try:
        preference_value = ui_cache.load_ui_preference(workspace_id, preference_key, None)
        debug_print(f"Loaded UI preference '{preference_key}' for workspace: {workspace_id}")
        return {"success": True, "value": preference_value}
    except Exception as e:
        log.error(f"Error loading UI preference '{preference_key}' for {workspace_id}: {e}")
        return {"success": False, "error": str(e), "value": None}

@app.delete("/api/ui-cache/preference/{workspace_id}/{preference_key}")
async def delete_ui_preference(workspace_id: str, preference_key: str):
    """Delete a UI preference from file-based cache."""
    try:
        deleted = ui_cache.delete_ui_preference(workspace_id, preference_key)
        if deleted:
            log.info(f"Deleted UI preference '{preference_key}' for workspace: {workspace_id}")
            return {"success": True, "message": f"UI preference '{preference_key}' deleted successfully"}
        else:
            log.info(f"UI preference '{preference_key}' not found for workspace: {workspace_id}")
            return {"success": True, "message": f"UI preference '{preference_key}' not found"}
    except Exception as e:
        log.error(f"Error deleting UI preference '{preference_key}' for {workspace_id}: {e}")
        return {"success": False, "error": str(e)}

@app.patch("/api/kanban/move-card/{workspace_id}/{progress_id}")
async def move_kanban_card(workspace_id: str, progress_id: int, update_data: Dict[str, Any]):
    """
    Hybrid endpoint: Update progress entry status AND kanban positions in one operation.
    This handles drag/drop of kanban cards that need both business data and UI state updates.
    
    Expected update_data format:
    {
      "new_status": "DONE",  // New progress status
      "kanban_positions": {  // Updated kanban positions after the move
        "TODO": ["41", "43"],
        "IN_PROGRESS": ["44"],
        "DONE": ["42", "45"]  // progress_id now in this column
      }
    }
    """
    try:
        new_status = update_data.get('new_status')
        kanban_positions = update_data.get('kanban_positions')
        
        if not new_status:
            return {"success": False, "error": "new_status is required"}
            
        # 1. Update the progress entry status in ConPort database
        try:
            # Import here to avoid circular dependencies
            from .handlers.mcp_handlers import handle_update_progress
            from .db.models import UpdateProgressArgs
            
            # Create the update args
            progress_args = UpdateProgressArgs(
                workspace_id=workspace_id,
                progress_id=progress_id,
                status=new_status
            )
            
            # Update the progress entry
            update_result = handle_update_progress(progress_args)
            
            if not update_result.get('status') == 'success':
                return {"success": False, "error": f"Failed to update progress entry: {update_result.get('message', 'Unknown error')}"}
                
            log.info(f"Updated progress {progress_id} status to {new_status} for workspace: {workspace_id}")
            
        except Exception as e:
            log.error(f"Error updating progress entry {progress_id} for {workspace_id}: {e}")
            return {"success": False, "error": f"Database update failed: {str(e)}"}
        
        # 2. Update kanban positions in UI cache (if provided)
        if kanban_positions:
            try:
                ui_cache.save_kanban_positions(workspace_id, kanban_positions)
                log.info(f"Updated kanban positions after moving card {progress_id} for workspace: {workspace_id}")
            except Exception as e:
                log.error(f"Error saving kanban positions for {workspace_id}: {e}")
                # Don't fail the whole operation if UI cache fails
                log.warning(f"Progress entry updated successfully, but UI cache update failed: {e}")
        
        return {
            "success": True,
            "message": f"Progress entry {progress_id} status updated to {new_status}",
            "progress_id": progress_id,
            "new_status": new_status,
            "ui_cache_updated": kanban_positions is not None
        }
        
    except Exception as e:
        log.error(f"Error in move_kanban_card for {workspace_id}, progress {progress_id}: {e}")
        return {"success": False, "error": str(e)}

# --- PLUGGABLE: Sync API Endpoints (Decision 108) ---
# These endpoints are only registered if sync_handlers module exists
# Enables Git-based collaboration as an optional feature
try:
    from .handlers import sync_handlers
    
    @app.post("/sync/checkpoint")
    async def sync_checkpoint(workspace_id: str = Query(..., description="Workspace identifier")):
        """WAL checkpoint endpoint for sync script."""
        try:
            args = sync_handlers.SyncCheckpointArgs(workspace_id=workspace_id)
            return await sync_handlers.handle_sync_checkpoint(args)
        except Exception as e:
            log.error(f"Error in sync checkpoint for {workspace_id}: {e}")
            return {"success": False, "error": str(e)}
    
    @app.post("/sync/validate")
    async def sync_validate(workspace_id: str = Query(..., description="Workspace identifier")):
        """Database validation endpoint for sync script."""
        try:
            args = sync_handlers.SyncValidateArgs(workspace_id=workspace_id)
            return await sync_handlers.handle_sync_validate(args)
        except Exception as e:
            log.error(f"Error in sync validation for {workspace_id}: {e}")
            return {"valid": False, "errors": [str(e)]}
    
    @app.get("/sync/health")
    async def sync_health():
        """Health check endpoint for sync script."""
        try:
            args = sync_handlers.SyncHealthArgs()
            return await sync_handlers.handle_sync_health(args)
        except Exception as e:
            log.error(f"Error in sync health check: {e}")
            return {"status": "error", "error": str(e)}
    
    log.info("✓ Sync API endpoints registered (pluggable feature enabled)")
    
except ImportError as e:
    log.debug(f"Sync handlers not available - sync feature disabled (this is normal): {e}")
    # This is expected and normal when sync_handlers.py doesn't exist
    # Core AIMED functionality continues to work perfectly

# Determine the absolute path to the root of the ConPort server project
# Assumes this script (main.py) is at src/context_portal_mcp/main.py
CONPORT_SERVER_ROOT_DIR = Path(os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')))
log.info(f"ConPort Server Root Directory identified as: {CONPORT_SERVER_ROOT_DIR}")
def main_logic(sys_args=None):
    """
    Configures and runs the ConPort server (HTTP mode via Uvicorn).
    The actual MCP logic is handled by the FastMCP instance mounted on the FastAPI app.
    """
    parser = argparse.ArgumentParser(description="ConPort MCP Server (FastMCP/HTTP)")
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind the HTTP server to (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8020,
        help="Port to bind the HTTP server to (default: 8020)"
    )
    # Enhanced workspace_id parameter with auto-detection support
    parser.add_argument(
        "--workspace_id",
        type=str,
        required=False, # No longer strictly required for server startup itself
        help="Workspace ID. If not provided, will auto-detect from current directory or MCP client context."
    )
    
    # New auto-detection parameters
    parser.add_argument(
        "--auto-detect-workspace",
        action="store_true",
        default=True,
        help="Automatically detect workspace from current directory (default: True)"
    )
    
    parser.add_argument(
        "--workspace-search-start",
        help="Starting directory for workspace detection (default: current directory)"
    )
    
    parser.add_argument(
        "--no-auto-detect",
        action="store_true",
        help="Disable automatic workspace detection"
    )
    # The --mode argument might be deprecated if FastMCP only runs HTTP this way,
    # or we add a condition here to call conport_mcp.run(transport="stdio")
    parser.add_argument(
        "--mode",
        choices=["http", "stdio"], # Add http, stdio might be handled by FastMCP directly
        default="http",
        help="Server communication mode (default: http for FastMCP mounted app)"
    )
    parser.add_argument(
        "--log-file",
        type=str,
        default="logs/conport.log",
        help="Path to a file where logs should be written, relative to the context_portal_aimed directory. Defaults to 'logs/conport.log'."
    )
    parser.add_argument(
        "--db-path",
        type=str,
        required=False,
        help="Custom database file path (absolute or relative to workspace). "
             "Defaults to 'context_portal_aimed/context_aimed.db' in workspace."
    )
    parser.add_argument(
        "--base-path",
        type=str,
        required=False,
        help="Base path for storing all workspace-specific data. A subdirectory will be created for each workspace."
    )
    parser.add_argument(
        "--db-filename",
        type=str,
        default="context_aimed.db",
        help="The name of the context database file. Defaults to 'context_aimed.db'."
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Set the logging level."
    )
    parser.add_argument("--debug", action="store_true", help="Enable verbose debug output")

    args = parser.parse_args(args=sys_args)

    # --- Startup Provisioning (workspace-scoped caches) ---
    # If the server is started with an explicit --workspace_id (e.g. via
    # [`context_portal_aimed/portal_launcher.py`](context_portal_aimed/portal_launcher.py:884)),
    # proactively create the MCP cache directory under:
    # `<workspace_id>/context_portal_aimed/mcp-cache/`
    # so the folder exists even before the first MCP tool call.
    if args.workspace_id:
        try:
            # Also ensure the default output_capture setting exists, with enabled=false.
            mcp_cache.get_mcp_cache_dir(args.workspace_id)
            mcp_cache.save_mcp_setting(
                args.workspace_id,
                "output_capture",
                mcp_cache.get_output_capture_config(args.workspace_id),
            )
        except Exception as e:
            # Best-effort: do not prevent server startup if cache provisioning fails.
            log.warning(f"Failed to provision mcp-cache directory for workspace '{args.workspace_id}': {e}")

    # Enable debug output only if requested
    if not args.debug:
        # Silence debug output for normal operation
        def quiet_debug_print(message, level="INFO"):
            pass  # No output
        globals()['debug_print'] = quiet_debug_print
        
        # Control external library logging levels when not in debug mode
        logging.getLogger('websockets.legacy').setLevel(logging.ERROR)
        logging.getLogger('websockets').setLevel(logging.ERROR)
        logging.getLogger('uvicorn.protocols.websockets.websockets_impl').setLevel(logging.ERROR)
        logging.getLogger('uvicorn').setLevel(logging.WARNING)
        logging.getLogger('uvicorn.access').setLevel(logging.WARNING)

    # Configure logging based on the parsed arguments
    setup_logging(args)

    # Set custom database path if provided
    if args.db_path:
        try:
            from .core import config
        except ImportError:
            from src.context_portal_mcp.core import config
        config.set_custom_db_path(args.db_path)
        log.info(f"Using custom database path: {args.db_path}")

    if args.base_path:
        try:
            from .core import config
        except ImportError:
            from src.context_portal_mcp.core import config
        config.set_base_path(args.base_path)
        log.info(f"Using base path: {args.base_path}")

    if args.db_filename:
        try:
            from .core import config
        except ImportError:
            from src.context_portal_mcp.core import config
        config.set_db_filename(args.db_filename)
        log.info(f"Using database filename: {args.db_filename}")

    log.info(f"Parsed CLI args: {args}")

    # In stdio mode, we should not configure the console handler, as it can interfere with MCP communication.
    # FastMCP handles stdio, so we only add console logging for http mode.
    if args.mode == "http":
        log.info(f"Starting ConPort HTTP server (via FastMCP) on {args.host}:{args.port}")
        # The FastAPI `app` (with FastMCP mounted) is run by Uvicorn
        uvicorn.run(app, host=args.host, port=args.port)
    elif args.mode == "stdio":
        log.info(f"Starting ConPort in STDIO mode with workspace detection enabled")

        # Resolve workspace ID using the new detection system
        auto_detect_enabled = args.auto_detect_workspace and not args.no_auto_detect
        effective_workspace_id = resolve_workspace_id(
            provided_workspace_id=args.workspace_id,
            auto_detect=auto_detect_enabled,
            start_path=args.workspace_search_start
        )
        
        # Log detection details for debugging
        if auto_detect_enabled:
            detector = WorkspaceDetector(args.workspace_search_start)
            detection_info = detector.get_detection_info()
            log.info(f"Workspace detection details: {detection_info}")
        
        log.info(f"Effective workspace ID: {effective_workspace_id}")

        # Pre-warm the database connection to trigger one-time initialization (e.g., migrations)
        # before the MCP transport starts. This prevents timeouts on the client's first tool call.
        if effective_workspace_id:
            try:
                # CRITICAL FIX (Progress 85/86): Capture central_python_executable BEFORE database initialization
                # This ensures the value is available when launcher is created during get_db_connection()
                python_executable = sys.executable
                ui_cache.update_workspace_env_var(effective_workspace_id, "central_python_executable", python_executable)
                log.info(f"Captured central_python_executable: {python_executable}")
                
                log.info(f"Pre-warming database connection for workspace: {effective_workspace_id}")
                database.get_db_connection(effective_workspace_id)
                log.info("Database connection pre-warmed successfully.")
                
            except Exception as e:
                log.error(f"Failed to pre-warm database connection for workspace '{effective_workspace_id}': {e}")
                # If the DB is essential, exiting is safer than continuing in a broken state.
                sys.exit(1)
        else:
            log.warning("No effective_workspace_id available at startup. Database initialization will be deferred to the first tool call.")

        # Note: The `FastMCP.run()` method is synchronous and will block until the server stops.
        # It requires the `mcp[cli]` extra to be installed for `mcp.server.stdio.run_server_stdio`.
        try:
            # The `settings` attribute on FastMCP can be used to pass runtime config.
            # However, `workspace_id` is not a standard FastMCP setting for `run()`.
            # It's expected to be part of the tool call parameters.
            # The primary role of --workspace_id for stdio here is for the IDE's launch config.
            conport_mcp.run(transport="stdio")
        except Exception as e:
            log.exception("Error running FastMCP in STDIO mode")
            sys.exit(1)

    else:
        log.error(f"Unsupported mode: {args.mode}")
        sys.exit(1)

def cli_entry_point():
    """Entry point for the 'conport-server' command-line script."""
    log.info("ConPort MCP Server CLI entry point called.")
    main_logic()

if __name__ == "__main__":
    cli_entry_point()
