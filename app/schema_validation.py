from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

SCHEMA_MAP = {
    "users": "users.schema.json",
    "orders": "orders.schema.json",
}
SCHEMAS_DIR = Path(__file__).resolve().parents[1] / "schemas"


def load_schema(template: str) -> dict[str, Any]:
    schema_name = SCHEMA_MAP.get(template)
    if schema_name is None:
        raise ValueError(f"Unsupported template: {template}")

    schema_path = SCHEMAS_DIR / schema_name
    if not schema_path.exists():
        raise ValueError(f"Schema file not found: {schema_name}")

    with schema_path.open("r", encoding="utf-8") as schema_file:
        return json.load(schema_file)


def validate_payload(template: str, payload: Any) -> dict[str, Any]:
    schema = load_schema(template)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())

    if isinstance(payload, dict):
        items = [payload]
    elif isinstance(payload, list):
        items = payload
    else:
        raise ValueError("Payload must be a JSON object or array of objects")

    if any(not isinstance(item, dict) for item in items):
        raise ValueError("Each array item must be a JSON object")

    errors: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        for err in validator.iter_errors(item):
            path = ".".join(str(p) for p in err.path) or "$"
            errors.append({
                "index": index,
                "path": path,
                "message": err.message,
            })

    return {
        "valid": len(errors) == 0,
        "template": template,
        "items_checked": len(items),
        "errors": errors,
    }
