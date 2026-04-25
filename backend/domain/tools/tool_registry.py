from typing import Optional, Dict, Type, Any
from enum import Enum

from backend.domain.tools.base import BaseToolkit
from backend.domain.tools.bash import BashToolkit
from backend.domain.tools.brave_search import BraveSearchToolkit
from backend.domain.tools.browser import BrowserToolkit
from backend.domain.tools.dedupe_search import DedupeSearchToolkit
from backend.domain.tools.http import HTTPToolkit
from backend.domain.tools.promt_tool import PromtToolToolkit
from backend.domain.tools.ui import UIToolkit
from backend.domain.tools.websearch import WebSearchToolkit
from backend.domain.tools.xai import XAIToolkit
from backend.domain.tools.xiaohongshu import XiaohongshuToolkit
from backend.domain.tools.truthsocial import TruthSocialToolkit
from backend.domain.tools.tiktok import TikTokToolkit
from backend.domain.tools.youtube import YouTubeToolkit
from backend.domain.tools.scrapecreators_x import ScrapeCreatorsXToolkit
from backend.domain.tools.instagram import InstagramToolkit
from backend.domain.tools.reddit import RedditToolkit
from backend.domain.tools.reddit_enrich import RedditEnrichToolkit
from backend.domain.tools.polymarket import PolymarketToolkit
from backend.domain.tools.parallel_search import ParallelSearchToolkit
from backend.domain.tools.openrouter_search import OpenRouterSearchToolkit
from backend.domain.tools.hackernews import HackerNewsToolkit
from backend.domain.tools.bluesky import BlueskyToolkit
from backend.domain.tools.bird_x import BirdXToolkit
from backend.domain.tools.sheet import SheetToolkit
from backend.domain.tools.drive import DriveToolkit
from backend.domain.tools.docs import DocsToolkit
from backend.domain.tools.slides import SlidesToolkit
from backend.domain.tools.calendar import CalendarToolkit
from backend.domain.tools.telegram_messaging import TelegramMessagingToolkit
from backend.domain.tools.discord_messaging import DiscordMessagingToolkit
from backend.domain.tools.slack_messaging import SlackMessagingToolkit
from backend.domain.tools.teams_messaging import TeamsMessagingToolkit
from backend.domain.tools.whatsapp_business import WhatsAppBusinessToolkit
from backend.domain.tools.facebook_messenger import FacebookMessengerToolkit
from backend.domain.tools.instagram_messaging import InstagramMessagingToolkit
from backend.domain.tools.line_messaging import LINEMessagingToolkit
from backend.domain.tools.viber_messaging import ViberMessagingToolkit
from backend.domain.tools.zalo_messaging import ZaloMessagingToolkit
from backend.domain.tools.signal_messaging import SignalMessagingToolkit
from backend.domain.tools.skype_messaging import SkypeMessagingToolkit
from backend.domain.tools.wire_messaging import WireMessagingToolkit
from backend.domain.tools.wechat_messaging import WeChatMessagingToolkit
from backend.domain.tools.snapchat_messaging import SnapchatMessagingToolkit


class ToolType(str, Enum):
    BASH = "bash"
    BRAVE_SEARCH = "brave_search"
    BROWSER = "browser"
    WEBSEARCH = "websearch"
    DEDUPE_SEARCH = "dedupe_search"
    HTTP = "http"
    XAI = "xai"
    XIAOHONGSHU = "xiaohongshu"
    TRUTHSOCIAL = "truthsocial"
    TIKTOK = "tiktok"
    YOUTUBE = "youtube"
    SCRAPECREATORS_X = "scrapecreators_x"
    INSTAGRAM = "instagram"
    REDDIT = "reddit"
    REDDIT_ENRICH = "reddit_enrich"
    POLYMARKET = "polymarket"
    PARALLEL_SEARCH = "parallel_search"
    OPENROUTER_SEARCH = "openrouter_search"
    HACKERNEWS = "hackernews"
    BLUESKY = "bluesky"
    BIRD_X = "bird_x"
    PROMT_TOOL = "promt_tool"
    UI = "ui"
    SHEET = "sheet"
    DRIVE = "drive"
    DOCS = "docs"
    SLIDES = "slides"
    CALENDAR = "calendar"
    TELEGRAM_MESSAGING = "telegram_messaging"
    DISCORD_MESSAGING = "discord_messaging"
    SLACK_MESSAGING = "slack_messaging"
    TEAMS_MESSAGING = "teams_messaging"
    WHATSAPP_BUSINESS = "whatsapp_business"
    FACEBOOK_MESSENGER = "facebook_messenger"
    INSTAGRAM_MESSAGING = "instagram_messaging"
    LINE_MESSAGING = "line_messaging"
    VIBER_MESSAGING = "viber_messaging"
    ZALO_MESSAGING = "zalo_messaging"
    SIGNAL_MESSAGING = "signal_messaging"
    SKYPE_MESSAGING = "skype_messaging"
    WIRE_MESSAGING = "wire_messaging"
    WECHAT_MESSAGING = "wechat_messaging"
    SNAPCHAT_MESSAGING = "snapchat_messaging"


TOOL_CLASS_REGISTRY: Dict[str, Type[BaseToolkit]] = {
    ToolType.BASH.value: BashToolkit,
    ToolType.BRAVE_SEARCH.value: BraveSearchToolkit,
    ToolType.BROWSER.value: BrowserToolkit,
    ToolType.WEBSEARCH.value: WebSearchToolkit,
    ToolType.DEDUPE_SEARCH.value: DedupeSearchToolkit,
    ToolType.HTTP.value: HTTPToolkit,
    ToolType.XAI.value: XAIToolkit,
    ToolType.XIAOHONGSHU.value: XiaohongshuToolkit,
    ToolType.TRUTHSOCIAL.value: TruthSocialToolkit,
    ToolType.TIKTOK.value: TikTokToolkit,
    ToolType.YOUTUBE.value: YouTubeToolkit,
    ToolType.INSTAGRAM.value: InstagramToolkit,
    ToolType.SCRAPECREATORS_X.value: ScrapeCreatorsXToolkit,
    ToolType.REDDIT.value: RedditToolkit,
    ToolType.REDDIT_ENRICH.value: RedditEnrichToolkit,
    ToolType.POLYMARKET.value: PolymarketToolkit,
    ToolType.PARALLEL_SEARCH.value: ParallelSearchToolkit,
    ToolType.OPENROUTER_SEARCH.value: OpenRouterSearchToolkit,
    ToolType.HACKERNEWS.value: HackerNewsToolkit,
    ToolType.BLUESKY.value: BlueskyToolkit,
    ToolType.BIRD_X.value: BirdXToolkit,
    ToolType.PROMT_TOOL.value: PromtToolToolkit,
    ToolType.UI.value: UIToolkit,
    ToolType.SHEET.value: SheetToolkit,
    ToolType.DRIVE.value: DriveToolkit,
    ToolType.DOCS.value: DocsToolkit,
    ToolType.SLIDES.value: SlidesToolkit,
    ToolType.CALENDAR.value: CalendarToolkit,
    ToolType.TELEGRAM_MESSAGING.value: TelegramMessagingToolkit,
    ToolType.DISCORD_MESSAGING.value: DiscordMessagingToolkit,
    ToolType.SLACK_MESSAGING.value: SlackMessagingToolkit,
    ToolType.TEAMS_MESSAGING.value: TeamsMessagingToolkit,
    ToolType.WHATSAPP_BUSINESS.value: WhatsAppBusinessToolkit,
    ToolType.FACEBOOK_MESSENGER.value: FacebookMessengerToolkit,
    ToolType.INSTAGRAM_MESSAGING.value: InstagramMessagingToolkit,
    ToolType.LINE_MESSAGING.value: LINEMessagingToolkit,
    ToolType.VIBER_MESSAGING.value: ViberMessagingToolkit,
    ToolType.ZALO_MESSAGING.value: ZaloMessagingToolkit,
    ToolType.SIGNAL_MESSAGING.value: SignalMessagingToolkit,
    ToolType.SKYPE_MESSAGING.value: SkypeMessagingToolkit,
    ToolType.WIRE_MESSAGING.value: WireMessagingToolkit,
    ToolType.WECHAT_MESSAGING.value: WeChatMessagingToolkit,
    ToolType.SNAPCHAT_MESSAGING.value: SnapchatMessagingToolkit,
}


class ToolRegistry:

    @staticmethod
    def get_tool_class(tool_name: str) -> Optional[Type[BaseToolkit]]:
        return TOOL_CLASS_REGISTRY.get(tool_name)

    @staticmethod
    def get_available_tools() -> list[str]:
        return list(TOOL_CLASS_REGISTRY.keys())

    @staticmethod
    def create_tool(
        tool_name: str,
        **kwargs: Any
    ) -> Optional[BaseToolkit]:
        tool_class = ToolRegistry.get_tool_class(tool_name)
        if tool_class is None:
            return None

        if tool_name == ToolType.BROWSER.value:
            cdp_url = kwargs.get("cdp_url")
            if not cdp_url:
                raise ValueError(
                    "Failed to instantiate browser. Required kwargs: "
                    "provide 'cdp_url'."
                )

            driver = kwargs.get("driver")
            if driver not in (None, "browser_use"):
                raise ValueError(
                    f"Unsupported browser driver '{driver}'. "
                    "Only 'browser_use' is currently supported."
                )

            from backend.infrastructure.browser.browser_use_browser import BrowserUseBrowser

            kwargs = {**kwargs, "browser": BrowserUseBrowser(cdp_url=cdp_url)}
        try:
            return tool_class(**kwargs)
        except TypeError as e:
            raise ValueError(
                f"Failed to instantiate {tool_name}. "
                f"Required kwargs: {e}"
            )

    @staticmethod
    def register_tool(tool_name: str, tool_class: Type[BaseToolkit]) -> None:
        if not issubclass(tool_class, BaseToolkit):
            raise TypeError(f"{tool_class} must inherit from BaseToolkit")
        TOOL_CLASS_REGISTRY[tool_name] = tool_class
