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
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/drive",
]


def _sanitize_email(email: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9._-]", "_", email.strip().lower())
    return value or "default"


class SlidesToolkit(BaseToolkit):
    """Google Slides toolkit using OAuth token or service account credentials."""

    name: str = "slides"

    def __init__(
        self,
        auth_email: str = "",
        token_path: str = "",
        credentials_path: str = "",
        service_account_path: str = "",
        **kwargs: Any,
    ):
        self.auth_email = (auth_email or "").strip()
        self.token_path = (token_path or "").strip()
        self.credentials_path = (credentials_path or "").strip()
        self.service_account_path = (service_account_path or "").strip()
        super().__init__(**kwargs)

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
            resolved_token = os.environ.get("GOOGLE_SLIDES_TOKEN_PATH") or str(default_storage_dir / "token_default.json")

        return resolved_credentials, resolved_token, resolved_service_account

    def _build_clients(self) -> tuple[Any, Any]:
        try:
            from google.auth.transport.requests import Request
            from google.oauth2 import service_account
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
        except ImportError as exc:
            raise RuntimeError(
                "Google Slides dependencies are missing. Install google-auth, google-auth-oauthlib, and google-api-python-client."
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
                "Google Slides is not authorized. Open Skills, select Google Slides, and click Authenticate Google."
            )

        slides_service = build("slides", "v1", credentials=creds)
        drive_service = build("drive", "v3", credentials=creds)
        return slides_service, drive_service

    @staticmethod
    def _extract_plain_text(page_element: dict[str, Any]) -> str:
        shape = page_element.get("shape") if isinstance(page_element, dict) else None
        if not isinstance(shape, dict):
            return ""

        text = shape.get("text")
        if not isinstance(text, dict):
            return ""

        text_elements = text.get("textElements", [])
        chunks: list[str] = []
        if isinstance(text_elements, list):
            for item in text_elements:
                if not isinstance(item, dict):
                    continue
                text_run = item.get("textRun")
                if isinstance(text_run, dict):
                    chunks.append(str(text_run.get("content", "")))
        return "".join(chunks).strip()

    @tool(parse_docstring=True)
    async def list_presentations(self, max_results: int = 20) -> list[dict[str, str]]:
        """List Google Slides presentations from Drive.

        Args:
            max_results: Maximum number of presentations to return.
        """

        def _run() -> list[dict[str, str]]:
            _slides, drive = self._build_clients()
            response = (
                drive.files()
                .list(
                    q="mimeType='application/vnd.google-apps.presentation' and trashed=false",
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
    async def get_presentation_content(
        self,
        presentation_id: str,
        slide_index: Optional[int] = None,
    ) -> dict[str, Any]:
        """Get plain text content of slides.

        Args:
            presentation_id: Google presentation ID.
            slide_index: Optional 0-based slide index to return a single slide.
        """

        def _run() -> dict[str, Any]:
            slides, _drive = self._build_clients()
            presentation = slides.presentations().get(presentationId=presentation_id).execute()
            all_slides = presentation.get("slides", [])
            if not isinstance(all_slides, list):
                all_slides = []

            indexed_slides: list[tuple[int, dict[str, Any]]] = []
            if slide_index is None:
                indexed_slides = [
                    (idx, slide)
                    for idx, slide in enumerate(all_slides)
                    if isinstance(slide, dict)
                ]
            elif 0 <= slide_index < len(all_slides) and isinstance(all_slides[slide_index], dict):
                indexed_slides = [(slide_index, all_slides[slide_index])]

            result_slides: list[dict[str, Any]] = []
            for idx, slide in indexed_slides:
                page_elements = slide.get("pageElements", [])
                texts: list[str] = []
                if isinstance(page_elements, list):
                    for el in page_elements:
                        if not isinstance(el, dict):
                            continue
                        content = self._extract_plain_text(el)
                        if content:
                            texts.append(content)

                result_slides.append(
                    {
                        "index": idx,
                        "object_id": str(slide.get("objectId", "")),
                        "text": "\n".join(texts).strip(),
                    }
                )

            return {
                "presentation_id": presentation_id,
                "title": str(presentation.get("title", "")),
                "slides": result_slides,
                "slide_count": len(all_slides),
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def create_presentation(
        self,
        name: str,
        slides: list[dict[str, str]],
        parent_folder_id: str = "",
    ) -> dict[str, Any]:
        """Create a new Google Slides presentation.

        Args:
            name: Presentation title.
            slides: Array of slide objects with keys: title, content.
            parent_folder_id: Optional Drive folder ID where the file is moved.
        """

        def _run() -> dict[str, Any]:
            slides_service, drive = self._build_clients()
            created = slides_service.presentations().create(body={"title": name}).execute()
            presentation_id = str(created.get("presentationId", ""))

            if parent_folder_id and presentation_id:
                drive.files().update(
                    fileId=presentation_id,
                    addParents=parent_folder_id,
                    removeParents="root",
                    supportsAllDrives=True,
                ).execute()

            requests: list[dict[str, Any]] = []
            # Keep the first default slide; insert additional slides then update text boxes.
            for index, item in enumerate(slides):
                title = str(item.get("title", "")).strip()
                content = str(item.get("content", "")).strip()
                slide_object_id = f"slide_{index + 1}"

                if index > 0:
                    requests.append(
                        {
                            "createSlide": {
                                "objectId": slide_object_id,
                                "insertionIndex": index,
                                "slideLayoutReference": {"predefinedLayout": "TITLE_AND_BODY"},
                            }
                        }
                    )
                else:
                    # Default first slide objectId is unknown. Use explicit mapping for consistency.
                    requests.append(
                        {
                            "createSlide": {
                                "objectId": slide_object_id,
                                "insertionIndex": 0,
                                "slideLayoutReference": {"predefinedLayout": "TITLE_AND_BODY"},
                            }
                        }
                    )

                title_box_id = f"title_box_{index + 1}"
                body_box_id = f"body_box_{index + 1}"
                requests.extend(
                    [
                        {
                            "createShape": {
                                "objectId": title_box_id,
                                "shapeType": "TEXT_BOX",
                                "elementProperties": {
                                    "pageObjectId": slide_object_id,
                                    "size": {
                                        "height": {"magnitude": 60, "unit": "PT"},
                                        "width": {"magnitude": 620, "unit": "PT"},
                                    },
                                    "transform": {
                                        "scaleX": 1,
                                        "scaleY": 1,
                                        "translateX": 50,
                                        "translateY": 40,
                                        "unit": "PT",
                                    },
                                },
                            }
                        },
                        {
                            "insertText": {
                                "objectId": title_box_id,
                                "insertionIndex": 0,
                                "text": title or "Untitled",
                            }
                        },
                        {
                            "createShape": {
                                "objectId": body_box_id,
                                "shapeType": "TEXT_BOX",
                                "elementProperties": {
                                    "pageObjectId": slide_object_id,
                                    "size": {
                                        "height": {"magnitude": 320, "unit": "PT"},
                                        "width": {"magnitude": 620, "unit": "PT"},
                                    },
                                    "transform": {
                                        "scaleX": 1,
                                        "scaleY": 1,
                                        "translateX": 50,
                                        "translateY": 130,
                                        "unit": "PT",
                                    },
                                },
                            }
                        },
                        {
                            "insertText": {
                                "objectId": body_box_id,
                                "insertionIndex": 0,
                                "text": content,
                            }
                        },
                    ]
                )

            if requests and presentation_id:
                slides_service.presentations().batchUpdate(
                    presentationId=presentation_id,
                    body={"requests": requests},
                ).execute()

            # Remove the initial blank slide (new presentation starts with one slide).
            if presentation_id:
                current = slides_service.presentations().get(presentationId=presentation_id).execute()
                existing_slides = current.get("slides", [])
                if isinstance(existing_slides, list):
                    extra_ids = [
                        str(slide.get("objectId", ""))
                        for slide in existing_slides
                        if isinstance(slide, dict) and str(slide.get("objectId", "")).startswith("p")
                    ]
                    if extra_ids:
                        slides_service.presentations().batchUpdate(
                            presentationId=presentation_id,
                            body={
                                "requests": [
                                    {"deleteObject": {"objectId": object_id}}
                                    for object_id in extra_ids
                                ]
                            },
                        ).execute()

            return {
                "id": presentation_id,
                "title": name,
                "slide_count": len(slides),
                "web_view_link": f"https://docs.google.com/presentation/d/{presentation_id}",
            }

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def replace_all_text(
        self,
        presentation_id: str,
        contains_text: str,
        replace_text: str,
        match_case: bool = False,
    ) -> dict[str, Any]:
        """Replace text across all slides.

        Args:
            presentation_id: Google presentation ID.
            contains_text: Text to find.
            replace_text: Replacement text.
            match_case: Case-sensitive matching.
        """

        def _run() -> dict[str, Any]:
            slides, _drive = self._build_clients()
            response = slides.presentations().batchUpdate(
                presentationId=presentation_id,
                body={
                    "requests": [
                        {
                            "replaceAllText": {
                                "containsText": {
                                    "text": contains_text,
                                    "matchCase": match_case,
                                },
                                "replaceText": replace_text,
                            }
                        }
                    ]
                },
            ).execute()
            return json.loads(json.dumps(response))

        return await asyncio.to_thread(_run)
