from __future__ import annotations

import math

from server.app.service.graph_extraction import tokenize
from server.domain.memory.knowledge_graph import MeetingKnowledgeGraph, GraphContextConfig


def term_freq(tokens: list[str]) -> dict[str, float]:
    if not tokens:
        return {}
    out: dict[str, float] = {}
    total = float(len(tokens))
    for token in tokens:
        out[token] = out.get(token, 0.0) + (1.0 / total)
    return out


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(v * b.get(k, 0.0) for k, v in a.items())
    if dot <= 0:
        return 0.0
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def pagerank_scores(
    graph: MeetingKnowledgeGraph,
    seeds: dict[str, float],
    *,
    damping: float = 0.85,
    iterations: int = 20,
) -> dict[str, float]:
    node_ids = list(graph.nodes.keys())
    if not node_ids:
        return {}

    n = len(node_ids)
    adjacency: dict[str, set[str]] = {node_id: set() for node_id in node_ids}
    for edge in graph.edges.values():
        if edge.src in adjacency and edge.dst in adjacency:
            adjacency[edge.src].add(edge.dst)
            adjacency[edge.dst].add(edge.src)

    seed_values = {node_id: max(0.0, seeds.get(node_id, 0.0)) for node_id in node_ids}
    total_seed = sum(seed_values.values())
    if total_seed > 0:
        personalization = {node_id: seed_values[node_id] / total_seed for node_id in node_ids}
    else:
        uniform = 1.0 / float(n)
        personalization = {node_id: uniform for node_id in node_ids}

    scores = dict(personalization)
    for _ in range(iterations):
        next_scores = {node_id: (1.0 - damping) * personalization[node_id] for node_id in node_ids}
        for node_id in node_ids:
            neighbors = adjacency[node_id]
            if not neighbors:
                share = damping * scores[node_id] / float(n)
                for target in node_ids:
                    next_scores[target] += share
                continue
            share = damping * scores[node_id] / float(len(neighbors))
            for target in neighbors:
                next_scores[target] += share
        scores = next_scores

    return scores


def retrieve_lexical(
    graph: MeetingKnowledgeGraph,
    query: str,
    config: GraphContextConfig,
) -> dict[str, float]:
    query_tokens = set(tokenize(query))
    if not query_tokens:
        return {}

    scores: dict[str, float] = {}
    recency_bias = max(1.0, float(graph.last_message_index))
    for node_id, node in graph.nodes.items():
        node_tokens = set(tokenize(node.value))
        if not node_tokens:
            continue
        overlap = len(query_tokens & node_tokens) / len(query_tokens | node_tokens)
        if overlap <= 0:
            continue
        recency = min(1.0, len(node.source_message_ids) / recency_bias)
        score = overlap * config.similarity_weight + recency * config.recency_weight + node.salience_score * config.edge_weight
        if score >= config.min_score_threshold:
            scores[node_id] = score

    return dict(sorted(scores.items(), key=lambda x: x[1], reverse=True)[: config.top_k_nodes])


def retrieve_embedding(
    graph: MeetingKnowledgeGraph,
    query: str,
    config: GraphContextConfig,
) -> dict[str, float]:
    query_vec = term_freq(tokenize(query))
    if not query_vec:
        return {}

    scores: dict[str, float] = {}
    for node_id, node in graph.nodes.items():
        node_vec = term_freq(tokenize(node.value))
        similarity = cosine(query_vec, node_vec)
        if similarity < config.min_score_threshold:
            continue
        score = similarity * config.similarity_weight + node.salience_score * config.edge_weight
        scores[node_id] = score

    return dict(sorted(scores.items(), key=lambda x: x[1], reverse=True)[: config.top_k_nodes])


def related_edges(
    graph: MeetingKnowledgeGraph,
    node_ids: list[str],
    top_k_edges: int,
) -> list[str]:
    node_set = set(node_ids)
    candidates = [
        edge
        for edge in graph.edges.values()
        if edge.src in node_set and edge.dst in node_set
        and graph.nodes.get(edge.src)
        and graph.nodes.get(edge.dst)
        and graph.nodes[edge.src].type == "entity"
        and graph.nodes[edge.dst].type == "entity"
    ]
    candidates.sort(key=lambda edge: edge.weight, reverse=True)
    return [edge.id for edge in candidates[:top_k_edges]]
