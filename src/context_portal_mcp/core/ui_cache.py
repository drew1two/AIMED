"""
File-based UI cache system for storing UI preferences and state.
Keeps UI concerns completely separate from business data.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
import logging
from datetime import datetime

from .config import get_database_path
from .exceptions import DatabaseError

log = logging.getLogger(__name__)

# Debug helpers (will be redefined based on --debug flag)
def debug_print(message, level="INFO"):
    """Debug print function - will be silenced unless --debug is used"""
    print(f"[ui_cache:{level}] {message}", file=sys.stderr)

# This will be set by main.py based on --debug flag
import sys
_debug_enabled = True  # Will be overridden


def get_ui_cache_dir(workspace_id: str) -> Path:
    """
    Get the UI cache directory for a given workspace.
    Creates the directory structure if it doesn't exist.
    
    Directory structure:
    <workspace>/context_portal_aimed/ui-cache/
    ├── kanban_positions.json
    ├── dashboard_settings.json
    ├── graph_positions.json (if exists from graph functionality)
    └── user_preferences.json
    """
    try:
        db_path = get_database_path(workspace_id)
        ui_cache_dir = db_path.parent / "ui-cache"
        ui_cache_dir.mkdir(exist_ok=True, parents=True)
        return ui_cache_dir
    except Exception as e:
        log.error(f"Failed to create UI cache directory for {workspace_id}: {e}")
        raise DatabaseError(f"Could not create UI cache directory: {e}")


def save_ui_preference(workspace_id: str, preference_key: str, preference_value: Any) -> None:
    """
    Save a UI preference to the cache file.
    
    Args:
        workspace_id: The workspace identifier
        preference_key: The preference key (e.g., 'kanban_positions', 'dashboard_settings')
        preference_value: The preference value (will be JSON serialized)
    """
    try:
        ui_cache_dir = get_ui_cache_dir(workspace_id)
        cache_file = ui_cache_dir / f"{preference_key}.json"
        
        # Prepare the cache data with metadata
        cache_data = {
            "updated_at": datetime.utcnow().isoformat(),
            "data": preference_value
        }
        
        # Write to file with pretty formatting for debugging
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2, ensure_ascii=False)
            
        log.debug(f"Saved UI preference {preference_key} for workspace {workspace_id}")
        
    except Exception as e:
        log.error(f"Failed to save UI preference {preference_key} for {workspace_id}: {e}")
        raise DatabaseError(f"Could not save UI preference {preference_key}: {e}")


def load_ui_preference(workspace_id: str, preference_key: str, default: Any = None) -> Any:
    """
    Load a UI preference from the cache file.
    
    Args:
        workspace_id: The workspace identifier
        preference_key: The preference key
        default: Default value to return if preference doesn't exist
        
    Returns:
        The preference value or default if not found
    """
    try:
        ui_cache_dir = get_ui_cache_dir(workspace_id)
        cache_file = ui_cache_dir / f"{preference_key}.json"
        
        if not cache_file.exists():
            log.debug(f"UI preference {preference_key} not found for workspace {workspace_id}, returning default")
            return default
            
        with open(cache_file, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
            
        # Return the data portion, ignoring metadata
        preference_value = cache_data.get("data", default)
        log.debug(f"Loaded UI preference {preference_key} for workspace {workspace_id}")
        return preference_value
        
    except (json.JSONDecodeError, KeyError) as e:
        log.warning(f"Invalid UI preference file {preference_key} for {workspace_id}: {e}, returning default")
        return default
    except Exception as e:
        log.error(f"Failed to load UI preference {preference_key} for {workspace_id}: {e}")
        return default


def delete_ui_preference(workspace_id: str, preference_key: str) -> bool:
    """
    Delete a UI preference cache file.
    
    Args:
        workspace_id: The workspace identifier
        preference_key: The preference key to delete
        
    Returns:
        True if deleted successfully, False if file didn't exist
    """
    try:
        ui_cache_dir = get_ui_cache_dir(workspace_id)
        cache_file = ui_cache_dir / f"{preference_key}.json"
        
        if cache_file.exists():
            cache_file.unlink()
            log.debug(f"Deleted UI preference {preference_key} for workspace {workspace_id}")
            return True
        else:
            log.debug(f"UI preference {preference_key} not found for workspace {workspace_id}")
            return False
            
    except Exception as e:
        log.error(f"Failed to delete UI preference {preference_key} for {workspace_id}: {e}")
        return False


def save_kanban_positions(workspace_id: str, positions: Dict[str, list]) -> None:
    """
    Save kanban card positions.
    
    Args:
        workspace_id: The workspace identifier
        positions: Dict with keys like 'TODO', 'IN_PROGRESS', 'DONE' mapping to ordered lists of IDs
    """
    save_ui_preference(workspace_id, "kanban_positions", positions)


def load_kanban_positions(workspace_id: str) -> Dict[str, list]:
    """
    Load kanban card positions.
    
    Returns:
        Dict with status keys mapping to ordered lists of progress IDs
    """
    return load_ui_preference(workspace_id, "kanban_positions", {
        "TODO": [],
        "IN_PROGRESS": [],
        "DONE": []
    })


def save_dashboard_settings(workspace_id: str, settings: Dict[str, Any]) -> None:
    """
    Save dashboard UI settings like polling intervals, view preferences, etc.
    
    Args:
        workspace_id: The workspace identifier
        settings: Dashboard settings dict
    """
    save_ui_preference(workspace_id, "dashboard_settings", settings)


def load_dashboard_settings(workspace_id: str) -> Dict[str, Any]:
    """
    Load dashboard UI settings.
    
    Returns:
        Dashboard settings dict with defaults
    """
    return load_ui_preference(workspace_id, "dashboard_settings", {
        "polling_enabled": True,
        "polling_interval": 3000,
        "current_view": "activity",
        "saved_view": "all"
    })


def save_workspace_env_vars(workspace_id: str, env_vars: Dict[str, Any]) -> None:
    """
    Save consolidated workspace environment variables to ui-cache.
    This replaces the need for shared system environment variables.
    
    Args:
        workspace_id: The workspace identifier
        env_vars: Dict of environment variables (workspace_id, mcp_server_port, ui_port, etc.)
    """
    save_ui_preference(workspace_id, "env_vars", env_vars)


def load_workspace_env_vars(workspace_id: str) -> Dict[str, Any]:
    """
    Load consolidated workspace environment variables from ui-cache.
    
    Returns:
        Dict of environment variables with defaults
    """
    return load_ui_preference(workspace_id, "env_vars", {
        "workspace_id": workspace_id,
        "mcp_server_port": 8020,
        "ui_port": 3000,
        "conport_server_url": f"http://localhost:8020/mcp/",
        "wsl2_ip": None,
        "wsl2_gateway_ip": None,
        "central_python_executable": None
    })


def update_workspace_env_var(workspace_id: str, key: str, value: Any) -> None:
    """
    Update a single environment variable in the consolidated env_vars.json
    
    Args:
        workspace_id: The workspace identifier
        key: Environment variable key
        value: Environment variable value
    """
    current_env = load_workspace_env_vars(workspace_id)
    current_env[key] = value
    save_workspace_env_vars(workspace_id, current_env)


# ==================== CENTRAL PORT MAPPING FUNCTIONS ====================
# These manage a shared mapping of UI ports to workspace IDs for multi-workspace support

def get_central_ui_cache_dir() -> Path:
    """Get the central UI cache directory path."""
    try:
        import importlib.util
        spec = importlib.util.find_spec("context_portal_mcp")
        if spec and spec.origin:
            # Navigate from module to installation root, then to ui-cache
            module_path = Path(spec.origin).resolve()
            central_path = module_path.parent.parent.parent / "context_portal_aimed" / "ui-cache"
            return central_path
    except Exception:
        pass
    
    # Fallback: assume we're in a context-portal workspace
    current_dir = Path.cwd()
    if current_dir.name == "context-portal" or (current_dir / "context_portal_aimed").exists():
        return current_dir / "context_portal_aimed" / "ui-cache"
    
    # Final fallback: use current directory
    return Path.cwd() / "context_portal_aimed" / "ui-cache"

def load_central_port_mapping() -> Dict[str, str]:
    """Load the central port-to-workspace mapping."""
    try:
        mapping_file = get_central_ui_cache_dir() / "port_workspace_mapping.json"
        if mapping_file.exists():
            with open(mapping_file, 'r') as f:
                mapping = json.load(f)
                log.debug(f"Loaded central port mapping: {mapping}")
                return mapping
    except Exception as e:
        log.debug(f"Failed to load central port mapping: {e}")
    return {}

def save_central_port_mapping(mapping: Dict[str, str]) -> bool:
    """Save the central port-to-workspace mapping."""
    try:
        mapping_file = get_central_ui_cache_dir() / "port_workspace_mapping.json"
        mapping_file.parent.mkdir(parents=True, exist_ok=True)
        with open(mapping_file, 'w') as f:
            json.dump(mapping, f, indent=2)
        log.debug(f"Saved central port mapping: {mapping}")
        return True
    except Exception as e:
        log.warning(f"Failed to save central port mapping: {e}")
        return False

def register_workspace_ui_port(ui_port: int, workspace_id: str) -> bool:
    """Register that a UI port belongs to a workspace."""
    mapping = load_central_port_mapping()
    
    # Clean up any stale mapping for this port
    port_str = str(ui_port)
    if port_str in mapping:
        old_workspace = mapping[port_str]
        if old_workspace != workspace_id:
            log.info(f"Port {ui_port} was mapped to {old_workspace}, updating to {workspace_id}")
    
    mapping[port_str] = workspace_id
    success = save_central_port_mapping(mapping)
    if success:
        log.info(f"Registered UI port {ui_port} → workspace {workspace_id}")
    return success

def lookup_workspace_by_ui_port(ui_port: int) -> Optional[str]:
    """Find which workspace is using the given UI port."""
    mapping = load_central_port_mapping()
    workspace_id = mapping.get(str(ui_port))
    if workspace_id:
        log.debug(f"Found workspace {workspace_id} for UI port {ui_port}")
    else:
        log.debug(f"No workspace found for UI port {ui_port}")
    return workspace_id

def cleanup_workspace_ui_port(ui_port: int) -> bool:
    """Remove mapping when port is no longer in use."""
    mapping = load_central_port_mapping()
    port_str = str(ui_port)
    if port_str in mapping:
        workspace_id = mapping.pop(port_str)
        success = save_central_port_mapping(mapping)
        if success:
            log.info(f"Cleaned up port mapping: {ui_port} was {workspace_id}")
        return success
    return True