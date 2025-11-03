"""CRUD operations for Decisions."""

import sqlite3
import json
from typing import List, Optional, Any

from ..core.exceptions import DatabaseError
from . import models

def _parse_tags_safely(tags_value: str) -> Optional[List[str]]:
    """
    Safely parse tags from database, handling both JSON arrays and comma-separated strings.
    
    Handles:
    - None/empty: returns None
    - JSON array: '["tag1", "tag2"]' -> ["tag1", "tag2"]
    - Comma-separated: 'tag1,tag2' -> ["tag1", "tag2"]
    - Empty JSON array: '[]' -> []
    """
    if not tags_value:
        return None
        
    # Try JSON parsing first (proper format)
    try:
        parsed = json.loads(tags_value)
        if isinstance(parsed, list):
            return parsed
        # If it's not a list, fall through to comma-separated handling
    except (json.JSONDecodeError, ValueError):
        pass
    
    # Handle legacy comma-separated format
    if isinstance(tags_value, str):
        # Split by comma and strip whitespace
        tags = [tag.strip() for tag in tags_value.split(',') if tag.strip()]
        return tags if tags else None
        
    return None

def log_decision(workspace_id: str, decision_data: models.Decision) -> models.Decision:
    """Logs a new decision."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    sql = """
        INSERT INTO decisions (timestamp, summary, rationale, implementation_details, tags)
        VALUES (?, ?, ?, ?, ?)
    """
    tags_json = json.dumps(decision_data.tags) if decision_data.tags is not None else None
    params = (
        decision_data.timestamp,
        decision_data.summary,
        decision_data.rationale,
        decision_data.implementation_details,
        tags_json
    )
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        decision_id = cursor.lastrowid
        conn.commit()
        # Return the full decision object including the new ID
        decision_data.id = decision_id
        return decision_data
    except sqlite3.Error as e:
        conn.rollback()
        raise DatabaseError(f"Failed to log decision: {e}")
    finally:
        if cursor:
            cursor.close()

def get_decisions(
    workspace_id: str,
    limit: Optional[int] = None,
    tags_filter_include_all: Optional[List[str]] = None,
    tags_filter_include_any: Optional[List[str]] = None
) -> List[models.Decision]:
    """Retrieves decisions, optionally limited, and filtered by tags."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    
    base_sql = "SELECT id, timestamp, summary, rationale, implementation_details, tags FROM decisions"
    conditions = []
    params_list: List[Any] = []

    if tags_filter_include_all:
        # For each tag in the list, we need to ensure it exists in the 'tags' JSON array.
        # This is tricky with pure SQL LIKE on a JSON array string.
        # A more robust way is to fetch and filter in Python, or use json_each if available and suitable.
        # For simplicity here, we'll filter in Python after fetching.
        # This means 'limit' will apply before this specific tag filter.
        # A true SQL solution would be more complex, e.g., using json_tree or json_each and subqueries.
        pass # Will be handled post-query

    if tags_filter_include_any:
        # Similar to above, this is easier to handle post-query for now.
        pass # Will be handled post-query

    # ORDER BY must come before LIMIT
    order_by_clause = " ORDER BY timestamp DESC"
    
    limit_clause = ""
    if limit is not None and limit > 0:
        limit_clause = " LIMIT ?"
        params_list.append(limit)

    # Construct the SQL query
    # Since tag filtering will be done in Python for now, conditions list remains empty for SQL
    sql = base_sql
    if conditions: # This block will not be hit with current Python-based tag filtering
        sql += " WHERE " + " AND ".join(conditions)
    
    sql += order_by_clause + limit_clause
    
    params_tuple = tuple(params_list)

    try:
        cursor = conn.cursor()
        cursor.execute(sql, params_tuple)
        rows = cursor.fetchall()
        decisions = [
            models.Decision(
                id=row['id'],
                timestamp=row['timestamp'],
                summary=row['summary'],
                rationale=row['rationale'],
                implementation_details=row['implementation_details'],
                tags=_parse_tags_safely(row['tags'])
            ) for row in rows
        ]

        # Python-based filtering for tags
        if tags_filter_include_all:
            decisions = [
                d for d in decisions if d.tags and all(tag in d.tags for tag in tags_filter_include_all)
            ]
        
        if tags_filter_include_any:
            decisions = [
                d for d in decisions if d.tags and any(tag in d.tags for tag in tags_filter_include_any)
            ]

        return decisions
    except (sqlite3.Error, json.JSONDecodeError) as e: # Added JSONDecodeError
        raise DatabaseError(f"Failed to retrieve decisions: {e}")
    finally:
        if cursor:
            cursor.close()

def search_decisions_fts(workspace_id: str, query_term: str, limit: Optional[int] = 10) -> List[models.Decision]:
    """Searches decisions using FTS5 for the given query term."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    # The MATCH operator is used for FTS queries.
    # We join back to the original 'decisions' table to get all columns.
    # 'rank' is an FTS5 auxiliary function that indicates relevance.
    sql = """
        SELECT d.id, d.timestamp, d.summary, d.rationale, d.implementation_details, d.tags
        FROM decisions_fts f
        JOIN decisions d ON f.rowid = d.id
        WHERE f.decisions_fts MATCH ? ORDER BY rank
    """
    params_list = [query_term]

    if limit is not None and limit > 0:
        sql += " LIMIT ?"
        params_list.append(limit)

    try:
        cursor = conn.cursor()
        cursor.execute(sql, tuple(params_list))
        rows = cursor.fetchall()
        decisions_found = [
            models.Decision(
                id=row['id'],
                timestamp=row['timestamp'],
                summary=row['summary'],
                rationale=row['rationale'],
                implementation_details=row['implementation_details'],
                tags=_parse_tags_safely(row['tags'])
            ) for row in rows
        ]
        return decisions_found
    except sqlite3.Error as e:
        raise DatabaseError(f"Failed FTS search on decisions for term '{query_term}': {e}")
    finally:
        if cursor:
            cursor.close()

def update_decision_by_id(workspace_id: str, update_args: 'models.UpdateDecisionArgs') -> bool:
    """
    Updates an existing decision by its ID.
    Returns True if the decision was found and updated, False otherwise.
    """
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    
    sql = "UPDATE decisions SET"
    updates = []
    params_list = []

    if update_args.summary is not None:
        updates.append("summary = ?")
        params_list.append(update_args.summary)
    if update_args.rationale is not None:
        updates.append("rationale = ?")
        params_list.append(update_args.rationale)
    if update_args.implementation_details is not None:
        updates.append("implementation_details = ?")
        params_list.append(update_args.implementation_details)
    # Handle tags update, including setting to NULL if explicitly None is intended
    # If tags is provided as [] (empty list), set to empty JSON array.
    # If tags is provided as None, set the DB column to NULL.
    # If tags is NOT provided in args (remains default None), do not include in update.
    if 'tags' in update_args.model_fields_set: # Check if tags was explicitly set in the input args
         updates.append("tags = ?")
         if update_args.tags is not None:
             params_list.append(json.dumps(update_args.tags))
         else:
             params_list.append(None) # SQLite handles Python None as NULL

    if not updates:
         # This case should be prevented by Pydantic model validation, but as a safeguard
         raise ValueError("No fields provided for update.")

    sql += " " + ", ".join(updates) + " WHERE id = ?"
    params_list.append(update_args.decision_id)
    params = tuple(params_list)

    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        return cursor.rowcount > 0 # Return True if one row was updated
    except sqlite3.Error as e:
        conn.rollback()
        raise DatabaseError(f"Failed to update decision with ID {update_args.decision_id}: {e}")
    finally:
        if cursor:
            cursor.close()

def delete_decision_by_id(workspace_id: str, decision_id: int) -> bool:
    """Deletes a decision by its ID. Returns True if deleted, False otherwise."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    sql = "DELETE FROM decisions WHERE id = ?"
    try:
        cursor = conn.cursor()
        cursor.execute(sql, (decision_id,))
        # The FTS table 'decisions_fts' should be updated automatically by its AFTER DELETE trigger.
        conn.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        conn.rollback()
        raise DatabaseError(f"Failed to delete decision with ID {decision_id}: {e}")
    finally:
        if cursor:
            cursor.close()