"""MongoDB repository adapters.

Each class mirrors the interface of the corresponding Json*Repository in json_files.py
but persists data to a MongoDB collection via pymongo.

Usage (configured through deps.py when STORAGE_BACKEND=mongo):
    client = pymongo.MongoClient(settings.mongo_uri)
    db = client[settings.mongo_db]
    agents = MongoAgentRepository(db)
"""
from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

import pymongo

from backend.domain.enums import AgentStatus, TaskStatus
from backend.domain.models import (
    ActivityFeedItem,
    Agent,
    Analytics,
    Message,
    Skill,
    Task,
    Team,
)
from backend.domain.memory.knowledge_graph import (
    ConversationKnowledgeGraph,
    GraphContextConfig,
    GraphEdge,
    GraphNode,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_iso_utc(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _default_agent_system_prompt(*, name: str, role: str, description: str) -> str:
    return (
        f"You are {name}, working as a {role}. "
        f"Your mission: {description.strip() or f'perform the responsibilities of a {role}'}. "
        "Provide concise, practical, and high-quality outputs. "
        "When information is missing, ask targeted follow-up questions before acting."
    )


def _doc_to_agent(item: dict[str, Any]) -> Agent:
    return Agent(
        id=str(item["id"]),
        name=str(item.get("name", "")),
        role=str(item.get("role", "")),
        description=str(item.get("description", "")),
        skill_ids=[str(x) for x in (item.get("skillIds") or [])],
        status=AgentStatus(str(item.get("status", "idle"))),
        avatar=str(item.get("avatar", "A")),
        avatar_icon=str(item.get("avatar_icon", "") or ""),
        avatar_color=str(item.get("avatar_color", "") or ""),
        avatar_url=str(item.get("avatar_url", "") or ""),
        system_prompt=(
            str(item.get("system_prompt", "")).strip()
            or _default_agent_system_prompt(
                name=str(item.get("name", "")),
                role=str(item.get("role", "")),
                description=str(item.get("description", "")),
            )
        ),
    )


def _agent_to_doc(a: Agent) -> dict[str, Any]:
    return {
        "id": a.id,
        "_id": a.id,
        "name": a.name,
        "role": a.role,
        "description": a.description,
        "skillIds": list(a.skill_ids),
        "status": a.status.value,
        "avatar": a.avatar,
        "avatar_icon": a.avatar_icon,
        "avatar_color": a.avatar_color,
        "avatar_url": a.avatar_url,
        "system_prompt": a.system_prompt
        or _default_agent_system_prompt(name=a.name, role=a.role, description=a.description),
    }


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class MongoAgentRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["agents"]
        self._col.create_index("id", unique=True, background=True)

    def list(self) -> list[Agent]:
        return [_doc_to_agent(doc) for doc in self._col.find()]

    def get(self, agent_id: str) -> Agent | None:
        doc = self._col.find_one({"id": agent_id})
        return _doc_to_agent(doc) if doc else None

    def upsert(self, agent: Agent) -> Agent:
        self._col.replace_one({"id": agent.id}, _agent_to_doc(agent), upsert=True)
        return agent

    def delete(self, agent_id: str) -> None:
        self._col.delete_one({"id": agent_id})


# ---------------------------------------------------------------------------
# Skill
# ---------------------------------------------------------------------------

class MongoSkillRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["skills"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_skill(self, item: dict[str, Any]) -> Skill:
        return Skill(
            id=str(item["id"]),
            name=str(item.get("name", "")),
            description=str(item.get("description", "")),
            third_party=str(item.get("third_party", "")),
            kind=str(item.get("kind", "integration")),
            config=dict(item.get("config") or {}),
            avatar=str(item.get("avatar", "") or str(item.get("name", "") or "S")[:1].upper()),
            avatar_icon=str(item.get("avatar_icon", "") or ""),
            avatar_color=str(item.get("avatar_color", "") or ""),
            avatar_url=str(item.get("avatar_url", "") or ""),
            tool_name=(str(item.get("tool_name")) if item.get("tool_name") is not None else None),
            code=(str(item.get("code")) if item.get("code") is not None else None),
        )

    def _skill_to_doc(self, s: Skill) -> dict[str, Any]:
        return {
            "id": s.id,
            "_id": s.id,
            "name": s.name,
            "description": s.description,
            "third_party": s.third_party,
            "kind": s.kind,
            "avatar": s.avatar,
            "avatar_icon": s.avatar_icon,
            "avatar_color": s.avatar_color,
            "avatar_url": s.avatar_url,
            "tool_name": s.tool_name,
            "config": dict(s.config or {}),
            "code": s.code,
        }

    def list(self) -> list[Skill]:
        return [self._doc_to_skill(doc) for doc in self._col.find()]

    def get(self, skill_id: str) -> Skill | None:
        doc = self._col.find_one({"id": skill_id})
        return self._doc_to_skill(doc) if doc else None

    def upsert(self, skill: Skill) -> Skill:
        self._col.replace_one({"id": skill.id}, self._skill_to_doc(skill), upsert=True)
        return skill

    def delete(self, skill_id: str) -> None:
        self._col.delete_one({"id": skill_id})


# ---------------------------------------------------------------------------
# Team
# ---------------------------------------------------------------------------

class MongoTeamRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["teams"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_team(self, item: dict[str, Any]) -> Team:
        return Team(
            id=str(item["id"]),
            name=str(item.get("name", "")),
            description=str(item.get("description", "")),
            agents=[str(x) for x in (item.get("agents") or [])],
            active_tasks=int(item.get("activeTasks", 0)),
            avatar=str(item.get("avatar", "") or str(item.get("name", "") or "T")[:1].upper()),
            avatar_icon=str(item.get("avatar_icon", "") or ""),
            avatar_color=str(item.get("avatar_color", "") or ""),
            avatar_url=str(item.get("avatar_url", "") or ""),
            mode=str(item.get("mode", "sequential")),
            max_steps=int(item.get("maxSteps", 6)),
        )

    def _team_to_doc(self, t: Team) -> dict[str, Any]:
        return {
            "id": t.id,
            "_id": t.id,
            "name": t.name,
            "description": t.description,
            "agents": list(t.agents),
            "activeTasks": t.active_tasks,
            "avatar": t.avatar,
            "avatar_icon": t.avatar_icon,
            "avatar_color": t.avatar_color,
            "avatar_url": t.avatar_url,
            "mode": t.mode,
            "maxSteps": t.max_steps,
        }

    def list(self) -> list[Team]:
        return [self._doc_to_team(doc) for doc in self._col.find()]

    def get(self, team_id: str) -> Team | None:
        doc = self._col.find_one({"id": team_id})
        return self._doc_to_team(doc) if doc else None

    def upsert(self, team: Team) -> Team:
        self._col.replace_one({"id": team.id}, self._team_to_doc(team), upsert=True)
        return team

    def delete(self, team_id: str) -> None:
        self._col.delete_one({"id": team_id})


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

class MongoTaskRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["tasks"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_task(self, item: dict[str, Any]) -> Task:
        return Task(
            id=str(item["id"]),
            title=str(item.get("title", "")),
            description=str(item.get("description", "")),
            team_id=str(item.get("teamId", "")),
            status=TaskStatus(str(item.get("status", "pending"))),
            progress=int(item.get("progress", 0)),
            assigned_agents=[str(x) for x in (item.get("assignedAgents") or [])],
            start_time=_parse_iso_utc(str(item["startTime"])) if item.get("startTime") else None,
            end_time=_parse_iso_utc(str(item["endTime"])) if item.get("endTime") else None,
        )

    def _task_to_doc(self, t: Task) -> dict[str, Any]:
        return {
            "id": t.id,
            "_id": t.id,
            "title": t.title,
            "description": t.description,
            "teamId": t.team_id,
            "status": t.status.value,
            "progress": t.progress,
            "assignedAgents": list(t.assigned_agents),
            "startTime": t.start_time.isoformat() if t.start_time else None,
            "endTime": t.end_time.isoformat() if t.end_time else None,
        }

    def list(self) -> list[Task]:
        return [self._doc_to_task(doc) for doc in self._col.find()]

    def get(self, task_id: str) -> Task | None:
        doc = self._col.find_one({"id": task_id})
        return self._doc_to_task(doc) if doc else None

    def upsert(self, task: Task) -> Task:
        self._col.replace_one({"id": task.id}, self._task_to_doc(task), upsert=True)
        return task

    def delete(self, task_id: str) -> None:
        self._col.delete_one({"id": task_id})


# ---------------------------------------------------------------------------
# Conversation (Messages)
# ---------------------------------------------------------------------------

class MongoConversationRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["conversations"]
        self._col.create_index("id", unique=True, background=True)
        self._col.create_index("taskId", background=True)

    def _doc_to_message(self, item: dict[str, Any]) -> Message:
        ts = str(item.get("timestamp") or "")
        dt = _parse_iso_utc(ts) if ts else datetime.now(timezone.utc).replace(microsecond=0)
        return Message(
            id=str(item["id"]),
            agent_id=str(item.get("agentId", "")),
            content=str(item.get("content", "")),
            timestamp=dt,
            task_id=(str(item.get("taskId")) if item.get("taskId") is not None else None),
        )

    def _message_to_doc(self, m: Message) -> dict[str, Any]:
        return {
            "id": m.id,
            "_id": m.id,
            "agentId": m.agent_id,
            "content": m.content,
            "timestamp": m.timestamp.isoformat(),
            "taskId": m.task_id,
        }

    def list(self, task_id: str | None = None) -> list[Message]:
        query = {"taskId": task_id} if task_id is not None else {}
        return [self._doc_to_message(doc) for doc in self._col.find(query)]

    def add(self, message: Message) -> Message:
        self._col.replace_one({"id": message.id}, self._message_to_doc(message), upsert=True)
        return message

    def delete_by_task(self, task_id: str) -> None:
        self._col.delete_many({"taskId": task_id})


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

class MongoAnalyticsRepository:
    _SINGLETON_ID = "singleton"

    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["analytics"]

    def _load(self) -> Analytics:
        doc = self._col.find_one({"_id": self._SINGLETON_ID}) or {}
        return Analytics(
            tasks_completed=int(doc.get("tasksCompleted", 0)),
            avg_completion_time=str(doc.get("avgCompletionTime", "")),
            team_efficiency=int(doc.get("teamEfficiency", 0)),
            agent_productivity={str(k): int(v) for k, v in (doc.get("agentProductivity") or {}).items()},
        )

    def get(self) -> Analytics:
        return self._load()

    def set(self, analytics: Analytics) -> Analytics:
        self._col.replace_one(
            {"_id": self._SINGLETON_ID},
            {
                "_id": self._SINGLETON_ID,
                "tasksCompleted": analytics.tasks_completed,
                "avgCompletionTime": analytics.avg_completion_time,
                "teamEfficiency": analytics.team_efficiency,
                "agentProductivity": dict(analytics.agent_productivity),
            },
            upsert=True,
        )
        return analytics


# ---------------------------------------------------------------------------
# Activity Feed
# ---------------------------------------------------------------------------

class MongoActivityFeedRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["activity_feed"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_item(self, item: dict[str, Any]) -> ActivityFeedItem:
        return ActivityFeedItem(
            id=str(item["id"]),
            agent_id=str(item.get("agentId", "")),
            action=str(item.get("action", "")),
            time=str(item.get("time", "")),
        )

    def _item_to_doc(self, i: ActivityFeedItem) -> dict[str, Any]:
        return {
            "id": i.id,
            "_id": i.id,
            "agentId": i.agent_id,
            "action": i.action,
            "time": i.time,
        }

    def list(self) -> list[ActivityFeedItem]:
        return [self._doc_to_item(doc) for doc in self._col.find().sort("_id", -1)]

    def add(self, item: ActivityFeedItem) -> ActivityFeedItem:
        self._col.replace_one({"id": item.id}, self._item_to_doc(item), upsert=True)
        return item


# ---------------------------------------------------------------------------
# Graph Knowledge
# ---------------------------------------------------------------------------

class MongoGraphKnowledgeRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._graphs_col = db["graph_knowledge"]
        self._events_col = db["graph_knowledge_events"]
        self._graphs_col.create_index("conversation_id", unique=True, background=True)
        self._events_col.create_index("conversation_id", background=True)

    # ---- Graphs ----

    def get(self, conversation_id: str) -> ConversationKnowledgeGraph | None:
        doc = self._graphs_col.find_one({"conversation_id": conversation_id})
        if not doc:
            return None
        return self._deserialize_graph(conversation_id, doc)

    def upsert(self, graph: ConversationKnowledgeGraph) -> ConversationKnowledgeGraph:
        payload = self._serialize_graph(graph)
        self._graphs_col.replace_one(
            {"conversation_id": graph.conversation_id}, payload, upsert=True
        )
        return graph

    def delete(self, conversation_id: str) -> None:
        self._graphs_col.delete_one({"conversation_id": conversation_id})
        self._events_col.delete_many({"conversation_id": conversation_id})

    # ---- Events ----

    def append_event(self, conversation_id: str, event: dict[str, object]) -> None:
        self._events_col.insert_one({"conversation_id": conversation_id, **event})

    # ---- Serialization ----

    def _serialize_graph(self, graph: ConversationKnowledgeGraph) -> dict[str, Any]:
        return {
            "_id": graph.conversation_id,
            "conversation_id": graph.conversation_id,
            "version": graph.version,
            "schema_version": graph.schema_version,
            "last_message_index": graph.last_message_index,
            "config": asdict(graph.config),
            "nodes": [asdict(node) for node in graph.nodes.values()],
            "edges": [asdict(edge) for edge in graph.edges.values()],
            "chunks": graph.chunks,
            "message_ids": list(graph.message_ids),
            "updated_at": graph.updated_at,
        }

    def _deserialize_graph(self, conversation_id: str, raw: dict[str, Any]) -> ConversationKnowledgeGraph | None:
        raw_config = raw.get("config")
        config = GraphContextConfig()
        if isinstance(raw_config, dict):
            try:
                config = GraphContextConfig(**raw_config).normalized()
            except TypeError:
                config = GraphContextConfig()

        graph = ConversationKnowledgeGraph(
            conversation_id=str(raw.get("conversation_id") or conversation_id),
            version=int(raw.get("version") or 1),
            schema_version=int(raw.get("schema_version") or 1),
            last_message_index=int(raw.get("last_message_index") or 0),
            config=config,
            message_ids=[str(m) for m in (raw.get("message_ids") or [])],
            updated_at=str(raw.get("updated_at") or ""),
        )

        raw_chunks = raw.get("chunks")
        if isinstance(raw_chunks, dict):
            graph.chunks = {str(k): str(v) for k, v in raw_chunks.items()}

        for raw_node in (raw.get("nodes") or []):
            if not isinstance(raw_node, dict):
                continue
            node = GraphNode(
                id=str(raw_node.get("id") or ""),
                type=str(raw_node.get("type") or "topic"),
                value=str(raw_node.get("value") or ""),
                aliases=[str(x) for x in (raw_node.get("aliases") or [])],
                source_message_ids=[str(x) for x in (raw_node.get("source_message_ids") or [])],
                chunk_ids=[str(x) for x in (raw_node.get("chunk_ids") or [])],
                created_at=str(raw_node.get("created_at") or ""),
                updated_at=str(raw_node.get("updated_at") or ""),
                confidence=float(raw_node.get("confidence") or 0.5),
                salience_score=float(raw_node.get("salience_score") or 0.5),
            )
            if node.id:
                graph.nodes[node.id] = node

        for raw_edge in (raw.get("edges") or []):
            if not isinstance(raw_edge, dict):
                continue
            edge = GraphEdge(
                id=str(raw_edge.get("id") or ""),
                src=str(raw_edge.get("src") or ""),
                dst=str(raw_edge.get("dst") or ""),
                relation=str(raw_edge.get("relation") or "related"),
                weight=float(raw_edge.get("weight") or 0.5),
                source_message_ids=[str(x) for x in (raw_edge.get("source_message_ids") or [])],
                chunk_ids=[str(x) for x in (raw_edge.get("chunk_ids") or [])],
                created_at=str(raw_edge.get("created_at") or ""),
                updated_at=str(raw_edge.get("updated_at") or ""),
            )
            if edge.id:
                graph.edges[edge.id] = edge

        return graph
