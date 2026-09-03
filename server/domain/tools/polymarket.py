from __future__ import annotations

import asyncio
import json
import math
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional
from urllib import error, parse, request

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit

try:
    import requests as _requests
except ImportError:
    _requests = None

GAMMA_SEARCH_URL = "https://gamma-api.polymarket.com/public-search"

# Pages to fetch per query (Gamma returns small page sizes).
DEPTH_CONFIG = {
    "quick": 1,
    "default": 3,
    "deep": 4,
}

# Max events to return after merge + dedupe + reranking.
RESULT_CAP = {
    "quick": 5,
    "default": 15,
    "deep": 25,
}

LOW_SIGNAL_QUERY_TOKENS = frozenset(
    {
        "the",
        "a",
        "an",
        "to",
        "for",
        "is",
        "are",
        "in",
        "on",
        "of",
        "and",
        "or",
        "about",
        "with",
        "what",
        "how",
        "when",
        "where",
        "last",
        "days",
    }
)

GENERIC_TAGS = frozenset({"sports", "politics", "crypto", "science", "culture", "pop culture"})


class PolymarketAPIError(RuntimeError):
    pass


def _log(msg: str) -> None:
    """Log to stderr only when interactive to avoid noisy tool payloads."""
    if sys.stderr.isatty():
        sys.stderr.write(f"[PM] {msg}\n")
        sys.stderr.flush()


def _request_json(url: str, *, timeout: int = 15) -> Dict[str, Any]:
    if _requests is not None:
        try:
            resp = _requests.get(url, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            raise PolymarketAPIError(str(exc)) from exc

    req = request.Request(url=url, method="GET", headers={"User-Staff": "ai-collective/polymarket-tool"})
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except error.HTTPError as exc:
        message = f"Polymarket API failed: HTTP {exc.code}"
        try:
            body = exc.read().decode("utf-8", errors="replace")
            if body:
                message = f"{message}: {body[:200]}"
        except Exception:
            pass
        raise PolymarketAPIError(message) from exc
    except (error.URLError, TimeoutError, ValueError) as exc:
        raise PolymarketAPIError(str(exc)) from exc


def _extract_core_subject(topic: str) -> str:
    """Extract core subject from topic string."""
    topic = topic.strip()
    prefixes = [
        r"^last \d+ days?\s+",
        r"^what(?:'s| is| are) (?:people saying about|happening with|going on with)\s+",
        r"^how (?:is|are)\s+",
        r"^tell me about\s+",
        r"^research\s+",
    ]
    for pattern in prefixes:
        topic = re.sub(pattern, "", topic, flags=re.IGNORECASE)
    return topic.strip()


def _tokenize(text: str) -> set[str]:
    return {w for w in re.sub(r"[^\w\s]", " ", (text or "").lower()).split() if len(w) > 1}


def _token_overlap_relevance(query: str, text: str) -> float:
    q = _tokenize(query)
    t = _tokenize(text)
    if not q:
        return 0.5
    overlap = len(q & t)
    return round(min(1.0, max(0.0, overlap / len(q))), 2)


def _detect_query_type(topic: str) -> str:
    text = (topic or "").lower()
    if any(k in text for k in ("will", "odds", "prediction", "chance", "probability")):
        return "prediction"
    return "general"


def _expand_queries(topic: str) -> List[str]:
    """Generate search queries to cast a wider net."""
    core = _extract_core_subject(topic)
    queries = [core]

    words = core.split()
    if len(words) >= 2:
        for word in words:
            if len(word) > 1 and word.lower() not in LOW_SIGNAL_QUERY_TOKENS:
                queries.append(word)

    if topic.lower().strip() != core.lower():
        queries.append(topic.strip())

    seen = set()
    unique = []
    for q in queries:
        q_lower = q.lower().strip()
        if q_lower and q_lower not in seen:
            seen.add(q_lower)
            unique.append(q.strip())
    return unique[:6]


def _extract_domain_queries(topic: str, events: List[Dict[str, Any]]) -> List[str]:
    """Extract domain-indicator search terms from first-pass event tags."""
    query_words = set(_extract_core_subject(topic).lower().split())
    tag_counts: Dict[str, int] = {}

    for event in events:
        tags = event.get("tags") or []
        for tag in tags:
            label = tag.get("label", "") if isinstance(tag, dict) else str(tag)
            if not label:
                continue
            label_lower = label.lower()
            if label_lower in GENERIC_TAGS or label_lower in query_words:
                continue
            tag_counts[label] = tag_counts.get(label, 0) + 1

    domain_queries = [
        label
        for label, count in sorted(tag_counts.items(), key=lambda x: -x[1])
        if count >= 2
    ][:2]
    return domain_queries


def _search_single_query(query: str, page: int = 1) -> Dict[str, Any]:
    params = {
        "q": query,
        "page": str(page),
        "events_status": "active",
        "keep_closed_markets": "0",
    }
    url = f"{GAMMA_SEARCH_URL}?{parse.urlencode(params)}"
    try:
        return _request_json(url, timeout=15)
    except PolymarketAPIError as exc:
        _log(f"Search failed for '{query}' page {page}: {exc}")
        return {"events": [], "error": str(exc)}
    except Exception as exc:
        _log(f"Search failed for '{query}' page {page}: {exc}")
        return {"events": [], "error": str(exc)}


def _run_queries_parallel(
    queries: List[str],
    pages: int,
    all_events: Dict[str, tuple[Dict[str, Any], int]],
    errors: List[str],
    start_idx: int = 0,
) -> None:
    max_workers = max(1, min(8, len(queries) * pages))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {}
        for i, q in enumerate(queries, start=start_idx):
            for p in range(1, pages + 1):
                future = executor.submit(_search_single_query, q, p)
                futures[future] = i

        for future in as_completed(futures):
            query_idx = futures[future]
            try:
                response = future.result(timeout=15)
                if response.get("error"):
                    errors.append(str(response["error"]))

                events = response.get("events", [])
                for event in events:
                    event_id = str(event.get("id", ""))
                    if not event_id:
                        continue
                    if event_id not in all_events:
                        all_events[event_id] = (event, query_idx)
                    elif query_idx < all_events[event_id][1]:
                        all_events[event_id] = (event, query_idx)
            except Exception as exc:
                errors.append(str(exc))


def search_polymarket(topic: str, from_date: str, to_date: str, depth: str = "default") -> Dict[str, Any]:
    """Search Polymarket Gamma API with two-pass query expansion."""
    _ = (from_date, to_date)
    pages = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])
    cap = RESULT_CAP.get(depth, RESULT_CAP["default"])
    queries = _expand_queries(topic)

    _log(f"Searching for '{topic}' with queries: {queries} (pages={pages})")

    all_events: Dict[str, tuple[Dict[str, Any], int]] = {}
    errors: List[str] = []
    _run_queries_parallel(queries, pages, all_events, errors)

    first_pass_events = [ev for ev, _ in all_events.values()]
    domain_queries = _extract_domain_queries(topic, first_pass_events)
    seen_queries = {q.lower() for q in queries}
    domain_queries = [dq for dq in domain_queries if dq.lower() not in seen_queries]

    if domain_queries:
        _log(f"Domain expansion queries: {domain_queries}")
        _run_queries_parallel(domain_queries, 1, all_events, errors, start_idx=len(queries))

    merged_events = [ev for ev, _ in sorted(all_events.values(), key=lambda x: x[1])]
    total_queries = len(queries) + len(domain_queries)
    _log(f"Found {len(merged_events)} unique events across {total_queries} queries")

    result = {"events": merged_events, "_cap": cap}
    if errors and not merged_events:
        result["error"] = "; ".join(errors[:2])
    return result


def _format_price_movement(market: Dict[str, Any]) -> Optional[str]:
    changes = [
        (abs(market.get("oneDayPriceChange") or 0), market.get("oneDayPriceChange"), "today"),
        (abs(market.get("oneWeekPriceChange") or 0), market.get("oneWeekPriceChange"), "this week"),
        (abs(market.get("oneMonthPriceChange") or 0), market.get("oneMonthPriceChange"), "this month"),
    ]

    changes.sort(key=lambda x: x[0], reverse=True)
    abs_change, raw_change, period = changes[0]
    if abs_change < 0.01:
        return None

    direction = "up" if (raw_change or 0) > 0 else "down"
    pct = abs_change * 100
    return f"{direction} {pct:.1f}% {period}"


def _parse_outcome_prices(market: Dict[str, Any]) -> List[tuple[str, float]]:
    outcomes_raw = market.get("outcomes") or []
    prices_raw = market.get("outcomePrices")
    if not prices_raw:
        return []

    try:
        outcomes = json.loads(outcomes_raw) if isinstance(outcomes_raw, str) else outcomes_raw
    except (json.JSONDecodeError, TypeError):
        outcomes = []

    try:
        prices = json.loads(prices_raw) if isinstance(prices_raw, str) else prices_raw
    except (json.JSONDecodeError, TypeError):
        return []

    result: List[tuple[str, float]] = []
    for i, price in enumerate(prices):
        try:
            p = float(price)
        except (ValueError, TypeError):
            continue
        name = outcomes[i] if i < len(outcomes) else f"Outcome {i + 1}"
        result.append((str(name), p))
    return result


def _shorten_question(question: str) -> str:
    q = question.strip().rstrip("?")
    m = re.match(
        r"^Will\s+(.+?)\s+(?:win|be|make|reach|have|lose|qualify|advance|strike|agree|pass|sign|get|become|remain|stay|leave|survive|next)\b",
        q,
        re.IGNORECASE,
    )
    if m:
        return m.group(1).strip()
    m = re.match(r"^Will\s+(.+?)\s+", q, re.IGNORECASE)
    if m and len(m.group(1).split()) <= 4:
        return m.group(1).strip()
    return question[:40] if len(question) > 40 else question


def _strong_phrase_match(core: str, candidate: str) -> bool:
    candidate = " ".join(re.sub(r"[^\w\s]", " ", candidate.lower()).split())
    core = " ".join(re.sub(r"[^\w\s]", " ", core.lower()).split())
    if not candidate or not core:
        return False

    candidate_tokens = candidate.split()
    core_tokens = set(core.split())

    if len(candidate_tokens) >= 2:
        return candidate in core or core in candidate

    token = candidate_tokens[0]
    return len(token) > 2 and token in core_tokens


def _compute_text_similarity(topic: str, title: str, outcomes: Optional[List[str]] = None) -> float:
    core = _extract_core_subject(topic).lower()
    title_lower = title.lower()
    if not core:
        return 0.5

    if core in title_lower:
        return 1.0

    query_type = _detect_query_type(topic)
    title_score = _token_overlap_relevance(core, title)
    best_score = title_score

    for outcome_name in outcomes or []:
        outcome_lower = outcome_name.lower()
        outcome_score = _token_overlap_relevance(core, outcome_name)
        if _strong_phrase_match(core, outcome_lower):
            outcome_score = max(outcome_score, 0.92 if len(outcome_lower.split()) >= 2 else 0.88)
        if title_score < 0.3:
            outcome_cap = 0.55 if query_type == "prediction" else 0.24
            outcome_score = min(outcome_cap, outcome_score)
        else:
            outcome_score = max(title_score, 0.75 * title_score + 0.25 * outcome_score)
        best_score = max(best_score, outcome_score)

    return round(best_score, 2)


def _safe_float(val: Any, default: float = 0.0) -> float:
    try:
        return float(val or default)
    except (ValueError, TypeError):
        return default


def parse_polymarket_response(response: Dict[str, Any], topic: str = "") -> List[Dict[str, Any]]:
    events = response.get("events", [])
    items: List[Dict[str, Any]] = []

    for event in events:
        event_id = str(event.get("id", ""))
        title = str(event.get("title", ""))
        slug = str(event.get("slug", ""))

        if event.get("closed", False):
            continue
        if not event.get("active", True):
            continue

        markets = event.get("markets", [])
        if not markets:
            continue

        active_markets = []
        for market in markets:
            if market.get("closed", False):
                continue
            if not market.get("active", True):
                continue
            try:
                liq = float(market.get("liquidity", 0) or 0)
            except (ValueError, TypeError):
                liq = 0
            if liq > 0:
                active_markets.append(market)

        if not active_markets:
            continue

        active_markets.sort(key=lambda m: _safe_float(m.get("volume")), reverse=True)
        top_market = active_markets[0]

        all_outcome_names: List[str] = []
        for market in active_markets:
            for name, price in _parse_outcome_prices(market):
                if price > 0.01 and name not in all_outcome_names:
                    all_outcome_names.append(name)
            question = str(market.get("question", ""))
            if question and question != title:
                all_outcome_names.append(question)

        outcome_prices = _parse_outcome_prices(top_market)
        top_outcomes_are_binary = (
            len(outcome_prices) == 2
            and {n.lower() for n, _ in outcome_prices} == {"yes", "no"}
        )
        if top_outcomes_are_binary and len(active_markets) > 1:
            synth_outcomes = []
            for market in active_markets:
                question = str(market.get("question", ""))
                if not question:
                    continue
                pairs = _parse_outcome_prices(market)
                yes_price = next((p for name, p in pairs if name.lower() == "yes"), None)
                if yes_price is not None and yes_price > 0.005:
                    synth_outcomes.append((question, yes_price))
            if synth_outcomes:
                synth_outcomes.sort(key=lambda x: x[1], reverse=True)
                outcome_prices = [(_shorten_question(q), p) for q, p in synth_outcomes]

        price_movement = _format_price_movement(top_market)

        event_volume1mo = _safe_float(event.get("volume1mo"))
        event_volume1wk = _safe_float(event.get("volume1wk"))
        event_liquidity = _safe_float(event.get("liquidity"))
        event_competitive = _safe_float(event.get("competitive"))
        volume24hr = _safe_float(event.get("volume24hr")) or _safe_float(top_market.get("volume24hr"))
        liquidity = event_liquidity or _safe_float(top_market.get("liquidity"))

        url = f"https://polymarket.com/event/{slug}" if slug else f"https://polymarket.com/event/{event_id}"

        updated_at = event.get("updatedAt", "")
        date_str = None
        if updated_at:
            try:
                date_str = str(updated_at)[:10]
            except (IndexError, TypeError):
                date_str = None

        end_date = top_market.get("endDate")
        if end_date:
            try:
                end_date = str(end_date)[:10]
            except (IndexError, TypeError):
                end_date = None

        text_score = _compute_text_similarity(topic, title, all_outcome_names) if topic else 0.5
        vol_raw = event_volume1mo or event_volume1wk or volume24hr
        vol_score = min(1.0, math.log1p(vol_raw) / 16)
        liq_score = min(1.0, math.log1p(liquidity) / 14)

        day_change = abs(top_market.get("oneDayPriceChange") or 0) * 3
        week_change = abs(top_market.get("oneWeekPriceChange") or 0) * 2
        month_change = abs(top_market.get("oneMonthPriceChange") or 0)
        max_change = max(day_change, week_change, month_change)
        movement_score = min(1.0, max_change * 5)

        market_quality = (
            0.50 * vol_score
            + 0.25 * liq_score
            + 0.15 * movement_score
            + 0.10 * event_competitive
        )
        relevance = min(1.0, text_score * (0.75 + 0.25 * market_quality))

        if topic and outcome_prices:
            core = _extract_core_subject(topic).lower()
            core_tokens = set(core.split())
            reordered = []
            rest = []
            for pair in outcome_prices:
                name_lower = pair[0].lower()
                if (core in name_lower or name_lower in core
                        or any(tok in name_lower for tok in core_tokens if len(tok) > 2)):
                    reordered.append(pair)
                else:
                    rest.append(pair)
            if reordered:
                outcome_prices = reordered + rest

        top_outcomes = outcome_prices[:3]
        remaining = max(0, len(outcome_prices) - 3)

        items.append(
            {
                "event_id": event_id,
                "title": title,
                "question": top_market.get("question", title),
                "url": url,
                "outcome_prices": top_outcomes,
                "outcomes_remaining": remaining,
                "price_movement": price_movement,
                "volume24hr": volume24hr,
                "volume1mo": event_volume1mo,
                "liquidity": liquidity,
                "date": date_str,
                "end_date": end_date,
                "relevance": round(relevance, 2),
                "why_relevant": f"Prediction market: {title[:60]}",
            }
        )

    items.sort(key=lambda x: x["relevance"], reverse=True)
    cap = int(response.get("_cap", len(items)))
    return items[:cap]


class PolymarketToolkit(BaseToolkit):
    """Polymarket prediction market toolkit via public Gamma API."""

    name: str = "polymarket"

    @tool(parse_docstring=True)
    async def polymarket_search(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
    ) -> Dict[str, Any]:
        """Search Polymarket events by topic and return normalized items.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
        """
        raw = await asyncio.to_thread(search_polymarket, topic, from_date, to_date, depth)
        items = parse_polymarket_response(raw, topic=topic)

        in_range = [item for item in items if item.get("date") and from_date <= item["date"] <= to_date]
        if in_range:
            items = in_range

        return {"items": items}
