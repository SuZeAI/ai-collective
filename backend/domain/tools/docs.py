from __future__ import annotations

import asyncio
import json
import os
import re
from pathlib import Path
from typing import Any, Optional

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.api.settings import settings

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def _sanitize_email(email: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9._-]", "_", email.strip().lower())
    return value or "default"


class DocsToolkit(BaseToolkit):
    """Google Docs toolkit using OAuth token or service account credentials."""

    name: str = "docs"

    def __init__(
        self,
        auth_email: str = "",
        token_path: str = "",
        credentials_path: str = "",
        service_account_path: str = "",
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.auth_email = (auth_email or "").strip()
        self.token_path = (token_path or "").strip()
        self.credentials_path = (credentials_path or "").strip()
        self.service_account_path = (service_account_path or "").strip()

    def _resolve_paths(self) -> tuple[Optional[str], Optional[str], Optional[str]]:
        default_storage_dir = Path("secrets") / "google" / self.get_canonical_name()
        default_storage_dir.mkdir(parents=True, exist_ok=True)

        resolved_credentials = (
            self.credentials_path
            or settings.auth.google_oauth_client_secret_path
            or settings.auth.credentials_path
            or "credentials.json"
        )

        resolved_service_account = self.service_account_path or settings.auth.service_account_path

        if self.token_path:
            resolved_token = self.token_path
        elif self.auth_email:
            resolved_token = str(default_storage_dir / f"token_{_sanitize_email(self.auth_email)}.json")
        else:
            resolved_token = str(default_storage_dir / "token_default.json")

        return resolved_credentials, resolved_token, resolved_service_account

    def _build_clients(self) -> tuple[Any, Any]:
        try:
            from google.auth.transport.requests import Request
            from google.oauth2 import service_account
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
        except ImportError as exc:
            raise RuntimeError(
                "Google Docs dependencies are missing. Install google-auth, google-auth-oauthlib, and google-api-python-client."
            ) from exc

        _resolved_credentials, resolved_token, resolved_service_account = self._resolve_paths()

        creds = None

        if resolved_service_account and os.path.exists(resolved_service_account):
            creds = service_account.Credentials.from_service_account_file(resolved_service_account, scopes=SCOPES)

        if creds is None and resolved_token and os.path.exists(resolved_token):
            creds = Credentials.from_authorized_user_file(resolved_token, SCOPES)

        if creds is not None and getattr(creds, "expired", False) and getattr(creds, "refresh_token", None):
            creds.refresh(Request())
            if resolved_token:
                Path(resolved_token).write_text(creds.to_json(), encoding="utf-8")

        if creds is None or not getattr(creds, "valid", False):
            raise RuntimeError(
                "Google Docs is not authorized. Open Skills, select Google Docs, and click Authenticate Google."
            )

        docs_service = build("docs", "v1", credentials=creds)
        drive_service = build("drive", "v3", credentials=creds)
        return docs_service, drive_service

    @staticmethod
    def _extract_text_from_elements(elements: list[dict[str, Any]]) -> str:
        chunks: list[str] = []

        def _walk(content: list[dict[str, Any]]) -> None:
            for item in content:
                paragraph = item.get("paragraph")
                if isinstance(paragraph, dict):
                    for pe in paragraph.get("elements", []):
                        text_run = pe.get("textRun")
                        if isinstance(text_run, dict):
                            chunks.append(str(text_run.get("content", "")))

                table = item.get("table")
                if isinstance(table, dict):
                    for row in table.get("tableRows", []):
                        for cell in row.get("tableCells", []):
                            cell_content = cell.get("content", [])
                            if isinstance(cell_content, list):
                                _walk(cell_content)

                toc = item.get("tableOfContents")
                if isinstance(toc, dict):
                    toc_content = toc.get("content", [])
                    if isinstance(toc_content, list):
                        _walk(toc_content)

        _walk(elements)
        return "".join(chunks)

    @tool(parse_docstring=True)
    async def list_google_docs(self, max_results: int = 20) -> list[dict[str, str]]:
        """List Google Docs files from Drive.

        Args:
            max_results: Maximum number of docs to return.
        """

        def _run() -> list[dict[str, str]]:
            _docs, drive = self._build_clients()
            response = (
                drive.files()
                .list(
                    q="mimeType='application/vnd.google-apps.document' and trashed=false",
                    spaces="drive",
                    includeItemsFromAllDrives=True,
                    supportsAllDrives=True,
                    fields="files(id,name,modifiedTime,webViewLink)",
                    orderBy="modifiedTime desc",
                    pageSize=max(1, min(max_results, 100)),
                )
                .execute()
            )
            rows = response.get("files", [])
            return [
                {
                    "id": str(item.get("id", "")),
                    "title": str(item.get("name", "")),
                    "modified_time": str(item.get("modifiedTime", "")),
                    "web_view_link": str(item.get("webViewLink", "")),
                }
                for item in rows
            ]

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def get_document_info(self, document_id: str) -> dict[str, Any]:
        """Get metadata and basic info for a Google Doc.

        Args:
            document_id: Google document ID.
        """

        def _run() -> dict[str, Any]:
            docs, drive = self._build_clients()
            doc = docs.documents().get(documentId=document_id).execute()
            file_info = (
                drive.files()
                .get(
                    fileId=document_id,
                    fields="id,name,createdTime,modifiedTime,webViewLink,owners(emailAddress,displayName)",
                    supportsAllDrives=True,
                )
                .execute()
            )
            return {
                "id": str(file_info.get("id", "")),
                "title": str(file_info.get("name", "")),
                "revision_id": str(doc.get("revisionId", "")),
                "created_time": str(file_info.get("createdTime", "")),
                "modified_time": str(file_info.get("modifiedTime", "")),
                "web_view_link": str(file_info.get("webViewLink", "")),
                "owner": [
                    {
                        "name": str(owner.get("displayName", "")),
                        "email": str(owner.get("emailAddress", "")),
                    }
                    for owner in file_info.get("owners", [])
                ],
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def read_google_doc(self, document_id: str, max_length: int = 20000) -> dict[str, Any]:
        """Read Google Doc content as plain text.

        Args:
            document_id: Google document ID.
            max_length: Maximum number of characters returned.
        """

        def _run() -> dict[str, Any]:
            docs, _drive = self._build_clients()
            doc = docs.documents().get(documentId=document_id).execute()
            title = str(doc.get("title", ""))
            body = doc.get("body", {}) if isinstance(doc, dict) else {}
            content = body.get("content", []) if isinstance(body, dict) else []
            text = self._extract_text_from_elements(content if isinstance(content, list) else [])
            limit = max(1, max_length)
            truncated = text[:limit]
            return {
                "document_id": document_id,
                "title": title,
                "content": truncated,
                "is_truncated": len(text) > len(truncated),
                "content_length": len(text),
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def create_google_doc(self, name: str, content: str = "") -> dict[str, Any]:
        """Create a new Google Doc and optionally set initial content.

        Args:
            name: Document title.
            content: Initial text content.
        """

        def _run() -> dict[str, Any]:
            docs, drive = self._build_clients()
            created = (
                drive.files()
                .create(
                    body={"name": name, "mimeType": "application/vnd.google-apps.document"},
                    fields="id,name,webViewLink",
                    supportsAllDrives=True,
                )
                .execute()
            )

            document_id = str(created.get("id", ""))
            if content and document_id:
                docs.documents().batchUpdate(
                    documentId=document_id,
                    body={
                        "requests": [
                            {
                                "insertText": {
                                    "location": {"index": 1},
                                    "text": content,
                                }
                            }
                        ]
                    },
                ).execute()

            return {
                "id": document_id,
                "title": str(created.get("name", "")),
                "web_view_link": str(created.get("webViewLink", "")),
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def append_text(self, document_id: str, text: str) -> dict[str, Any]:
        """Append text to the end of a Google Doc body.

        Args:
            document_id: Google document ID.
            text: Text to append.
        """

        def _run() -> dict[str, Any]:
            docs, _drive = self._build_clients()
            doc = docs.documents().get(documentId=document_id).execute()
            body = doc.get("body", {}) if isinstance(doc, dict) else {}
            content = body.get("content", []) if isinstance(body, dict) else []

            insert_index = 1
            if isinstance(content, list) and content:
                last = content[-1]
                end_index = int(last.get("endIndex", 1)) if isinstance(last, dict) else 1
                insert_index = max(1, end_index - 1)

            response = docs.documents().batchUpdate(
                documentId=document_id,
                body={
                    "requests": [
                        {
                            "insertText": {
                                "location": {"index": insert_index},
                                "text": text,
                            }
                        }
                    ]
                },
            ).execute()
            return json.loads(json.dumps(response))

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def find_and_replace_in_doc(
        self,
        document_id: str,
        find_text: str,
        replace_text: str,
        match_case: bool = False,
    ) -> dict[str, Any]:
        """Find and replace text in a Google Doc.

        Args:
            document_id: Google document ID.
            find_text: Text to find.
            replace_text: Replacement text.
            match_case: Case-sensitive matching.
        """

        def _run() -> dict[str, Any]:
            docs, _drive = self._build_clients()
            response = docs.documents().batchUpdate(
                documentId=document_id,
                body={
                    "requests": [
                        {
                            "replaceAllText": {
                                "containsText": {
                                    "text": find_text,
                                    "matchCase": match_case,
                                },
                                "replaceText": replace_text,
                            }
                        }
                    ]
                },
            ).execute()

            occurrences = 0
            replies = response.get("replies", []) if isinstance(response, dict) else []
            if replies and isinstance(replies[0], dict):
                occurrences = int(replies[0].get("replaceAllText", {}).get("occurrencesChanged", 0))

            return {
                "document_id": document_id,
                "occurrences_changed": occurrences,
            }

        return await asyncio.to_thread(_run)
