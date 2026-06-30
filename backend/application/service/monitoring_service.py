from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from backend.application.ports.repositories import (
    AgentRepository,
    ModelPricingRepository,
    TaskRepository,
    TeamRepository,
    TokenUsageRepository,
    UserRepository,
    WorkspaceRepository,
)
from backend.domain.errors import ValidationError
from backend.domain.models import ModelPricing, TokenUsageRecord


class MonitoringService:
    """Aggregations behind the admin System Monitoring page."""

    def __init__(
        self,
        usage: TokenUsageRepository,
        pricing: ModelPricingRepository,
        users: UserRepository,
        agents: AgentRepository,
        teams: TeamRepository,
        tasks: TaskRepository,
        workspaces: WorkspaceRepository,
    ) -> None:
        self._usage = usage
        self._pricing = pricing
        self._users = users
        self._agents = agents
        self._teams = teams
        self._tasks = tasks
        self._workspaces = workspaces

    # ── Token usage ──────────────────────────────────────────────────────────

    def _records_since(self, days: int) -> list[TokenUsageRecord]:
        days = max(1, min(int(days), 365))
        since = datetime.now(timezone.utc) - timedelta(days=days)
        return self._usage.list(since=since)

    def _cost_of(self, record: TokenUsageRecord, pricing_by_model: dict[str, ModelPricing]) -> float | None:
        p = pricing_by_model.get(record.model)
        if p is None:
            return None
        return (
            record.input_tokens / 1_000_000 * p.input_price_per_million
            + record.output_tokens / 1_000_000 * p.output_price_per_million
        )

    def get_usage_summary(self, days: int = 30) -> dict[str, Any]:
        days = max(1, min(int(days), 365))
        records = self._records_since(days)
        pricing_by_model = {p.model: p for p in self._pricing.list()}
        user_names = {u.id: u.name for u in self._users.list()}

        def _bucket() -> dict[str, Any]:
            return {"input_tokens": 0, "output_tokens": 0, "requests": 0, "cost": 0.0}

        totals = _bucket()
        by_model: dict[str, dict[str, Any]] = defaultdict(_bucket)
        by_user: dict[str, dict[str, Any]] = defaultdict(_bucket)
        by_day: dict[str, dict[str, Any]] = defaultdict(_bucket)

        for r in records:
            cost = self._cost_of(r, pricing_by_model)
            day = r.timestamp.astimezone(timezone.utc).date().isoformat()
            for bucket in (totals, by_model[r.model], by_user[r.user_id], by_day[day]):
                bucket["input_tokens"] += r.input_tokens
                bucket["output_tokens"] += r.output_tokens
                bucket["requests"] += 1
                bucket["cost"] += cost or 0.0
            by_model[r.model]["provider"] = r.provider
            by_model[r.model]["priced"] = r.model in pricing_by_model

        # Continuous daily series (zero-filled) so charts don't skip days.
        today = datetime.now(timezone.utc).date()
        daily = []
        for offset in range(days - 1, -1, -1):
            day = (today - timedelta(days=offset)).isoformat()
            entry = by_day.get(day, _bucket())
            daily.append({"date": day, **entry})

        return {
            "days": days,
            "totals": {**totals, "total_tokens": totals["input_tokens"] + totals["output_tokens"]},
            "by_model": [
                {"model": model, **data}
                for model, data in sorted(by_model.items(), key=lambda kv: -kv[1]["cost"])
            ],
            "by_user": [
                {"user_id": user_id, "name": user_names.get(user_id, user_id), **data}
                for user_id, data in sorted(by_user.items(), key=lambda kv: -(kv[1]["input_tokens"] + kv[1]["output_tokens"]))
            ],
            "by_day": daily,
        }

    # ── Consumption (owner-scoped) ───────────────────────────────────────────

    def get_consumption(self, owner_id: str, days: int = 30) -> dict[str, Any]:
        """Token/cost consumption for one owner, broken down by department
        (team), staff (agent) and human (user).

        Powers the per-user Cost Monitoring page. Only records triggered by the
        given owner are counted, so each user sees just their own spend. Records
        captured before per-agent/per-team attribution shipped fall under an
        "unattributed" bucket.
        """
        days = max(1, min(int(days), 365))
        records = [r for r in self._records_since(days) if r.user_id == owner_id]
        pricing_by_model = {p.model: p for p in self._pricing.list()}
        team_names = {t.id: t.name for t in self._teams.list()}
        agent_roles = {a.name: a.role for a in self._agents.list()}
        user_names = {u.id: u.name for u in self._users.list()}

        def _bucket() -> dict[str, Any]:
            return {"input_tokens": 0, "output_tokens": 0, "requests": 0, "cost": 0.0}

        totals = _bucket()
        by_team: dict[str, dict[str, Any]] = defaultdict(_bucket)
        by_agent: dict[str, dict[str, Any]] = defaultdict(_bucket)
        by_user: dict[str, dict[str, Any]] = defaultdict(_bucket)
        by_day: dict[str, dict[str, Any]] = defaultdict(_bucket)

        for r in records:
            cost = self._cost_of(r, pricing_by_model) or 0.0
            day = r.timestamp.astimezone(timezone.utc).date().isoformat()
            team_key = r.team_id or "unattributed"
            agent_key = r.agent_name or "unattributed"
            for bucket in (totals, by_team[team_key], by_agent[agent_key], by_user[r.user_id], by_day[day]):
                bucket["input_tokens"] += r.input_tokens
                bucket["output_tokens"] += r.output_tokens
                bucket["requests"] += 1
                bucket["cost"] += cost

        # Continuous daily series (zero-filled) so charts don't skip days.
        today = datetime.now(timezone.utc).date()
        daily = []
        for offset in range(days - 1, -1, -1):
            day = (today - timedelta(days=offset)).isoformat()
            daily.append({"date": day, **by_day.get(day, _bucket())})

        def _name_team(key: str) -> str:
            return "Unattributed" if key == "unattributed" else team_names.get(key, key)

        return {
            "days": days,
            "totals": {**totals, "total_tokens": totals["input_tokens"] + totals["output_tokens"]},
            "by_team": [
                {"team_id": key, "name": _name_team(key), **data}
                for key, data in sorted(by_team.items(), key=lambda kv: -kv[1]["cost"])
            ],
            "by_agent": [
                {"agent_name": key, "name": "Unattributed" if key == "unattributed" else key,
                 "role": agent_roles.get(key, ""), **data}
                for key, data in sorted(by_agent.items(), key=lambda kv: -kv[1]["cost"])
            ],
            "by_user": [
                {"user_id": uid, "name": user_names.get(uid, uid), **data}
                for uid, data in sorted(by_user.items(), key=lambda kv: -kv[1]["cost"])
            ],
            "by_day": daily,
        }

    # ── Pricing ──────────────────────────────────────────────────────────────

    def list_pricing(self) -> list[ModelPricing]:
        return sorted(self._pricing.list(), key=lambda p: (p.provider, p.model))

    def upsert_pricing(self, pricing: ModelPricing) -> ModelPricing:
        if not pricing.model.strip():
            raise ValidationError("Model name is required")
        if pricing.input_price_per_million < 0 or pricing.output_price_per_million < 0:
            raise ValidationError("Prices must be non-negative")
        return self._pricing.upsert(pricing)

    def delete_pricing(self, model: str) -> None:
        self._pricing.delete(model)

    # ── System health ────────────────────────────────────────────────────────

    def get_entity_counts(self) -> dict[str, int]:
        return {
            "users": len(self._users.list()),
            "agents": len(self._agents.list()),
            "teams": len(self._teams.list()),
            "tasks": len(self._tasks.list()),
            "workspaces": len(self._workspaces.list()),
        }

    # ── User activity ────────────────────────────────────────────────────────

    def get_user_activity(self, days: int = 30) -> list[dict[str, Any]]:
        records = self._records_since(days)
        pricing_by_model = {p.model: p for p in self._pricing.list()}

        usage_by_user: dict[str, dict[str, Any]] = defaultdict(
            lambda: {"input_tokens": 0, "output_tokens": 0, "requests": 0, "cost": 0.0}
        )
        for r in records:
            bucket = usage_by_user[r.user_id]
            bucket["input_tokens"] += r.input_tokens
            bucket["output_tokens"] += r.output_tokens
            bucket["requests"] += 1
            bucket["cost"] += self._cost_of(r, pricing_by_model) or 0.0

        def _count_owned(items: list[Any], owner_id: str) -> int:
            return sum(1 for item in items if getattr(item, "owner_id", "") == owner_id)

        agents = self._agents.list()
        teams = self._teams.list()
        tasks = self._tasks.list()
        workspaces = self._workspaces.list()

        result = []
        for user in sorted(self._users.list(), key=lambda u: u.joined_at, reverse=True):
            usage = usage_by_user.get(
                user.id, {"input_tokens": 0, "output_tokens": 0, "requests": 0, "cost": 0.0}
            )
            result.append(
                {
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "role": user.role,
                    "provider": user.provider,
                    "joined_at": user.joined_at,
                    "agents": _count_owned(agents, user.id),
                    "teams": _count_owned(teams, user.id),
                    "tasks": _count_owned(tasks, user.id),
                    "workspaces": _count_owned(workspaces, user.id),
                    **usage,
                }
            )
        return result
