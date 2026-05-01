from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Dict, Optional
from urllib import error, parse, request

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit

SNAPCHAT_ADS_API_BASE = "https://adsapi.snapchat.com/v1"


def _snap_request(
    method: str,
    path: str,
    access_token: str,
    data: Optional[Dict] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    url = f"{SNAPCHAT_ADS_API_BASE}{path}"
    payload = None
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    if data is not None:
        payload = json.dumps(data).encode("utf-8")
    req = request.Request(url=url, method=method, data=payload, headers=headers)
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Snapchat API error {exc.code}: {body[:300]}") from exc
    except (error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"Snapchat request failed: {exc}") from exc


class SnapchatMessagingToolkit(BaseToolkit):
    """Snapchat Ads API toolkit for business campaign management and analytics.

    Note: Snapchat does not provide a public direct-messaging API for bots.
    This toolkit uses the Snapchat Ads API for ad account management and campaign analytics.
    """

    name: str = "snapchat_messaging"

    def __init__(
        self,
        access_token: Optional[str] = None,
        ad_account_id: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.access_token = access_token or os.getenv("SNAPCHAT_ACCESS_TOKEN", "")
        self.ad_account_id = ad_account_id or os.getenv("SNAPCHAT_AD_ACCOUNT_ID", "")

    def _token(self) -> str:
        if not self.access_token:
            raise ValueError(
                "Snapchat access token required. Set SNAPCHAT_ACCESS_TOKEN."
            )
        return self.access_token

    @tool(parse_docstring=True)
    async def snapchat_get_ad_accounts(
        self,
        organization_id: str,
    ) -> Dict[str, Any]:
        """Get all ad accounts for a Snapchat organization.

        Args:
            organization_id: Snapchat organization ID (visible in Snapchat Ads Manager).
        """
        return await asyncio.to_thread(
            _snap_request,
            "GET",
            f"/organizations/{organization_id}/adaccounts",
            self._token(),
        )

    @tool(parse_docstring=True)
    async def snapchat_get_campaigns(
        self,
        ad_account_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get all campaigns for a Snapchat ad account.

        Args:
            ad_account_id: Ad account ID. Uses configured default if not provided.
        """
        target = ad_account_id or self.ad_account_id
        if not target:
            raise ValueError(
                "ad_account_id is required. Set SNAPCHAT_AD_ACCOUNT_ID."
            )
        return await asyncio.to_thread(
            _snap_request, "GET", f"/adaccounts/{target}/campaigns", self._token()
        )

    @tool(parse_docstring=True)
    async def snapchat_get_campaign_stats(
        self,
        campaign_id: str,
        start_time: str,
        end_time: str,
    ) -> Dict[str, Any]:
        """Get performance statistics for a Snapchat campaign.

        Args:
            campaign_id: Snapchat campaign ID.
            start_time: Stats period start in ISO 8601 format (e.g., 2024-01-01T00:00:00.000-0500).
            end_time: Stats period end in ISO 8601 format.
        """
        path = (
            f"/campaigns/{campaign_id}/stats"
            f"?granularity=TOTAL"
            f"&start_time={parse.quote(start_time)}"
            f"&end_time={parse.quote(end_time)}"
        )
        return await asyncio.to_thread(_snap_request, "GET", path, self._token())

    @tool(parse_docstring=True)
    async def snapchat_get_creatives(
        self,
        ad_account_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List all ad creatives in a Snapchat ad account.

        Args:
            ad_account_id: Ad account ID. Uses configured default if not provided.
        """
        target = ad_account_id or self.ad_account_id
        if not target:
            raise ValueError("ad_account_id is required. Set SNAPCHAT_AD_ACCOUNT_ID.")
        return await asyncio.to_thread(
            _snap_request, "GET", f"/adaccounts/{target}/creatives", self._token()
        )
