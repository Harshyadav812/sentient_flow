import re

import pytest
from sqlmodel import select

from app.core.rate_limit import rate_limiter
from app.data_handlers import (
    handle_aggregate,
    handle_crypto,
    handle_datetime,
    handle_filter,
    handle_json,
    handle_limit,
    handle_sort,
    handle_text_ops,
)
from app.models.workflow import Workflow
from app.schemas.nodes import WorkflowPayload
from app.starter_workflows import ORDER_DISCOUNT, TASK_DIGEST
from app.workflow_engine import WorkflowEngine

PEOPLE = [
    {"name": "Ann", "age": 31, "active": True, "city": {"name": "Oslo"}},
    {"name": "bob", "age": 17, "active": False, "city": {"name": "Rome"}},
    {"name": "Cy", "active": True},
]


async def run(handler, input_data=None, **params):
    result, output_index = await handler(params, input_data, None)
    assert output_index == 0
    return result


@pytest.mark.asyncio
async def test_filter_by_field_and_nested_path():
    adults = await run(handle_filter, list=PEOPLE, field="age", operator=">=", value="18")
    assert [p["name"] for p in adults["items"]] == ["Ann"]
    assert adults["removed"] == 2

    active = await run(handle_filter, PEOPLE, field="active", operator="==", value="true")
    assert active["count"] == 2

    oslo = await run(handle_filter, {"items": PEOPLE}, field="city.name", operator="==", value="Oslo")
    assert oslo["count"] == 1

    missing = await run(handle_filter, PEOPLE, field="age", operator="is_empty")
    assert [p["name"] for p in missing["items"]] == ["Cy"]


@pytest.mark.asyncio
async def test_filter_rejects_non_list():
    with pytest.raises(ValueError, match="Expected a list"):
        await run(handle_filter, list=42, field="x", operator="==", value="1")


@pytest.mark.asyncio
async def test_sort_puts_missing_last_and_ignores_case():
    by_age = await run(handle_sort, PEOPLE, field="age", order="desc")
    assert [p["name"] for p in by_age["items"]] == ["Ann", "bob", "Cy"]

    by_name = await run(handle_sort, PEOPLE, field="name", order="asc")
    assert [p["name"] for p in by_name["items"]] == ["Ann", "bob", "Cy"]


@pytest.mark.asyncio
async def test_limit_first_and_last():
    assert (await run(handle_limit, [1, 2, 3, 4], count=2))["items"] == [1, 2]
    assert (await run(handle_limit, [1, 2, 3, 4], count=2, keep="last"))["items"] == [3, 4]


@pytest.mark.asyncio
async def test_aggregate_operations():
    nums = [{"v": 2}, {"v": 4}, {"v": "6"}, {"x": 1}]
    assert await run(handle_aggregate, nums, operation="sum", field="v") == 12
    assert await run(handle_aggregate, nums, operation="average", field="v") == 4
    assert await run(handle_aggregate, nums, operation="max", field="v") == 6
    assert await run(handle_aggregate, nums, operation="count", field="v") == 3
    assert await run(handle_aggregate, ["a", "b", "a"], operation="unique") == ["a", "b"]
    assert await run(handle_aggregate, PEOPLE, operation="join", field="name", separator=" / ") == "Ann / bob / Cy"


@pytest.mark.asyncio
async def test_text_operations():
    assert await run(handle_text_ops, "  hi there ", operation="trim") == "hi there"
    assert await run(handle_text_ops, text="a-b-c", operation="replace", find="-", replace_with="+") == "a+b+c"
    assert await run(handle_text_ops, text="a, b,c", operation="split", separator=",") == ["a", "b", "c"]
    assert await run(handle_text_ops, text="one two  three", operation="word_count") == 3
    assert await run(handle_text_ops, text="abcdef", operation="truncate", max_length=3) == "abc…"


@pytest.mark.asyncio
async def test_datetime_operations():
    base = "2026-01-30T10:00:00Z"
    assert await run(handle_datetime, operation="add", date=base, amount=3, unit="days") == "2026-02-02T10:00:00Z"
    assert await run(handle_datetime, operation="format", date=base, format="%d/%m/%Y") == "30/01/2026"
    assert await run(
        handle_datetime, operation="difference", date=base, end_date="2026-01-30T16:00:00Z", unit="hours"
    ) == 6
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T.*Z", await run(handle_datetime, operation="now"))
    with pytest.raises(ValueError, match="Cannot parse date"):
        await run(handle_datetime, operation="format", date="next tuesday")


@pytest.mark.asyncio
async def test_json_and_crypto():
    assert await run(handle_json, operation="parse", value='{"a": [1, 2]}') == {"a": [1, 2]}
    assert await run(handle_json, {"a": 1}, operation="stringify") == '{"a": 1}'
    with pytest.raises(ValueError, match="Invalid JSON"):
        await run(handle_json, operation="parse", value="{nope")

    encoded = await run(handle_crypto, operation="base64_encode", value="hello")
    assert encoded == "aGVsbG8="
    assert await run(handle_crypto, operation="base64_decode", value=encoded) == "hello"
    assert len(await run(handle_crypto, operation="sha256", value="x")) == 64
    assert 5 <= await run(handle_crypto, operation="random_number", min=5, max=7) <= 7


async def run_workflow(data: dict) -> dict:
    return await WorkflowEngine(workflow=WorkflowPayload.model_validate(data)).run()


@pytest.mark.asyncio
async def test_order_discount_example_runs():
    state = await run_workflow(ORDER_DISCOUNT["data"])
    assert state["Order Total"] == 150
    assert state["Apply Discount"] == 135
    assert state["Discount Message"] == (
        "Hi Ada! Your order of $150 qualifies for 10% off, so you pay $135."
    )
    assert state["Standard Message"] == {"status": "skipped"}


@pytest.mark.asyncio
async def test_task_digest_example_runs():
    state = await run_workflow(TASK_DIGEST["data"])
    assert state["Open Tasks"]["count"] == 3
    assert state["Task Titles"] == "Fix login bug, Review pull request, Update dependencies"
    assert state["Digest"].startswith(f"Digest for {state['Today']}: 3 open tasks.")


@pytest.mark.asyncio
async def test_stop_error_fails_the_run():
    state = await run_workflow(
        {
            "nodes": [
                {"id": "1", "name": "Start", "type": "manual_trigger"},
                {"id": "2", "name": "Stop", "type": "stop_error", "parameters": {"message": "No data"}},
            ],
            "connections": {"Start": {"main": [[{"node": "Stop"}]]}},
        }
    )
    assert state["Stop"] == {"error": "No data"}


def test_register_creates_example_workflows(client, session):
    rate_limiter._requests.clear()
    res = client.post("/auth/register", json={"email": "new@example.com", "password": "Password123!"})
    assert res.status_code == 200, res.text

    workflows = session.exec(select(Workflow)).all()
    assert sorted(w.name for w in workflows) == [
        "Example: Daily task digest",
        "Example: Order discount check",
    ]
    assert all(str(w.owner_id) == res.json()["id"] for w in workflows)
