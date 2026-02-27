from datetime import datetime
from typing import Any
from uuid import UUID

from sqlmodel import SQLModel

from app.models.execution import ExecutionStatus
from app.models.execution_node import NodeExecutionStatus


class ExecutionNodeRead(SQLModel):
    id: UUID
    node_id: str
    status: NodeExecutionStatus
    input_data: Any = None
    output_data: Any = None
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class ExecutionRead(SQLModel):
    id: UUID
    workflow_id: UUID
    owner_id: UUID
    status: ExecutionStatus
    workflow_name: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None


class ExecutionDetailRead(ExecutionRead):
    state: dict[str, Any] = {}
    nodes: list[ExecutionNodeRead] = []
