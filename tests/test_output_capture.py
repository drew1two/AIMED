import json
import os
from pathlib import Path
import tempfile
import asyncio

import pytest

from src.context_portal_mcp.core import mcp_cache


def test_sanitize_and_persist_config_creates_cache_dir_and_enforces_json():
    with tempfile.TemporaryDirectory() as tmp:
        workspace_id = tmp
        cfg = mcp_cache.set_output_capture_config(workspace_id, enabled=True, base_filename="foo/bar.results", timestamp_tz="UTC")
        assert cfg["enabled"] is True
        assert cfg["base_filename"].endswith(".json")
        cache_file = Path(workspace_id) / "context_portal_aimed" / "mcp-cache" / "output_capture.json"
        # cache dir is under the db path parent (context_portal_aimed), ensure it exists
        assert cache_file.parent.exists()
        assert cache_file.exists()
        data = json.loads(cache_file.read_text())
        assert data["data"]["base_filename"].endswith(".json")


def test_write_captured_result_creates_output_file_and_tracks_last_capture():
    with tempfile.TemporaryDirectory() as tmp:
        workspace_id = tmp
        # enable capture
        mcp_cache.set_output_capture_config(workspace_id, enabled=True, base_filename="results.json")
        result = {"hello": "world"}
        rel = mcp_cache.write_captured_result(workspace_id, "dummy_tool", result)
        assert rel is not None
        output_path = Path(workspace_id) / rel
        assert output_path.exists()
        payload = json.loads(output_path.read_text())
        assert payload["meta"]["tool"] == "dummy_tool"
        assert payload["result"] == result
        # last_capture_file recorded
        cfg = mcp_cache.get_output_capture_config(workspace_id)
        assert cfg.get("last_capture_file") == rel


def test_write_captured_result_disabled_returns_none_and_does_not_write():
    with tempfile.TemporaryDirectory() as tmp:
        workspace_id = tmp
        mcp_cache.set_output_capture_config(workspace_id, enabled=False, base_filename="results.json")
        rel = mcp_cache.write_captured_result(workspace_id, "dummy_tool", {"a": 1})
        assert rel is None
        out_dir = Path(workspace_id) / "conport-aimed_output"
        assert not out_dir.exists()


def test_write_captured_result_best_effort_on_error(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        workspace_id = tmp
        mcp_cache.set_output_capture_config(workspace_id, enabled=True, base_filename="results.json")

        # Force open to fail
        def boom(*args, **kwargs):
            raise OSError("boom")

        monkeypatch.setattr("builtins.open", boom)
        rel = mcp_cache.write_captured_result(workspace_id, "dummy_tool", {"x": 1})
        assert rel is None


def test_filename_format_includes_timestamp():
    with tempfile.TemporaryDirectory() as tmp:
        workspace_id = tmp
        mcp_cache.set_output_capture_config(workspace_id, enabled=True, base_filename="res.json")
        rel = mcp_cache.write_captured_result(workspace_id, "dummy_tool", {"k": "v"})
        assert rel is not None
        name = os.path.basename(rel)
        assert name.startswith("res_") and name.endswith(".json")


def test_output_capture_help_tool_is_static_and_mentions_paths():
    # Importing main registers tool functions; we only validate the help function output.
    from src.context_portal_mcp import main as conport_main

    payload = conport_main._build_output_capture_help_payload()
    assert isinstance(payload, dict)
    assert payload.get("feature") == "output_capture"
    how = payload.get("how_it_works", {})
    assert "conport-aimed_output" in how.get("where_files_go", "")
    assert "mcp-cache" in how.get("persistence", "")
