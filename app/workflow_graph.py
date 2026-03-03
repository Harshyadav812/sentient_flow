"""
Pure workflow graph topology — no DB, no execution state, no side effects.

Built once from a ``WorkflowPayload``, reusable across executions.
"""

from __future__ import annotations

from collections import deque
from functools import cached_property
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.schemas.nodes import ConnectionTarget, Node, WorkflowPayload


class WorkflowGraph:
    """Immutable DAG representation of a workflow."""

    def __init__(self, workflow: WorkflowPayload) -> None:
        self._workflow = workflow
        self._node_map: dict[str, Node] = {n.name: n for n in workflow.nodes}
        self._connections = workflow.connections

        # Pre-compute adjacency lists once
        self._adjacency = self._build_adjacency()
        self._reverse_adjacency = self._build_reverse_adjacency()

        # Validate on construction
        self._detect_cycles()

    # ------------------------------------------------------------------
    # Adjacency builders
    # ------------------------------------------------------------------

    def _build_adjacency(self) -> dict[str, list[str]]:
        """Forward adjacency: node → list of all direct children."""
        adj: dict[str, list[str]] = {name: [] for name in self._node_map}
        for source, connections in self._connections.items():
            for connection_type in connections.values():
                for output_index_list in connection_type:
                    for target in output_index_list:
                        if source in adj:
                            adj[source].append(target.node)
        return adj

    def _build_reverse_adjacency(self) -> dict[str, list[str]]:
        """Reverse adjacency: node → list of all direct parents."""
        rev: dict[str, list[str]] = {name: [] for name in self._node_map}
        for source, connections in self._connections.items():
            for connection_type in connections.values():
                for output_index_list in connection_type:
                    for target in output_index_list:
                        if target.node in rev:
                            rev[target.node].append(source)
        return rev

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def _detect_cycles(self) -> None:
        """Detect cycles using DFS with 3-colour marking."""
        white, gray, black = 0, 1, 2
        colour = dict.fromkeys(self._adjacency, white)

        def dfs(node: str) -> str | None:
            colour[node] = gray
            for neighbour in self._adjacency.get(node, []):
                if colour.get(neighbour) == gray:
                    return neighbour
                if colour.get(neighbour) == white:
                    cycle_node = dfs(neighbour)
                    if cycle_node is not None:
                        return cycle_node
            colour[node] = black
            return None

        for node_name in self._adjacency:
            if colour[node_name] == white:
                cycle_node = dfs(node_name)
                if cycle_node is not None:
                    msg = (
                        f"Invalid workflow: cycle detected involving node "
                        f"'{cycle_node}'. Remove circular connections."
                    )
                    raise ValueError(msg)

    # ------------------------------------------------------------------
    # Cached properties (computed once)
    # ------------------------------------------------------------------

    @cached_property
    def trigger_node_name(self) -> str | None:
        """Return the name of the first trigger node, or ``None``."""
        trigger_types = {"manual_trigger", "manualtrigger", "webhook"}
        return next(
            (
                node.name
                for node in self._workflow.nodes
                if node.type.lower() in trigger_types
                or any(t in node.type.lower() for t in trigger_types)
            ),
            None,
        )

    @cached_property
    def in_degrees(self) -> dict[str, int]:
        """In-degree for every node (how many incoming connections)."""
        deg: dict[str, int] = dict.fromkeys(self._node_map, 0)
        for _source, connections in self._connections.items():
            for connection_type in connections.values():
                for output_index_list in connection_type:
                    for target in output_index_list:
                        if target.node in deg:
                            deg[target.node] += 1

        # The trigger node gets a virtual in-degree of 1
        trigger = self.trigger_node_name
        if trigger is not None:
            deg[trigger] = 1
        return deg

    # Node accessors

    @property
    def node_names(self) -> set[str]:
        return set(self._node_map.keys())

    @property
    def nodes(self) -> dict[str, Node]:
        return self._node_map

    def get_node(self, name: str) -> Node | None:
        return self._node_map.get(name)

    # ------------------------------------------------------------------
    # Forward traversal
    # ------------------------------------------------------------------

    def get_children(self, node_name: str, output_index: int = 0) -> list[str]:
        """Children connected to a specific output port."""
        connections_data = self._connections.get(node_name)
        if not connections_data or "main" not in connections_data:
            return []
        main = connections_data["main"]
        if output_index < len(main):
            return [t.node for t in main[output_index]]
        return []

    def get_all_children(self, node_name: str) -> list[str]:
        """All children across every output port."""
        connections_data = self._connections.get(node_name)
        if not connections_data or "main" not in connections_data:
            return []
        children: list[str] = []
        for output_list in connections_data["main"]:
            for target in output_list:
                children.append(target.node)
        return children

    def get_skipped_children(
        self, node_name: str, active_output_index: int
    ) -> list[str]:
        """Children on non-active output ports (for IF / Switch nodes)."""
        connections_data = self._connections.get(node_name)
        if not connections_data or "main" not in connections_data:
            return []
        skipped: list[str] = []
        for i, output_list in enumerate(connections_data["main"]):
            if i != active_output_index:
                for target in output_list:
                    skipped.append(target.node)
        return skipped

    # ------------------------------------------------------------------
    # Backward traversal
    # ------------------------------------------------------------------

    def get_immediate_parents(self, node_name: str) -> list[str]:
        """Direct parents (depth 1) via reverse adjacency."""
        return list(self._reverse_adjacency.get(node_name, []))

    def get_parent_nodes(self, node_name: str) -> list[str]:
        """All ancestor nodes via BFS backward traversal."""
        visited: set[str] = set()
        queue: deque[str] = deque(self._reverse_adjacency.get(node_name, []))
        ancestors: list[str] = []

        while queue:
            current = queue.popleft()
            if current in visited:
                continue
            visited.add(current)
            ancestors.append(current)
            for parent in self._reverse_adjacency.get(current, []):
                if parent not in visited:
                    queue.append(parent)

        return ancestors
