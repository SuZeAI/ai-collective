# LangGraph Custom Stream Writer Guide

## Tổng quan
Đã cập nhật orchestrators để sử dụng `get_stream_writer()` từ LangGraph, cho phép stream custom events trong thực thi agent mà không cần update state.

## Thay đổi chính

### 1. Import mới
```python
from langgraph.config import get_stream_writer
```

### 2. Streaming Mode
Thay đổi từ state-based streaming sang custom event streaming:
```python
# Cũ: graph.astream(initial)
# Mới: graph.astream(initial, stream_mode="custom")
async for event in graph.astream(initial, stream_mode="custom"):
    # event là dicts gửi từ get_stream_writer()
    yield event
```

### 3. Node Functions
Trong mỗi node function, gọi `get_stream_writer()` để gửi real-time events:

```python
async def node(state: MultiAgentState):
    stream_writer = get_stream_writer()

    # Stream: Start event
    stream_writer({
        "type": "agent_start",
        "agent_name": agent.name,
        "turn": turn_number,
    })

    # ... Xử lý logic ...

    # Stream: Context built
    stream_writer({
        "type": "context_retrieved",
        "node_ids": pack.node_ids,
        "chunk_ids": pack.chunk_ids,
    })

    # ... LLM processing ...

    # Stream: Complete
    stream_writer({
        "type": "turn_complete",
        "turn": new_turn,
    })

    return updated_state
```

## Stream Event Types

### Orchestrator Common Events
Canonical values live in the `EventType` enum (`server/domain/event/schema.py`);
every topology streams `EventType.<NAME>.value` dicts rather than hand-typed
strings, so the wire format below is authoritative across all 5 topologies
(sequential/ring/supervisor/tree/mesh).

- **agent_start**: Agent bắt đầu turn (sequential)
- **agent_turn_start**: Agent turn starts with round info (ring/tree/supervisor/mesh)
- **context_building**: Đang build context
- **context_retrieved**: Context hoàn tất với knowledge graph info
- **llm_request_start**: LLM request bắt đầu
- **llm_response_complete**: LLM response nhận được
- **message_ingested**: Thông báo ingested vào knowledge graph
- **turn_complete**: Turn hoàn tất với turn object
- **subagent_start** / **subagent_complete**: A staff member spawns/finishes a subagent (`domain/tools/task.py`)
- **fanout_start** / **fanout_complete**: Concurrent branch fan-out begins/ends (supervisor/mesh)
- **user_message_injected**: A mid-run human interjection was merged into the conversation (`_graph_runtime.py`)
- **run_paused** / **run_resumed**: The run was paused/resumed (`_graph_runtime.py`)
- **user_input_request** / **user_input_received**: The `ask_user` tool is waiting for / received human input (`domain/tools/ask_user.py`)

### Event Structure
Mỗi event là dict Python với:
- `type`: String identifier (e.g., "agent_start", "context_retrieved")
- `agent_name`: Tên agent processing
- Các fields khác tuỳ loại event

## Client-side Usage

### Python Async Client
```python
from server.domain.staff.langgraph_mesh import MultiAgentMeshOrchestrator

orchestrator = MultiAgentMeshOrchestrator()

# Streaming
async for event in orchestrator.run_stream(
    user_input="Your query",
    agents=agents_list,
    llm=llm_provider,
    max_rounds=5,
):
    print(f"Event type: {event.get('type')}")

    if event["type"] == "agent_start":
        print(f"Agent {event['agent_name']} starting turn {event['turn']}")

    elif event["type"] == "context_retrieved":
        print(f"Retrieved {len(event.get('node_ids', []))} nodes")

    elif event["type"] == "llm_request_start":
        print(f"Calling LLM with {event['context_length']} chars")

    elif event["type"] == "turn_complete":
        turn = event.get('turn')
        print(f"Turn complete: {turn.agent_name} -> {turn.content[:100]}")
```

### WebSocket/HTTP Streaming
```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

@router.post("/stream-agent")
async def stream_agent_response(request: dict):
    async def event_generator():
        async for event in orchestrator.run_stream(...):
            # Gửi JSON event
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

## Lợi ích của Custom Stream Writer

### 1. **Real-time Events**
- Gửi events ngay khi xảy ra (không chờ state update)
- Streaming partial results, intermediate steps

### 2. **Linh hoạt hơn**
- Không cần thay đổi state structure
- Có thể gửi debugging info, metrics, logging
- Decoupled từ state management

### 3. **Tốc độ**
- Không cần serialize toàn bộ state
- Chỉ gửi relevant information

### 4. **Better UX**
- Show progress in real-time
- Display agent reasoning steps
- Show knowledge graph retrieval progress

## Migration Path

### Từ state-based sang custom events

**Trước:**
```python
async for event in graph.astream(initial):
    state_update = next(iter(event.values())) if event else {}
    if "turns" in state_update:
        new_turns = state_update["turns"]
        if new_turns:
            yield new_turns[-1]
```

**Sau:**
```python
async for event in graph.astream(initial, stream_mode="custom"):
    if isinstance(event, dict):
        yield event
```

## Examples

### 1. Track Agent Progress
```python
progress = {}
async for event in orchestrator.run_stream(...):
    if event["type"] == "agent_turn_start":
        progress[event["agent_name"]] = "processing"
    elif event["type"] == "turn_complete":
        progress[event["turn"].agent_name] = "done"

    print(f"Progress: {progress}")
```

### 2. Collect Metrics
```python
metrics = {
    "context_retrievals": 0,
    "llm_calls": 0,
    "total_tokens": 0,
}

async for event in orchestrator.run_stream(...):
    if event["type"] == "context_retrieved":
        metrics["context_retrievals"] += 1
    elif event["type"] == "llm_request_start":
        metrics["llm_calls"] += 1
```

### 3. Display Knowledge Graph Integration
```python
async for event in orchestrator.run_stream(...):
    if event["type"] == "context_retrieved":
        print(f"Knowledge Graph:")
        print(f"  - Nodes: {event['node_ids']}")
        print(f"  - Edges: {event['edge_ids']}")
        print(f"  - Chunks: {event['chunk_ids']}")
```

## Troubleshooting

### Events không được stream
- Kiểm tra: `stream_mode="custom"` được pass vào `astream()`
- Kiểm tra: `get_stream_writer()` được gọi trong node function
- Kiểm tra: Node function chạy async (use `await` với `chat()`)

### Python < 3.11 Issue
`get_stream_writer()` cần Python >= 3.11 hoặc Python >= 3.10 với asyncio task creation.

## Files Đã Thay Đổi
- `server/domain/staff/langgraph_orchestrator.py` (sequential)
- `server/domain/staff/langgraph_ring.py` (ring)
- `server/domain/staff/langgraph_supervisor.py` (supervisor)
- `server/domain/staff/langgraph_tree.py` (tree)
- `server/domain/staff/langgraph_mesh.py` (mesh)
- `server/domain/staff/_graph_runtime.py` (shared turn/pause/resume events)
- `server/domain/tools/task.py` (subagent events), `server/domain/tools/ask_user.py` (human-in-the-loop events)

Tất cả 5 topologies giờ support streaming với `get_stream_writer()`.
