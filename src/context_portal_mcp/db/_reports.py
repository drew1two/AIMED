"""Aggregated reporting and reference retrieval helpers for ConPort DB.

Note:
- All DB access is performed through database.py via local imports inside functions
  to avoid circular imports and to keep a single connection orchestration point.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta, timezone
import sqlite3
import json
import logging

from . import models
from ..core.exceptions import DatabaseError

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

log = logging.getLogger(__name__)


def get_recent_activity_summary_data(
    workspace_id: str,
    hours_ago: Optional[int] = None,
    since_timestamp: Optional[datetime] = None,
    limit_per_type: int = 5
) -> Dict[str, Any]:
    """
    Retrieves a summary of recent activity across various ConPort items.
    """
    # Import locally to avoid circular import at module load
    from .database import get_db_connection

    conn = get_db_connection(workspace_id)
    cursor: Optional[sqlite3.Cursor] = None
    summary_results: Dict[str, Any] = {
        "recent_decisions": [],
        "recent_progress_entries": [],
        "recent_product_context_updates": [],
        "recent_active_context_updates": [],
        "recent_links_created": [],
        "recent_system_patterns": [],
        "notes": []
    }

    now_utc = datetime.now(timezone.utc)
    summary_results["summary_period_end"] = now_utc.isoformat()

    if since_timestamp:
        start_datetime = since_timestamp
    elif hours_ago:
        start_datetime = now_utc - timedelta(hours=hours_ago)
    else:
        start_datetime = now_utc - timedelta(hours=24)  # Default to last 24 hours

    summary_results["summary_period_start"] = start_datetime.isoformat()

    try:
        cursor = conn.cursor()

        # Recent Decisions
        cursor.execute(
            """
            SELECT id, timestamp, summary, rationale, implementation_details, tags
            FROM decisions WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?
            """,
            (start_datetime, limit_per_type)
        )
        rows = cursor.fetchall()
        summary_results["recent_decisions"] = [
            models.Decision(
                id=row['id'], timestamp=row['timestamp'], summary=row['summary'],
                rationale=row['rationale'], implementation_details=row['implementation_details'],
                tags=_parse_tags_safely(row['tags'])
            ).model_dump(mode='json') for row in rows
        ]

        # Recent Progress Entries
        cursor.execute(
            """
            SELECT id, timestamp, status, description, parent_id
            FROM progress_entries WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?
            """,
            (start_datetime, limit_per_type)
        )
        rows = cursor.fetchall()
        summary_results["recent_progress_entries"] = [
            models.ProgressEntry(
                id=row['id'], timestamp=row['timestamp'], status=row['status'],
                description=row['description'], parent_id=row['parent_id']
            ).model_dump(mode='json') for row in rows
        ]

        # Recent Product Context Updates (from history)
        cursor.execute(
            """
            SELECT id, timestamp, version, content, change_source
            FROM product_context_history WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?
            """,
            (start_datetime, limit_per_type)
        )
        rows = cursor.fetchall()
        summary_results["recent_product_context_updates"] = [
            models.ProductContextHistory(
                id=row['id'], timestamp=row['timestamp'], version=row['version'],
                content=json.loads(row['content']), change_source=row['change_source']
            ).model_dump(mode='json') for row in rows
        ]

        # Recent Active Context Updates (from history)
        cursor.execute(
            """
            SELECT id, timestamp, version, content, change_source
            FROM active_context_history WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?
            """,
            (start_datetime, limit_per_type)
        )
        rows = cursor.fetchall()
        summary_results["recent_active_context_updates"] = [
            models.ActiveContextHistory(
                id=row['id'], timestamp=row['timestamp'], version=row['version'],
                content=json.loads(row['content']), change_source=row['change_source']
            ).model_dump(mode='json') for row in rows
        ]

        # Recent Links Created
        cursor.execute(
            """
            SELECT id, timestamp, source_item_type, source_item_id, target_item_type, target_item_id, relationship_type, description
            FROM context_links WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?
            """,
            (start_datetime, limit_per_type)
        )
        rows = cursor.fetchall()
        summary_results["recent_links_created"] = [
            models.ContextLink(
                id=row['id'], timestamp=row['timestamp'], source_item_type=row['source_item_type'],
                source_item_id=row['source_item_id'], target_item_type=row['target_item_type'],
                target_item_id=row['target_item_id'], relationship_type=row['relationship_type'],
                description=row['description']
            ).model_dump(mode='json') for row in rows
        ]

        # Recent System Patterns
        cursor.execute(
            """
            SELECT id, timestamp, name, description, tags
            FROM system_patterns WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?
            """,
            (start_datetime, limit_per_type)
        )
        rows = cursor.fetchall()
        summary_results["recent_system_patterns"] = [
            models.SystemPattern(
                id=row['id'], timestamp=row['timestamp'], name=row['name'],
                description=row['description'], tags=_parse_tags_safely(row['tags'])
            ).model_dump(mode='json') for row in rows
        ]

        return summary_results

    except (sqlite3.Error, json.JSONDecodeError) as e:
        log.error(f"Failed to retrieve recent activity summary: {e}", exc_info=True)
        raise DatabaseError(f"Failed to retrieve recent activity summary: {e}")
    finally:
        if cursor:
            cursor.close()


def get_items_by_references(
    workspace_id: str,
    references: Optional[List[models.ItemReference]] = None,
    linked_items_result: Optional[List[Dict[str, Any]]] = None
) -> List[Dict[str, Any]]:
    """
    Enhanced bulk item retrieval with dual interface and comprehensive error handling.
    
    **Key Features:**
    - **Dual Interface**: Accept either direct references OR get_linked_items results
    - **Comprehensive Error Handling**: Each item returns success/failure with error details
    - **Knowledge Graph Support**: Automatic 1-hop expansion from get_linked_items
    - **Deduplication**: Handles duplicate references intelligently
    - **Structured Results**: Consistent success/error response format
    
    **Interface Methods:**
    
    Method 1 - Direct References:
        references=[{"type": "decision", "id": "1"}, {"type": "progress_entry", "id": "5"}]
        
    Method 2 - Linked Items Result Parsing:
        linked_items_result=[get_linked_items() output] -> automatically extracts all referenced items
    
    **Return Structure:**
    ```
    [
        {
            "reference": {"type": "decision", "id": "1"},
            "success": True,
            "item": {...full item data...},
            "error": None
        },
        {
            "reference": {"type": "custom_data", "id": "nonexistent"},
            "success": False,
            "item": None,
            "error": "Custom data with ID nonexistent not found"
        }
    ]
    ```
    
    **Supported Item Types:**
    - decision, progress_entry, system_pattern, custom_data, product_context, active_context
    
    Args:
        workspace_id: Workspace identifier
        references: List of {type, id} pairs (Method 1)
        linked_items_result: Result from get_linked_items (Method 2)
        
    Returns:
        List of structured result dictionaries with success/failure status
        
    Raises:
        DatabaseError: On database access errors
        ValueError: If both or neither interface methods provided
    """
    # Input validation - exactly one method must be provided
    if (references is None) == (linked_items_result is None):
        raise ValueError("Provide either 'references' or 'linked_items_result', not both or neither")
    
    # Import locally to avoid circular import at module load
    from .database import get_db_connection
    
    conn = get_db_connection(workspace_id)
    cursor: Optional[sqlite3.Cursor] = None
    results: List[Dict[str, Any]] = []
    
    try:
        cursor = conn.cursor()
        
        # Method 2: Parse linked_items_result to extract references
        if linked_items_result is not None:
            references = _extract_references_from_links(linked_items_result)
            log.debug(f"Extracted {len(references)} references from linked_items_result: {references}")
        
        # Process references with deduplication
        seen_refs = set()
        for ref in references or []:
            if not ref or not hasattr(ref, 'type') or not hasattr(ref, 'id'):
                continue
                
            # Create reference dict for consistent structure
            ref_dict = {"type": ref.type, "id": ref.id}
            ref_key = (ref.type.lower(), str(ref.id))
            
            # Skip duplicates
            if ref_key in seen_refs:
                continue
            seen_refs.add(ref_key)
            
            # Retrieve item with comprehensive error handling
            try:
                item_data = _retrieve_single_item(cursor, ref.type, ref.id)
                
                if item_data is not None:
                    results.append({
                        "reference": ref_dict,
                        "success": True,
                        "item": item_data,
                        "error": None
                    })
                else:
                    # Item not found
                    results.append({
                        "reference": ref_dict,
                        "success": False,
                        "item": None,
                        "error": _format_not_found_error(ref.type, ref.id)
                    })
                    
            except Exception as e:
                # Database error retrieving specific item
                results.append({
                    "reference": ref_dict,
                    "success": False,
                    "item": None,
                    "error": f"Database error retrieving {ref.type} ID {ref.id}: {e}"
                })
                log.warning(f"Error retrieving {ref.type} ID {ref.id}: {e}")
        
        log.info(f"Retrieved {len(results)} items by references ({len([r for r in results if r['success']])} successful)")
        return results
        
    except sqlite3.Error as e:
        log.error(f"SQLite error in get_items_by_references: {e}", exc_info=True)
        raise DatabaseError(f"Database error in get_items_by_references: {e}")
    finally:
        if cursor:
            cursor.close()


def _extract_references_from_links(linked_items_result: List[Dict[str, Any]]) -> List[models.ItemReference]:
    """
    Extracts item references from get_linked_items result.
    
    Parses both source and target items from link metadata to enable 1-hop graph expansion.
    """
    references = []
    seen = set()
    
    for link in linked_items_result or []:
        # Extract source item reference
        if link.get('source_item_type') and link.get('source_item_id'):
            source_ref = models.ItemReference(
                type=link['source_item_type'],
                id=link['source_item_id']
            )
            source_key = (source_ref.type.lower(), str(source_ref.id))
            if source_key not in seen:
                references.append(source_ref)
                seen.add(source_key)
        
        # Extract target item reference
        if link.get('target_item_type') and link.get('target_item_id'):
            target_ref = models.ItemReference(
                type=link['target_item_type'],
                id=link['target_item_id']
            )
            target_key = (target_ref.type.lower(), str(target_ref.id))
            if target_key not in seen:
                references.append(target_ref)
                seen.add(target_key)
    
    return references


def _retrieve_single_item(cursor: sqlite3.Cursor, item_type: str, item_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a single item by type and ID with robust error handling.
    
    Returns None if item not found, raises exception for database errors.
    """
    item_type_lower = item_type.lower()
    
    try:
        if item_type_lower == "decision":
            decision_id = int(item_id)
            cursor.execute(
                "SELECT id, timestamp, summary, rationale, implementation_details, tags FROM decisions WHERE id = ?",
                (decision_id,)
            )
            row = cursor.fetchone()
            if row:
                return models.Decision(
                    id=row["id"], timestamp=row["timestamp"], summary=row["summary"],
                    rationale=row["rationale"], implementation_details=row["implementation_details"],
                    tags=_parse_tags_safely(row["tags"])
                ).model_dump(mode="json")
                
        elif item_type_lower == "progress_entry":
            progress_id = int(item_id)
            cursor.execute(
                "SELECT id, timestamp, status, description, parent_id FROM progress_entries WHERE id = ?",
                (progress_id,)
            )
            row = cursor.fetchone()
            if row:
                return models.ProgressEntry(
                    id=row["id"], timestamp=row["timestamp"], status=row["status"],
                    description=row["description"], parent_id=row["parent_id"]
                ).model_dump(mode="json")
                
        elif item_type_lower == "system_pattern":
            pattern_id = int(item_id)
            cursor.execute(
                "SELECT id, timestamp, name, description, tags FROM system_patterns WHERE id = ?",
                (pattern_id,)
            )
            row = cursor.fetchone()
            if row:
                return models.SystemPattern(
                    id=row["id"], timestamp=row["timestamp"], name=row["name"],
                    description=row["description"], tags=_parse_tags_safely(row["tags"])
                ).model_dump(mode="json")
                
        elif item_type_lower == "custom_data":
            return _retrieve_custom_data_item(cursor, item_id)
            
        elif item_type_lower == "product_context":
            cursor.execute("SELECT id, content FROM product_context WHERE id = 1")
            row = cursor.fetchone()
            if row:
                try:
                    content_dict = json.loads(row["content"])
                except json.JSONDecodeError:
                    content_dict = {}
                return models.ProductContext(id=row["id"], content=content_dict).model_dump(mode="json")
                
        elif item_type_lower == "active_context":
            cursor.execute("SELECT id, content FROM active_context WHERE id = 1")
            row = cursor.fetchone()
            if row:
                try:
                    content_dict = json.loads(row["content"])
                except json.JSONDecodeError:
                    content_dict = {}
                return models.ActiveContext(id=row["id"], content=content_dict).model_dump(mode="json")
        
        else:
            raise ValueError(f"Unsupported item type: {item_type}")
            
    except ValueError as e:
        # Re-raise validation errors (invalid ID format, unsupported type)
        raise e
    except sqlite3.Error as e:
        # Re-raise database errors
        raise e
    except Exception as e:
        # Convert other errors to database errors
        raise sqlite3.Error(f"Unexpected error retrieving {item_type} {item_id}: {e}")
    
    return None


def _retrieve_custom_data_item(cursor: sqlite3.Cursor, item_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves custom_data item with flexible ID matching.
    
    Supports:
    - Numeric ID: "123"
    - Category::Key format: "ProjectGlossary::term1"
    - Category/Key format: "config/setting"
    - Key-only fallback: "setting" -> latest entry with that key
    """
    row = None
    
    # Try numeric ID first
    if item_id.isdigit():
        cursor.execute(
            "SELECT id, timestamp, category, key, value FROM custom_data WHERE id = ?",
            (int(item_id),)
        )
        row = cursor.fetchone()
    else:
        # Try structured formats
        category = None
        key_part = None
        
        if "::" in item_id:
            category, key_part = item_id.split("::", 1)
        elif "/" in item_id:
            category, key_part = item_id.split("/", 1)
        
        if category and key_part:
            # Category and key specified
            cursor.execute(
                "SELECT id, timestamp, category, key, value FROM custom_data WHERE category = ? AND key = ? ORDER BY timestamp DESC LIMIT 1",
                (category, key_part)
            )
            row = cursor.fetchone()
        else:
            # Fallback: search by key only (latest)
            cursor.execute(
                "SELECT id, timestamp, category, key, value FROM custom_data WHERE key = ? ORDER BY timestamp DESC LIMIT 1",
                (item_id,)
            )
            row = cursor.fetchone()
    
    if row:
        try:
            value_data = json.loads(row["value"])
        except json.JSONDecodeError:
            value_data = row["value"]
        
        return models.CustomData(
            id=row["id"], timestamp=row["timestamp"], category=row["category"],
            key=row["key"], value=value_data
        ).model_dump(mode="json")
    
    return None


def _format_not_found_error(item_type: str, item_id: str) -> str:
    """Formats a user-friendly error message for missing items."""
    type_name = item_type.replace("_", " ").title()
    return f"{type_name} with ID {item_id} not found"