import os
import json
import subprocess

def run_mcp_tool(server_name, tool_name, arguments):
    """Helper function to run an MCP tool via CLI."""
    args_json = json.dumps(arguments)
    command = [
        "mcp", "use", f"{server_name}/{tool_name}",
        "--args", args_json
    ]
    print(f"Running command: {' '.join(command)}")
    result = subprocess.run(command, capture_output=True, text=True, shell=True)
    if result.returncode != 0:
        print(f"Error running tool {tool_name}:")
        print(result.stderr)
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"Error decoding JSON from tool {tool_name}:")
        print(result.stdout)
        return None

def main():
    """Main function to test all conport MCP tools."""
    workspace_id = os.getcwd()
    server_name = "conport"

    print("--- Testing Product Context ---")
    run_mcp_tool(server_name, "update_product_context", {"workspace_id": workspace_id, "content": {"goal": "Test all the things!"}})
    product_context = run_mcp_tool(server_name, "get_product_context", {"workspace_id": workspace_id})
    print(f"Product Context: {product_context}")

    print("\n--- Testing Active Context ---")
    run_mcp_tool(server_name, "update_active_context", {"workspace_id": workspace_id, "content": {"focus": "Running test script."}})
    active_context = run_mcp_tool(server_name, "get_active_context", {"workspace_id": workspace_id})
    print(f"Active Context: {active_context}")

    print("\n--- Testing Decision Logging ---")
    decision = run_mcp_tool(server_name, "log_decision", {"workspace_id": workspace_id, "summary": "Script test decision", "rationale": "Automated test.", "tags": ["script", "test"]})
    decisions = run_mcp_tool(server_name, "get_decisions", {"workspace_id": workspace_id, "limit": 1})
    print(f"Logged Decision: {decisions}")

    print("\n--- Testing Progress Logging ---")
    progress = run_mcp_tool(server_name, "log_progress", {"workspace_id": workspace_id, "status": "IN_PROGRESS", "description": "Running script tests"})
    progress_entries = run_mcp_tool(server_name, "get_progress", {"workspace_id": workspace_id, "limit": 1})
    print(f"Logged Progress: {progress_entries}")

    print("\n--- Testing System Pattern Logging ---")
    pattern = run_mcp_tool(server_name, "log_system_pattern", {"workspace_id": workspace_id, "name": "Test Script Pattern", "description": "A pattern for testing.", "tags": ["script"]})
    patterns = run_mcp_tool(server_name, "get_system_patterns", {"workspace_id": workspace_id})
    print(f"Logged Patterns: {patterns}")

    print("\n--- Testing Custom Data Logging ---")
    custom_data = run_mcp_tool(server_name, "log_custom_data", {"workspace_id": workspace_id, "category": "TestScript", "key": "Run1", "value": {"status": "success"}})
    custom_data_entries = run_mcp_tool(server_name, "get_custom_data", {"workspace_id": workspace_id, "category": "TestScript"})
    print(f"Logged Custom Data: {custom_data_entries}")

    print("\n--- Testing Linking ---")
    link = run_mcp_tool(server_name, "link_conport_items", {"workspace_id": workspace_id, "source_item_type": "decision", "source_item_id": str(decision['id']), "target_item_type": "progress_entry", "target_item_id": str(progress['id']), "relationship_type": "tested_by"})
    links = run_mcp_tool(server_name, "get_linked_items", {"workspace_id": workspace_id, "item_type": "decision", "item_id": str(decision['id'])})
    print(f"Links for decision: {links}")

    print("\n--- Testing FTS ---")
    fts_results = run_mcp_tool(server_name, "search_decisions_fts", {"workspace_id": workspace_id, "query_term": "script"})
    print(f"FTS Results: {fts_results}")

    print("\n--- Testing Export ---")
    export_result = run_mcp_tool(server_name, "export_conport_to_markdown", {"workspace_id": workspace_id})
    print(f"Export Result: {export_result}")

if __name__ == "__main__":
    main()
