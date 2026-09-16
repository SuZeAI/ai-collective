from __future__ import annotations

import asyncio
import json
import re
from typing import TYPE_CHECKING

try:
    import spacy
except Exception:  # pragma: no cover - fallback if spacy is not installed
    spacy = None

from server.domain.memory.knowledge_graph import GraphContextConfig
from server.share.log import get_logger

if TYPE_CHECKING:
    from server.app.ports.llm import LLMProvider

logger = get_logger(__name__)
_NLP = None
_NLP_INIT_ATTEMPTED = False

# ---------------------------------------------------------------------------
# LLM extraction prompts
# ---------------------------------------------------------------------------

_LLM_ENTITY_SYSTEM = """\
You are an expert knowledge graph builder.
Given a conversation message, extract all meaningful **named entities**
(people, organizations, locations, products, concepts, technologies, events, etc.).

Return ONLY a valid JSON array. Each element must have:
- "value": the entity text (string)
- "type": entity category ("person"|"org"|"location"|"product"|"concept"|"technology"|"event"|"entity")
- "confidence": 0.0-1.0
- "salience": 0.0-1.0 (how important is this entity to the message)

Rules:
- Exclude stopwords and single characters
- Exclude generic words like "message", "task", "staff", "history"
- Maximum 15 entities
- If no meaningful entities, return []
"""

_LLM_RELATION_SYSTEM = """\
You are an expert knowledge graph builder.
Given a conversation message, identify **relationships** between entities.

Return ONLY a valid JSON array. Each element must have:
- "src": source entity text (string)
- "src_type": entity category of source
- "dst": destination entity text (string)
- "dst_type": entity category of destination
- "relation": relationship label (e.g. "works_for", "uses", "manages", "created_by", "depends_on", "is_a", "part_of", "related_to")
- "confidence": 0.0-1.0

Rules:
- Only extract clear, meaningful relationships
- Maximum 10 relations
- If no clear relations, return []
"""

_STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "for",
    "of",
    "in",
    "on",
    "with",
    "is",
    "are",
    "be",
    "as",
    "that",
    "this",
    "it",
    "at",
    "by",
    "from",
    "you",
    "we",
    "i",
    "he",
    "she",
    "they",
    "them",
    "cua",
    "la",
    "va",
    "cho",
    "voi",
    "mot",
    "nhung",
    "hay",
    "can",
    "toi",
    "ban",
    "task",
    "title",
    "description",
    "history",
    "mesage",
    "message",
    "graph_context",
    "staff",
    "ask",
}

_GENERIC_ENTITY_TERMS = {
    "task",
    "title",
    "description",
    "history",
    "message",
    "mesage",
    "graph",
    "context",
    "staff",
}

_CONTROL_BLOCK_RE = re.compile(
    r"<\s*(NEXT_AGENT|DISCUSSION_END|ASK_NEXT_AGENT)\s*>.*?<\s*/\s*\1\s*>",
    re.IGNORECASE | re.DOTALL,
)


def sanitize_graph_text(content: str) -> str:
    cleaned = _CONTROL_BLOCK_RE.sub(" ", content)
    cleaned = re.sub(r"<\s*/?\s*[A-Z_]+\s*>", " ", cleaned)
    cleaned = re.sub(r"\bagent\s+[^\n:]+\s+ask\s*:", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bhistory\s+mesage\s*:", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bhistory\s+message\s*:", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bgraph_context\s*:", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def is_generic_entity(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized in _GENERIC_ENTITY_TERMS


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-zA-Z0-9_]+", text.lower())
    return [w for w in words if len(w) >= 3 and w not in _STOPWORDS]


def _get_nlp_pipeline():
    global _NLP, _NLP_INIT_ATTEMPTED
    if _NLP_INIT_ATTEMPTED:
        return _NLP

    _NLP_INIT_ATTEMPTED = True
    if spacy is None:
        logger.warning("spaCy is not installed; fallback to rule-based extraction")
        return None

    for model_name in ("xx_ent_wiki_sm", "en_core_web_sm"):
        try:
            _NLP = spacy.load(model_name)
            logger.info("Loaded spaCy model for graph extraction: %s", model_name)
            return _NLP
        except Exception:
            continue

    logger.warning(
        "No spaCy model found (tried xx_ent_wiki_sm, en_core_web_sm); fallback to rule-based extraction"
    )
    return None


class StaticGraphExtractor:
    """Rule-based / spaCy entity & relation extraction — no LLM calls."""

    def extract_entities(self, content: str, config: GraphContextConfig) -> list[dict[str, object]]:
        content = sanitize_graph_text(content)
        if not content:
            return []

        entities: list[dict[str, object]] = []
        nlp = _get_nlp_pipeline()

        if nlp is not None:
            try:
                doc = nlp(content)
                for ent in doc.ents:
                    value = ent.text.strip()
                    if len(value) < 3:
                        continue
                    if is_generic_entity(value):
                        continue
                    entities.append(
                        {
                            "type": "entity",
                            "value": value,
                            "confidence": 0.82,
                            "salience": 0.72,
                        }
                    )
            except Exception:
                logger.exception("spaCy entity extraction failed; using fallback")

        tokens = tokenize(content)
        ranked = sorted(
            {t: tokens.count(t) for t in set(tokens)}.items(),
            key=lambda x: x[1],
            reverse=True,
        )

        if config.entity_method in {"keyword", "hybrid"}:
            for token, freq in ranked[:6]:
                entities.append(
                    {
                        "type": "entity",
                        "value": token,
                        "confidence": min(0.95, 0.45 + 0.1 * freq),
                        "salience": min(1.0, 0.4 + 0.08 * freq),
                    }
                )

        if config.entity_method in {"capitalized", "hybrid"}:
            for phrase in re.findall(r"\b(?:[A-Z][a-zA-Z0-9_]{1,}(?:\s+[A-Z][a-zA-Z0-9_]{1,})+)\b", content):
                value = phrase.strip()
                if is_generic_entity(value):
                    continue
                entities.append(
                    {
                        "type": "entity",
                        "value": value,
                        "confidence": 0.76,
                        "salience": 0.7,
                    }
                )
            for cap in re.findall(r"\b[A-Z][a-zA-Z0-9_]{2,}\b", content):
                if is_generic_entity(cap):
                    continue
                entities.append(
                    {
                        "type": "entity",
                        "value": cap,
                        "confidence": 0.7,
                        "salience": 0.65,
                    }
                )

        dedup: dict[str, dict[str, object]] = {}
        for ent in entities:
            key = f"{ent['type']}:{str(ent['value']).lower()}"
            if key not in dedup:
                dedup[key] = ent
        return list(dedup.values())

    def extract_relations(self, content: str, config: GraphContextConfig) -> list[dict[str, str]]:
        content = sanitize_graph_text(content)
        if not content:
            return []

        relations: list[dict[str, str]] = []
        nlp = _get_nlp_pipeline()
        if nlp is not None:
            try:
                doc = nlp(content)
                verb_objects: dict[int, str] = {}
                for token in doc:
                    if token.dep_ in {"dobj", "obj", "attr"} and token.head.pos_ == "VERB":
                        verb_objects[token.head.i] = token.text.strip()

                for token in doc:
                    if token.dep_ in {"nsubj", "nsubjpass"} and token.head.pos_ == "VERB":
                        src = token.text.strip()
                        dst = verb_objects.get(token.head.i)
                        relation = "unknown"
                        if not dst or len(src) < 3 or len(dst) < 3:
                            continue
                        relations.append(
                            {
                                "src": src,
                                "dst": dst,
                                "src_type": "entity",
                                "dst_type": "entity",
                                "relation": relation,
                            }
                        )
            except Exception:
                logger.exception("spaCy relation extraction failed; using fallback")

        if config.relation_method == "pattern":
            patterns = [
                (r"([\wÀ-ỹ][\wÀ-ỹ\s\-]{1,})\s+là\s+([\wÀ-ỹ][\wÀ-ỹ\s\-]{1,})\s+của\s+([\wÀ-ỹ][\wÀ-ỹ\s\-]{1,})", "vi_is_of"),
                (r"([A-Za-z0-9_\-\s]{3,})\s+is\s+([A-Za-z0-9_\-\s]{3,})", "about"),
                (r"([A-Za-z0-9_\-\s]{3,})\s+needs\s+([A-Za-z0-9_\-\s]{3,})", "depends_on"),
                (r"([A-Za-z0-9_\-\s]{3,})\s+cần\s+([A-Za-z0-9_\-\s]{3,})", "depends_on"),
            ]
            for regex, relation in patterns:
                for match in re.finditer(regex, content, flags=re.IGNORECASE):
                    if relation == "vi_is_of" and len(match.groups()) == 3:
                        left = re.sub(r"\s+", " ", match.group(1).strip())
                        role = re.sub(r"\s+", " ", match.group(2).strip())
                        right = re.sub(r"\s+", " ", match.group(3).strip())
                        if len(left) < 2 or len(role) < 2 or len(right) < 2:
                            continue
                        relations.append(
                            {
                                "src": left,
                                "dst": right,
                                "src_type": "entity",
                                "dst_type": "entity",
                                "relation": role,
                            }
                        )
                        continue

                    left = re.sub(r"\s+", " ", match.group(1).strip())
                    right = re.sub(r"\s+", " ", match.group(2).strip())
                    if len(left) < 3 or len(right) < 3:
                        continue
                    relations.append(
                        {
                            "src": left,
                            "dst": right,
                            "src_type": "entity",
                            "dst_type": "entity",
                            "relation": relation,
                        }
                    )
            if not relations:
                tokens = tokenize(content)
                for i in range(min(len(tokens) - 1, 6)):
                    relations.append(
                        {
                            "src": tokens[i],
                            "dst": tokens[i + 1],
                            "src_type": "entity",
                            "dst_type": "entity",
                            "relation": "unknown",
                        }
                    )
        else:
            tokens = tokenize(content)
            for i in range(min(len(tokens) - 1, 6)):
                relations.append(
                    {
                        "src": tokens[i],
                        "dst": tokens[i + 1],
                        "src_type": "entity",
                        "dst_type": "entity",
                        "relation": "unknown",
                    }
                )
        return relations


class LLMGraphExtractor:
    """LLM-based entity & relation extraction."""

    def __init__(self, llm_provider: "LLMProvider") -> None:
        self._llm_provider = llm_provider

    def _run_async(self, coro):
        """Run an async coroutine from sync context safely."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # We are inside an async event loop (e.g. FastAPI)
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        else:
            return asyncio.run(coro)

    def extract_entities(self, content: str) -> list[dict[str, object]]:
        """Use LLM to extract entities from content."""
        sanitized = sanitize_graph_text(content)
        if not sanitized:
            return []

        truncated = sanitized[:3000]  # limit context to avoid token overflow

        async def _call():
            return await self._llm_provider.chat(
                system=_LLM_ENTITY_SYSTEM,
                user=f"Message:\n{truncated}",
            )

        raw = self._run_async(_call())
        entities = self._parse_llm_json_list(raw, context="entity extraction")

        result: list[dict[str, object]] = []
        seen: set[str] = set()
        for item in entities:
            value = str(item.get("value", "")).strip()
            if not value or len(value) < 2:
                continue
            if is_generic_entity(value):
                continue
            key = f"{item.get('type', 'entity')}:{value.lower()}"
            if key in seen:
                continue
            seen.add(key)
            result.append(
                {
                    "type": str(item.get("type", "entity")),
                    "value": value,
                    "confidence": float(item.get("confidence", 0.8)),
                    "salience": float(item.get("salience", 0.7)),
                }
            )
        logger.info(
            "LLM entity extraction | extracted=%d entities",
            len(result),
        )
        return result

    def extract_relations(self, content: str) -> list[dict[str, str]]:
        """Use LLM to extract relations from content."""
        sanitized = sanitize_graph_text(content)
        if not sanitized:
            return []

        truncated = sanitized[:3000]

        async def _call():
            return await self._llm_provider.chat(
                system=_LLM_RELATION_SYSTEM,
                user=f"Message:\n{truncated}",
            )

        raw = self._run_async(_call())
        relations_raw = self._parse_llm_json_list(raw, context="relation extraction")

        result: list[dict[str, str]] = []
        seen: set[str] = set()
        for item in relations_raw:
            src = str(item.get("src", "")).strip()
            dst = str(item.get("dst", "")).strip()
            relation = str(item.get("relation", "related_to")).strip()
            if not src or not dst or len(src) < 2 or len(dst) < 2:
                continue
            key = f"{src.lower()}:{relation}:{dst.lower()}"
            if key in seen:
                continue
            seen.add(key)
            result.append(
                {
                    "src": src,
                    "src_type": str(item.get("src_type", "entity")),
                    "dst": dst,
                    "dst_type": str(item.get("dst_type", "entity")),
                    "relation": relation,
                }
            )
        logger.info(
            "LLM relation extraction | extracted=%d relations",
            len(result),
        )
        return result

    def _parse_llm_json_list(self, raw: str, *, context: str = "") -> list:
        """Parse a JSON array from LLM response, with fallback extraction."""
        raw = raw.strip()
        # Strip markdown code fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"```\s*$", "", raw, flags=re.MULTILINE)
        raw = raw.strip()
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict) and any(isinstance(v, list) for v in parsed.values()):
                for v in parsed.values():
                    if isinstance(v, list):
                        return v
        except json.JSONDecodeError:
            pass
        # Try to find JSON array in the response
        start = raw.find("[")
        end = raw.rfind("]")
        if start != -1 and end > start:
            try:
                parsed = json.loads(raw[start : end + 1])
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass
        logger.warning("Could not parse JSON from LLM response for %s; got: %.200s", context, raw)
        return []
