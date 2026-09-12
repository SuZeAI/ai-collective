"""One-time backfill: give every Department/Staff/Skill a real company_id.

Before this migration, Staff/Skill/Department only carried owner_id — company
membership was inferred transitively via Company.department_ids ->
Department.staff -> Staff.skill_ids, so the same row could be (and in seeded
data, was) wired into more than one company at once. Company_id now ties each
row to exactly one company; this script backfills existing data to match:

For each company, walk its department_ids:
  - a department/staff/skill still at the CATALOG_COMPANY_ID default is
    "claimed" in place (company_id + owner_id stamped to this company).
  - one already claimed by a *different* company is cloned (fresh id) into
    this company instead, mirroring RecruitingService's clone helpers.

Idempotent: re-running after a successful pass is a no-op (every row already
belongs to the company it's reachable from).

Usage:
    PYTHONPATH=. uv run python scripts/migrate_company_scoping.py [--dry-run]
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import replace
from uuid import uuid4

from server.api.deps import get_company_service, get_department_service, get_skill_service, get_staff_service
from server.domain.models import CATALOG_COMPANY_ID, Company, Department, Skill, Staff


def _claim_or_clone_skill(skill_id: str, company: Company, skill_service, dry_run: bool) -> str | None:
    skill = skill_service.try_get_skill(skill_id)
    if skill is None:
        return None
    if skill.company_id == company.id:
        return skill.id
    if skill.company_id == CATALOG_COMPANY_ID:
        print(f"  claim skill {skill.id!r} ({skill.name!r}) -> company {company.id!r}")
        if not dry_run:
            skill_service.upsert_skill(replace(skill, company_id=company.id, owner_id=company.owner_id))
        return skill.id
    clone_id = f"skill_{uuid4().hex}"
    print(f"  fork skill {skill.id!r} ({skill.name!r}) -> {clone_id!r} for company {company.id!r}")
    if not dry_run:
        skill_service.upsert_skill(
            replace(skill, id=clone_id, config=dict(skill.config or {}), company_id=company.id, owner_id=company.owner_id)
        )
    return clone_id


def _claim_or_clone_staff(staff_id: str, company: Company, staff_service, skill_service, dry_run: bool) -> str | None:
    staff = staff_service.try_get_staff(staff_id)
    if staff is None:
        return None
    new_skill_ids = [
        sid
        for sid in (
            _claim_or_clone_skill(skill_id, company, skill_service, dry_run) for skill_id in staff.skill_ids
        )
        if sid is not None
    ]
    if staff.company_id == company.id:
        if new_skill_ids != staff.skill_ids and not dry_run:
            staff_service.upsert_staff(replace(staff, skill_ids=new_skill_ids))
        return staff.id
    if staff.company_id == CATALOG_COMPANY_ID:
        print(f"  claim staff {staff.id!r} ({staff.name!r}) -> company {company.id!r}")
        if not dry_run:
            staff_service.upsert_staff(
                replace(staff, skill_ids=new_skill_ids, company_id=company.id, owner_id=company.owner_id)
            )
        return staff.id
    clone_id = f"agent_{uuid4().hex}"
    print(f"  fork staff {staff.id!r} ({staff.name!r}) -> {clone_id!r} for company {company.id!r}")
    if not dry_run:
        staff_service.upsert_staff(
            replace(staff, id=clone_id, skill_ids=new_skill_ids, company_id=company.id, owner_id=company.owner_id)
        )
    return clone_id


def _claim_or_clone_department(
    department_id: str, company: Company, department_service, staff_service, skill_service, dry_run: bool
) -> str | None:
    department = department_service.try_get_department(department_id)
    if department is None:
        return None
    new_staff_ids = [
        sid
        for sid in (
            _claim_or_clone_staff(staff_id, company, staff_service, skill_service, dry_run)
            for staff_id in department.staff
        )
        if sid is not None
    ]
    if department.company_id == company.id:
        if new_staff_ids != department.staff and not dry_run:
            department_service.upsert_department(replace(department, staff=new_staff_ids))
        return department.id
    if department.company_id == CATALOG_COMPANY_ID:
        print(f"  claim department {department.id!r} ({department.name!r}) -> company {company.id!r}")
        if not dry_run:
            department_service.upsert_department(
                replace(department, staff=new_staff_ids, company_id=company.id, owner_id=company.owner_id)
            )
        return department.id
    clone_id = f"team_{uuid4().hex}"
    print(f"  fork department {department.id!r} ({department.name!r}) -> {clone_id!r} for company {company.id!r}")
    if not dry_run:
        department_service.upsert_department(
            replace(department, id=clone_id, staff=new_staff_ids, company_id=company.id, owner_id=company.owner_id)
        )
    return clone_id


def migrate(dry_run: bool) -> None:
    company_service = get_company_service()
    department_service = get_department_service()
    staff_service = get_staff_service()
    skill_service = get_skill_service()

    companies = company_service.list_companies()
    print(f"Found {len(companies)} companies.")
    for company in companies:
        print(f"\nCompany {company.id!r} ({company.name!r}):")
        new_department_ids = [
            did
            for did in (
                _claim_or_clone_department(department_id, company, department_service, staff_service, skill_service, dry_run)
                for department_id in company.department_ids
            )
            if did is not None
        ]
        if new_department_ids != company.department_ids:
            print(f"  department_ids: {company.department_ids} -> {new_department_ids}")
            if not dry_run:
                company_service.upsert_company(replace(company, department_ids=new_department_ids))

    print("\nDry run — no changes written." if dry_run else "\nDone.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Print what would change without writing anything.")
    args = parser.parse_args()
    migrate(dry_run=args.dry_run)
    sys.exit(0)
