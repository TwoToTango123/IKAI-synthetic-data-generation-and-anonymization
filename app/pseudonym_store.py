"""
Pseudonym storage module.

NOTE: Pseudonym mappings are now stored CLIENT-SIDE only for better privacy and 
to reduce server disk usage (13GB limit). This module is kept for backward compatibility
but all functions are deprecated.

The mapping format is:
{
    "columns": {
        "column_name": {
            "pseudo_value_1": "original_value_1",
            "pseudo_value_2": "original_value_2",
            ...
        }
    }
}

This mapping is sent directly to the client via the /anonymize endpoint 
and should be stored in the browser's localStorage for later use in restoration.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any


def validate_mapping_format(mapping: dict[str, Any]) -> bool:
    """
    Validate that mapping has the correct format for client storage.
    
    Args:
        mapping: The mapping dictionary to validate
        
    Returns:
        bool: True if valid format, False otherwise
    """
    if not isinstance(mapping, dict):
        return False
    
    columns = mapping.get("columns")
    if not isinstance(columns, dict):
        return False
    
    for col_name, col_mapping in columns.items():
        if not isinstance(col_name, str):
            return False
        if not isinstance(col_mapping, dict):
            return False
        # Each mapping entry should have string keys and values
        for pseudo_key, original_value in col_mapping.items():
            if not isinstance(pseudo_key, str) or not isinstance(original_value, str):
                return False
    
    return True


def create_mapping_with_metadata(mapping: dict[str, dict[str, str]]) -> dict[str, Any]:
    """
    Create a mapping with metadata for client-side storage.
    
    Args:
        mapping: Column to pseudo mapping
        
    Returns:
        dict: Mapping with metadata (created_at, version, etc)
    """
    return {
        "columns": mapping,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "version": "1.0",
    }


def extract_mapping_for_deanonymize(mapping_data: dict[str, Any]) -> dict[str, Any]:
    """
    Extract the mapping data from client-provided mapping for use in deanonymization.
    
    Args:
        mapping_data: Full mapping data from client
        
    Returns:
        dict: Mapping data suitable for deanonymization
    """
    if not isinstance(mapping_data, dict):
        raise ValueError("Mapping must be a dictionary")
    
    # Support both new format (with metadata) and old format (direct columns mapping)
    if "columns" in mapping_data:
        return mapping_data
    
    # If it's just the columns mapping, wrap it
    if validate_mapping_format({"columns": mapping_data}):
        return {"columns": mapping_data}
    
    raise ValueError("Invalid mapping format")

