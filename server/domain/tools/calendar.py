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

# server/domain/tools/calendar.py -> project root is three parents up.
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive",
]


def _sanitize_email(email: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9._-]", "_", email.strip().lower())
    return value or "default"


class CalendarToolkit(BaseToolkit):
    """Google Calendar toolkit using OAuth token or service account credentials."""

    name: str = "calendar"

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
                "Google Calendar dependencies are missing. Install google-auth, google-auth-oauthlib, and google-api-python-client."
            ) from exc

        _resolved_credentials, resolved_token, resolved_service_account = self._resolve_paths()

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
                "Google Calendar is not authorized. Open Skills, select Google Calendar, and click Authenticate Google."
            )

        return build("calendar", "v3", credentials=creds)

    @staticmethod
    def _format_event(event: dict[str, Any]) -> dict[str, Any]:
        start = event.get("start", {}) if isinstance(event.get("start"), dict) else {}
        end = event.get("end", {}) if isinstance(event.get("end"), dict) else {}
        attendees = event.get("attendees", []) if isinstance(event.get("attendees"), list) else []
        conference_data = event.get("conferenceData", {}) if isinstance(event.get("conferenceData"), dict) else {}

        meeting_link = str(event.get("hangoutLink", ""))
        entry_points = conference_data.get("entryPoints", []) if isinstance(conference_data.get("entryPoints"), list) else []
        if not meeting_link and entry_points:
            for entry_point in entry_points:
                if not isinstance(entry_point, dict):
                    continue
                if entry_point.get("entryPointType") == "video" and entry_point.get("uri"):
                    meeting_link = str(entry_point["uri"])
                    break

        return {
            "id": str(event.get("id", "")),
            "summary": str(event.get("summary", "")),
            "description": str(event.get("description", "")),
            "location": str(event.get("location", "")),
            "status": str(event.get("status", "")),
            "html_link": str(event.get("htmlLink", "")),
            "meeting_link": meeting_link,
            "start": {
                "date_time": str(start.get("dateTime", "")),
                "date": str(start.get("date", "")),
                "time_zone": str(start.get("timeZone", "")),
            },
            "end": {
                "date_time": str(end.get("dateTime", "")),
                "date": str(end.get("date", "")),
                "time_zone": str(end.get("timeZone", "")),
            },
            "attendees": [
                {
                    "email": str(attendee.get("email", "")),
                    "display_name": str(attendee.get("displayName", "")),
                    "response_status": str(attendee.get("responseStatus", "")),
                }
                for attendee in attendees
                if isinstance(attendee, dict)
            ],
            "organizer": event.get("organizer", {}),
            "created": str(event.get("created", "")),
            "updated": str(event.get("updated", "")),
            "recurrence": event.get("recurrence", []),
        }

    @tool(parse_docstring=True)
    async def list_calendars(self, show_hidden: bool = False, max_results: int = 100) -> list[dict[str, Any]]:
        """List accessible Google Calendars.

        Args:
            show_hidden: Include hidden calendars.
            max_results: Maximum number of calendars to return (1-250).
        """

        def _run() -> list[dict[str, Any]]:
            calendar = self._build_client()
            response = (
                calendar.calendarList()
                .list(
                    showHidden=show_hidden,
                    maxResults=max(1, min(max_results, 250)),
                )
                .execute()
            )
            calendars = response.get("items", [])
            return [
                {
                    "id": str(item.get("id", "")),
                    "summary": str(item.get("summary", "")),
                    "description": str(item.get("description", "")),
                    "time_zone": str(item.get("timeZone", "")),
                    "access_role": str(item.get("accessRole", "")),
                    "primary": bool(item.get("primary", False)),
                }
                for item in calendars
                if isinstance(item, dict)
            ]

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def get_calendar_events(
        self,
        calendar_id: str = "primary",
        time_min: str = "",
        time_max: str = "",
        query: str = "",
        max_results: int = 50,
        single_events: bool = True,
        order_by: str = "startTime",
    ) -> list[dict[str, Any]]:
        """Get calendar events with optional filters.

        Args:
            calendar_id: Calendar ID (default: primary).
            time_min: RFC3339 start time filter.
            time_max: RFC3339 end time filter.
            query: Free text search query.
            max_results: Maximum number of events (1-250).
            single_events: Expand recurring events to instances.
            order_by: Sort order (startTime or updated).
        """

        def _run() -> list[dict[str, Any]]:
            calendar = self._build_client()
            safe_order_by = order_by if order_by in {"startTime", "updated"} else "startTime"
            params: dict[str, Any] = {
                "calendarId": calendar_id or "primary",
                "maxResults": max(1, min(max_results, 250)),
                "singleEvents": bool(single_events),
                "orderBy": safe_order_by,
            }
            if time_min:
                params["timeMin"] = time_min
            if time_max:
                params["timeMax"] = time_max
            if query:
                params["q"] = query

            response = calendar.events().list(**params).execute()
            events = response.get("items", [])
            return [self._format_event(item) for item in events if isinstance(item, dict)]

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def get_calendar_event(self, event_id: str, calendar_id: str = "primary") -> dict[str, Any]:
        """Get a single calendar event by ID.

        Args:
            event_id: Google Calendar event ID.
            calendar_id: Calendar ID (default: primary).
        """

        def _run() -> dict[str, Any]:
            calendar = self._build_client()
            event = calendar.events().get(calendarId=calendar_id or "primary", eventId=event_id).execute()
            return self._format_event(event)

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def create_calendar_event(
        self,
        summary: str,
        start: dict[str, Any],
        end: dict[str, Any],
        calendar_id: str = "primary",
        description: str = "",
        location: str = "",
        attendees: Optional[list[str]] = None,
        send_updates: str = "none",
        conference_type: str = "",
        recurrence: Optional[list[str]] = None,
        visibility: str = "",
    ) -> dict[str, Any]:
        """Create a Google Calendar event.

        Args:
            summary: Event title.
            start: Start object. Use dateTime for timed events or date for all-day events.
            end: End object. Use dateTime for timed events or date for all-day events.
            calendar_id: Calendar ID (default: primary).
            description: Event description.
            location: Event location.
            attendees: List of attendee emails.
            send_updates: Notification mode: all, externalOnly, or none.
            conference_type: Set to hangoutsMeet to add Google Meet link.
            recurrence: List of RRULE strings.
            visibility: Event visibility.
        """

        def _run() -> dict[str, Any]:
            calendar = self._build_client()
            resource: dict[str, Any] = {
                "summary": summary,
                "start": dict(start or {}),
                "end": dict(end or {}),
            }
            if description:
                resource["description"] = description
            if location:
                resource["location"] = location
            if visibility:
                resource["visibility"] = visibility
            if attendees:
                resource["attendees"] = [{"email": email} for email in attendees if str(email).strip()]
            if recurrence:
                resource["recurrence"] = [str(value) for value in recurrence if str(value).strip()]

            params: dict[str, Any] = {
                "calendarId": calendar_id or "primary",
                "requestBody": resource,
                "sendUpdates": send_updates if send_updates in {"all", "externalOnly", "none"} else "none",
            }

            if conference_type == "hangoutsMeet":
                resource["conferenceData"] = {
                    "createRequest": {
                        "requestId": f"meet-{os.urandom(8).hex()}",
                        "conferenceSolutionKey": {"type": "hangoutsMeet"},
                    }
                }
                params["conferenceDataVersion"] = 1

            created = calendar.events().insert(**params).execute()
            return self._format_event(created)

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def update_calendar_event(
        self,
        event_id: str,
        calendar_id: str = "primary",
        summary: str = "",
        description: str = "",
        location: str = "",
        start: Optional[dict[str, Any]] = None,
        end: Optional[dict[str, Any]] = None,
        attendees: Optional[list[str]] = None,
        send_updates: str = "none",
    ) -> dict[str, Any]:
        """Update an existing Google Calendar event.

        Args:
            event_id: Event ID to update.
            calendar_id: Calendar ID (default: primary).
            summary: New event title.
            description: New event description.
            location: New event location.
            start: New start object.
            end: New end object.
            attendees: Replaces attendees with provided email list.
            send_updates: Notification mode: all, externalOnly, or none.
        """

        def _run() -> dict[str, Any]:
            calendar = self._build_client()
            existing = calendar.events().get(calendarId=calendar_id or "primary", eventId=event_id).execute()

            if summary:
                existing["summary"] = summary
            if description:
                existing["description"] = description
            if location:
                existing["location"] = location
            if start is not None:
                existing["start"] = dict(start)
            if end is not None:
                existing["end"] = dict(end)
            if attendees is not None:
                existing["attendees"] = [{"email": email} for email in attendees if str(email).strip()]

            updated = (
                calendar.events()
                .update(
                    calendarId=calendar_id or "primary",
                    eventId=event_id,
                    requestBody=existing,
                    sendUpdates=send_updates if send_updates in {"all", "externalOnly", "none"} else "none",
                )
                .execute()
            )
            return self._format_event(updated)

        return await asyncio.to_thread(_run)

    @tool(parse_docstring=True)
    async def delete_calendar_event(
        self,
        event_id: str,
        calendar_id: str = "primary",
        send_updates: str = "none",
    ) -> dict[str, Any]:
        """Delete a Google Calendar event.

        Args:
            event_id: Event ID to delete.
            calendar_id: Calendar ID (default: primary).
            send_updates: Notification mode: all, externalOnly, or none.
        """

        def _run() -> dict[str, Any]:
            calendar = self._build_client()
            calendar.events().delete(
                calendarId=calendar_id or "primary",
                eventId=event_id,
                sendUpdates=send_updates if send_updates in {"all", "externalOnly", "none"} else "none",
            ).execute()
            return {"deleted": True, "event_id": event_id}

        return await asyncio.to_thread(_run)
