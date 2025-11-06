"""CRUD operations for Context Links."""

import sqlite3
from typing import List, Optional

from ..core.exceptions import DatabaseError
from . import models

def log_context_link(workspace_id: str, link_data: models.ContextLink) -> models.ContextLink:
    """Logs a new context link."""
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    sql = """
        INSERT INTO context_links (
            workspace_id, source_item_type, source_item_id,
            target_item_type, target_item_id, relationship_type, description, timestamp
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    # Use link_data.timestamp if provided (e.g. from an import), else it defaults in DB
    # However, our Pydantic model ContextLink has default_factory=datetime.utcnow for timestamp
    # So, link_data.timestamp will always be populated.
    params = (
        workspace_id, # Storing workspace_id explicitly in the table
        link_data.source_item_type,
        str(link_data.source_item_id), # Ensure IDs are stored as text
        link_data.target_item_type,
        str(link_data.target_item_id), # Ensure IDs are stored as text
        link_data.relationship_type,
        link_data.description,
        link_data.timestamp # Pydantic model ensures this is set
    )
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        link_id = cursor.lastrowid
        conn.commit()
        link_data.id = link_id
        # The timestamp from the DB default might be slightly different if we didn't pass it,
        # but since our Pydantic model sets it, what we have in link_data.timestamp is accurate.
        return link_data
    except sqlite3.Error as e:
        conn.rollback()
        raise DatabaseError(f"Failed to log context link: {e}")
    finally:
        if cursor:
            cursor.close()

def get_context_links(
    workspace_id: str,
    item_type: str,
    item_id: str,
    relationship_type_filter: Optional[str] = None,
    linked_item_type_filter: Optional[str] = None,
    limit: Optional[int] = None
) -> List[models.ContextLink]:
    """
    Retrieves links for a given item, with optional filters.
    Finds links where the given item is EITHER the source OR the target.
    For custom_data, supports both numeric ID and category:key format.
    """
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None # Initialize cursor for finally block
    
    # Ensure item_id is treated as string for consistent querying with TEXT columns
    str_item_id = str(item_id)
    
    # For custom_data, also check category:key format if item_id is numeric
    search_item_ids = [str_item_id]
    if item_type == 'custom_data' and item_id.isdigit():
        try:
            # Import here to avoid circular import
            from ._custom_data import get_custom_data_by_id
            custom_data_item = get_custom_data_by_id(workspace_id, int(item_id))
            if custom_data_item:
                category_key_id = f"{custom_data_item.category}:{custom_data_item.key}"
                search_item_ids.append(category_key_id)
        except Exception as e:
            # If lookup fails, just use the original numeric ID
            pass

    base_sql = """
        SELECT id, timestamp, workspace_id, source_item_type, source_item_id,
               target_item_type, target_item_id, relationship_type, description
        FROM context_links
    """
    conditions = []
    params_list = []

    # Main condition: item is either source or target
    # For custom_data, search all possible ID formats
    if len(search_item_ids) > 1:  # Multiple ID formats to check (numeric + category:key)
        id_conditions = []
        for search_id in search_item_ids:
            id_conditions.append("(source_item_type = ? AND source_item_id = ?)")
            id_conditions.append("(target_item_type = ? AND target_item_id = ?)")
            params_list.extend([item_type, search_id, item_type, search_id])
        conditions.append("(" + " OR ".join(id_conditions) + ")")
    else:  # Single ID format (normal case for decisions/progress/patterns)
        conditions.append(
            "((source_item_type = ? AND source_item_id = ?) OR (target_item_type = ? AND target_item_id = ?))"
        )
        params_list.extend([item_type, str_item_id, item_type, str_item_id])
    
    # Add workspace_id filter for safety, though connection is already workspace-specific
    conditions.append("workspace_id = ?")
    params_list.append(workspace_id)

    if relationship_type_filter:
        conditions.append("relationship_type = ?")
        params_list.append(relationship_type_filter)
    
    if linked_item_type_filter:
        # This filter applies to the "other end" of the link
        conditions.append(
            "((source_item_type = ? AND source_item_id = ? AND target_item_type = ?) OR " +
            "(target_item_type = ? AND target_item_id = ? AND source_item_type = ?))"
        )
        params_list.extend([item_type, str_item_id, linked_item_type_filter,
                            item_type, str_item_id, linked_item_type_filter])

    if conditions:
        sql = base_sql + " WHERE " + " AND ".join(conditions)
    else: # Should not happen due to main condition and workspace_id
        sql = base_sql

    sql += " ORDER BY timestamp DESC"

    if limit is not None and limit > 0:
        sql += " LIMIT ?"
        params_list.append(limit)
    
    params = tuple(params_list)

    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        links = [
            models.ContextLink(
                id=row['id'],
                timestamp=row['timestamp'],
                # workspace_id=row['workspace_id'], # Not part of ContextLink Pydantic model
                source_item_type=row['source_item_type'],
                source_item_id=row['source_item_id'],
                target_item_type=row['target_item_type'],
                target_item_id=row['target_item_id'],
                relationship_type=row['relationship_type'],
                description=row['description']
            ) for row in rows
        ]
        return links
    except sqlite3.Error as e:
        raise DatabaseError(f"Failed to retrieve context links: {e}")
    finally:
        if cursor:
            cursor.close()

def update_context_link(
    workspace_id: str,
    link_id: int,
    relationship_type: Optional[str] = None,
    description: Optional[str] = None
) -> bool:
    """
    Updates an existing context link by its ID. Returns True if updated, False otherwise.
    """
    if relationship_type is None and description is None:
        raise ValueError("At least one of 'relationship_type' or 'description' must be provided for update.")

    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None
    try:
        fields: List[str] = []
        params: List[any] = []

        if relationship_type is not None:
            fields.append("relationship_type = ?")
            params.append(relationship_type)
        if description is not None:
            fields.append("description = ?")
            params.append(description)

        sql = f"UPDATE context_links SET {', '.join(fields)} WHERE id = ? AND workspace_id = ?"
        params.extend([link_id, workspace_id])

        cursor = conn.cursor()
        cursor.execute(sql, tuple(params))
        conn.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        conn.rollback()
        raise DatabaseError(f"Failed to update context link ID {link_id}: {e}")
    finally:
        if cursor:
            cursor.close()


def delete_context_link_by_id(workspace_id: str, link_id: int) -> bool:
    """
    Deletes a context link by its ID. Returns True if deleted, False otherwise.
    """
    from .database import get_db_connection
    conn = get_db_connection(workspace_id)
    cursor = None
    sql = "DELETE FROM context_links WHERE id = ? AND workspace_id = ?"
    try:
        cursor = conn.cursor()
        cursor.execute(sql, (link_id, workspace_id))
        conn.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        conn.rollback()
        raise DatabaseError(f"Failed to delete context link with ID {link_id}: {e}")
    finally:
        if cursor:
            cursor.close()