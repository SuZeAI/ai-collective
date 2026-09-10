from types import SimpleNamespace

from server.domain.staff.subagents import (
    BUILTIN_SUBAGENTS,
    filter_tools,
    get_available_subagent_names,
    get_subagent_config,
)


def test_get_subagent_config_returns_known_configs():
    for name in ("general-purpose", "research", "coding"):
        cfg = get_subagent_config(name)
        assert cfg is not None
        assert cfg.name == name


def test_get_subagent_config_returns_none_for_unknown_name():
    assert get_subagent_config("does-not-exist") is None


def test_get_available_subagent_names_lists_all_builtins():
    assert set(get_available_subagent_names()) == {"general-purpose", "research", "coding"}


def test_every_builtin_subagent_disallows_task_tool_by_default():
    # Prevents a subagent from recursively delegating to another subagent,
    # which would allow unbounded nesting.
    for cfg in BUILTIN_SUBAGENTS.values():
        assert "task" in cfg.disallowed_tools


def test_filter_tools_allowlist_keeps_only_matching_names():
    tools = [SimpleNamespace(name="a"), SimpleNamespace(name="b"), SimpleNamespace(name="c")]
    result = filter_tools(tools, allowed=["a", "c"], disallowed=None)
    assert [t.name for t in result] == ["a", "c"]


def test_filter_tools_disallowlist_removes_matching_names():
    tools = [SimpleNamespace(name="a"), SimpleNamespace(name="task"), SimpleNamespace(name="c")]
    result = filter_tools(tools, allowed=None, disallowed=["task"])
    assert [t.name for t in result] == ["a", "c"]


def test_filter_tools_disallowed_wins_even_if_also_allowed():
    tools = [SimpleNamespace(name="a"), SimpleNamespace(name="task")]
    result = filter_tools(tools, allowed=["a", "task"], disallowed=["task"])
    assert [t.name for t in result] == ["a"]


def test_filter_tools_none_none_keeps_everything():
    tools = [SimpleNamespace(name="a"), SimpleNamespace(name="b")]
    result = filter_tools(tools, allowed=None, disallowed=None)
    assert result == tools


def test_filter_tools_unnamed_tool_excluded_by_allowlist():
    unnamed = object()  # no .name attribute
    tools = [SimpleNamespace(name="a"), unnamed]
    result = filter_tools(tools, allowed=["a"], disallowed=None)
    assert result == [tools[0]]


def test_coding_subagent_allowlists_only_sandbox_and_bash_tools():
    cfg = get_subagent_config("coding")
    tools = [
        SimpleNamespace(name="bash_exec"),
        SimpleNamespace(name="sandbox_read_file"),
        SimpleNamespace(name="web_search"),  # not in coding's allowlist
    ]
    result = filter_tools(tools, allowed=cfg.tools, disallowed=cfg.disallowed_tools)
    assert {t.name for t in result} == {"bash_exec", "sandbox_read_file"}


def test_general_purpose_subagent_inherits_all_tools_except_task():
    cfg = get_subagent_config("general-purpose")
    tools = [SimpleNamespace(name="web_search"), SimpleNamespace(name="task")]
    result = filter_tools(tools, allowed=cfg.tools, disallowed=cfg.disallowed_tools)
    assert [t.name for t in result] == ["web_search"]
