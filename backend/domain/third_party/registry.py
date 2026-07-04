from __future__ import annotations

from typing import Dict, Optional, Type

from backend.domain.thirty_part.base_hook import BaseHookProcessor
from backend.domain.thirty_part.telegram_hook import TelegramHookProcessor
from backend.domain.thirty_part.discord_hook import DiscordHookProcessor
from backend.domain.thirty_part.slack_hook import SlackHookProcessor
from backend.domain.thirty_part.teams_hook import TeamsHookProcessor
from backend.domain.thirty_part.whatsapp_hook import WhatsAppHookProcessor
from backend.domain.thirty_part.messenger_hook import MessengerHookProcessor
from backend.domain.thirty_part.instagram_hook import InstagramHookProcessor
from backend.domain.thirty_part.line_hook import LINEHookProcessor
from backend.domain.thirty_part.viber_hook import ViberHookProcessor
from backend.domain.thirty_part.zalo_hook import ZaloHookProcessor
from backend.domain.thirty_part.signal_hook import SignalHookProcessor
from backend.domain.thirty_part.skype_hook import SkypeHookProcessor
from backend.domain.thirty_part.wire_hook import WireHookProcessor
from backend.domain.thirty_part.wechat_hook import WeChatHookProcessor
from backend.domain.thirty_part.snapchat_hook import SnapchatHookProcessor

_REGISTRY: Dict[str, Type[BaseHookProcessor]] = {
    "telegram": TelegramHookProcessor,
    "discord": DiscordHookProcessor,
    "slack": SlackHookProcessor,
    "teams": TeamsHookProcessor,
    "whatsapp_business": WhatsAppHookProcessor,
    "facebook_messenger": MessengerHookProcessor,
    "instagram": InstagramHookProcessor,
    "line_messaging": LINEHookProcessor,
    "viber_messaging": ViberHookProcessor,
    "zalo_messaging": ZaloHookProcessor,
    "signal_messaging": SignalHookProcessor,
    "skype_messaging": SkypeHookProcessor,
    "wire_messaging": WireHookProcessor,
    "wechat_messaging": WeChatHookProcessor,
    "snapchat_messaging": SnapchatHookProcessor,
}

# Human-readable labels for each platform
PLATFORM_LABELS: Dict[str, str] = {
    "telegram": "Telegram",
    "discord": "Discord",
    "slack": "Slack",
    "teams": "Microsoft Teams",
    "whatsapp_business": "WhatsApp Business",
    "facebook_messenger": "Facebook Messenger",
    "instagram": "Instagram",
    "line_messaging": "LINE",
    "viber_messaging": "Viber",
    "zalo_messaging": "Zalo OA",
    "signal_messaging": "Signal (CallMeBot)",
    "skype_messaging": "Skype",
    "wire_messaging": "Wire",
    "wechat_messaging": "WeChat",
    "snapchat_messaging": "Snapchat",
}

# Config field definitions per platform (for frontend form generation)
PLATFORM_CONFIG_FIELDS: Dict[str, list] = {
    "telegram": [
        {"key": "bot_token", "label": "Bot Token", "input": "text", "required": True, "placeholder": "123456:ABC-DEF..."},
    ],
    "discord": [
        {"key": "bot_token", "label": "Bot Token", "input": "text", "required": False, "placeholder": "Bot token (for reading messages)"},
        {"key": "webhook_url", "label": "Webhook URL", "input": "text", "required": False, "placeholder": "https://discord.com/api/webhooks/..."},
        {"key": "channel_id", "label": "Default Channel ID", "input": "text", "required": False},
        {"key": "public_key", "label": "Application Public Key", "input": "text", "required": False, "placeholder": "Required for Interactions endpoint (Ed25519 verification)"},
    ],
    "slack": [
        {"key": "bot_token", "label": "Bot Token (xoxb-...)", "input": "text", "required": True},
        {"key": "signing_secret", "label": "Signing Secret", "input": "text", "required": False},
    ],
    "teams": [
        {"key": "webhook_url", "label": "Incoming Webhook URL", "input": "text", "required": True},
    ],
    "whatsapp_business": [
        {"key": "access_token", "label": "Meta Access Token", "input": "text", "required": True},
        {"key": "phone_number_id", "label": "Phone Number ID", "input": "text", "required": True},
        {"key": "verify_token", "label": "Verify Token (custom secret)", "input": "text", "required": True, "placeholder": "Your custom secret for webhook verification"},
        {"key": "app_secret", "label": "App Secret (for X-Hub-Signature-256)", "input": "text", "required": False, "placeholder": "Meta App Secret — enables payload signature verification"},
    ],
    "facebook_messenger": [
        {"key": "page_access_token", "label": "Page Access Token", "input": "text", "required": True},
        {"key": "verify_token", "label": "Verify Token", "input": "text", "required": True},
        {"key": "app_secret", "label": "App Secret (for X-Hub-Signature-256)", "input": "text", "required": False},
    ],
    "instagram": [
        {"key": "page_access_token", "label": "Page Access Token", "input": "text", "required": True},
        {"key": "verify_token", "label": "Verify Token", "input": "text", "required": True},
        {"key": "app_secret", "label": "App Secret (for X-Hub-Signature-256)", "input": "text", "required": False},
    ],
    "line_messaging": [
        {"key": "channel_access_token", "label": "Channel Access Token", "input": "text", "required": True},
        {"key": "channel_secret", "label": "Channel Secret", "input": "text", "required": False},
    ],
    "viber_messaging": [
        {"key": "auth_token", "label": "Auth Token", "input": "text", "required": True},
        {"key": "sender_name", "label": "Sender Name", "input": "text", "required": False, "default": "AI Assistant"},
    ],
    "zalo_messaging": [
        {"key": "access_token", "label": "OA Access Token", "input": "text", "required": True},
    ],
    "signal_messaging": [
        {"key": "phone_number", "label": "Phone Number (E.164)", "input": "text", "required": True, "placeholder": "+84901234567"},
        {"key": "api_key", "label": "CallMeBot API Key", "input": "text", "required": True},
    ],
    "skype_messaging": [
        {"key": "app_id", "label": "Bot App ID", "input": "text", "required": True},
        {"key": "app_password", "label": "Bot App Password", "input": "text", "required": True},
        {"key": "service_url", "label": "Service URL", "input": "text", "required": False, "default": "https://smba.trafficmanager.net/apis"},
    ],
    "wire_messaging": [
        {"key": "bearer_token", "label": "Bearer Token", "input": "text", "required": True},
    ],
    "wechat_messaging": [
        {"key": "app_id", "label": "App ID", "input": "text", "required": True},
        {"key": "app_secret", "label": "App Secret", "input": "text", "required": True},
        {"key": "verify_token", "label": "Verify Token", "input": "text", "required": False},
    ],
    "snapchat_messaging": [
        {"key": "access_token", "label": "Access Token (Ads API)", "input": "text", "required": True},
    ],
}


def get_processor(platform: str) -> Optional[BaseHookProcessor]:
    cls = _REGISTRY.get(platform)
    return cls() if cls else None


def list_platforms() -> list[Dict]:
    return [
        {
            "platform": p,
            "label": PLATFORM_LABELS.get(p, p),
            "config_fields": PLATFORM_CONFIG_FIELDS.get(p, []),
        }
        for p in _REGISTRY
    ]
