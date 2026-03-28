from __future__ import annotations

from typing import Any


TOOL_PRESET_DEFAULTS: dict[str, dict[str, Any]] = {
	"websearch": {
		"label": "Web Search (DuckDuckGo)",
		"third_party": "Web",
		"config_fields": [
			{
				"key": "provider",
				"label": "Provider",
				"input": "text",
				"required": True,
				"default": "duckduckgo",
			},
			{
				"key": "region",
				"label": "Region",
				"input": "text",
				"required": True,
				"default": "wt-wt",
				"placeholder": "wt-wt, us-en, vn-vi",
			},
			{
				"key": "safesearch",
				"label": "Safe Search",
				"input": "select",
				"required": True,
				"default": "moderate",
				"options": ["off", "moderate", "strict"],
			},
		],
	},
	"parallel_search": {
		"label": "Web Search (Parallel AI)",
		"third_party": "Web",
		"config_fields": [
			{
				"key": "api_key",
				"label": "Parallel API Key",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to PARALLEL_API_KEY",
			},
			{
				"key": "beta_header",
				"label": "Beta Header",
				"input": "text",
				"required": False,
				"default": "search-extract-2025-10-10",
			},
		],
	},
	"brave_search": {
		"label": "Web Search (Brave Search)",
		"third_party": "Web",
		"config_fields": [
			{
				"key": "api_key",
				"label": "Brave Search API Key",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to BRAVE_SEARCH_API_KEY",
			},
			{
				"key": "use_llm_context",
				"label": "Use LLM Context",
				"input": "boolean",
				"required": False,
				"default": False,
			},
		],
	},
	"openrouter_search": {
		"label": "Web Search (OpenRouter Sonar)",
		"third_party": "Web",
		"config_fields": [
			{
				"key": "api_key",
				"label": "OpenRouter API Key",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to OPENROUTER_API_KEY",
			},
			{
				"key": "model",
				"label": "Model",
				"input": "text",
				"required": False,
				"default": "perplexity/sonar-pro",
			},
		],
	},
	"dedupe_search": {
		"label": "Dedupe Search Results",
		"third_party": "Search Utils",
		"config_fields": [],
	},
	"http": {
		"label": "HTTP Client",
		"third_party": "Network",
		"config_fields": [
			{
				"key": "timeout",
				"label": "Timeout (seconds)",
				"input": "text",
				"required": False,
				"default": "30",
				"placeholder": "30",
			},
			{
				"key": "retries",
				"label": "Retries",
				"input": "text",
				"required": False,
				"default": "5",
				"placeholder": "5",
			},
			{
				"key": "user_agent",
				"label": "User Agent",
				"input": "text",
				"required": False,
				"default": "ai-collective/http-tool",
			},
		],
	},
	"browser": {
		"label": "Browser Automation",
		"third_party": "Browser",
		"config_fields": [
			{
				"key": "driver",
				"label": "Driver",
				"input": "text",
				"required": True,
				"default": "browser_use",
			},
			{
				"key": "cdp_url",
				"label": "CDP URL",
				"input": "text",
				"required": True,
				"default": "http://localhost:9222",
			},
			{
				"key": "requires_runtime",
				"label": "Requires Runtime",
				"input": "boolean",
				"required": False,
				"default": True,
			},
		],
	},
	"bash": {
		"label": "Shell Automation",
		"third_party": "Shell",
		"config_fields": [
			{
				"key": "sandbox",
				"label": "Sandbox",
				"input": "text",
				"required": True,
				"default": "default",
			},
			{
				"key": "requires_runtime",
				"label": "Requires Runtime",
				"input": "boolean",
				"required": False,
				"default": True,
			},
		],
	},
	"youtube": {
		"label": "YouTube Search (yt-dlp)",
		"third_party": "YouTube",
		"config_fields": [
			{
				"key": "depth",
				"label": "Search Depth",
				"input": "select",
				"required": True,
				"default": "default",
				"options": ["quick", "default", "deep"],
			},
		],
	},
	"xai": {
		"label": "xAI X Search",
		"third_party": "X (xAI)",
		"config_fields": [
			{
				"key": "api_key",
				"label": "xAI API Key",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to XAI_API_KEY",
			},
			{
				"key": "model",
				"label": "Model",
				"input": "text",
				"required": False,
				"default": "grok-4-fast",
			},
			{
				"key": "depth",
				"label": "Search Depth",
				"input": "select",
				"required": True,
				"default": "default",
				"options": ["quick", "default", "deep"],
			},
		],
	},
	"bird_x": {
		"label": "X Search (Bird GraphQL)",
		"third_party": "X (Bird)",
		"config_fields": [
			{
				"key": "auth_token",
				"label": "X AUTH_TOKEN",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to AUTH_TOKEN",
			},
			{
				"key": "ct0",
				"label": "X CT0",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to CT0",
			},
			{
				"key": "bird_search_mjs",
				"label": "bird-search.mjs Path",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to BIRD_SEARCH_MJS or project default",
			},
			{
				"key": "depth",
				"label": "Search Depth",
				"input": "select",
				"required": True,
				"default": "default",
				"options": ["quick", "default", "deep"],
			},
		],
	},
	"xiaohongshu": {
		"label": "Xiaohongshu Search",
		"third_party": "Xiaohongshu",
		"config_fields": [
			{
				"key": "base_url",
				"label": "API Base URL",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to XIAOHONGSHU_API_BASE_URL",
			},
			{
				"key": "depth",
				"label": "Search Depth",
				"input": "select",
				"required": True,
				"default": "default",
				"options": ["quick", "default", "deep"],
			},
		],
	},
	"truthsocial": {
		"label": "Truth Social Search",
		"third_party": "Truth Social",
		"config_fields": [
			{
				"key": "token",
				"label": "Truth Social Token",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to TRUTHSOCIAL_TOKEN",
			},
			{
				"key": "depth",
				"label": "Search Depth",
				"input": "select",
				"required": True,
				"default": "default",
				"options": ["quick", "default", "deep"],
			},
		],
	},
	"bluesky": {
		"label": "Bluesky Search",
		"third_party": "Bluesky",
		"config_fields": [
			{
				"key": "handle",
				"label": "Bluesky Handle",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to BSKY_HANDLE",
			},
			{
				"key": "app_password",
				"label": "Bluesky App Password",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to BSKY_APP_PASSWORD",
			},
			{
				"key": "depth",
				"label": "Search Depth",
				"input": "select",
				"required": True,
				"default": "default",
				"options": ["quick", "default", "deep"],
			},
		],
	},
	"tiktok": {
		"label": "TikTok Search (ScrapeCreators)",
		"third_party": "TikTok",
		"config_fields": [
			{
				"key": "token",
				"label": "ScrapeCreators API Key",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to SCRAPECREATORS_API_KEY",
			},
			{
				"key": "depth",
				"label": "Search Depth",
				"input": "select",
				"required": True,
				"default": "default",
				"options": ["quick", "default", "deep"],
			},
		],
	},
	"scrapecreators_x": {
		"label": "X Search (ScrapeCreators)",
		"third_party": "X (ScrapeCreators)",
		"config_fields": [
			{
				"key": "token",
				"label": "ScrapeCreators API Key",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to SCRAPECREATORS_API_KEY",
			},
			{
				"key": "depth",
				"label": "Search Depth",
				"input": "select",
				"required": True,
				"default": "default",
				"options": ["quick", "default", "deep"],
			},
		],
	},
	"instagram": {
		"label": "Instagram Reels Search (ScrapeCreators)",
		"third_party": "Instagram",
		"config_fields": [
			{
				"key": "token",
				"label": "ScrapeCreators API Key",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to SCRAPECREATORS_API_KEY",
			},
			{
				"key": "depth",
				"label": "Search Depth",
				"input": "select",
				"required": True,
				"default": "default",
				"options": ["quick", "default", "deep"],
			},
		],
	},
	"reddit": {
		"label": "Reddit Search (ScrapeCreators)",
		"third_party": "Reddit",
		"config_fields": [
			{
				"key": "token",
				"label": "ScrapeCreators API Key",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to SCRAPECREATORS_API_KEY",
			},
			{
				"key": "depth",
				"label": "Search Depth",
				"input": "select",
				"required": True,
				"default": "default",
				"options": ["quick", "default", "deep"],
			},
		],
	},
	"reddit_enrich": {
		"label": "Reddit Enrich (Thread Metrics)",
		"third_party": "Reddit",
		"config_fields": [
			{
				"key": "token",
				"label": "ScrapeCreators API Key",
				"input": "text",
				"required": False,
				"default": "",
				"placeholder": "Optional, fallback to SCRAPECREATORS_API_KEY",
			},
			{
				"key": "backend",
				"label": "Backend",
				"input": "select",
				"required": True,
				"default": "auto",
				"options": ["auto", "scrapecreators", "reddit_json"],
			},
		],
	},
	"hackernews": {
		"label": "Hacker News Search (Algolia)",
		"third_party": "Hacker News",
		"config_fields": [
			{
				"key": "depth",
				"label": "Search Depth",
				"input": "select",
				"required": True,
				"default": "default",
				"options": ["quick", "default", "deep"],
			},
		],
	},
	"polymarket": {
		"label": "Polymarket Search (Gamma API)",
		"third_party": "Polymarket",
		"config_fields": [
			{
				"key": "depth",
				"label": "Search Depth",
				"input": "select",
				"required": True,
				"default": "default",
				"options": ["quick", "default", "deep"],
			},
		],
	},
	"promt_tool": {
		"label": "Prompt Tool",
		"third_party": "Prompt",
		"config_fields": [
			{
				"key": "system_prompt",
				"label": "System Prompt",
				"input": "textarea",
				"required": True,
				"default": "",
				"rows": 6,
			},
		],
	},
	"ui": {
		"label": "UI Helper",
		"third_party": "UI",
		"config_fields": [],
	},
}


def build_tool_presets(tool_names: list[str]) -> list[dict[str, Any]]:
	presets: list[dict[str, Any]] = []
	for tool_name in tool_names:
		preset = TOOL_PRESET_DEFAULTS.get(tool_name, {})
		title = tool_name.replace("_", " ").replace("-", " ").strip().title()
		presets.append(
			{
				"tool_name": tool_name,
				"label": preset.get("label") or title,
				"third_party": preset.get("third_party") or title,
				"config_fields": list(preset.get("config_fields") or []),
			}
		)
	return presets
