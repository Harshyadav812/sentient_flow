import pytest

from app.schemas.nodes import ConnectionTarget, Node, WorkflowPayload
from app.workflow_engine import WorkflowEngine


@pytest.mark.asyncio
async def test_engine_skip_signal_propagation():
    """
    Test that a condition node correctly routes execution,
    skips the unselected branch, and allows the merge node to fire.
    """
    # ---------------------------------------------------------
    # 1. SETUP: Create the nodes for a diamond workflow
    # ---------------------------------------------------------
    node_start = Node(id="1", name="Start", type="manual_trigger", parameters={})
    node_set = Node(
        id="2", name="Set User", type="set", parameters={"value": {"age": 25}}
    )
    node_if = Node(
        id="3",
        name="Check Age",
        type="condition",
        parameters={"left": "$'Set User'.age", "operator": ">", "right": 20},
    )
    node_true = Node(
        id="4", name="Adult Path", type="set", parameters={"value": {"status": "Adult"}}
    )
    node_false = Node(
        id="5", name="Child Path", type="set", parameters={"value": {"status": "Child"}}
    )
    node_merge = Node(
        id="6", name="Merge Result", type="merge", parameters={"mode": "append"}
    )

    # ---------------------------------------------------------
    # 2. SETUP: Connect the nodes
    # Check Age splits into Output 0 (Adult) and Output 1 (Child)
    # Both paths then connect to the Merge Result node.
    # ---------------------------------------------------------
    connections = {
        "Start": {"main": [[ConnectionTarget(node="Set User")]]},
        "Set User": {"main": [[ConnectionTarget(node="Check Age")]]},
        "Check Age": {
            "main": [
                [ConnectionTarget(node="Adult Path")],  # Output index 0 (True)
                [ConnectionTarget(node="Child Path")],  # Output index 1 (False)
            ]
        },
        "Adult Path": {"main": [[ConnectionTarget(node="Merge Result")]]},
        "Child Path": {"main": [[ConnectionTarget(node="Merge Result")]]},
    }

    # Create the payload
    payload = WorkflowPayload(
        name="Diamond Workflow Test",
        nodes=[node_start, node_set, node_if, node_true, node_false, node_merge],
        connections=connections,
    )

    # ---------------------------------------------------------
    # 3. ACT: Initialize and run the engine
    # ---------------------------------------------------------
    engine = WorkflowEngine(payload)
    results = await engine.run()

    # ---------------------------------------------------------
    # 4. ASSERT: Verify the execution state
    # ---------------------------------------------------------
    # The condition should evaluate to True (25 > 20)
    assert results["Check Age"]["condition_result"] is True

    # The True path should have executed normally
    assert results["Adult Path"] == {"status": "Adult"}

    # The False path should have been skipped entirely
    assert results["Child Path"] == {"status": "skipped"}

    # The Merge Node should not deadlock!
    # It should receive the Adult data, filter out the Child's skip signal,
    # and return a clean flattened list.
    assert results["Merge Result"] == [{"status": "Adult"}]
