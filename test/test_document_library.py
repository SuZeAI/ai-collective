"""Tests for the document storage foundation, DocumentToolkit, and library service."""
from __future__ import annotations

import io
import os

import pytest

from backend.infra.storage.file_store import FileStore
from backend.infra.repositories.json_files.library_documents import (
    JsonLibraryDocumentRepository,
)
from backend.infra.repositories.json_store import JsonFileStore
from backend.app.service.document_library_service import DocumentLibraryService


# ── FileStore (local backend) ───────────────────────────────────────────────

class TestFileStoreLocal:
    def _store(self, tmp_path, namespace="sandbox"):
        store = FileStore(namespace)
        store._local_root = str(tmp_path / namespace)  # isolate from real workspace
        return store

    def test_put_get_list_roundtrip(self, tmp_path):
        store = self._store(tmp_path)
        store.put("conv-1", "uploads/a.txt", b"hello")
        assert store.get("conv-1", "uploads/a.txt") == b"hello"
        assert store.list("conv-1") == ["uploads/a.txt"]

    def test_get_missing_returns_none(self, tmp_path):
        store = self._store(tmp_path)
        assert store.get("conv-x", "nope.txt") is None

    def test_delete(self, tmp_path):
        store = self._store(tmp_path)
        store.put("conv-1", "uploads/a.txt", b"x")
        store.delete("conv-1", "uploads/a.txt")
        assert store.get("conv-1", "uploads/a.txt") is None

    def test_restore_to_dir_is_noop_in_local_mode(self, tmp_path):
        store = self._store(tmp_path)
        # local backend → restore does nothing (host dir is the source of truth)
        assert store.restore_to_dir("conv-1", str(tmp_path / "dest")) == 0

    def test_library_namespace_has_its_own_subdir(self, tmp_path):
        lib = self._store(tmp_path, "library")
        lib.put("ws_1", "doc_1/spec.csv", b"a,b")
        assert lib.get("ws_1", "doc_1/spec.csv") == b"a,b"
        assert os.path.isfile(str(tmp_path / "library" / "ws_1" / "doc_1" / "spec.csv"))


# ── DocumentToolkit extraction ──────────────────────────────────────────────

class TestDocumentToolkit:
    def _toolkit_in(self, tmp_path, monkeypatch):
        # Point the workspace base at tmp_path and bind a thread id.
        import backend.infra.storage.file_store as fs
        import backend.infra.sandbox.sandbox_session as ss
        monkeypatch.setattr(fs, "workspace_base", lambda: str(tmp_path))
        ss.set_current_thread_id("conv-test")
        os.makedirs(str(tmp_path / "conv-test" / "uploads"), exist_ok=True)
        from backend.domain.tools.document_tools import DocumentToolkit
        return DocumentToolkit()

    def test_extract_csv_as_markdown_table(self, tmp_path, monkeypatch):
        tk = self._toolkit_in(tmp_path, monkeypatch)
        (tmp_path / "conv-test" / "uploads" / "d.csv").write_text("name,role\nAlice,CEO\n")
        out = tk._extract_text_sync("uploads/d.csv")
        assert "Alice" in out and "CEO" in out and "|" in out

    def test_extract_txt(self, tmp_path, monkeypatch):
        tk = self._toolkit_in(tmp_path, monkeypatch)
        (tmp_path / "conv-test" / "uploads" / "note.txt").write_text("plain content here")
        assert "plain content here" in tk._extract_text_sync("uploads/note.txt")

    def test_extract_xlsx_table(self, tmp_path, monkeypatch):
        openpyxl = pytest.importorskip("openpyxl")
        tk = self._toolkit_in(tmp_path, monkeypatch)
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["Name", "Dept"])
        ws.append(["Lan", "Eng"])
        wb.save(str(tmp_path / "conv-test" / "uploads" / "t.xlsx"))
        out = tk._read_table_sync("uploads/t.xlsx", None, 50)
        assert "Lan" in out and "Eng" in out

    def test_path_confinement_rejects_escape(self, tmp_path, monkeypatch):
        tk = self._toolkit_in(tmp_path, monkeypatch)
        out = tk._extract_text_sync("../../etc/passwd")
        assert out.startswith("Error")

    def test_missing_file(self, tmp_path, monkeypatch):
        tk = self._toolkit_in(tmp_path, monkeypatch)
        assert tk._extract_text_sync("uploads/none.pdf").startswith("Error")


# ── Library service ─────────────────────────────────────────────────────────

class TestDocumentLibraryService:
    def _svc(self, tmp_path, monkeypatch):
        import backend.infra.storage.file_store as fs
        monkeypatch.setattr(fs, "workspace_base", lambda: str(tmp_path))
        fs._stores.clear()  # rebuild stores against the patched base
        repo = JsonLibraryDocumentRepository(JsonFileStore(tmp_path / "lib.json"))
        return DocumentLibraryService(repo)

    def test_create_list_read_delete(self, tmp_path, monkeypatch):
        svc = self._svc(tmp_path, monkeypatch)
        doc = svc.create_document(
            company_id="ws_1", filename="spec.csv", content_type="text/csv",
            data=b"a,b\n1,2\n", owner_id="u1", uploaded_by="u1", tags=["plan"],
        )
        assert doc.company_id == "ws_1" and doc.size == 8
        assert [d.id for d in svc.list_documents()] == [doc.id]
        assert svc.read_bytes(doc) == b"a,b\n1,2\n"
        svc.delete_document(doc)
        assert svc.list_documents() == []
        assert svc.read_bytes(doc) is None

    def test_attach_to_project_records_thread_file(self, tmp_path, monkeypatch):
        import backend.infra.sandbox.sandbox_session as ss
        monkeypatch.setattr(ss, "_ensure_thread_workspace",
                            lambda tid: str(_mkd(tmp_path / "ws" / tid)))
        svc = self._svc(tmp_path, monkeypatch)
        doc = svc.create_document(
            company_id="ws_1", filename="brief.txt", content_type="text/plain",
            data=b"hello team", owner_id="u1", uploaded_by="u1",
        )
        rec = svc.attach_to_project(doc, "task-abc", "u1")
        assert rec["rel_path"] == "uploads/brief.txt"
        # The bytes must land in the project's conversation workspace uploads dir.
        from backend.infra.sandbox.sandbox_session import (
            conversation_thread_id,
            ensure_conversation_workspace,
        )
        ws = ensure_conversation_workspace("task-abc")
        assert (open(os.path.join(ws, "uploads", "brief.txt"), "rb").read()) == b"hello team"
        assert conversation_thread_id("task-abc")  # deterministic id resolves


def _mkd(p):
    os.makedirs(str(p), exist_ok=True)
    os.makedirs(str(p / "uploads"), exist_ok=True)
    return p
