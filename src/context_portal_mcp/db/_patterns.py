"""CRUD operations for System Patterns."""

import sqlite3
import json
from typing import List, Optional

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

def log_system_pattern(workspace_id: str, pattern_data: models.SystemPattern) -> models.SystemPattern:
    """Logs or updates a system pattern. Uses atomic INSERT ON CONFLICT to preserve IDs and links."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    
    tags_json = json.dumps(pattern_data.tags) if pattern_data.tags is not None else None
    
    # Use atomic INSERT ... ON CONFLICT to avoid race conditions
    # Same name = UPDATE (preserves ID and links)
    # New name = INSERT new record (old record stays intact with links)
    sql = """
        INSERT INTO system_patterns (timestamp, name, description, tags)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            timestamp = excluded.timestamp,
            description = excluded.description,
            tags = excluded.tags
        RETURNING id
    """
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql, (
            pattern_data.timestamp,
            pattern_data.name,
            pattern_data.description,
            tags_json
        ))
        
        # Get the ID from the RETURNING clause
        row = cursor.fetchone()
        if row:
            pattern_data.id = row['id']
        
        conn.commit()
        return pattern_data
    except sqlite3.Error as e:
        conn.rollback()
        raise DatabaseError(f"Failed to log system pattern '{pattern_data.name}': {e}")
    finally:
        if cursor:
            cursor.close()

def get_system_patterns(
    workspace_id: str,
    tags_filter_include_all: Optional[List[str]] = None,
    tags_filter_include_any: Optional[List[str]] = None
    # limit: Optional[int] = None, # Add if pagination is desired
) -> List[models.SystemPattern]:
    """Retrieves system patterns, optionally filtered by tags."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    
    base_sql = "SELECT id, timestamp, name, description, tags FROM system_patterns"
    order_by_clause = " ORDER BY name ASC"
    # params_list: List[Any] = [] # Not used for SQL filtering of tags for now
    # limit_clause = ""
    # if limit is not None and limit > 0:
    #     limit_clause = " LIMIT ?"
    #     params_list.append(limit)

    sql = base_sql + order_by_clause # + limit_clause
    # params_tuple = tuple(params_list)

    try:
        cursor = conn.cursor()
        cursor.execute(sql) #, params_tuple)
        rows = cursor.fetchall()
        patterns = [
            models.SystemPattern(
                id=row['id'],
                timestamp=row['timestamp'],
                name=row['name'],
                description=row['description'],
                tags=_parse_tags_safely(row['tags'])
            ) for row in rows
        ]

        # Python-based filtering for tags
        if tags_filter_include_all:
            patterns = [
                p for p in patterns if p.tags and all(tag in p.tags for tag in tags_filter_include_all)
            ]
        
        if tags_filter_include_any:
            patterns = [
                p for p in patterns if p.tags and any(tag in p.tags for tag in tags_filter_include_any)
            ]

        return patterns
    except (sqlite3.Error, json.JSONDecodeError) as e: # Added JSONDecodeError
        raise DatabaseError(f"Failed to retrieve system patterns: {e}")
    finally:
        if cursor:
            cursor.close()

def delete_system_pattern_by_id(workspace_id: str, pattern_id: int) -> bool:
    """Deletes a system pattern by its ID. Returns True if deleted, False otherwise."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    sql = "DELETE FROM system_patterns WHERE id = ?"
    # Note: System patterns do not currently have an FTS table, so no trigger concerns here.
    try:
        cursor = conn.cursor()
        cursor.execute(sql, (pattern_id,))
        conn.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        conn.rollback()
        raise DatabaseError(f"Failed to delete system pattern with ID {pattern_id}: {e}")
    finally:
        if cursor:
            cursor.close()

def search_system_patterns_fts(workspace_id: str, query_term: str, limit: Optional[int] = 10) -> List[models.SystemPattern]:
    """Searches system patterns using FTS5 for the given query term."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    sql = """
        SELECT sp.id, sp.timestamp, sp.name, sp.description, sp.tags
        FROM system_patterns_fts f
        JOIN system_patterns sp ON f.rowid = sp.id
        WHERE f.system_patterns_fts MATCH ? ORDER BY rank
    """
    params_list = [query_term]

    if limit is not None and limit > 0:
        sql += " LIMIT ?"
        params_list.append(limit)

    try:
        cursor = conn.cursor()
        cursor.execute(sql, tuple(params_list))
        rows = cursor.fetchall()
        patterns = [
            models.SystemPattern(
                id=row['id'],
                timestamp=row['timestamp'],
                name=row['name'],
                description=row['description'],
                tags=_parse_tags_safely(row['tags'])
            ) for row in rows
        ]
        return patterns
    except sqlite3.Error as e:
        raise DatabaseError(f"Failed FTS search on system patterns for term '{query_term}': {e}")
    finally:
        if cursor:
            cursor.close()