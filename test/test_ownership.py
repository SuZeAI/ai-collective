"""Tests for the ownership/access-control primitives in domain/models.py.

is_visible_to / is_owned_by / can_delete / can_modify are the *sole*
access-control mechanism for every user-creatable entity in the app (staff,
departments, tasks, projects, connections, ...). Every router that scopes a
read/write to the caller goes through these four functions, so a regression
here is a cross-cutting data-leak or privilege-escalation bug, not a
one-endpoint bug.
"""
from __future__ import annotations

from backend.domain.models import (
    DEFAULT_OWNER_ID,
    GUEST_OWNER_ID,
    can_delete,
    can_modify,
    is_owned_by,
    is_visible_to,
)

ALICE = "user_alice"
BOB = "user_bob"


class TestIsVisibleTo:
    def test_owner_sees_their_own_entity(self):
        assert is_visible_to(ALICE, ALICE) is True

    def test_owner_does_not_see_another_users_entity(self):
        assert is_visible_to(ALICE, BOB) is False

    def test_everyone_sees_shared_default_entities(self):
        assert is_visible_to(ALICE, DEFAULT_OWNER_ID) is True
        assert is_visible_to(BOB, DEFAULT_OWNER_ID) is True
        assert is_visible_to(GUEST_OWNER_ID, DEFAULT_OWNER_ID) is True

    def test_guest_scope_is_just_another_owner_id(self):
        # Guest mode shares one pooled "guest" scope — visible to any caller
        # acting as guest, but not to a named/logged-in user or vice versa.
        assert is_visible_to(GUEST_OWNER_ID, GUEST_OWNER_ID) is True
        assert is_visible_to(ALICE, GUEST_OWNER_ID) is False
        assert is_visible_to(GUEST_OWNER_ID, ALICE) is False

    def test_default_owner_only_sees_its_own_and_shared_items(self):
        # The admin/default account does NOT get blanket visibility into
        # other users' private entities — only into shared "default" ones.
        assert is_visible_to(DEFAULT_OWNER_ID, DEFAULT_OWNER_ID) is True
        assert is_visible_to(DEFAULT_OWNER_ID, ALICE) is False


class TestIsOwnedBy:
    def test_strict_equality_only(self):
        assert is_owned_by(ALICE, ALICE) is True
        assert is_owned_by(ALICE, BOB) is False

    def test_shared_default_items_are_not_owned_by_regular_users(self):
        # Per-user "my items" pages must not show shared defaults as theirs.
        assert is_owned_by(ALICE, DEFAULT_OWNER_ID) is False

    def test_default_account_owns_default_items(self):
        # The admin account acts in the DEFAULT_OWNER_ID scope, so it still
        # sees shared defaults through the *same* strict-equality check.
        assert is_owned_by(DEFAULT_OWNER_ID, DEFAULT_OWNER_ID) is True


class TestCanDeleteAndCanModify:
    def test_can_delete_is_owner_only(self):
        assert can_delete(ALICE, ALICE) is True
        assert can_delete(ALICE, BOB) is False

    def test_regular_user_cannot_delete_shared_default_item(self):
        assert can_delete(ALICE, DEFAULT_OWNER_ID) is False

    def test_only_default_account_can_delete_shared_default_item(self):
        assert can_delete(DEFAULT_OWNER_ID, DEFAULT_OWNER_ID) is True

    def test_guest_cannot_delete_anyone_elses_or_shared_items(self):
        assert can_delete(GUEST_OWNER_ID, DEFAULT_OWNER_ID) is False
        assert can_delete(GUEST_OWNER_ID, ALICE) is False
        assert can_delete(GUEST_OWNER_ID, GUEST_OWNER_ID) is True

    def test_can_modify_is_an_alias_of_can_delete(self):
        # Editing shared "default" items follows the same owner-only rule as
        # deleting (task status transitions are exempted at the router, not
        # here) — assert the alias itself so a future de-aliasing edit that
        # silently diverges the two rules gets caught immediately.
        assert can_modify is can_delete
