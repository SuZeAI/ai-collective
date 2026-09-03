"""Unit tests for the MCP toolkit config parsing and spec validation.

Network-free: these cover the pure helpers and the fail-fast validation in
``MCPServerSpec``; actual server connections are exercised manually (see
docs/mcp-guide.md).
"""

from __future__ import annotations

import pytest

from backend.domain.tools.mcp_toolkit import (
    MCPServerSpec,
    parse_allowed_tools,
    parse_args,
    parse_key_values,
)


# ── parse_args ────────────────────────────────────────────────────────────────

def test_parse_args_shell_style():
    assert parse_args("-y @modelcontextprotocol/server-filesystem /tmp") == [
        "-y", "@modelcontextprotocol/server-filesystem", "/tmp",
    ]


def test_parse_args_json_array():
    assert parse_args('["-y", "pkg", "/a dir/with spaces"]') == ["-y", "pkg", "/a dir/with spaces"]


def test_parse_args_quoted_shell():
    assert parse_args("serve '/a dir/with spaces'") == ["serve", "/a dir/with spaces"]


def test_parse_args_empty_and_list_passthrough():
    assert parse_args("") == []
    assert parse_args(None) == []
    assert parse_args(["a", 1]) == ["a", "1"]


# ── parse_key_values ──────────────────────────────────────────────────────────

def test_parse_key_values_lines():
    raw = "API_KEY=secret\n# comment\nREGION: us-east-1\n\n"
    assert parse_key_values(raw) == {"API_KEY": "secret", "REGION": "us-east-1"}


def test_parse_key_values_json():
    assert parse_key_values('{"Authorization": "Bearer x"}') == {"Authorization": "Bearer x"}


def test_parse_key_values_value_containing_separator():
    assert parse_key_values("Authorization=Bearer a=b") == {"Authorization": "Bearer a=b"}


def test_parse_key_values_empty_and_dict_passthrough():
    assert parse_key_values("") == {}
    assert parse_key_values(None) == {}
    assert parse_key_values({"A": 1}) == {"A": "1"}


# ── parse_allowed_tools ───────────────────────────────────────────────────────

def test_parse_allowed_tools_comma_and_newline():
    assert parse_allowed_tools("read_file, write_file\nsearch") == {
        "read_file", "write_file", "search",
    }
    assert parse_allowed_tools("") == set()
    assert parse_allowed_tools(None) == set()


# ── MCPServerSpec validation ──────────────────────────────────────────────────

def test_spec_stdio_requires_command():
    with pytest.raises(ValueError, match="command"):
        MCPServerSpec(transport="stdio", command="")


def test_spec_http_requires_url():
    with pytest.raises(ValueError, match="url"):
        MCPServerSpec(transport="streamable_http", url="")


def test_spec_rejects_unknown_transport():
    with pytest.raises(ValueError, match="transport"):
        MCPServerSpec(transport="carrier-pigeon", command="x")


def test_spec_http_alias_and_describe():
    spec = MCPServerSpec(transport="http", url="http://localhost:8931/mcp")
    assert spec.transport == "streamable_http"
    assert "http://localhost:8931/mcp" in spec.describe()


def test_spec_parses_nested_fields():
    spec = MCPServerSpec(
        transport="stdio",
        command="npx",
        args="-y pkg",
        env="TOKEN=abc",
    )
    assert spec.args == ["-y", "pkg"]
    assert spec.env == {"TOKEN": "abc"}
    assert spec.describe().startswith("stdio:npx")
