"""MCP handlers for UI cache operations."""

import logging
from typing import Dict, Any

from ..core.ui_cache import (
    save_kanban_positions,
    load_kanban_positions,
    save_dashboard_settings,
    load_dashboard_settings,
    save_ui_preference,
    load_ui_preference,
)
from ..db.models import BaseArgs
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)


class SaveKanbanPositionsArgs(BaseArgs):
    """Arguments for saving kanban positions."""
    positions: Dict[str, list] = Field(..., description="Dict with status keys mapping to ordered lists of progress IDs")


class LoadKanbanPositionsArgs(BaseArgs):
    """Arguments for loading kanban positions."""
    pass


class SaveDashboardSettingsArgs(BaseArgs):
    """Arguments for saving dashboard settings."""
    settings: Dict[str, Any] = Field(..., description="Dashboard settings dict")


class LoadDashboardSettingsArgs(BaseArgs):
    """Arguments for loading dashboard settings."""
    pass


async def handle_save_kanban_positions(args: SaveKanbanPositionsArgs) -> Dict[str, Any]:
    """Save kanban card positions to UI cache."""
    try:
        save_kanban_positions(args.workspace_id, args.positions)
        log.info(f"Saved kanban positions for workspace {args.workspace_id}")
        return {
            "success": True,
            "message": "Kanban positions saved successfully"
        }
    except Exception as e:
        log.error(f"Error saving kanban positions for {args.workspace_id}: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def handle_load_kanban_positions(args: LoadKanbanPositionsArgs) -> Dict[str, Any]:
    """Load kanban card positions from UI cache."""
    try:
        positions = load_kanban_positions(args.workspace_id)
        log.info(f"Loaded kanban positions for workspace {args.workspace_id}")
        return {
            "success": True,
            "positions": positions
        }
    except Exception as e:
        log.error(f"Error loading kanban positions for {args.workspace_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "positions": {"TODO": [], "IN_PROGRESS": [], "DONE": []}  # Return defaults on error
        }


async def handle_save_dashboard_settings(args: SaveDashboardSettingsArgs) -> Dict[str, Any]:
    """Save dashboard settings to UI cache."""
    try:
        save_dashboard_settings(args.workspace_id, args.settings)
        log.info(f"Saved dashboard settings for workspace {args.workspace_id}")
        return {
            "success": True,
            "message": "Dashboard settings saved successfully"
        }
    except Exception as e:
        log.error(f"Error saving dashboard settings for {args.workspace_id}: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def handle_load_dashboard_settings(args: LoadDashboardSettingsArgs) -> Dict[str, Any]:
    """Load dashboard settings from UI cache."""
    try:
        settings = load_dashboard_settings(args.workspace_id)
        log.info(f"Loaded dashboard settings for workspace {args.workspace_id}")
        return {
            "success": True,
            "settings": settings
        }
    except Exception as e:
        log.error(f"Error loading dashboard settings for {args.workspace_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "settings": {
                "polling_enabled": True,
                "polling_interval": 3000,
                "current_view": "activity",
                "saved_view": "all"
            }
        }