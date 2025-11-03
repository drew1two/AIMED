"""CRUD operations for Progress Entries."""

import sqlite3
from datetime import datetime
from typing import List, Optional

from ..core.exceptions import DatabaseError
from . import models

def log_progress(workspace_id: str, progress_data: models.ProgressEntry) -> models.ProgressEntry:
    """Logs a new progress entry."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    sql = """
        INSERT INTO progress_entries (timestamp, status, description, parent_id)
        VALUES (?, ?, ?, ?)
    """
    params = (
        progress_data.timestamp,
        progress_data.status,
        progress_data.description,
        progress_data.parent_id
    )
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        progress_id = cursor.lastrowid
        conn.commit()
        progress_data.id = progress_id
        return progress_data
    except sqlite3.Error as e:
        conn.rollback()
        # Consider checking for foreign key constraint errors if parent_id is invalid
        raise DatabaseError(f"Failed to log progress entry: {e}")
    finally:
        if cursor:
            cursor.close()

def get_progress(
    workspace_id: str,
    status_filter: Optional[str] = None,
    parent_id_filter: Optional[int] = None,
    limit: Optional[int] = None
) -> List[models.ProgressEntry]:
    """Retrieves progress entries, optionally filtered and limited."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    sql = "SELECT id, timestamp, status, description, parent_id FROM progress_entries"
    conditions = []
    params_list = []

    if status_filter:
        conditions.append("status = ?")
        params_list.append(status_filter)
    if parent_id_filter is not None: # Check for None explicitly as 0 could be a valid parent_id
        conditions.append("parent_id = ?")
        params_list.append(parent_id_filter)
    # Add more filters if needed (e.g., date range)

    if conditions:
        sql += " WHERE " + " AND ".join(conditions)

    sql += " ORDER BY timestamp DESC" # Default order: newest first

    if limit is not None and limit > 0:
        sql += " LIMIT ?"
        params_list.append(limit)

    params = tuple(params_list)

    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        progress_entries = [
            models.ProgressEntry(
                id=row['id'],
                timestamp=row['timestamp'],
                status=row['status'],
                description=row['description'],
                parent_id=row['parent_id']
            ) for row in rows
        ]
        # progress_entries.reverse() # Optional: uncomment to return oldest first
        return progress_entries
    except sqlite3.Error as e:
        raise DatabaseError(f"Failed to retrieve progress entries: {e}")
    finally:
        if cursor:
            cursor.close()

def update_progress_entry(workspace_id: str, update_args: models.UpdateProgressArgs) -> bool:
    """
    Updates an existing progress entry by its ID.
    Returns True if the entry was found and updated, False otherwise.
    """
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    
    sql = "UPDATE progress_entries SET"
    updates = []
    params_list: List[any] = []

    if update_args.status is not None:
        updates.append("status = ?")
        params_list.append(update_args.status)
    if update_args.description is not None:
        updates.append("description = ?")
        params_list.append(update_args.description)
    # Handle parent_id update, including setting to NULL if explicitly None is intended (though Pydantic allows Optional[int])
    # If parent_id is provided as 0 or a positive int, update it.
    # If parent_id is provided as None, set the DB column to NULL.
    # If parent_id is NOT provided in args (remains default None), do not include in update.
    # The Pydantic model check_at_least_one_field ensures at least one field is provided,
    # so we don't need to worry about an empty updates list here.
    if 'parent_id' in update_args.model_fields_set: # Check if parent_id was explicitly set in the input args
         updates.append("parent_id = ?")
         params_list.append(update_args.parent_id) # SQLite handles Python None as NULL

    if not updates:
         # This case should be prevented by Pydantic model validation, but as a safeguard
         raise ValueError("No fields provided for update.")

    sql += " " + ", ".join(updates) + " WHERE id = ?"
    params_list.append(update_args.progress_id)
    params = tuple(params_list)

    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        return cursor.rowcount > 0 # Return True if one row was updated
    except sqlite3.Error as e:
        conn.rollback()
        raise DatabaseError(f"Failed to update progress entry with ID {update_args.progress_id}: {e}")
    finally:
        if cursor:
            cursor.close()

def delete_progress_entry_by_id(workspace_id: str, progress_id: int) -> bool:
    """
    Deletes a progress entry by its ID.
    Note: This will also set the parent_id of any child tasks to NULL due to FOREIGN KEY ON DELETE SET NULL.
    Returns True if deleted, False otherwise.
    """
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    sql = "DELETE FROM progress_entries WHERE id = ?"
    try:
        cursor = conn.cursor()
        cursor.execute(sql, (progress_id,))
        conn.commit()
        return cursor.rowcount > 0 # Return True if one row was deleted
    except sqlite3.Error as e:
        conn.rollback()
        raise DatabaseError(f"Failed to delete progress entry with ID {progress_id}: {e}")
    finally:
        if cursor:
            cursor.close()

def search_progress_fts(workspace_id: str, query_term: str, limit: Optional[int] = 10) -> List[models.ProgressEntry]:
    """Searches progress entries using FTS5 for the given query term."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    sql = """
        SELECT p.id, p.timestamp, p.status, p.description, p.parent_id
        FROM progress_entries_fts f
        JOIN progress_entries p ON f.rowid = p.id
        WHERE f.progress_entries_fts MATCH ? ORDER BY rank
    """
    params_list = [query_term]

    if limit is not None and limit > 0:
        sql += " LIMIT ?"
        params_list.append(limit)

    try:
        cursor = conn.cursor()
        cursor.execute(sql, tuple(params_list))
        rows = cursor.fetchall()
        progress_entries = [
            models.ProgressEntry(
                id=row['id'],
                timestamp=row['timestamp'],
                status=row['status'],
                description=row['description'],
                parent_id=row['parent_id']
            ) for row in rows
        ]
        return progress_entries
    except sqlite3.Error as e:
        raise DatabaseError(f"Failed FTS search on progress entries for term '{query_term}': {e}")
    finally:
        if cursor:
            cursor.close()