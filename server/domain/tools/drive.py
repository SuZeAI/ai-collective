from __future__ import annotations

import asyncio
import os
import re
from pathlib import Path
from typing import Any, Optional

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit
from server.api.settings import settings
from server.infra.storage.google_oauth_store import restore_token_if_missing, save_token

# server/domain/tools/drive.py -> project root is three parents up.
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
]

FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
SHORTCUT_MIME_TYPE = "application/vnd.google-apps.shortcut"


def _sanitize_email(email: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9._-]", "_", email.strip().lower())
    return value or "default"


class DriveToolkit(BaseToolkit):
    """Google Drive toolkit using OAuth token or service account credentials."""

    name: str = "drive"

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
        default_storage_dir = _PROJECT_ROOT / ".secrets" / "google" / self.get_canonical_name()
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

    def _build_client(self) -> Any:
        try:
            from google.auth.transport.requests import Request
            from google.oauth2 import service_account
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
        except ImportError as exc:
            raise RuntimeError(
                "Google Drive dependencies are missing. Install google-auth, google-auth-oauthlib, and google-api-python-client."
            ) from exc

        resolved_credentials, resolved_token, resolved_service_account = self._resolve_paths()

        creds = None

        if resolved_service_account and os.path.exists(resolved_service_account):
            creds = service_account.Credentials.from_service_account_file(resolved_service_account, scopes=SCOPES)

        if creds is None and resolved_token:
            restore_token_if_missing(resolved_token)
            if os.path.exists(resolved_token):
                creds = Credentials.from_authorized_user_file(resolved_token, SCOPES)

        if creds is not None and getattr(creds, "expired", False) and getattr(creds, "refresh_token", None):
            creds.refresh(Request())
            if resolved_token:
                save_token(resolved_token, creds.to_json())

        if creds is None or not getattr(creds, "valid", False):
            raise RuntimeError(
                "Google Drive is not authorized. Open Skills, select Google Drive, and click Authenticate Google."
            )

        drive_service = build("drive", "v3", credentials=creds)
        return drive_service

    @tool(parse_docstring=True)
    async def search_files(
        self,
        query: str,
        page_size: int = 50,
        raw_query: bool = False,
    ) -> list[dict[str, Any]]:
        """Search for files in Google Drive.

        Args:
            query: Search query (or raw Google Drive API query if raw_query=True).
            page_size: Maximum number of results (1-100, default 50).
            raw_query: If true, query is passed directly to Drive API enabling date/mimeType filters.
        """

        def _run() -> list[dict[str, Any]]:
            drive = self._build_client()
            q = query if raw_query else f"fullText contains '{query}'"
            response = (
                drive.files()
                .list(
                    q=q,
                    spaces="drive",
                    includeItemsFromAllDrives=True,
                    supportsAllDrives=True,
                    fields="files(id,name,mimeType,modifiedTime,createdTime,size,webViewLink,owners)",
                    orderBy="modifiedTime desc",
                    pageSize=max(1, min(page_size, 100)),
                )
                .execute()
            )
            files = response.get("files", [])
            return [
                {
                    "id": str(file.get("id", "")),
                    "name": str(file.get("name", "")),
                    "mimeType": str(file.get("mimeType", "")),
                    "modifiedTime": str(file.get("modifiedTime", "")),
                    "createdTime": str(file.get("createdTime", "")),
                    "size": str(file.get("size", "")),
                    "webViewLink": str(file.get("webViewLink", "")),
                }
                for file in files
            ]

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def list_folder(
        self,
        folder_id: str = "",
        page_size: int = 50,
    ) -> list[dict[str, Any]]:
        """List contents of a folder (defaults to root).

        Args:
            folder_id: Folder ID (empty string for root).
            page_size: Maximum number of items (1-100, default 50).
        """

        def _run() -> list[dict[str, Any]]:
            drive = self._build_client()
            query_parts = ["trashed=false"]
            if folder_id:
                query_parts.append(f"'{folder_id}' in parents")
            else:
                query_parts.append("'root' in parents")
            q = " and ".join(query_parts)

            response = (
                drive.files()
                .list(
                    q=q,
                    spaces="drive",
                    includeItemsFromAllDrives=True,
                    supportsAllDrives=True,
                    fields="files(id,name,mimeType,modifiedTime,size,webViewLink)",
                    orderBy="modifiedTime desc",
                    pageSize=max(1, min(page_size, 100)),
                )
                .execute()
            )
            files = response.get("files", [])
            return [
                {
                    "id": str(file.get("id", "")),
                    "name": str(file.get("name", "")),
                    "mimeType": str(file.get("mimeType", "")),
                    "isFolder": str(file.get("mimeType", "")) == FOLDER_MIME_TYPE,
                    "modifiedTime": str(file.get("modifiedTime", "")),
                    "size": str(file.get("size", "")),
                    "webViewLink": str(file.get("webViewLink", "")),
                }
                for file in files
            ]

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def create_text_file(
        self,
        name: str,
        content: str,
        parent_folder_id: str = "",
    ) -> dict[str, str]:
        """Create a new text or markdown file.

        Args:
            name: File name (.txt or .md).
            content: File content.
            parent_folder_id: Parent folder ID (empty for root).
        """

        def _run() -> dict[str, str]:
            drive = self._build_client()
            file_metadata = {"name": name}
            if parent_folder_id:
                file_metadata["parents"] = [parent_folder_id]

            file = (
                drive.files()
                .create(
                    body=file_metadata,
                    media_body=content,
                    fields="id,name,webViewLink",
                )
                .execute()
            )
            return {
                "id": str(file.get("id", "")),
                "name": str(file.get("name", "")),
                "webViewLink": str(file.get("webViewLink", "")),
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def update_text_file(
        self,
        file_id: str,
        content: str,
        name: str = "",
    ) -> dict[str, str]:
        """Update an existing text or markdown file.

        Args:
            file_id: ID of the file to update.
            content: New file content.
            name: New file name (optional).
        """

        def _run() -> dict[str, str]:
            drive = self._build_client()
            file_metadata = {}
            if name:
                file_metadata["name"] = name

            file = (
                drive.files()
                .update(
                    fileId=file_id,
                    body=file_metadata,
                    media_body=content,
                    fields="id,name,modifiedTime",
                )
                .execute()
            )
            return {
                "id": str(file.get("id", "")),
                "name": str(file.get("name", "")),
                "modifiedTime": str(file.get("modifiedTime", "")),
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def create_folder(
        self,
        name: str,
        parent_folder_id: str = "",
    ) -> dict[str, str]:
        """Create a new folder in Google Drive.

        Args:
            name: Folder name.
            parent_folder_id: Parent folder ID (empty for root).
        """

        def _run() -> dict[str, str]:
            drive = self._build_client()
            file_metadata = {
                "name": name,
                "mimeType": FOLDER_MIME_TYPE,
            }
            if parent_folder_id:
                file_metadata["parents"] = [parent_folder_id]

            folder = (
                drive.files()
                .create(
                    body=file_metadata,
                    fields="id,name,webViewLink",
                )
                .execute()
            )
            return {
                "id": str(folder.get("id", "")),
                "name": str(folder.get("name", "")),
                "webViewLink": str(folder.get("webViewLink", "")),
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def rename_item(
        self,
        item_id: str,
        new_name: str,
    ) -> dict[str, str]:
        """Rename a file or folder.

        Args:
            item_id: ID of the item to rename.
            new_name: New name.
        """

        def _run() -> dict[str, str]:
            drive = self._build_client()
            file = (
                drive.files()
                .update(
                    fileId=item_id,
                    body={"name": new_name},
                    fields="id,name,modifiedTime",
                )
                .execute()
            )
            return {
                "id": str(file.get("id", "")),
                "name": str(file.get("name", "")),
                "modifiedTime": str(file.get("modifiedTime", "")),
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def move_item(
        self,
        item_id: str,
        destination_folder_id: str = "",
    ) -> dict[str, str]:
        """Move a file or folder to another location.

        Args:
            item_id: ID of the item to move.
            destination_folder_id: Destination folder ID (empty for root).
        """

        def _run() -> dict[str, str]:
            drive = self._build_client()
            previous_parents = (
                drive.files()
                .get(fileId=item_id, fields="parents")
                .execute()
                .get("parents", [])
            )
            file = (
                drive.files()
                .update(
                    fileId=item_id,
                    addParents=destination_folder_id or "root",
                    removeParents=",".join(previous_parents),
                    fields="id,name,webViewLink",
                )
                .execute()
            )
            return {
                "id": str(file.get("id", "")),
                "name": str(file.get("name", "")),
                "webViewLink": str(file.get("webViewLink", "")),
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def delete_item(
        self,
        item_id: str,
    ) -> dict[str, str]:
        """Move a file or folder to trash.

        Args:
            item_id: ID of the item to delete.
        """

        def _run() -> dict[str, str]:
            drive = self._build_client()
            drive.files().delete(fileId=item_id).execute()
            return {
                "success": "true",
                "itemId": item_id,
                "message": "Item moved to trash",
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def copy_file(
        self,
        file_id: str,
        new_name: str = "",
        parent_folder_id: str = "",
    ) -> dict[str, str]:
        """Create a copy of a file.

        Args:
            file_id: ID of the file to copy.
            new_name: Name for the copied file (defaults to "Copy of [original name]").
            parent_folder_id: Destination folder ID (defaults to same folder).
        """

        def _run() -> dict[str, str]:
            drive = self._build_client()
            body = {}
            if new_name:
                body["name"] = new_name
            if parent_folder_id:
                body["parents"] = [parent_folder_id]

            file = drive.files().copy(fileId=file_id, body=body, fields="id,name,webViewLink").execute()
            return {
                "id": str(file.get("id", "")),
                "name": str(file.get("name", "")),
                "webViewLink": str(file.get("webViewLink", "")),
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def upload_file(
        self,
        local_path: str,
        name: str = "",
        parent_folder_id: str = "",
    ) -> dict[str, str]:
        """Upload a local file to Google Drive.

        Args:
            local_path: Absolute path to the local file.
            name: File name in Drive (defaults to local filename).
            parent_folder_id: Parent folder ID (empty for root).
        """

        def _run() -> dict[str, str]:
            try:
                from googleapiclient.http import MediaFileUpload
            except ImportError as exc:
                raise RuntimeError("Missing googleapiclient dependency") from exc

            drive = self._build_client()
            path = Path(local_path)
            if not path.exists():
                raise FileNotFoundError(f"File not found: {local_path}")

            file_name = name or path.name
            file_metadata = {"name": file_name}
            if parent_folder_id:
                file_metadata["parents"] = [parent_folder_id]

            media = MediaFileUpload(str(path), resumable=True)
            file = (
                drive.files()
                .create(
                    body=file_metadata,
                    media_body=media,
                    fields="id,name,size,webViewLink",
                )
                .execute()
            )
            return {
                "id": str(file.get("id", "")),
                "name": str(file.get("name", "")),
                "size": str(file.get("size", "")),
                "webViewLink": str(file.get("webViewLink", "")),
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def download_file(
        self,
        file_id: str,
        local_path: str,
        overwrite: bool = False,
    ) -> dict[str, str]:
        """Download a file from Google Drive.

        Args:
            file_id: Google Drive file ID.
            local_path: Absolute local path to save the file.
            overwrite: Whether to overwrite if file exists (default False).
        """

        def _run() -> dict[str, str]:
            try:
                from googleapiclient.http import MediaIoBaseDownload
            except ImportError as exc:
                raise RuntimeError("Missing googleapiclient dependency") from exc

            drive = self._build_client()
            path = Path(local_path)

            if path.exists() and not overwrite:
                raise FileExistsError(f"File already exists: {local_path}. Set overwrite=True to replace.")

            path.parent.mkdir(parents=True, exist_ok=True)

            request = drive.files().get_media(fileId=file_id)
            with open(path, "wb") as f:
                downloader = MediaIoBaseDownload(f, request)
                done = False
                while not done:
                    status, done = downloader.next_chunk()

            return {
                "success": "true",
                "fileId": file_id,
                "localPath": str(path),
                "size": str(path.stat().st_size),
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def list_permissions(
        self,
        file_id: str,
    ) -> list[dict[str, Any]]:
        """List sharing permissions for a file.

        Args:
            file_id: Google Drive file ID.
        """

        def _run() -> list[dict[str, Any]]:
            drive = self._build_client()
            response = (
                drive.permissions()
                .list(
                    fileId=file_id,
                    fields="permissions(id,type,role,emailAddress,displayName)",
                )
                .execute()
            )
            permissions = response.get("permissions", [])
            return [
                {
                    "id": str(perm.get("id", "")),
                    "type": str(perm.get("type", "")),
                    "role": str(perm.get("role", "")),
                    "emailAddress": str(perm.get("emailAddress", "")),
                    "displayName": str(perm.get("displayName", "")),
                }
                for perm in permissions
            ]

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def add_permission(
        self,
        file_id: str,
        email_address: str,
        role: str = "reader",
        perm_type: str = "user",
    ) -> dict[str, str]:
        """Add a sharing permission to a file.

        Args:
            file_id: Google Drive file ID.
            email_address: Target user/group email.
            role: Permission role (reader/commenter/writer/organizer/owner).
            perm_type: Principal type (user/group/domain/anyone).
        """

        def _run() -> dict[str, str]:
            drive = self._build_client()
            permission = {
                "type": perm_type,
                "role": role,
            }
            if perm_type == "user" or perm_type == "group":
                permission["emailAddress"] = email_address

            result = (
                drive.permissions()
                .create(
                    fileId=file_id,
                    body=permission,
                    fields="id,type,role,emailAddress",
                )
                .execute()
            )
            return {
                "id": str(result.get("id", "")),
                "type": str(result.get("type", "")),
                "role": str(result.get("role", "")),
                "emailAddress": str(result.get("emailAddress", "")),
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def remove_permission(
        self,
        file_id: str,
        permission_id: str,
    ) -> dict[str, str]:
        """Remove a permission from a file.

        Args:
            file_id: Google Drive file ID.
            permission_id: Permission ID to remove.
        """

        def _run() -> dict[str, str]:
            drive = self._build_client()
            drive.permissions().delete(fileId=file_id, permissionId=permission_id).execute()
            return {
                "success": "true",
                "fileId": file_id,
                "permissionId": permission_id,
                "message": "Permission removed",
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def share_file(
        self,
        file_id: str,
        email_address: str,
        role: str = "reader",
    ) -> dict[str, str]:
        """Convenience method to share a file with a user.

        Args:
            file_id: Google Drive file ID.
            email_address: User email to share with.
            role: Permission role (reader/commenter/writer).
        """

        def _run() -> dict[str, str]:
            drive = self._build_client()
            permission = {
                "type": "user",
                "role": role,
                "emailAddress": email_address,
            }
            result = (
                drive.permissions()
                .create(
                    fileId=file_id,
                    body=permission,
                    fields="id,role,emailAddress",
                )
                .execute()
            )
            return {
                "fileId": file_id,
                "sharedWith": email_address,
                "role": str(result.get("role", "")),
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def list_shared_drives(
        self,
        page_size: int = 50,
    ) -> list[dict[str, str]]:
        """List available Google Shared Drives.

        Args:
            page_size: Number of drives to return (1-100, default 50).
        """

        def _run() -> list[dict[str, str]]:
            drive = self._build_client()
            response = (
                drive.drives()
                .list(
                    fields="drives(id,name,restrictions)",
                    pageSize=max(1, min(page_size, 100)),
                )
                .execute()
            )
            drives = response.get("drives", [])
            return [
                {
                    "id": str(drive_item.get("id", "")),
                    "name": str(drive_item.get("name", "")),
                }
                for drive_item in drives
            ]

        return await asyncio.to_thread(_run)
