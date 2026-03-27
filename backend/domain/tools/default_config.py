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
	"dedupe_search": {
		"label": "Dedupe Search Results",
		"third_party": "Search Utils",
		"config_fields": [],
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
