"""
File-based MCP cache for server-level settings (e.g., output capture toggle).
Mirrors the UI cache pattern but scoped for MCP/server concerns.
"""

import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from .config import get_database_path
from .exceptions import DatabaseError

log = logging.getLogger(__name__)

_DEFAULT_CAPTURE_CONFIG: Dict[str, Any] = {
    "enabled": False,
    "base_filename": "results.json",
    "timestamp_tz": "UTC",
    "last_capture_file": None,
}

_SAFE_BASENAME_PATTERN = re.compile(r"[^A-Za-z0-9._-]+")


def get_mcp_cache_dir(workspace_id: str) -> Path:
    """Return `<workspace>/context_portal_aimed/mcp-cache/`, creating it if missing."""
    try:
        db_path = get_database_path(workspace_id)
        cache_dir = db_path.parent / "mcp-cache"
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir
    except Exception as e:  # pragma: no cover - defensive logging
        log.error(f"Failed to create MCP cache directory for {workspace_id}: {e}")
        raise DatabaseError(f"Could not create MCP cache directory: {e}")


def _sanitize_base_filename(name: str) -> str:
    """Sanitize a user-supplied base filename and enforce `.json` extension."""
    try:
        name = Path(name).name  # strip any path components
    except Exception:
        name = "results.json"

    name = _SAFE_BASENAME_PATTERN.sub("_", name).strip("._")
    if not name:
        name = "results"
    if not name.lower().endswith(".json"):
        name = f"{name}.json"
    return name


def save_mcp_setting(workspace_id: str, key: str, value: Any) -> None:
    """Persist an MCP setting to `<mcp-cache>/<key>.json` with metadata."""
    cache_dir = get_mcp_cache_dir(workspace_id)
    cache_file = cache_dir / f"{key}.json"
    cache_data = {
        "updated_at": datetime.utcnow().isoformat(timespec="seconds"),
        "data": value,
    }
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(cache_data, f, indent=2, ensure_ascii=False)


def load_mcp_setting(workspace_id: str, key: str, default: Any = None) -> Any:
    """Load an MCP setting or return default when missing/invalid."""
    try:
        cache_dir = get_mcp_cache_dir(workspace_id)
        cache_file = cache_dir / f"{key}.json"
        if not cache_file.exists():
            return default

        with open(cache_file, "r", encoding="utf-8") as f:
            cache_data = json.load(f)
        return cache_data.get("data", default)
    except (json.JSONDecodeError, OSError, KeyError) as e:
        log.warning(f"Invalid MCP setting file {key} for {workspace_id}: {e}; returning default")
        return default
    except Exception as e:  # pragma: no cover - defensive logging
        log.error(f"Failed to load MCP setting {key} for {workspace_id}: {e}")
        return default


def get_output_capture_config(workspace_id: str) -> Dict[str, Any]:
    """Return output capture config merged with defaults and sanitized filename."""
    stored = load_mcp_setting(workspace_id, "output_capture", {}) or {}
    config = {**_DEFAULT_CAPTURE_CONFIG, **stored}
    config["base_filename"] = _sanitize_base_filename(config.get("base_filename", "results.json"))
    if config.get("timestamp_tz") is None:
        config["timestamp_tz"] = "UTC"
    return config


def set_output_capture_config(
    workspace_id: str,
    enabled: bool,
    base_filename: str,
    timestamp_tz: Optional[str] = "UTC",
) -> Dict[str, Any]:
    """Update and persist output capture config. Returns the saved config."""
    current = get_output_capture_config(workspace_id)
    current.update(
        {
            "enabled": bool(enabled),
            "base_filename": _sanitize_base_filename(base_filename or current["base_filename"]),
            "timestamp_tz": timestamp_tz or current.get("timestamp_tz") or "UTC",
        }
    )
    save_mcp_setting(workspace_id, "output_capture", current)
    return current


def write_captured_result(workspace_id: str, tool_name: str, result: Any) -> Optional[str]:
    """
    Write the tool result to `<workspace>/conport-aimed_output/` if capture is enabled.

    Returns the relative capture path (from workspace) when written, else None.
    Errors are logged but do not raise.
    """
    config = get_output_capture_config(workspace_id)
    if not config.get("enabled"):
        return None

    base_filename = _sanitize_base_filename(config.get("base_filename", "results.json"))
    output_dir = Path(workspace_id) / "conport-aimed_output"
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")[:-3]  # milliseconds
    stem = Path(base_filename).stem
    filename = f"{stem}_{timestamp}.json"
    output_path = output_dir / filename

    payload = {
        "meta": {
            "tool": tool_name,
            "captured_at": datetime.utcnow().isoformat(timespec="milliseconds") + "Z",
        },
        "result": result,
    }

    try:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
    except Exception as e:  # pragma: no cover - defensive logging
        log.error(f"Failed to write capture for {tool_name} ({workspace_id}): {e}")
        try:
            error_path = output_path.with_suffix(".error.json")
            with open(error_path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "meta": payload["meta"],
                        "error": str(e),
                    },
                    f,
                    indent=2,
                    ensure_ascii=False,
                )
        except Exception:
            log.debug("Failed to write capture error file", exc_info=True)
        return None

    try:
        relative_capture = str(output_path.relative_to(Path(workspace_id)))
    except Exception:
        relative_capture = str(output_path)

    config.update(
        {
            "enabled": True,
            "base_filename": base_filename,
            "last_capture_file": relative_capture,
        }
    )
    save_mcp_setting(workspace_id, "output_capture", config)
    return relative_capture

