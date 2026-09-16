"""Chunking service with tiktoken for Vietnamese text processing."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

try:
    import tiktoken
except ImportError:
    tiktoken = None

from server.share.log import get_logger

logger = get_logger(__name__)

# Vietnamese sentence splitters
VIETNAMESE_SENT_BOUNDARIES = [
    r'(?<=[.!?])\s+(?=[A-ZA-Zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ])',
    r'(?<=[.!?])\s+',
]


@dataclass(slots=True)
class Chunk:
    """Represents a text chunk with metadata."""
    id: str
    text: str
    token_count: int
    position: int  # Position in original document (chunk number)
    start_char: int  # Start character position in original text
    end_char: int  # End character position in original text
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: dict[str, object] = field(default_factory=dict)


class ChunkingService:
    """Service for chunking text with overlap support using tiktoken."""

    def __init__(
        self,
        chunk_size: int = 1200,
        overlap_size: int = 100,
        encoding_name: str = "cl100k_base",
    ):
        """
        Initialize ChunkingService.

        Args:
            chunk_size: Target tokens per chunk (default: 1200)
            overlap_size: Overlap tokens between chunks (default: 100)
            encoding_name: Tiktoken encoding name (default: cl100k_base for GPT models)
        """
        self.chunk_size = max(1, chunk_size)
        self.overlap_size = max(0, min(overlap_size, chunk_size - 1))
        self.encoding_name = encoding_name

        self._encoding = None
        if tiktoken is not None:
            try:
                self._encoding = tiktoken.get_encoding(encoding_name)
                logger.info(f"Loaded tiktoken encoding: {encoding_name}")
            except Exception as e:
                logger.warning(f"Failed to load tiktoken encoding {encoding_name}: {e}")
                self._encoding = None
        else:
            logger.warning("tiktoken not installed; using fallback token counting")

    def tokenize(self, text: str) -> list[int]:
        """Tokenize text using tiktoken or fallback."""
        if self._encoding is not None:
            try:
                return self._encoding.encode(text)
            except Exception as e:
                logger.warning(f"Tiktoken encoding failed: {e}; using fallback")

        # Fallback: simple whitespace tokenization
        return text.split()

    def decode(self, tokens: list[int]) -> str:
        """Decode tokens back to text."""
        if self._encoding is not None:
            try:
                return self._encoding.decode(tokens)
            except Exception as e:
                logger.warning(f"Tiktoken decoding failed: {e}")

        return " ".join(str(t) for t in tokens)

    def _estimate_char_to_token_ratio(self, text: str) -> float:
        """Estimate character to token ratio for this text."""
        sample_size = min(len(text), 1000)
        sample = text[:sample_size]
        tokens = self.tokenize(sample)
        if len(tokens) == 0:
            return 4.0  # Default estimate
        return len(sample) / len(tokens)

    def chunk(
        self,
        text: str,
        chunk_id_prefix: str = "chunk",
        metadata: Optional[dict[str, object]] = None,
    ) -> list[Chunk]:
        """
        Chunk text into overlapping chunks of ~chunk_size tokens.

        Args:
            text: Text to chunk
            chunk_id_prefix: Prefix for chunk IDs
            metadata: Additional metadata for chunks

        Returns:
            List of Chunk objects
        """
        if not text or not text.strip():
            return []

        tokens = self.tokenize(text)
        if not tokens:
            return []

        chunks: list[Chunk] = []
        position = 0
        step = max(1, self.chunk_size - self.overlap_size)
        char_search_cursor = 0
        char_ratio: float | None = None

        for token_start in range(0, len(tokens), step):
            token_end = min(token_start + self.chunk_size, len(tokens))
            chunk_tokens = tokens[token_start:token_end]
            if not chunk_tokens:
                continue

            chunk_text = self.decode(chunk_tokens).strip()
            if not chunk_text:
                continue

            # Locate this chunk's actual span in the original text. decode()
            # can normalize whitespace so it isn't always a verbatim substring
            # match; fall back to a char/token-ratio estimate anchored to the
            # token position rather than mislabeling every chunk as (0, len).
            found_at = text.find(chunk_text, char_search_cursor)
            if found_at == -1:
                if char_ratio is None:
                    char_ratio = self._estimate_char_to_token_ratio(text)
                found_at = min(len(text), round(token_start * char_ratio))
            start_char = found_at
            end_char = start_char + len(chunk_text)
            char_search_cursor = start_char + 1

            chunk_metadata = dict(metadata or {})
            chunk_metadata.update(
                {
                    "start_token_index": token_start,
                    "end_token_index": token_end,
                    "token_span": token_end - token_start,
                }
            )
            chunk_obj = Chunk(
                id=f"{chunk_id_prefix}_{position}",
                text=chunk_text,
                token_count=len(chunk_tokens),
                position=position,
                start_char=start_char,
                end_char=end_char,
                metadata=chunk_metadata,
            )
            chunks.append(chunk_obj)
            position += 1

        return chunks

    def chunk_and_map_entities(
        self,
        text: str,
        entities: list[dict[str, object]],
        chunk_id_prefix: str = "chunk",
    ) -> tuple[list[Chunk], dict[str, list[str]]]:
        """
        Chunk text and map entities to chunks they appear in.

        Args:
            text: Text to chunk
            entities: List of dicts with 'value' key
            chunk_id_prefix: Prefix for chunk IDs

        Returns:
            Tuple of (chunks, entity_to_chunk_ids_map)
        """
        chunks = self.chunk(text, chunk_id_prefix)

        # Map entities to chunks (simple substring matching)
        entity_to_chunks: dict[str, list[str]] = {}
        for entity in entities:
            entity_value = str(entity.get("value", "")).lower()
            if not entity_value or len(entity_value) < 2:
                continue

            matching_chunk_ids = []
            for chunk in chunks:
                if entity_value in chunk.text.lower():
                    matching_chunk_ids.append(chunk.id)

            if matching_chunk_ids:
                entity_key = f"{entity.get('type', 'entity')}:{entity_value}"
                entity_to_chunks[entity_key] = matching_chunk_ids

        return chunks, entity_to_chunks


# Singleton instance
_chunking_service: Optional[ChunkingService] = None


def get_chunking_service(
    chunk_size: int = 1200,
    overlap_size: int = 100,
) -> ChunkingService:
    """Get or create singleton ChunkingService instance."""
    global _chunking_service
    if (
        _chunking_service is None
        or _chunking_service.chunk_size != chunk_size
        or _chunking_service.overlap_size != overlap_size
    ):
        _chunking_service = ChunkingService(
            chunk_size=chunk_size,
            overlap_size=overlap_size,
        )
    return _chunking_service
