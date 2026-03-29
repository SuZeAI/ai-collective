from __future__ import annotations

import asyncio
import json
import os
import re
from pathlib import Path
from typing import Any, Optional

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def _sanitize_email(email: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9._-]", "_", email.strip().lower())
    return value or "default"


class SheetToolkit(BaseToolkit):
    """Google Sheets toolkit using OAuth token or service account credentials."""

    name: str = "sheet"

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
        default_storage_dir = Path("secrets") / "google"
        default_storage_dir.mkdir(parents=True, exist_ok=True)

        resolved_credentials = (
            self.credentials_path
            or os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET_PATH")
            or os.environ.get("CREDENTIALS_PATH")
            or "credentials.json"
        )

        resolved_service_account = self.service_account_path or os.environ.get("SERVICE_ACCOUNT_PATH")

        if self.token_path:
            resolved_token = self.token_path
        elif self.auth_email:
            resolved_token = str(default_storage_dir / f"token_{_sanitize_email(self.auth_email)}.json")
        else:
            resolved_token = os.environ.get("GOOGLE_SHEETS_TOKEN_PATH") or str(default_storage_dir / "token_default.json")

        return resolved_credentials, resolved_token, resolved_service_account

    def _build_clients(self) -> tuple[Any, Any]:
        try:
            from google.auth.transport.requests import Request
            from google.oauth2 import service_account
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
        except ImportError as exc:
            raise RuntimeError(
                "Google Sheets dependencies are missing. Install google-auth, google-auth-oauthlib, and google-api-python-client."
            ) from exc

        resolved_credentials, resolved_token, resolved_service_account = self._resolve_paths()

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
                "Google Sheets is not authorized. Open Skills, select Google Sheets, and click Authenticate Google."
            )

        sheets_service = build("sheets", "v4", credentials=creds)
        drive_service = build("drive", "v3", credentials=creds)
        return sheets_service, drive_service

    @tool(parse_docstring=True)
    async def list_spreadsheets(self, max_results: int = 20) -> list[dict[str, str]]:
        """List Google Spreadsheets from Drive.

        Args:
            max_results: Maximum number of spreadsheets to return.
        """

        def _run() -> list[dict[str, str]]:
            _sheets, drive = self._build_clients()
            response = (
                drive.files()
                .list(
                    q="mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
                    spaces="drive",
                    includeItemsFromAllDrives=True,
                    supportsAllDrives=True,
                    fields="files(id,name,modifiedTime)",
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
                }
                for item in rows
            ]

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def list_sheets(self, spreadsheet_id: str) -> list[str]:
        """List sheet tabs in a spreadsheet.

        Args:
            spreadsheet_id: Google spreadsheet ID.
        """

        def _run() -> list[str]:
            sheets_service, _drive = self._build_clients()
            spreadsheet = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
            return [
                str(sheet.get("properties", {}).get("title", ""))
                for sheet in spreadsheet.get("sheets", [])
                if isinstance(sheet, dict)
            ]

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def get_sheet_values(
        self,
        spreadsheet_id: str,
        sheet: str,
        cell_range: str = "A1:Z1000",
    ) -> list[list[Any]]:
        """Read values from a specific sheet range.

        Args:
            spreadsheet_id: Google spreadsheet ID.
            sheet: Sheet tab name.
            cell_range: A1 range, for example A1:D20.
        """

        def _run() -> list[list[Any]]:
            sheets_service, _drive = self._build_clients()
            full_range = f"{sheet}!{cell_range}" if cell_range else sheet
            response = (
                sheets_service.spreadsheets()
                .values()
                .get(spreadsheetId=spreadsheet_id, range=full_range)
                .execute()
            )
            return list(response.get("values", []))

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def update_sheet_values(
        self,
        spreadsheet_id: str,
        sheet: str,
        cell_range: str,
        values: list[list[Any]],
    ) -> dict[str, Any]:
        """Update values to a specific sheet range.

        Args:
            spreadsheet_id: Google spreadsheet ID.
            sheet: Sheet tab name.
            cell_range: A1 range, for example A1:D20.
            values: 2D value matrix to write.
        """

        def _run() -> dict[str, Any]:
            sheets_service, _drive = self._build_clients()
            full_range = f"{sheet}!{cell_range}" if cell_range else sheet
            payload = {"values": values}
            response = (
                sheets_service.spreadsheets()
                .values()
                .update(
                    spreadsheetId=spreadsheet_id,
                    range=full_range,
                    valueInputOption="USER_ENTERED",
                    body=payload,
                )
                .execute()
            )
            return json.loads(json.dumps(response))

        return await asyncio.to_thread(_run)
