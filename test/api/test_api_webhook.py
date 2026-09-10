"""API tests for the inbound /webhook/{platform}/{company_id}/{hook_id} endpoints.

Covers the router logic (hook resolution, disabled-hook short circuit, signature
verification gate, platform challenge passthrough) which previously had zero
test coverage despite being an externally-reachable, unauthenticated surface.
"""

from __future__ import annotations

import json
import time

from conftest import API, unique

from server.domain.third_party.base_hook import hmac_sha256_hex


def _slack_signature(secret: str, timestamp: str, body: bytes) -> str:
    basestring = f"v0:{timestamp}:".encode("utf-8") + body
    return "v0=" + hmac_sha256_hex(secret, basestring)


def _make_company(client, admin_headers) -> str:
    resp = client.post(
        f"{API}/companies",
        json={"name": unique("webhook-co"), "description": "d", "type": "general"},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _make_inbound_hook(client, admin_headers, *, company_id: str, platform: str, config: dict, enabled: bool = True) -> str:
    resp = client.post(
        f"{API}/connections",
        json={
            "kind": "inbound_webhook",
            "platform": platform,
            "name": unique("hook"),
            "companyId": company_id,
            "config": config,
            "enabled": enabled,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_webhook_receive_404_for_unknown_hook(client):
    resp = client.post(f"{API}/webhook/slack/some-company/does-not-exist", json={})
    assert resp.status_code == 404


def test_webhook_receive_400_for_unknown_platform(client, admin_headers):
    company_id = _make_company(client, admin_headers)
    hook_id = _make_inbound_hook(client, admin_headers, company_id=company_id, platform="slack", config={})
    resp = client.post(f"{API}/webhook/not-a-real-platform/{company_id}/{hook_id}", json={})
    assert resp.status_code == 400


def test_webhook_receive_short_circuits_when_hook_disabled(client, admin_headers):
    company_id = _make_company(client, admin_headers)
    hook_id = _make_inbound_hook(
        client, admin_headers, company_id=company_id, platform="slack", config={}, enabled=False
    )
    resp = client.post(f"{API}/webhook/slack/{company_id}/{hook_id}", json={"anything": True})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "status": "hook_disabled"}


def test_webhook_receive_rejects_invalid_signature(client, admin_headers):
    company_id = _make_company(client, admin_headers)
    hook_id = _make_inbound_hook(
        client, admin_headers, company_id=company_id, platform="slack", config={"signing_secret": "supersecret"}
    )
    resp = client.post(
        f"{API}/webhook/slack/{company_id}/{hook_id}",
        content=b'{"type":"event_callback"}',
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 403


def test_webhook_receive_accepts_valid_signature_and_answers_slack_challenge(client, admin_headers):
    company_id = _make_company(client, admin_headers)
    secret = "supersecret"
    hook_id = _make_inbound_hook(
        client, admin_headers, company_id=company_id, platform="slack", config={"signing_secret": secret}
    )
    body = json.dumps({"type": "url_verification", "challenge": "abc123"}).encode("utf-8")
    timestamp = str(int(time.time()))
    resp = client.post(
        f"{API}/webhook/slack/{company_id}/{hook_id}",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Slack-Request-Timestamp": timestamp,
            "X-Slack-Signature": _slack_signature(secret, timestamp, body),
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"challenge": "abc123"}


def test_webhook_receive_reports_not_a_message_for_bot_events(client, admin_headers):
    company_id = _make_company(client, admin_headers)
    hook_id = _make_inbound_hook(client, admin_headers, company_id=company_id, platform="slack", config={})
    # No signing_secret configured -> verify_request accepts unsigned requests.
    body = json.dumps(
        {"event": {"type": "message", "bot_id": "B123", "text": "hi", "channel": "C1", "user": "U1"}}
    ).encode("utf-8")
    resp = client.post(
        f"{API}/webhook/slack/{company_id}/{hook_id}",
        content=body,
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "status": "not_a_message"}


def test_webhook_verify_get_defaults_to_ok(client, admin_headers):
    company_id = _make_company(client, admin_headers)
    hook_id = _make_inbound_hook(client, admin_headers, company_id=company_id, platform="slack", config={})
    resp = client.get(f"{API}/webhook/slack/{company_id}/{hook_id}")
    assert resp.status_code == 200
    assert resp.text == "OK"
