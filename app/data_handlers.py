"""Handlers for data-transformation and utility nodes."""

# ruff: noqa: ARG001

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import random
import uuid
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from .tasks import do_condition

if TYPE_CHECKING:
    from app.workflow_executor import WorkflowExecutor


# =============================================================================
# Helpers
# =============================================================================


def _as_list(source: Any, input_data: Any) -> list:
    """Resolve the list a node should operate on (explicit source, else node input)."""
    value = source if source not in (None, "") else input_data
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            msg = "List must be a JSON array or a $ reference to a list"
            raise ValueError(msg) from None
    if isinstance(value, dict):
        for key in ("items", "data", "results"):
            if isinstance(value.get(key), list):
                return value[key]
    if isinstance(value, list):
        return value
    msg = (
        f"Expected a list but got {type(value).__name__}. "
        "Set 'List' to a node output that contains a list."
    )
    raise ValueError(msg)


def _get_field(item: Any, path: str) -> Any:
    """Read a dotted path (e.g. ``address.city``) from an item; '' means the item itself."""
    if not path:
        return item
    current = item
    for part in str(path).split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list) and part.isdigit() and int(part) < len(current):
            current = current[int(part)]
        else:
            return None
    return current


def _as_text(value: Any, input_data: Any) -> str:
    value = value if value not in (None, "") else input_data
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, default=str)


def _matches(left: Any, operator: str, right: Any) -> bool:
    if operator == "is_empty":
        return left in (None, "", [], {})
    if operator == "is_not_empty":
        return left not in (None, "", [], {})
    if isinstance(left, bool) and isinstance(right, str):
        right = right.strip().lower() == "true"
    if left is None:
        return operator == "!=" and right not in (None, "")
    try:
        return bool(do_condition(left, operator, right))
    except TypeError:
        return False


def _to_number(value: Any) -> int | float:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return value
    try:
        return float(value)
    except (TypeError, ValueError):
        msg = f"Cannot convert {value!r} to a number"
        raise ValueError(msg) from None


# =============================================================================
# List nodes
# =============================================================================


async def handle_filter(
    params: dict, input_data: Any, engine: WorkflowExecutor
) -> tuple[Any, int]:
    """Keep only the items whose field matches a condition."""
    items = _as_list(params.get("list"), input_data)
    field = params.get("field", "")
    operator = params.get("operator", "==")
    value = params.get("value", "")

    kept = [item for item in items if _matches(_get_field(item, field), operator, value)]
    return {"items": kept, "count": len(kept), "removed": len(items) - len(kept)}, 0


async def handle_sort(
    params: dict, input_data: Any, engine: WorkflowExecutor
) -> tuple[Any, int]:
    """Sort items by a field. Items missing the field always go last."""
    items = _as_list(params.get("list"), input_data)
    field = params.get("field", "")
    descending = params.get("order", "asc") == "desc"

    present = [i for i in items if _get_field(i, field) is not None]
    missing = [i for i in items if _get_field(i, field) is None]

    def key(item: Any) -> tuple:
        v = _get_field(item, field)
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            return (0, v, "")
        return (1, 0, str(v).lower())

    ordered = sorted(present, key=key, reverse=descending) + missing
    return {"items": ordered, "count": len(ordered)}, 0


async def handle_limit(
    params: dict, input_data: Any, engine: WorkflowExecutor
) -> tuple[Any, int]:
    """Keep the first or last N items."""
    items = _as_list(params.get("list"), input_data)
    count = max(int(_to_number(params.get("count", 10))), 0)
    kept = items[-count:] if params.get("keep") == "last" and count else items[:count]
    return {"items": kept, "count": len(kept)}, 0


async def handle_aggregate(
    params: dict, input_data: Any, engine: WorkflowExecutor
) -> tuple[Any, int]:
    """Reduce a list to a single value (count, sum, average, min, max, join, unique)."""
    items = _as_list(params.get("list"), input_data)
    operation = params.get("operation", "count")
    values = [v for v in (_get_field(i, params.get("field", "")) for i in items) if v is not None]

    match operation:
        case "count":
            return len(values), 0
        case "sum":
            return sum(_to_number(v) for v in values), 0
        case "average":
            nums = [_to_number(v) for v in values]
            return (round(sum(nums) / len(nums), 6) if nums else 0), 0
        case "min" | "max":
            if not values:
                return None, 0
            nums = [_to_number(v) for v in values]
            return (min(nums) if operation == "min" else max(nums)), 0
        case "join":
            return str(params.get("separator", ", ")).join(str(v) for v in values), 0
        case "unique":
            seen: list = []
            for v in values:
                if v not in seen:
                    seen.append(v)
            return seen, 0
        case _:
            msg = f"Unknown aggregate operation: {operation}"
            raise ValueError(msg)


# =============================================================================
# Value nodes
# =============================================================================


async def handle_text_ops(
    params: dict, input_data: Any, engine: WorkflowExecutor
) -> tuple[Any, int]:
    """Common string transformations."""
    text = _as_text(params.get("text"), input_data)
    operation = params.get("operation", "uppercase")

    match operation:
        case "uppercase":
            return text.upper(), 0
        case "lowercase":
            return text.lower(), 0
        case "title":
            return text.title(), 0
        case "trim":
            return text.strip(), 0
        case "length":
            return len(text), 0
        case "word_count":
            return len(text.split()), 0
        case "replace":
            find = str(params.get("find", ""))
            if not find:
                msg = "'Find' is required for the replace operation"
                raise ValueError(msg)
            return text.replace(find, str(params.get("replace_with", ""))), 0
        case "split":
            separator = str(params.get("separator", ",")) or None
            return [part.strip() for part in text.split(separator)], 0
        case "truncate":
            limit = max(int(_to_number(params.get("max_length", 100))), 0)
            return (text if len(text) <= limit else text[:limit].rstrip() + "…"), 0
        case _:
            msg = f"Unknown text operation: {operation}"
            raise ValueError(msg)


_UNITS = {"seconds", "minutes", "hours", "days", "weeks"}


def _parse_date(value: Any) -> datetime:
    if value in (None, "", "now"):
        return datetime.now(UTC)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        seconds = value / 1000 if value > 1e12 else value
        return datetime.fromtimestamp(seconds, UTC)
    try:
        parsed = datetime.fromisoformat(str(value).strip())
    except ValueError:
        msg = f"Cannot parse date {value!r}. Use ISO 8601, e.g. 2026-01-31T09:00:00Z"
        raise ValueError(msg) from None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _format_date(dt: datetime, fmt: str) -> str:
    return dt.strftime(fmt) if fmt else dt.isoformat().replace("+00:00", "Z")


async def handle_datetime(
    params: dict, input_data: Any, engine: WorkflowExecutor
) -> tuple[Any, int]:
    """Get, format, shift and compare dates. All times are UTC unless the input has an offset."""
    operation = params.get("operation", "now")
    fmt = str(params.get("format", "") or "")
    unit = params.get("unit", "days")
    if unit not in _UNITS:
        msg = f"Unknown unit: {unit}"
        raise ValueError(msg)

    if operation == "now":
        return _format_date(datetime.now(UTC), fmt), 0

    date = _parse_date(params.get("date"))

    match operation:
        case "format":
            return _format_date(date, fmt), 0
        case "add" | "subtract":
            delta = timedelta(**{unit: _to_number(params.get("amount", 1))})
            shifted = date + delta if operation == "add" else date - delta
            return _format_date(shifted, fmt), 0
        case "difference":
            end = _parse_date(params.get("end_date"))
            seconds = (end - date).total_seconds()
            per_unit = timedelta(**{unit: 1}).total_seconds()
            return round(seconds / per_unit, 4), 0
        case _:
            msg = f"Unknown date operation: {operation}"
            raise ValueError(msg)


async def handle_json(
    params: dict, input_data: Any, engine: WorkflowExecutor
) -> tuple[Any, int]:
    """Parse a JSON string into data, or turn data into a JSON string."""
    raw = params.get("value")
    value = raw if raw not in (None, "") else input_data

    if params.get("operation", "parse") == "stringify":
        indent = 2 if params.get("pretty") else None
        return json.dumps(value, indent=indent, default=str), 0

    if not isinstance(value, str):
        return value, 0
    try:
        return json.loads(value), 0
    except json.JSONDecodeError as e:
        msg = f"Invalid JSON: {e.msg} (line {e.lineno}, column {e.colno})"
        raise ValueError(msg) from None


async def handle_crypto(
    params: dict, input_data: Any, engine: WorkflowExecutor
) -> tuple[Any, int]:
    """Generate IDs and random numbers, hash values, and encode/decode Base64."""
    operation = params.get("operation", "uuid")

    match operation:
        case "uuid":
            return str(uuid.uuid4()), 0
        case "random_number":
            low = int(_to_number(params.get("min", 1)))
            high = int(_to_number(params.get("max", 100)))
            if low > high:
                low, high = high, low
            return random.randint(low, high), 0  # noqa: S311
        case _:
            pass

    text = _as_text(params.get("value"), input_data)
    data = text.encode()

    match operation:
        case "sha256":
            return hashlib.sha256(data).hexdigest(), 0
        case "sha1":
            return hashlib.sha1(data, usedforsecurity=False).hexdigest(), 0
        case "md5":
            return hashlib.md5(data, usedforsecurity=False).hexdigest(), 0
        case "base64_encode":
            return base64.b64encode(data).decode(), 0
        case "base64_decode":
            try:
                return base64.b64decode(data, validate=True).decode(), 0
            except (binascii.Error, UnicodeDecodeError):
                msg = "Value is not valid Base64 text"
                raise ValueError(msg) from None
        case _:
            msg = f"Unknown operation: {operation}"
            raise ValueError(msg)


async def handle_stop_error(
    params: dict, input_data: Any, engine: WorkflowExecutor
) -> tuple[Any, int]:
    """Fail the workflow on purpose with a custom message."""
    message = str(params.get("message") or "").strip() or "Workflow stopped by Stop & Error node"
    raise ValueError(message)


DATA_HANDLERS = {
    "filter": handle_filter,
    "sort": handle_sort,
    "limit": handle_limit,
    "aggregate": handle_aggregate,
    "text_ops": handle_text_ops,
    "datetime": handle_datetime,
    "json": handle_json,
    "crypto": handle_crypto,
    "stop_error": handle_stop_error,
}
