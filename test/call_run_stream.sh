#!/bin/bash
# Test streaming endpoint with curl

BASE_URL="http://localhost:8000"
ENDPOINT="/llm/agent-graph/run-stream"

echo "Testing streaming endpoint with curl..."
echo "=========================================="
echo ""

# Make SSE request
curl -N -X POST "${BASE_URL}${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "Explain quantum computing in simple terms",
    "agents": ["agent_1", "agent_2"],
    "max_rounds": 6
  }' \
  -v

echo ""
echo "=========================================="
echo "Done"
