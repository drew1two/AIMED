"""CRUD operations for Product, Active and any other future Contexts."""

import sqlite3
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from ..core.exceptions import DatabaseError
from . import models

# --- Helper functions for history ---

def _get_latest_context_version(cursor: sqlite3.Cursor, table_name: str) -> int:
    """Retrieves the latest version number from a history table."""
    try:
        cursor.execute(f"SELECT MAX(version) FROM {table_name}")
        row = cursor.fetchone()
        return row[0] if row and row[0] is not None else 0
    except sqlite3.Error as e:
        # Log this error appropriately in a real application
        print(f"Error getting latest version from {table_name}: {e}")
        return 0 # Default to 0 if error or no versions found

def _add_context_history_entry(
    cursor: sqlite3.Cursor,
    history_table_name: str,
    version: int,
    content_dict: Dict[str, Any],
    change_source: Optional[str]
) -> None:
    """Adds an entry to the specified context history table."""
    content_json = json.dumps(content_dict)
    timestamp = datetime.now(timezone.utc)
    try:
        cursor.execute(
            f"""
            INSERT INTO {history_table_name} (timestamp, version, content, change_source)
            VALUES (?, ?, ?, ?)
            """,
            (timestamp, version, content_json, change_source)
        )
    except sqlite3.Error as e:
        # This error should be handled by the calling function's rollback
        raise DatabaseError(f"Failed to add entry to {history_table_name}: {e}")

# --- CRUD Operations ---

def get_product_context(workspace_id: str) -> models.ProductContext:
    """Retrieves the product context."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, content FROM product_context WHERE id = 1")
        row = cursor.fetchone()
        if row:
            content_dict = json.loads(row['content'])
            return models.ProductContext(id=row['id'], content=content_dict)
        else:
            # Should not happen if initialized correctly, but handle defensively
            raise DatabaseError("Product context row not found.")
    except (sqlite3.Error, json.JSONDecodeError) as e:
        raise DatabaseError(f"Failed to retrieve product context: {e}")
    finally:
        if cursor:
            cursor.close()

def update_product_context(workspace_id: str, update_args: models.UpdateContextArgs) -> None:
    """Updates the product context using either full content or a patch."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    try:
        cursor = conn.cursor()
        # Fetch current content to log to history
        cursor.execute("SELECT content FROM product_context WHERE id = 1")
        current_row = cursor.fetchone()
        if not current_row:
            raise DatabaseError("Product context row not found for updating (cannot log history).")
        current_content_dict = json.loads(current_row['content'])

        # Determine new content
        new_final_content = {}
        if update_args.content is not None:
            new_final_content = update_args.content
        elif update_args.patch_content is not None:
            # Apply patch to a copy of current_content_dict for the new state
            new_final_content = current_content_dict.copy()
            # Iterate over patch_content to handle __DELETE__ sentinel
            for key, value in update_args.patch_content.items():
                if value == "__DELETE__":
                    new_final_content.pop(key, None)  # Remove key, do nothing if key not found
                else:
                    new_final_content[key] = value
        else:
            # This case should be prevented by Pydantic model validation, but handle defensively
            raise ValueError("No content or patch_content provided for update.")

        # Log previous version to history
        latest_version = _get_latest_context_version(cursor, "product_context_history")
        new_version = latest_version + 1
        _add_context_history_entry(
            cursor,
            "product_context_history",
            new_version,
            current_content_dict, # Log the content *before* the update
            "update_product_context" # Basic change source
        )

        # Update the main product_context table
        new_content_json = json.dumps(new_final_content)
        cursor.execute("UPDATE product_context SET content = ? WHERE id = 1", (new_content_json,))
        
        conn.commit()
        # No need to check rowcount here as history is logged regardless of content identity
    except (sqlite3.Error, TypeError, json.JSONDecodeError, DatabaseError) as e: # Added DatabaseError
        conn.rollback()
        raise DatabaseError(f"Failed to update product_context: {e}")
    finally:
        if cursor:
            cursor.close()

            
def get_active_context(workspace_id: str) -> models.ActiveContext:
    """Retrieves the active context."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, content FROM active_context WHERE id = 1")
        row = cursor.fetchone()
        if row:
            content_dict = json.loads(row['content'])
            return models.ActiveContext(id=row['id'], content=content_dict)
        else:
            raise DatabaseError("Active context row not found.")
    except (sqlite3.Error, json.JSONDecodeError) as e:
        raise DatabaseError(f"Failed to retrieve active context: {e}")
    finally:
        if cursor:
            cursor.close()

def update_active_context(workspace_id: str, update_args: models.UpdateContextArgs) -> None:
    """Updates the active context using either full content or a patch."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    try:
        cursor = conn.cursor()
        # Fetch current content to log to history
        cursor.execute("SELECT content FROM active_context WHERE id = 1")
        current_row = cursor.fetchone()
        if not current_row:
            raise DatabaseError("Active context row not found for updating (cannot log history).")
        current_content_dict = json.loads(current_row['content'])

        # Determine new content
        new_final_content = {}
        if update_args.content is not None:
            new_final_content = update_args.content
        elif update_args.patch_content is not None:
            new_final_content = current_content_dict.copy()
            # Iterate over patch_content to handle __DELETE__ sentinel
            for key, value in update_args.patch_content.items():
                if value == "__DELETE__":
                    new_final_content.pop(key, None)  # Remove key, do nothing if key not found
                else:
                    new_final_content[key] = value
        else:
            # This case should be prevented by Pydantic model validation, but handle defensively
            raise ValueError("No content or patch_content provided for update.")

        # Log previous version to history
        latest_version = _get_latest_context_version(cursor, "active_context_history")
        new_version = latest_version + 1
        _add_context_history_entry(
            cursor,
            "active_context_history",
            new_version,
            current_content_dict, # Log the content *before* the update
            "update_active_context" # Basic change source
        )

        # Update the main active_context table
        new_content_json = json.dumps(new_final_content)
        cursor.execute("UPDATE active_context SET content = ? WHERE id = 1", (new_content_json,))
        
        conn.commit()
    except (sqlite3.Error, TypeError, json.JSONDecodeError, DatabaseError) as e: # Added DatabaseError
        conn.rollback()
        raise DatabaseError(f"Failed to update active context: {e}")
    finally:
        if cursor:
            cursor.close()

def search_context_fts(
    workspace_id: str,
    query_term: str,
    context_type_filter: Optional[str] = None,
    limit: Optional[int] = 10
) -> List[Dict[str, Any]]:
    """Searches contexts (product and active) using FTS5 for the given query term."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    
    # Base SQL for context FTS search
    sql = "SELECT rowid, context_type, content_text FROM context_fts WHERE context_fts MATCH ?"
    params_list = [query_term]
    
    if context_type_filter:
        sql += " AND context_type = ?"
        params_list.append(context_type_filter)
    
    sql += " ORDER BY rank"
    
    if limit is not None and limit > 0:
        sql += " LIMIT ?"
        params_list.append(limit)

    try:
        cursor = conn.cursor()
        cursor.execute(sql, tuple(params_list))
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            # Parse the JSON content
            try:
                content_dict = json.loads(row['content_text'])
                results.append({
                    'id': row['rowid'],
                    'context_type': row['context_type'],
                    'content': content_dict,
                    'content_text_snippet': row['content_text'][:200] + '...' if len(row['content_text']) > 200 else row['content_text']
                })
            except json.JSONDecodeError as e:
                log.warning(f"Failed to decode JSON for context search result: {e}")
                continue
                
        return results
    except sqlite3.Error as e:
        raise DatabaseError(f"Failed FTS search on contexts for term '{query_term}': {e}")
    finally:
        if cursor:
            cursor.close()

def get_item_history(
    workspace_id: str,
    args: models.GetItemHistoryArgs
) -> List[Dict[str, Any]]: # Returning list of dicts for now, could be Pydantic models
    """Retrieves history for product_context or active_context."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block

    if args.item_type == "product_context":
        history_table_name = "product_context_history"
        # history_model = models.ProductContextHistory # If returning Pydantic models
    elif args.item_type == "active_context":
        history_table_name = "active_context_history"
        # history_model = models.ActiveContextHistory # If returning Pydantic models
    else:
        # This should be caught by Pydantic validation in GetItemHistoryArgs
        raise ValueError("Invalid item_type for history retrieval.")

    sql = f"SELECT id, timestamp, version, content, change_source FROM {history_table_name}"
    conditions = []
    params_list = []

    if args.version is not None:
        conditions.append("version = ?")
        params_list.append(args.version)
    if args.before_timestamp:
        conditions.append("timestamp < ?")
        params_list.append(args.before_timestamp)
    if args.after_timestamp:
        conditions.append("timestamp > ?")
        params_list.append(args.after_timestamp)
    
    # Add workspace_id filter if it were part of the history table (it's not currently)
    # conditions.append("workspace_id = ?")
    # params_list.append(workspace_id)

    if conditions:
        sql += " WHERE " + " AND ".join(conditions)

    sql += " ORDER BY version DESC, timestamp DESC" # Most recent version/timestamp first

    if args.limit is not None and args.limit > 0:
        sql += " LIMIT ?"
        params_list.append(args.limit)

    params = tuple(params_list)

    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        history_entries = []
        for row in rows:
            content_dict = json.loads(row['content'])
            history_entries.append({
                "id": row['id'],
                "timestamp": row['timestamp'], # Already datetime object
                "version": row['version'],
                "content": content_dict,
                "change_source": row['change_source']
            })
            # Or if using Pydantic models:
            # history_entries.append(history_model(id=row['id'], timestamp=row['timestamp'], ...))
        return history_entries
    except (sqlite3.Error, json.JSONDecodeError) as e:
        raise DatabaseError(f"Failed to retrieve history for {args.item_type}: {e}")
    finally:
        if cursor:
            cursor.close()