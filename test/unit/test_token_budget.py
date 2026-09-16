from types import SimpleNamespace

import tiktoken

from server.domain.staff.token_budget import apply_context_token_budget


class FakeLLM:
    def __init__(self, provider_name: str = "", chat_model=None):
        self._provider_name = provider_name
        self._chat_model = chat_model

    def get_chat_model(self):
        if self._chat_model is None:
            raise RuntimeError("no chat model configured")
        return self._chat_model


def make_chat_model(cls_name: str, **attrs):
    cls = type(cls_name, (), {})
    obj = cls()
    for key, value in attrs.items():
        setattr(obj, key, value)
    return obj


def test_no_truncation_when_input_fits_budget():
    result = apply_context_token_budget(
        llm=object(),
        system_prompt="",
        user_input="short message",
        max_context_tokens=1000,
        reserved_output_tokens=0,
    )
    assert result.truncated is False
    assert result.text == "short message"
    assert result.tokenizer_family == "generic"


def test_truncation_keeps_tail_and_drops_head():
    content = ("HEAD" * 300) + ("TAIL" * 300)  # 1200 chars head, 1200 chars tail
    result = apply_context_token_budget(
        llm=object(),
        system_prompt="",
        user_input=content,
        max_context_tokens=300,
        reserved_output_tokens=0,
    )
    assert result.truncated is True
    assert result.text == "TAIL" * 300
    assert "HEAD" not in result.text


def test_available_for_input_floors_at_256_tokens():
    result = apply_context_token_budget(
        llm=object(),
        system_prompt="",
        user_input="x",
        max_context_tokens=100,
        reserved_output_tokens=50,
        )
    assert result.max_input_tokens == 256


def test_system_prompt_reduces_available_budget():
    result = apply_context_token_budget(
        llm=object(),
        system_prompt="S" * 400,  # ~100 generic tokens
        user_input="x",
        max_context_tokens=1000,
        reserved_output_tokens=0,
    )
    assert result.max_input_tokens == 900


def test_tokenizer_family_claude_from_provider_name():
    llm = FakeLLM(provider_name="Anthropic")
    result = apply_context_token_budget(
        llm=llm, system_prompt="", user_input="hi", max_context_tokens=1000, reserved_output_tokens=0,
    )
    assert result.tokenizer_family == "claude"
    assert result.provider == "anthropic"


def test_tokenizer_family_inferred_from_chat_model_class_name():
    llm = FakeLLM(chat_model=make_chat_model("ChatAnthropicMessages", model_name="claude-3-opus"))
    result = apply_context_token_budget(
        llm=llm, system_prompt="", user_input="hi", max_context_tokens=1000, reserved_output_tokens=0,
    )
    assert result.provider == "anthropic"
    assert result.model == "claude-3-opus"
    assert result.tokenizer_family == "claude"


def test_model_attr_priority_prefers_model_name_over_model():
    llm = FakeLLM(chat_model=make_chat_model("SomeChat", model_name="preferred", model="fallback"))
    result = apply_context_token_budget(
        llm=llm, system_prompt="", user_input="hi", max_context_tokens=1000, reserved_output_tokens=0,
    )
    assert result.model == "preferred"


def test_gpt_token_count_matches_tiktoken_encoding():
    llm = FakeLLM(provider_name="openai", chat_model=SimpleNamespace(model_name="gpt-4o"))
    text = "Hello world, this is a test of tiktoken counting."
    result = apply_context_token_budget(
        llm=llm, system_prompt="", user_input=text, max_context_tokens=10_000, reserved_output_tokens=0,
    )
    enc = tiktoken.encoding_for_model("gpt-4o")
    assert result.tokenizer_family == "gpt"
    assert result.input_tokens == len(enc.encode(text))
    assert result.truncated is False


def test_gpt_truncation_uses_tiktoken_and_keeps_tail_tokens():
    llm = FakeLLM(provider_name="openai", chat_model=SimpleNamespace(model_name="gpt-4o"))
    enc = tiktoken.encoding_for_model("gpt-4o")
    text = " ".join(f"word{i}" for i in range(500))
    # max_context_tokens is above the 256-token floor, so the available budget
    # for input is exactly max_context_tokens (no system prompt to subtract).
    result = apply_context_token_budget(
        llm=llm, system_prompt="", user_input=text, max_context_tokens=300, reserved_output_tokens=0,
    )
    assert result.max_input_tokens == 300
    assert result.truncated is True
    full_tokens = enc.encode(text)
    expected_tail = enc.decode(full_tokens[-300:]).lstrip()
    assert result.text == expected_tail
    assert "word0 " not in result.text
