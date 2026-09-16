from typing import Optional, Dict, Type, Any
from enum import Enum

from server.domain.tools.base import BaseToolkit
from server.domain.tools.bash import BashToolkit
from server.domain.tools.sandbox_tools import SandboxToolkit
from server.domain.tools.brave_search import BraveSearchToolkit
from server.domain.tools.browser import BrowserToolkit
from server.domain.tools.document_tools import DocumentToolkit
from server.domain.tools.http import HTTPToolkit
from server.domain.tools.mcp_toolkit import MCPToolkit
from server.domain.tools.a2a_toolkit import A2AToolkit
from server.domain.tools.promt_tool import PromtToolToolkit
from server.domain.tools.websearch import WebSearchToolkit
from server.domain.tools.xai import XAIToolkit
from server.domain.tools.xiaohongshu import XiaohongshuToolkit
from server.domain.tools.truthsocial import TruthSocialToolkit
from server.domain.tools.tiktok import TikTokToolkit
from server.domain.tools.youtube import YouTubeToolkit
from server.domain.tools.scrapecreators_x import ScrapeCreatorsXToolkit
from server.domain.tools.instagram import InstagramToolkit
from server.domain.tools.reddit import RedditToolkit
from server.domain.tools.reddit_enrich import RedditEnrichToolkit
from server.domain.tools.polymarket import PolymarketToolkit
from server.domain.tools.parallel_search import ParallelSearchToolkit
from server.domain.tools.openrouter_search import OpenRouterSearchToolkit
from server.domain.tools.hackernews import HackerNewsToolkit
from server.domain.tools.bluesky import BlueskyToolkit
from server.domain.tools.bird_x import BirdXToolkit
from server.domain.tools.sheet import SheetToolkit
from server.domain.tools.drive import DriveToolkit
from server.domain.tools.docs import DocsToolkit
from server.domain.tools.slides import SlidesToolkit
from server.domain.tools.calendar import CalendarToolkit
from server.domain.tools.telegram_messaging import TelegramMessagingToolkit
from server.domain.tools.discord_messaging import DiscordMessagingToolkit
from server.domain.tools.slack_messaging import SlackMessagingToolkit
from server.domain.tools.teams_messaging import TeamsMessagingToolkit
from server.domain.tools.whatsapp_business import WhatsAppBusinessToolkit
from server.domain.tools.facebook_messenger import FacebookMessengerToolkit
from server.domain.tools.instagram_messaging import InstagramMessagingToolkit
from server.domain.tools.line_messaging import LINEMessagingToolkit
from server.domain.tools.viber_messaging import ViberMessagingToolkit
from server.domain.tools.zalo_messaging import ZaloMessagingToolkit
from server.domain.tools.signal_messaging import SignalMessagingToolkit
from server.domain.tools.skype_messaging import SkypeMessagingToolkit
from server.domain.tools.wire_messaging import WireMessagingToolkit
from server.domain.tools.wechat_messaging import WeChatMessagingToolkit
from server.domain.tools.snapchat_messaging import SnapchatMessagingToolkit
from server.domain.tools.image_generation import ImageGenerationToolkit
from server.domain.tools.text_to_speech import TextToSpeechToolkit
from server.domain.tools.video_generation import VideoGenerationToolkit
from server.domain.tools.gemini import (
    GeminiImageToolkit,
    GeminiTTSToolkit,
    GeminiVideoToolkit,
)


class ToolType(str, Enum):
    BASH = "bash"
    SANDBOX = "sandbox"
    DOCUMENTS = "documents"
    BRAVE_SEARCH = "brave_search"
    BROWSER = "browser"
    WEBSEARCH = "websearch"
    HTTP = "http"
    MCP = "mcp"
    A2A = "a2a"
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
    IMAGE_GENERATION = "image_generation"
    TEXT_TO_SPEECH = "text_to_speech"
    VIDEO_GENERATION = "video_generation"
    GEMINI_IMAGE = "gemini_image"
    GEMINI_TTS = "gemini_tts"
    GEMINI_VIDEO = "gemini_video"


TOOL_CLASS_REGISTRY: Dict[str, Type[BaseToolkit]] = {
    ToolType.BASH.value: BashToolkit,
    ToolType.SANDBOX.value: SandboxToolkit,
    ToolType.DOCUMENTS.value: DocumentToolkit,
    ToolType.BRAVE_SEARCH.value: BraveSearchToolkit,
    ToolType.BROWSER.value: BrowserToolkit,
    ToolType.WEBSEARCH.value: WebSearchToolkit,
    ToolType.HTTP.value: HTTPToolkit,
    ToolType.MCP.value: MCPToolkit,
    ToolType.A2A.value: A2AToolkit,
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
    ToolType.IMAGE_GENERATION.value: ImageGenerationToolkit,
    ToolType.TEXT_TO_SPEECH.value: TextToSpeechToolkit,
    ToolType.VIDEO_GENERATION.value: VideoGenerationToolkit,
    ToolType.GEMINI_IMAGE.value: GeminiImageToolkit,
    ToolType.GEMINI_TTS.value: GeminiTTSToolkit,
    ToolType.GEMINI_VIDEO.value: GeminiVideoToolkit,
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

        if tool_name in (ToolType.BASH.value, ToolType.SANDBOX.value):
            from server.infra.sandbox.factory import create_sandbox_adapter
            from server.app.ports.sandbox import Sandbox

            for _k in ("sandbox_mode", "sandbox_url", "sandbox_provisioner_url", "sandbox_timeout", "sandbox_workspace"):
                kwargs.pop(_k, None)

            if not isinstance(kwargs.get("sandbox"), Sandbox):
                kwargs.pop("sandbox", None)
                sandbox = create_sandbox_adapter()
                kwargs = {**kwargs, "sandbox": sandbox}

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

            from server.infra.browser.browser_use_browser import BrowserUseBrowser

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
