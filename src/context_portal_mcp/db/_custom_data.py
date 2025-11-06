"""CRUD operations for Custom Data."""

import sqlite3
import json
from typing import List, Optional

from ..core.exceptions import DatabaseError
from . import models

def log_custom_data(workspace_id: str, data: models.CustomData) -> models.CustomData:
    """Logs or updates a custom data entry. Uses atomic INSERT ON CONFLICT to preserve IDs and links."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    
    # Ensure value is serialized to JSON string
    value_json = json.dumps(data.value)
    
    # Use atomic INSERT ... ON CONFLICT to avoid race conditions
    # Same category+key = UPDATE (preserves ID and links)
    # New category+key = INSERT new record (old record stays intact with links)
    sql = """
        INSERT INTO custom_data (timestamp, category, key, value)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(category, key) DO UPDATE SET
            timestamp = excluded.timestamp,
            value = excluded.value
        RETURNING id
    """
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql, (
            data.timestamp,
            data.category,
            data.key,
            value_json
        ))
        
        # Get the ID from the RETURNING clause
        row = cursor.fetchone()
        if row:
            data.id = row['id']
        
        conn.commit()
        return data
    except (sqlite3.Error, TypeError) as e: # TypeError for json.dumps
        conn.rollback()
        raise DatabaseError(f"Failed to log custom data for '{data.category}/{data.key}': {e}")
    finally:
        if cursor:
            cursor.close()

def get_custom_data(
    workspace_id: str,
    category: Optional[str] = None,
    key: Optional[str] = None
) -> List[models.CustomData]:
    """Retrieves custom data entries, optionally filtered by category and/or key."""
    if key and not category:
        raise ValueError("Cannot filter by key without specifying a category.")

    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    sql = "SELECT id, timestamp, category, key, value FROM custom_data"
    conditions = []
    params_list = []

    if category:
        conditions.append("category = ?")
        params_list.append(category)
    if key: # We already ensured category is present if key is
        conditions.append("key = ?")
        params_list.append(key)

    if conditions:
        sql += " WHERE " + " AND ".join(conditions)

    sql += " ORDER BY category ASC, key ASC" # Consistent ordering
    params = tuple(params_list)

    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        custom_data_list = []
        for row in rows:
            try:
                # Deserialize value from JSON string
                value_data = json.loads(row['value'])
                custom_data_list.append(
                    models.CustomData(
                        id=row['id'],
                        timestamp=row['timestamp'],
                        category=row['category'],
                        key=row['key'],
                        value=value_data
                    )
                )
            except json.JSONDecodeError as e:
                # Log or handle error for specific row if JSON is invalid
                print(f"Warning: Failed to decode JSON for custom_data id={row['id']}: {e}") # Replace with proper logging
                continue # Skip this row
        return custom_data_list
    except sqlite3.Error as e:
        raise DatabaseError(f"Failed to retrieve custom data: {e}")
    finally:
        if cursor:
            cursor.close()

def get_custom_data_by_id(workspace_id: str, custom_data_id: int) -> Optional[models.CustomData]:
    """Retrieves a specific custom data entry by its numeric ID."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None
    sql = "SELECT id, timestamp, category, key, value FROM custom_data WHERE id = ?"
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql, (custom_data_id,))
        row = cursor.fetchone()
        
        if row:
            try:
                value_data = json.loads(row['value'])
                return models.CustomData(
                    id=row['id'],
                    timestamp=row['timestamp'],
                    category=row['category'],
                    key=row['key'],
                    value=value_data
                )
            except json.JSONDecodeError as e:
                print(f"Warning: Failed to decode JSON for custom_data id={custom_data_id}: {e}")
                return None
        return None
    except sqlite3.Error as e:
        raise DatabaseError(f"Failed to retrieve custom data by ID {custom_data_id}: {e}")
    finally:
        if cursor:
            cursor.close()

def get_all_custom_data_by_id_desc(workspace_id: str, limit: Optional[int] = None) -> List[models.CustomData]:
    """Retrieves all custom data entries sorted by ID descending (most recent first) for UI display."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None
    sql = "SELECT id, timestamp, category, key, value FROM custom_data ORDER BY id DESC"
    params_list = []
    
    if limit is not None and limit > 0:
        sql += " LIMIT ?"
        params_list.append(limit)
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql, tuple(params_list))
        rows = cursor.fetchall()
        custom_data_list = []
        for row in rows:
            try:
                value_data = json.loads(row['value'])
                custom_data_list.append(
                    models.CustomData(
                        id=row['id'],
                        timestamp=row['timestamp'],
                        category=row['category'],
                        key=row['key'],
                        value=value_data
                    )
                )
            except json.JSONDecodeError as e:
                print(f"Warning: Failed to decode JSON for custom_data id={row['id']}: {e}")
                continue
        return custom_data_list
    except sqlite3.Error as e:
        raise DatabaseError(f"Failed to retrieve custom data sorted by ID: {e}")
    finally:
        if cursor:
            cursor.close()

def delete_custom_data(workspace_id: str, category: str, key: str) -> bool:
    """Deletes a specific custom data entry by category and key. Returns True if deleted, False otherwise."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    sql = "DELETE FROM custom_data WHERE category = ? AND key = ?"
    params = (category, key)
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        return cursor.rowcount > 0 # Return True if one row was deleted
    except sqlite3.Error as e:
        conn.rollback()
        raise DatabaseError(f"Failed to delete custom data for '{category}/{key}': {e}")
    finally:
        if cursor:
            cursor.close()

def search_project_glossary_fts(workspace_id: str, query_term: str, limit: Optional[int] = 10) -> List[models.CustomData]:
    """Searches ProjectGlossary entries in custom_data using FTS5."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    # Updated to use the new general custom_data_fts table structure
    sql = """
        SELECT cd.id, cd.category, cd.key, cd.value
        FROM custom_data_fts fts
        JOIN custom_data cd ON fts.rowid = cd.id
        WHERE fts.custom_data_fts MATCH ? AND fts.category = 'ProjectGlossary'
        ORDER BY rank
    """
    # The MATCH query will search category, key, and value_text.
    # We explicitly filter for ProjectGlossary category after the FTS match.
    # Note: The MATCH query will search across 'term' and 'definition_text' columns in custom_data_fts
    params_list = [query_term]

    if limit is not None and limit > 0:
        sql += " LIMIT ?"
        params_list.append(limit)

    try:
        cursor = conn.cursor()
        cursor.execute(sql, tuple(params_list))
        rows = cursor.fetchall()
        glossary_entries = []
        for row in rows:
            try:
                value_data = json.loads(row['value'])
                glossary_entries.append(
                    models.CustomData(
                        id=row['id'],
                        category=row['category'],
                        key=row['key'],
                        value=value_data
                    )
                )
            except json.JSONDecodeError as e:
                # Log or handle error for specific row if JSON is invalid
                print(f"Warning: Failed to decode JSON for glossary item id={row['id']}: {e}") # Replace with proper logging
                continue # Skip this row
        return glossary_entries
    except sqlite3.Error as e:
        raise DatabaseError(f"Failed FTS search on ProjectGlossary for term '{query_term}': {e}")
    finally:
        if cursor:
            cursor.close()

def search_custom_data_value_fts(
    workspace_id: str,
    query_term: str,
    category_filter: Optional[str] = None,
    limit: Optional[int] = 10
) -> List[models.CustomData]:
    """Searches all custom_data entries using FTS5 on category, key, and value.
       Optionally filters by category after FTS."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    
    sql = """
        SELECT cd.id, cd.timestamp, cd.category, cd.key, cd.value
        FROM custom_data_fts fts
        JOIN custom_data cd ON fts.rowid = cd.id
        WHERE fts.custom_data_fts MATCH ?
    """
    params_list = [query_term]

    if category_filter:
        sql += " AND fts.category = ?" # Filter by category on the FTS table
        params_list.append(category_filter)
        
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
            try:
                cursor = conn.cursor()
                value_data = json.loads(row['value'])
                results.append(
                    models.CustomData(
                        id=row['id'],
                        timestamp=row['timestamp'],
                        category=row['category'],
                        key=row['key'],
                        value=value_data
                    )
                )
            except json.JSONDecodeError as e:
                print(f"Warning: Failed to decode JSON for custom_data id={row['id']} (search_custom_data_value_fts): {e}")
                continue
        return results
    except sqlite3.Error as e:
        raise DatabaseError(f"Failed FTS search on custom_data for term '{query_term}': {e}")
    finally:
        if cursor:
            cursor.close()