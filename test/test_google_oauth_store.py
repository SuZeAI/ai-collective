"""Tests for server.infra.storage.google_oauth_store: local write/read
plus the MinIO mirror used to survive a k8s sandbox pod reschedule."""
from __future__ import annotations

import server.infra.storage.google_oauth_store as gos


class _FakeBackupService:
    """In-memory stand-in for S3BackupService/_NoopBackupService."""

    def __init__(self, enabled: bool = True):
        self.enabled = enabled
        self.store: dict[tuple[str, str], bytes] = {}

    def backup_bytes(self, scope: str, rel_path: str, data: bytes) -> None:
        self.store[(scope, rel_path)] = data

    def get_bytes(self, scope: str, rel_path: str):
        return self.store.get((scope, rel_path))


def _use_fake_backup(monkeypatch, enabled: bool = True) -> _FakeBackupService:
    fake = _FakeBackupService(enabled=enabled)
    monkeypatch.setattr(gos, "_backup_service", lambda: fake)
    return fake


# ── _rel_key ─────────────────────────────────────────────────────────────────

def test_rel_key_relative_to_tokens_root(monkeypatch, tmp_path):
    monkeypatch.setattr(gos, "_TOKENS_ROOT", tmp_path / "secrets" / "google")
    path = tmp_path / "secrets" / "google" / "user-1" / "calendar" / "token_default.json"
    assert gos._rel_key(str(path)) == "user-1/calendar/token_default.json"


def test_rel_key_falls_back_to_basename_outside_root(monkeypatch, tmp_path):
    monkeypatch.setattr(gos, "_TOKENS_ROOT", tmp_path / "secrets" / "google")
    outside = tmp_path / "elsewhere" / "token_default.json"
    assert gos._rel_key(str(outside)) == "token_default.json"


# ── save_token ───────────────────────────────────────────────────────────────

def test_save_token_writes_local_file(monkeypatch, tmp_path):
    _use_fake_backup(monkeypatch, enabled=False)
    monkeypatch.setattr(gos, "_TOKENS_ROOT", tmp_path / "secrets" / "google")
    path = tmp_path / "secrets" / "google" / "user-1" / "calendar" / "token_default.json"

    gos.save_token(str(path), '{"token": "abc"}')

    assert path.is_file()
    assert path.read_text(encoding="utf-8") == '{"token": "abc"}'


def test_save_token_mirrors_to_minio_when_enabled(monkeypatch, tmp_path):
    fake = _use_fake_backup(monkeypatch, enabled=True)
    monkeypatch.setattr(gos, "_TOKENS_ROOT", tmp_path / "secrets" / "google")
    path = tmp_path / "secrets" / "google" / "user-1" / "calendar" / "token_default.json"

    gos.save_token(str(path), '{"token": "abc"}')

    assert fake.store[("tokens", "user-1/calendar/token_default.json")] == b'{"token": "abc"}'


def test_save_token_does_not_mirror_when_disabled(monkeypatch, tmp_path):
    fake = _use_fake_backup(monkeypatch, enabled=False)
    monkeypatch.setattr(gos, "_TOKENS_ROOT", tmp_path / "secrets" / "google")
    path = tmp_path / "secrets" / "google" / "user-1" / "calendar" / "token_default.json"

    gos.save_token(str(path), '{"token": "abc"}')

    assert fake.store == {}


# ── restore_token_if_missing ─────────────────────────────────────────────────

def test_restore_noop_when_local_file_present(monkeypatch, tmp_path):
    fake = _use_fake_backup(monkeypatch, enabled=True)
    monkeypatch.setattr(gos, "_TOKENS_ROOT", tmp_path / "secrets" / "google")
    path = tmp_path / "secrets" / "google" / "user-1" / "calendar" / "token_default.json"
    path.parent.mkdir(parents=True)
    path.write_text("local-copy", encoding="utf-8")

    gos.restore_token_if_missing(str(path))

    # Untouched — restore must prefer the existing local copy, not overwrite it.
    assert path.read_text(encoding="utf-8") == "local-copy"
    assert fake.store == {}


def test_restore_pulls_from_minio_when_local_missing(monkeypatch, tmp_path):
    fake = _use_fake_backup(monkeypatch, enabled=True)
    monkeypatch.setattr(gos, "_TOKENS_ROOT", tmp_path / "secrets" / "google")
    path = tmp_path / "secrets" / "google" / "user-1" / "calendar" / "token_default.json"
    fake.store[("tokens", "user-1/calendar/token_default.json")] = b'{"token": "restored"}'

    gos.restore_token_if_missing(str(path))

    assert path.is_file()
    assert path.read_text(encoding="utf-8") == '{"token": "restored"}'


def test_restore_noop_when_backup_disabled_and_local_missing(monkeypatch, tmp_path):
    _use_fake_backup(monkeypatch, enabled=False)
    monkeypatch.setattr(gos, "_TOKENS_ROOT", tmp_path / "secrets" / "google")
    path = tmp_path / "secrets" / "google" / "user-1" / "calendar" / "token_default.json"

    gos.restore_token_if_missing(str(path))

    assert not path.exists()


def test_restore_noop_when_object_not_in_minio(monkeypatch, tmp_path):
    _use_fake_backup(monkeypatch, enabled=True)
    monkeypatch.setattr(gos, "_TOKENS_ROOT", tmp_path / "secrets" / "google")
    path = tmp_path / "secrets" / "google" / "user-1" / "calendar" / "token_default.json"

    gos.restore_token_if_missing(str(path))

    assert not path.exists()


# ── different users never collide ───────────────────────────────────────────

def test_different_users_get_independent_minio_objects(monkeypatch, tmp_path):
    fake = _use_fake_backup(monkeypatch, enabled=True)
    monkeypatch.setattr(gos, "_TOKENS_ROOT", tmp_path / "secrets" / "google")
    path_a = tmp_path / "secrets" / "google" / "user-a" / "calendar" / "token_default.json"
    path_b = tmp_path / "secrets" / "google" / "user-b" / "calendar" / "token_default.json"

    gos.save_token(str(path_a), '{"token": "a"}')
    gos.save_token(str(path_b), '{"token": "b"}')

    assert fake.store[("tokens", "user-a/calendar/token_default.json")] == b'{"token": "a"}'
    assert fake.store[("tokens", "user-b/calendar/token_default.json")] == b'{"token": "b"}'
    assert len(fake.store) == 2
