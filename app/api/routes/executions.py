"""API routes for execution history."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import desc, select

from app.api.deps import CurrentUser, SessionDep
from app.models.execution import Execution
from app.models.workflow import Workflow
from app.schemas.execution import ExecutionDetailRead, ExecutionRead

router = APIRouter()


@router.get("/", response_model=list[ExecutionRead])
def read_all_executions(
    current_user: CurrentUser,
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=50)] = 20,
):
    """List ALL executions for the current user, across all workflows."""
    statement = (
        select(Execution, Workflow.name)
        .join(Workflow, Execution.workflow_id == Workflow.id)
        .where(Execution.owner_id == current_user.id)
        .order_by(desc(Execution.created_at))
        .offset(offset)
        .limit(limit)
    )

    rows = session.exec(statement).all()

    return [
        ExecutionRead(
            id=ex.id,
            workflow_id=ex.workflow_id,
            owner_id=ex.owner_id,
            status=ex.status,
            workflow_name=wf_name,
            created_at=ex.created_at,
            started_at=ex.started_at,
            finished_at=ex.finished_at,
        )
        for ex, wf_name in rows
    ]


@router.get("/{execution_id}", response_model=ExecutionDetailRead)
def read_execution(
    execution_id: UUID,
    current_user: CurrentUser,
    session: SessionDep,
):
    """Get the full details of a specific execution."""
    execution = session.get(Execution, execution_id)

    if not execution or execution.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Execution not found")

    return execution
