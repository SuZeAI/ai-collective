"""No pytest-asyncio in this repo; LLMGraphExtractor drives its own event loop internally."""

from __future__ import annotations

from server.app.service.graph_extraction import (
    LLMGraphExtractor,
    StaticGraphExtractor,
    is_generic_entity,
    sanitize_graph_text,
    tokenize,
)
from server.domain.memory.knowledge_graph import GraphContextConfig


def test_sanitize_graph_text_strips_control_blocks_and_tags():
    content = "<NEXT_AGENT>Developer Staff</NEXT_AGENT> history mesage: hello <FOO> world"
    cleaned = sanitize_graph_text(content)

    assert "NEXT_AGENT" not in cleaned
    assert "FOO" not in cleaned
    assert "hello" in cleaned
    assert "world" in cleaned


def test_sanitize_graph_text_empty_input():
    assert sanitize_graph_text("") == ""


def test_is_generic_entity():
    assert is_generic_entity("task") is True
    assert is_generic_entity(" Staff ") is True
    assert is_generic_entity("Acme Corp") is False


def test_tokenize_drops_stopwords_and_short_tokens():
    tokens = tokenize("The Acme Corp is building a new product for you")
    assert "acme" in tokens
    assert "corp" in tokens
    assert "building" in tokens
    assert "the" not in tokens  # stopword
    assert "is" not in tokens  # stopword
    assert "a" not in tokens  # too short


def test_static_extractor_extract_entities_keyword_method_dedupes_and_ranks():
    extractor = StaticGraphExtractor()
    config = GraphContextConfig(entity_method="keyword")
    content = "Acme Corp Acme Corp Acme Corp builds rockets rockets rockets rockets"

    entities = extractor.extract_entities(content, config)

    values = [e["value"] for e in entities]
    assert "acme" in values
    assert "rockets" in values
    # extract_entities dedupes by (type, lowercased value) key
    assert len(values) == len(set(values))


def test_static_extractor_extract_entities_empty_content_returns_empty():
    extractor = StaticGraphExtractor()
    config = GraphContextConfig(entity_method="hybrid")
    assert extractor.extract_entities("", config) == []
    assert extractor.extract_entities("   ", config) == []


def test_static_extractor_extract_entities_capitalized_method_finds_multi_word_phrases():
    extractor = StaticGraphExtractor()
    config = GraphContextConfig(entity_method="capitalized")
    content = "Acme Corporation partnered with Beta Industries on Project Nova."

    entities = extractor.extract_entities(content, config)
    values = {e["value"] for e in entities}

    assert "Acme Corporation" in values
    assert "Beta Industries" in values


def test_static_extractor_extract_relations_pattern_method():
    extractor = StaticGraphExtractor()
    config = GraphContextConfig(relation_method="pattern")
    content = "the roadmap needs approval from leadership"

    relations = extractor.extract_relations(content, config)

    assert any(
        r["src"] == "the roadmap" and r["dst"] == "approval from leadership" and r["relation"] == "depends_on"
        for r in relations
    )


def test_static_extractor_extract_relations_empty_content_returns_empty():
    extractor = StaticGraphExtractor()
    config = GraphContextConfig(relation_method="pattern")
    assert extractor.extract_relations("", config) == []


def test_static_extractor_extract_relations_cooccurrence_fallback():
    extractor = StaticGraphExtractor()
    config = GraphContextConfig(relation_method="cooccurrence")
    content = "roadmap approval leadership budget timeline milestones deliverables"

    relations = extractor.extract_relations(content, config)

    assert len(relations) > 0
    assert all(r["relation"] == "unknown" for r in relations)


class _FakeLLMProvider:
    def __init__(self, response: str):
        self._response = response

    async def chat(self, *, system: str, user: str = "", **kwargs) -> str:
        return self._response

    def get_chat_model(self):
        raise NotImplementedError


def test_llm_extractor_extract_entities_parses_json_array():
    provider = _FakeLLMProvider(
        '```json\n[{"value": "Acme Corp", "type": "org", "confidence": 0.9, "salience": 0.8}]\n```'
    )
    extractor = LLMGraphExtractor(provider)

    entities = extractor.extract_entities("Acme Corp announced a new product.")

    assert len(entities) == 1
    assert entities[0]["value"] == "Acme Corp"
    assert entities[0]["type"] == "org"


def test_llm_extractor_extract_entities_filters_generic_and_dedupes():
    provider = _FakeLLMProvider(
        '[{"value": "task", "type": "entity"}, '
        '{"value": "Acme", "type": "org"}, '
        '{"value": "Acme", "type": "org"}]'
    )
    extractor = LLMGraphExtractor(provider)

    entities = extractor.extract_entities("some content")

    values = [e["value"] for e in entities]
    assert values == ["Acme"]  # "task" filtered as generic, duplicate "Acme" deduped


def test_llm_extractor_extract_entities_empty_content_short_circuits():
    provider = _FakeLLMProvider("[]")
    extractor = LLMGraphExtractor(provider)
    assert extractor.extract_entities("") == []


def test_llm_extractor_extract_entities_unparseable_response_returns_empty():
    provider = _FakeLLMProvider("not json at all, sorry")
    extractor = LLMGraphExtractor(provider)
    assert extractor.extract_entities("some content") == []


def test_llm_extractor_extract_relations_parses_json_array():
    provider = _FakeLLMProvider(
        '[{"src": "Acme", "dst": "Beta", "relation": "partners_with", '
        '"src_type": "org", "dst_type": "org", "confidence": 0.9}]'
    )
    extractor = LLMGraphExtractor(provider)

    relations = extractor.extract_relations("Acme partners with Beta.")

    assert len(relations) == 1
    assert relations[0]["src"] == "Acme"
    assert relations[0]["dst"] == "Beta"
    assert relations[0]["relation"] == "partners_with"


def test_llm_extractor_extract_relations_empty_content_short_circuits():
    provider = _FakeLLMProvider("[]")
    extractor = LLMGraphExtractor(provider)
    assert extractor.extract_relations("") == []
