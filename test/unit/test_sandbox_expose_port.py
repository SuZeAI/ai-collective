from __future__ import annotations

import asyncio
from unittest.mock import MagicMock, patch

from server.infra.sandbox.aio_sandbox import AioSandbox, SandboxAPIError
from server.infra.sandbox.local_sandbox import LocalSandboxAdapter
from server.domain.tools.sandbox_tools import SandboxToolkit


def _run(coro):
    return asyncio.run(coro)


def test_local_sandbox_expose_port_is_already_reachable(tmp_path):
    sandbox = LocalSandboxAdapter(workspace=str(tmp_path))
    url = _run(sandbox.expose_port(6789))
    assert url == "http://127.0.0.1:6789"


def test_aio_sandbox_expose_port_calls_provisioner_and_returns_url():
    sandbox = AioSandbox(id="abc123", base_url="http://sandbox:8080", provisioner_url="http://provisioner:8002")
    fake_response = MagicMock()
    fake_response.json.return_value = {"port": 6789, "node_port": 31983, "url": "http://host.docker.internal:31983"}
    fake_response.raise_for_status.return_value = None

    with patch("server.infra.sandbox.aio_sandbox.requests.post", return_value=fake_response) as mock_post:
        url = _run(sandbox.expose_port(6789))

    assert url == "http://host.docker.internal:31983"
    called_url = mock_post.call_args[0][0]
    assert called_url == "http://provisioner:8002/api/sandboxes/abc123/expose"
    assert mock_post.call_args[1]["json"] == {"port": 6789}


def test_aio_sandbox_expose_port_without_provisioner_url_raises():
    sandbox = AioSandbox(id="abc123", base_url="http://sandbox:8080")
    try:
        _run(sandbox.expose_port(6789))
        assert False, "expected SandboxAPIError"
    except SandboxAPIError:
        pass


def test_sandbox_expose_port_tool_delegates_to_sandbox(tmp_path):
    local = LocalSandboxAdapter(workspace=str(tmp_path))
    toolkit = SandboxToolkit(sandbox=local)
    tools = {t.name: t for t in toolkit.get_tools()}
    assert "sandbox_expose_port" in tools

    result = _run(tools["sandbox_expose_port"]._arun(description="dev server", port=6789))
    assert result == "Exposed. Reachable at: http://127.0.0.1:6789"
