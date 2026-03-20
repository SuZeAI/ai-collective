#!/bin/bash

# Curl command to call the agent-graph/run endpoint with list of agent IDs
# The API will fetch agent details from the database
curl -X POST http://localhost:8000/api/v1/llm/agent-graph/run \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "Analyze the golden price market and provide insights.",
    "max_rounds": 5,
    "agents": ["a1", "a2", "a3"]
  }'
