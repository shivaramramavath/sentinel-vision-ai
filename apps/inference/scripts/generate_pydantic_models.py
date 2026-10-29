"""
Script to generate Python Pydantic v2 models from the exported JSON Schemas in packages/generated-json-schema.
This ensures `packages/shared-types` remains the single source of truth for both TypeScript and Python.
"""
import json
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
JSON_SCHEMA_DIR = ROOT_DIR / "packages" / "generated-json-schema"
OUTPUT_FILE = ROOT_DIR / "apps" / "inference" / "src" / "sentinel_inference" / "schemas" / "generated.py"

TYPE_MAP = {
    "string": "str",
    "integer": "int",
    "number": "float",
    "boolean": "bool",
    "null": "None",
}


def pythonic_type(prop: dict, title_prefix: str = "") -> str:
    """Map a JSON schema property definition to a Python type annotation."""
    if "$ref" in prop:
        ref_name = prop["$ref"].split("/")[-1]
        return ref_name

    p_type = prop.get("type")

    # Enum
    if "enum" in prop:
        values = prop["enum"]
        literals = ", ".join(f'"{v}"' if isinstance(v, str) else str(v) for v in values)
        return f"Literal[{literals}]"

    # Any / unknown
    if not p_type:
        return "Any"

    # Primitive
    if isinstance(p_type, str) and p_type in TYPE_MAP:
        # String format check
        if p_type == "string" and prop.get("format") == "date-time":
            return "datetime"
        return TYPE_MAP[p_type]

    # Array
    if p_type == "array":
        items = prop.get("items")
        if isinstance(items, list):
            # Tuple
            tuple_types = [pythonic_type(it, title_prefix) for it in items]
            return f"tuple[{', '.join(tuple_types)}]"
        elif isinstance(items, dict):
            inner = pythonic_type(items, title_prefix)
            return f"list[{inner}]"
        return "list[Any]"

    # Nested object
    if p_type == "object":
        return "dict[str, Any]"

    return "Any"


def generate_models() -> str:
    lines = [
        '"""',
        "AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.",
        "Generated from packages/generated-json-schema (Zod JSON-Schema single source of truth).",
        '"""',
        "from __future__ import annotations",
        "",
        "from datetime import datetime",
        "from typing import Any, Generic, Literal, TypeVar",
        "from pydantic import BaseModel, Field",
        "",
        "T = TypeVar('T')",
        "",
    ]

    schema_files = sorted(list(JSON_SCHEMA_DIR.glob("*.json")))

    for fpath in schema_files:
        if fpath.name == "contracts.json":
            continue

        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)

        title = data.get("title", fpath.stem)
        description = data.get("description", "")
        properties = data.get("properties", {})
        required = set(data.get("required", []))

        # Check if model has additional generic handling or special envelope
        if title == "EventEnvelope":
            lines.extend([
                f"class {title}(BaseModel, Generic[T]):",
                '    """Canonical event envelope for Sentinel Vision AI messages."""',
            ])
            for prop_name, prop_def in properties.items():
                if prop_name == "payload":
                    lines.append("    payload: T")
                else:
                    py_t = pythonic_type(prop_def, title)
                    if prop_name not in required:
                        py_t = f"{py_t} | None"
                        lines.append(f"    {prop_name}: {py_t} = None")
                    else:
                        lines.append(f"    {prop_name}: {py_t}")
            lines.append("")
            lines.append("    model_config = {'populate_by_name': True}")
            lines.append("")
            continue

        lines.append(f"class {title}(BaseModel):")
        if description:
            lines.append(f'    """{description}"""')

        if not properties:
            lines.append("    pass")
            lines.append("")
            continue

        for prop_name, prop_def in properties.items():
            py_t = pythonic_type(prop_def, title)
            is_req = prop_name in required

            # Handle defaults or optional
            default_val = prop_def.get("default")
            if default_val is not None:
                if isinstance(default_val, str):
                    lines.append(f'    {prop_name}: {py_t} = "{default_val}"')
                else:
                    lines.append(f"    {prop_name}: {py_t} = {default_val}")
            elif not is_req:
                lines.append(f"    {prop_name}: {py_t} | None = None")
            else:
                lines.append(f"    {prop_name}: {py_t}")

        lines.append("")
        lines.append("    model_config = {'populate_by_name': True}")
        lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    if not JSON_SCHEMA_DIR.exists():
        print(f"Error: JSON schema directory {JSON_SCHEMA_DIR} not found.")
        sys.exit(1)

    code = generate_models()
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(code)

    print(f"Generated Pydantic models at: {OUTPUT_FILE}")
