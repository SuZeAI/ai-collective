"""DocumentToolkit — read & understand documents that live in a chat's workspace.

These tools let staff actually *work with* the documents people share in a Project
or office chat: extract the text of a PDF/Word/Excel/CSV file, read a spreadsheet as
a table, pull the readable text from a web link, and describe an image.

Like ``SandboxToolkit`` every path is confined to the conversation's shared workspace
(``{SANDBOX_WORKSPACE}/<thread_id>/``). Bytes are read through the ``FileStore`` facade
so they resolve the same way regardless of the ``local``/``s3`` storage backend.

Available tools:
  document_extract_text   — extract plain text/markdown from pdf/docx/xlsx/csv/txt/md/json
  document_read_table     — read an xlsx/csv file as a markdown table
  document_fetch_url      — fetch a web page/link, save its readable text into the workspace
  document_describe_image — describe an image (and report its dimensions/format)

Parser libraries (pypdf/openpyxl/python-docx/Pillow) are imported lazily inside each
tool so a missing optional dependency degrades to a clear message instead of an import error.
"""
from __future__ import annotations

import csv
import html
import io
import os
import re
from typing import Any, Optional

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit
from server.share.log import get_logger

logger = get_logger(__name__)

_MAX_CHARS = 50_000
_TEXT_EXTS = {".txt", ".md", ".markdown", ".json", ".log", ".csv", ".tsv", ".html", ".htm", ".xml"}
_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}


def _truncate(text: str, max_chars: int = _MAX_CHARS) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + f"\n\n... [truncated: {len(text) - max_chars} more chars]"


def _strip_html(raw: str) -> str:
    """Best-effort HTML → readable text without a heavyweight parser dependency."""
    raw = re.sub(r"(?is)<(script|style|head|noscript)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?i)<br\s*/?>", "\n", raw)
    raw = re.sub(r"(?i)</(p|div|li|tr|h[1-6])>", "\n", raw)
    raw = re.sub(r"<[^>]+>", " ", raw)
    raw = html.unescape(raw)
    raw = re.sub(r"[ \t]+", " ", raw)
    raw = re.sub(r"\n\s*\n\s*\n+", "\n\n", raw)
    return raw.strip()


class DocumentToolkit(BaseToolkit):
    """Read and understand documents shared in a conversation's workspace."""

    name: str = "documents"

    # ── workspace helpers ────────────────────────────────────────────────────────

    def _workspace(self) -> tuple[str, Optional[str]]:
        """Return ``(workspace_dir, thread_id)`` for the current run."""
        from server.infra.sandbox.sandbox_session import get_current_thread_id
        from server.infra.storage.file_store import workspace_base

        thread_id = get_current_thread_id()
        base = workspace_base()
        return (os.path.join(base, thread_id) if thread_id else base, thread_id)

    def _confine(self, path: str, workspace: str) -> str:
        """Resolve *path* (relative to workspace) and assert it stays inside it."""
        if not os.path.isabs(path):
            path = os.path.join(workspace, path)
        norm = os.path.normpath(path)
        norm_ws = os.path.normpath(workspace)
        if norm != norm_ws and not norm.startswith(norm_ws + os.sep):
            raise PermissionError(
                f"'{path}' is outside the conversation workspace '{workspace}'."
            )
        return norm

    def _read_bytes(self, path: str) -> tuple[bytes, str]:
        """Read raw bytes of a workspace file (host first, S3 fallback). Returns (data, abspath)."""
        workspace, thread_id = self._workspace()
        abspath = self._confine(path, workspace)
        rel = os.path.relpath(abspath, workspace)
        if thread_id:
            from server.infra.storage.file_store import get_file_store

            data = get_file_store("sandbox").get(thread_id, rel)
            if data is not None:
                return data, abspath
        if os.path.isfile(abspath):
            with open(abspath, "rb") as fh:
                return fh.read(), abspath
        raise FileNotFoundError(f"File not found in workspace: {path}")

    # ── tools ─────────────────────────────────────────────────────────────────────

    @tool(parse_docstring=True)
    async def document_extract_text(self, description: str, path: str) -> Any:
        """Extract the readable text of a document into plain text / markdown.

        Supports PDF, Word (.docx), Excel (.xlsx), CSV/TSV, and plain text/markdown/json.
        Use this to read what a shared document actually says before acting on it.

        Args:
            description: Brief reason you are reading this document.
            path: Path to the file inside the conversation workspace (e.g. ``uploads/report.pdf``).
        """
        import asyncio

        return await asyncio.to_thread(self._extract_text_sync, path)

    def _extract_text_sync(self, path: str) -> str:
        try:
            data, abspath = self._read_bytes(path)
        except (PermissionError, FileNotFoundError) as exc:
            return f"Error: {exc}"
        ext = os.path.splitext(abspath)[1].lower()
        try:
            if ext == ".pdf":
                return _truncate(self._pdf_text(data))
            if ext == ".docx":
                return _truncate(self._docx_text(data))
            if ext in (".xlsx", ".xlsm"):
                return _truncate(self._xlsx_text(data))
            if ext in (".csv", ".tsv"):
                return _truncate(self._csv_text(data, "\t" if ext == ".tsv" else ","))
            if ext in _TEXT_EXTS or ext == "":
                return _truncate(data.decode("utf-8", errors="replace"))
            if ext in _IMAGE_EXTS:
                return f"'{os.path.basename(abspath)}' is an image — use document_describe_image instead."
            return f"Unsupported file type '{ext}'. Supported: pdf, docx, xlsx, csv, txt, md, json."
        except Exception as exc:  # noqa: BLE001
            logger.warning("document_extract_text failed for %s: %s", path, exc)
            return f"Error extracting '{path}': {exc}"

    @tool(parse_docstring=True)
    async def document_read_table(
        self, description: str, path: str, sheet: Optional[str] = None, max_rows: int = 200
    ) -> Any:
        """Read a spreadsheet (.xlsx) or CSV file as a markdown table.

        Args:
            description: Brief reason you are reading this table.
            path: Path to the .xlsx/.csv file inside the conversation workspace.
            sheet: Optional sheet name for .xlsx files (defaults to the first/active sheet).
            max_rows: Maximum data rows to return (default 200).
        """
        import asyncio

        return await asyncio.to_thread(self._read_table_sync, path, sheet, max_rows)

    def _read_table_sync(self, path: str, sheet: Optional[str], max_rows: int) -> str:
        try:
            data, abspath = self._read_bytes(path)
        except (PermissionError, FileNotFoundError) as exc:
            return f"Error: {exc}"
        ext = os.path.splitext(abspath)[1].lower()
        limit = max(1, min(int(max_rows or 200), 2000))
        try:
            if ext in (".xlsx", ".xlsm"):
                rows = self._xlsx_rows(data, sheet, limit)
            elif ext in (".csv", ".tsv"):
                delim = "\t" if ext == ".tsv" else ","
                reader = csv.reader(io.StringIO(data.decode("utf-8", errors="replace")), delimiter=delim)
                rows = [r for _, r in zip(range(limit + 1), reader)]
            else:
                return f"document_read_table supports .xlsx/.csv, not '{ext}'. Try document_extract_text."
            return _truncate(self._rows_to_markdown(rows))
        except Exception as exc:  # noqa: BLE001
            logger.warning("document_read_table failed for %s: %s", path, exc)
            return f"Error reading table '{path}': {exc}"

    @tool(parse_docstring=True)
    async def document_fetch_url(self, description: str, url: str, save_as: Optional[str] = None) -> Any:
        """Fetch a web page/link and save its readable text into the workspace.

        SSRF-protected (internal/metadata hosts are blocked). The cleaned text is saved
        under ``uploads/`` so it can be re-read later, and a preview is returned.

        Args:
            description: Brief reason you are fetching this link.
            url: Absolute http(s) URL to fetch.
            save_as: Optional filename to save the extracted text as (default derived from the URL).
        """
        import asyncio

        return await asyncio.to_thread(self._fetch_url_sync, url, save_as)

    def _fetch_url_sync(self, url: str, save_as: Optional[str]) -> str:
        from server.domain.tools.http import request, HTTPError
        from server.domain.tools._ssrf import BlockedURLError

        try:
            raw = request("GET", url, raw=True, retries=2)
        except BlockedURLError as exc:
            return f"Error: blocked URL ({exc})."
        except HTTPError as exc:
            return f"Error fetching '{url}': {exc}"
        except Exception as exc:  # noqa: BLE001
            return f"Error fetching '{url}': {exc}"

        text = _strip_html(raw) if "<" in raw[:2000] and ">" in raw[:2000] else raw.strip()
        name = (save_as or "").strip()
        if not name:
            slug = re.sub(r"[^a-zA-Z0-9._-]", "_", url.split("//", 1)[-1])[:60].strip("_") or "page"
            name = f"{slug}.md"
        if not os.path.splitext(name)[1]:
            name += ".md"

        workspace, thread_id = self._workspace()
        rel = f"uploads/{os.path.basename(name)}"
        body = text.encode("utf-8")
        try:
            if thread_id:
                from server.infra.storage.file_store import get_file_store

                get_file_store("sandbox").put(thread_id, rel, body)
            else:
                dest = self._confine(rel, workspace)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with open(dest, "wb") as fh:
                    fh.write(body)
        except Exception as exc:  # noqa: BLE001
            logger.warning("document_fetch_url save failed: %s", exc)
            return f"Fetched {len(text)} chars but could not save: {exc}\n\n{_truncate(text, 4000)}"

        return f"Saved {len(text)} chars to '{rel}'. Preview:\n\n{_truncate(text, 4000)}"

    @tool(parse_docstring=True)
    async def document_describe_image(
        self, description: str, path: str, question: str = "Describe this image in detail."
    ) -> Any:
        """Describe an image and report its format/dimensions.

        Args:
            description: Brief reason you are inspecting this image.
            path: Path to the image inside the conversation workspace.
            question: What you want to know about the image.
        """
        import asyncio

        return await asyncio.to_thread(self._describe_image_sync, path, question)

    def _describe_image_sync(self, path: str, question: str) -> str:
        try:
            data, abspath = self._read_bytes(path)
        except (PermissionError, FileNotFoundError) as exc:
            return f"Error: {exc}"
        ext = os.path.splitext(abspath)[1].lower().lstrip(".") or "png"
        info = ""
        try:
            from PIL import Image  # type: ignore

            with Image.open(io.BytesIO(data)) as im:
                info = f"Format: {im.format}, size: {im.width}x{im.height}, mode: {im.mode}.\n"
        except Exception:  # noqa: BLE001
            pass
        vision = self._vision_describe(data, ext, question)
        return (info + vision).strip() or "Could not analyze the image."

    def _vision_describe(self, data: bytes, ext: str, question: str) -> str:
        import asyncio
        import base64

        try:
            provider = self._default_llm()
            if provider is None:
                return "(Image description unavailable: no LLM provider configured.)"
            model = provider.get_chat_model()
            mime = "jpeg" if ext in ("jpg", "jpeg") else ext
            b64 = base64.b64encode(data).decode("ascii")
            from langchain_core.messages import HumanMessage

            msg = HumanMessage(content=[
                {"type": "text", "text": question},
                {"type": "image_url", "image_url": {"url": f"data:image/{mime};base64,{b64}"}},
            ])

            async def _run() -> str:
                resp = await model.ainvoke([msg])
                return getattr(resp, "content", str(resp))

            out = asyncio.run(_run())
            return out if isinstance(out, str) else str(out)
        except Exception as exc:  # noqa: BLE001
            logger.warning("vision describe failed: %s", exc)
            return f"(Image description unavailable: {exc})"

    @staticmethod
    def _default_llm():
        from server.infra.llm.factory import build_default_llm_provider

        return build_default_llm_provider()

    # ── parsers (lazy imports) ─────────────────────────────────────────────────────

    @staticmethod
    def _pdf_text(data: bytes) -> str:
        try:
            from pypdf import PdfReader  # type: ignore
        except ImportError:
            return "Error: PDF support requires the 'pypdf' package (pip install pypdf)."
        reader = PdfReader(io.BytesIO(data))
        parts = []
        for i, page in enumerate(reader.pages, 1):
            txt = (page.extract_text() or "").strip()
            if txt:
                parts.append(f"--- Page {i} ---\n{txt}")
        return "\n\n".join(parts) or "(No extractable text — the PDF may be scanned images.)"

    @staticmethod
    def _docx_text(data: bytes) -> str:
        try:
            import docx  # type: ignore
        except ImportError:
            return "Error: Word support requires the 'python-docx' package."
        doc = docx.Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    def _xlsx_text(self, data: bytes) -> str:
        rows_by_sheet = self._xlsx_all_sheets(data)
        out = []
        for name, rows in rows_by_sheet.items():
            out.append(f"## Sheet: {name}\n{self._rows_to_markdown(rows)}")
        return "\n\n".join(out)

    @staticmethod
    def _xlsx_all_sheets(data: bytes) -> dict[str, list[list[Any]]]:
        from openpyxl import load_workbook  # type: ignore

        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        result: dict[str, list[list[Any]]] = {}
        for ws in wb.worksheets:
            rows = []
            for r, row in enumerate(ws.iter_rows(values_only=True)):
                if r >= 200:
                    break
                rows.append(list(row))
            result[ws.title] = rows
        wb.close()
        return result

    @staticmethod
    def _xlsx_rows(data: bytes, sheet: Optional[str], limit: int) -> list[list[Any]]:
        from openpyxl import load_workbook  # type: ignore

        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        ws = wb[sheet] if sheet and sheet in wb.sheetnames else wb.active
        rows = []
        for r, row in enumerate(ws.iter_rows(values_only=True)):
            if r >= limit:
                break
            rows.append(list(row))
        wb.close()
        return rows

    @staticmethod
    def _csv_text(data: bytes, delim: str) -> str:
        reader = csv.reader(io.StringIO(data.decode("utf-8", errors="replace")), delimiter=delim)
        return DocumentToolkit._rows_to_markdown([row for row in reader])

    @staticmethod
    def _rows_to_markdown(rows: list[list[Any]]) -> str:
        rows = [r for r in rows if r is not None]
        if not rows:
            return "(empty)"
        def cell(v: Any) -> str:
            return "" if v is None else str(v).replace("|", "\\|").replace("\n", " ")
        header = rows[0]
        width = max(len(r) for r in rows)
        header = list(header) + [""] * (width - len(header))
        lines = ["| " + " | ".join(cell(c) for c in header) + " |",
                 "| " + " | ".join("---" for _ in range(width)) + " |"]
        for r in rows[1:]:
            r = list(r) + [""] * (width - len(r))
            lines.append("| " + " | ".join(cell(c) for c in r) + " |")
        return "\n".join(lines)
