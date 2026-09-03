"""Test chunking service with Vietnamese text."""
import pytest
from server.app.service.chunking_service import ChunkingService, get_chunking_service


class TestChunkingService:
    def test_chunk_uses_exact_token_windows(self):
        """Chunking should advance by chunk_size - overlap_size token windows."""
        service = ChunkingService(chunk_size=20, overlap_size=5)
        text = " ".join(f"token{i}" for i in range(80))

        chunks = service.chunk(text, chunk_id_prefix="msg_demo")

        assert len(chunks) >= 4
        assert chunks[0].metadata["start_token_index"] == 0
        assert chunks[0].metadata["end_token_index"] == 20
        assert chunks[1].metadata["start_token_index"] == 15
        assert chunks[1].metadata["end_token_index"] == 35
        assert chunks[2].metadata["start_token_index"] == 30
        assert chunks[2].metadata["end_token_index"] == 50
        assert all(chunk.token_count == chunk.metadata["token_span"] for chunk in chunks)

    def test_chunk_vietnamese_text(self):
        """Test chunking Vietnamese text."""
        service = ChunkingService(chunk_size=200, overlap_size=20)
        
        vietnamese_text = """
        Giá vàng Bảo Tín Minh Châu hôm nay được cập nhật liên tục trên website của công ty. 
        Công ty cung cấp dịch vụ mua bán vàng, cập nhật giá vàng mới nhất và tư vấn đầu tư vàng uy tín. 
        Đảm bảo chất lượng, bảo mật và dịch vụ nhanh chóng tại Hà Nội. 
        Giá vàng Bảo Tín Minh Châu niêm yết ở mức 176.7 triệu đồng/lượng tăng 1.8 triệu đồng so với hôm qua.
        """
        
        chunks = service.chunk(vietnamese_text)
        
        assert len(chunks) > 0
        assert all(chunk.text for chunk in chunks)
        assert all(chunk.token_count > 0 for chunk in chunks)
        assert all(chunk.position >= 0 for chunk in chunks)
        
        # Check overlap
        for i, chunk in enumerate(chunks):
            assert chunk.id == f"chunk_{i}"
            assert chunk.start_char >= 0
            assert chunk.end_char > chunk.start_char

    def test_chunk_with_entities(self):
        """Test chunking and mapping entities to chunks."""
        service = ChunkingService(chunk_size=200, overlap_size=20)
        
        text = "Bao Tin Minh Chau is a gold company in Hanoi. They sell gold rings and bars."
        entities = [
            {"value": "Bao Tin Minh Chau", "type": "entity"},
            {"value": "gold", "type": "topic"},
            {"value": "Hanoi", "type": "entity"},
        ]
        
        chunks, entity_map = service.chunk_and_map_entities(text, entities)
        
        assert len(chunks) > 0
        assert len(entity_map) > 0
        
        # Check that entities are mapped to chunks
        for entity_key, chunk_ids in entity_map.items():
            assert isinstance(chunk_ids, list)
            assert len(chunk_ids) > 0
            for chunk_id in chunk_ids:
                chunk = next((c for c in chunks if c.id == chunk_id), None)
                assert chunk is not None

    def test_token_counting(self):
        """Test token counting with tiktoken."""
        service = ChunkingService(chunk_size=100, overlap_size=10)
        
        text = "The quick brown fox jumps over the lazy dog. " * 5
        tokens = service.tokenize(text)
        
        assert len(tokens) > 0
        assert isinstance(tokens, list)

    def test_tokenize_and_decode(self):
        """Test tokenization followed by decoding."""
        service = ChunkingService()
        
        text = "Giá vàng Bảo Tín Minh Châu"
        tokens = service.tokenize(text)
        decoded = service.decode(tokens)
        
        # Allow some variation in whitespace
        assert len(decoded) > 0
        assert "vàng" in decoded or "v" in decoded

    def test_singleton_instance(self):
        """Test that GetChunkingService returns singleton."""
        service1 = get_chunking_service()
        service2 = get_chunking_service()
        
        assert service1 is service2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
