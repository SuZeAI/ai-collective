from __future__ import annotations

from backend.application.ports.repositories import SkillRepository
from backend.domain.models import Skill


class SkillService:
    def __init__(self, repo: SkillRepository):
        self._repo = repo

    def list_skills(self) -> list[Skill]:
        return self._repo.list()

    def upsert_skill(self, skill: Skill) -> Skill:
        return self._repo.upsert(skill)

    def delete_skill(self, skill_id: str) -> None:
        self._repo.delete(skill_id)
