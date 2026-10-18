"""Example workflows created for every new account so users can see how the app works."""

from typing import Any
from uuid import UUID

from sqlmodel import Session

from app.models.workflow import Workflow
from app.schemas.nodes import WorkflowPayload


def _node(node_id: str, name: str, node_type: str, x: int, y: int, **parameters: Any) -> dict:
    return {
        "id": node_id,
        "name": name,
        "type": node_type,
        "position": [x, y],
        "parameters": parameters,
    }


def _link(*targets: str) -> list[dict]:
    return [{"node": t, "type": "main", "index": 0} for t in targets]


ORDER_DISCOUNT: dict[str, Any] = {
    "name": "Example: Order discount check",
    "description": (
        "Totals an order, branches on the amount with an IF node, and builds a "
        "message from earlier nodes using $ references."
    ),
    "data": {
        "name": "Example: Order discount check",
        "nodes": [
            _node("start", "Start", "manual_trigger", 0, 200),
            _node(
                "order",
                "Order",
                "set",
                220,
                200,
                value={
                    "customer": "Ada",
                    "items": [
                        {"name": "Mechanical keyboard", "price": 90},
                        {"name": "Wireless mouse", "price": 35},
                        {"name": "USB-C hub", "price": 25},
                    ],
                },
            ),
            _node(
                "total",
                "Order Total",
                "aggregate",
                440,
                200,
                list="$Order.items",
                operation="sum",
                field="price",
            ),
            _node(
                "check",
                "Over 100?",
                "if",
                660,
                200,
                left="$'Order Total'",
                operator=">",
                right="100",
            ),
            _node(
                "discount",
                "Apply Discount",
                "calculate",
                880,
                80,
                operation="mul",
                numbers=["$'Order Total'", 0.9],
            ),
            _node(
                "discount_msg",
                "Discount Message",
                "text_template",
                1100,
                80,
                template=(
                    "Hi $Order.customer! Your order of $$'Order Total' qualifies "
                    "for 10% off, so you pay $$'Apply Discount'."
                ),
            ),
            _node(
                "standard_msg",
                "Standard Message",
                "text_template",
                880,
                320,
                template=(
                    "Hi $Order.customer! Your total is $$'Order Total'. "
                    "Spend over $100 to unlock 10% off."
                ),
            ),
        ],
        "connections": {
            "Start": {"main": [_link("Order")]},
            "Order": {"main": [_link("Order Total")]},
            "Order Total": {"main": [_link("Over 100?")]},
            "Over 100?": {"main": [_link("Apply Discount"), _link("Standard Message")]},
            "Apply Discount": {"main": [_link("Discount Message")]},
        },
    },
}


TASK_DIGEST: dict[str, Any] = {
    "name": "Example: Daily task digest",
    "description": (
        "Filters a task list, sorts it by priority, joins the titles, and writes "
        "a dated summary."
    ),
    "data": {
        "name": "Example: Daily task digest",
        "nodes": [
            _node("start", "Start", "manual_trigger", 0, 200),
            _node("today", "Today", "datetime", 220, 200, operation="now", format="%A, %d %B %Y"),
            _node(
                "tasks",
                "Tasks",
                "set",
                440,
                200,
                value={
                    "tasks": [
                        {"title": "Fix login bug", "status": "open", "priority": 3},
                        {"title": "Write release notes", "status": "done", "priority": 2},
                        {"title": "Review pull request", "status": "open", "priority": 2},
                        {"title": "Update dependencies", "status": "open", "priority": 1},
                        {"title": "Plan the sprint", "status": "done", "priority": 3},
                    ]
                },
            ),
            _node(
                "open",
                "Open Tasks",
                "filter",
                660,
                200,
                list="$Tasks.tasks",
                field="status",
                operator="==",
                value="open",
            ),
            _node(
                "sorted",
                "By Priority",
                "sort",
                880,
                200,
                list="",
                field="priority",
                order="desc",
            ),
            _node(
                "titles",
                "Task Titles",
                "aggregate",
                1100,
                200,
                list="",
                operation="join",
                field="title",
                separator=", ",
            ),
            _node(
                "digest",
                "Digest",
                "text_template",
                1320,
                200,
                template=(
                    "Digest for $Today: $'Open Tasks'.count open tasks. "
                    "In priority order: $'Task Titles'."
                ),
            ),
        ],
        "connections": {
            "Start": {"main": [_link("Today")]},
            "Today": {"main": [_link("Tasks")]},
            "Tasks": {"main": [_link("Open Tasks")]},
            "Open Tasks": {"main": [_link("By Priority")]},
            "By Priority": {"main": [_link("Task Titles")]},
            "Task Titles": {"main": [_link("Digest")]},
        },
    },
}

STARTER_WORKFLOWS = [ORDER_DISCOUNT, TASK_DIGEST]


def add_starter_workflows(session: Session, owner_id: UUID) -> None:
    """Stage the example workflows for a user; the caller commits."""
    for template in STARTER_WORKFLOWS:
        payload = WorkflowPayload.model_validate(template["data"])
        session.add(
            Workflow(
                name=template["name"],
                description=template["description"],
                owner_id=owner_id,
                data=payload.model_dump(),
            )
        )
