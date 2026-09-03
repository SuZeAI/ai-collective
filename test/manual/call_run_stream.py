"""
Test script to call the streaming agent-graph endpoint
"""
import asyncio
import httpx
import json

# Configuration
BASE_URL = "http://localhost:8000"
ENDPOINT = "/api/v1/llm/agent-graph/run-stream"

async def test_stream():
    """Test streaming endpoint"""
    
    # Prepare request payload
    payload = {
        "user_input": "Explain quantum computing in simple terms",
        "agents": ["agent_1", "agent_2"],  # Replace with actual agent IDs
        "max_rounds": 6
    }
    
    print(f"Calling {BASE_URL}{ENDPOINT}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print("-" * 80)
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream(
                "POST",
                f"{BASE_URL}{ENDPOINT}",
                json=payload
            ) as response:
                print(f"Status: {response.status_code}")
                print("-" * 80)
                
                if response.status_code == 200:
                    # Process Server-Sent Events
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            # Extract JSON from SSE format
                            json_str = line[6:]  # Remove "data: " prefix
                            try:
                                event_data = json.loads(json_str)
                                print(f"\n[Turn {event_data.get('turn')}]")
                                print(f"Agent: {event_data.get('agent_name')} ({event_data.get('agent_role')})")
                                print(f"Response: {event_data.get('content')}")
                                print("-" * 40)
                            except json.JSONDecodeError:
                                print(f"Failed to parse: {json_str}")
                else:
                    print(f"Error: {response.status_code}")
                    print(await response.atext())
                    
    except Exception as e:
        print(f"Error: {e}")


def test_stream_sync():
    """Synchronous test using requests library"""
    import requests
    
    payload = {
        "user_input": "Analyze the golden price market and provide insights",
        "agents": ["a1", "a2", "a3"],  # Replace with actual agent IDs
        "max_rounds": 6
    }
    
    print(f"Calling {BASE_URL}{ENDPOINT} (sync)")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print("-" * 80)
    
    try:
        response = requests.post(
            f"{BASE_URL}{ENDPOINT}",
            json=payload,
            stream=True,
            timeout=300
        )
        
        print(f"Status: {response.status_code}")
        print("-" * 80)
        
        if response.status_code == 200:
            for line in response.iter_lines():
                if line:
                    if line.startswith(b"data: "):
                        json_str = line[6:].decode()
                        try:
                            event_data = json.loads(json_str)
                            print(f"\n[Turn {event_data.get('turn')}]")
                            print(f"Agent: {event_data.get('agent_name')} ({event_data.get('agent_role')})")
                            print(f"Response: {event_data.get('content')}")
                            print("-" * 40)
                        except json.JSONDecodeError:
                            print(f"Failed to parse: {json_str}")
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    import sys
    
    # Check if requests or httpx is available
    try:
        import requests
        print("Using requests library (sync)\n")
        test_stream_sync()
    except ImportError:
        try:
            print("Using httpx library (async)\n")
            asyncio.run(test_stream())
        except ImportError:
            print("Please install requests or httpx: pip install requests httpx")
            sys.exit(1)
