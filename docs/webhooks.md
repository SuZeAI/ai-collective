# Inbound Webhooks

The backend can receive messages from ~15 messaging platforms, run the
configured agent team, and reply. Webhook processors live in
`backend/domain/third_party/` and are dispatched by `backend/api/routers/webhook.py`.

## Endpoints

```
GET  /api/v1/webhook/{platform}/{workspace_id}/{hook_id}   # verification handshake
POST /api/v1/webhook/{platform}/{workspace_id}/{hook_id}   # incoming events
```

`platform` is one of the registry keys (e.g. `slack`, `telegram`, `discord`,
`line_messaging`, `whatsapp_business`, `facebook_messenger`, `instagram`,
`wechat_messaging`, `viber_messaging`, `zalo_messaging`, `signal_messaging`,
`skype_messaging`, `teams`, `wire_messaging`, `snapchat_messaging`).

## Request flow (POST)

1. Resolve workspace + hook; 404 if missing, `{"status":"hook_disabled"}` if off.
2. **Verify the signature** — `processor.verify_request(headers, raw_body, config)`.
   Returns 403 on failure.
3. Handle synchronous handshakes: Slack `url_verification` challenge and the
   generic `post_challenge_response` (Discord Interactions PING → `{"type": 1}`).
4. Parse the body (JSON, or XML via **defusedxml** for WeChat).
5. `extract_message` → if it is a chat message, run the agent team in a
   background task and reply via `send_response`.

## Signature verification

Verification is enforced when a secret is configured; if none is set, the
request is accepted (legacy behaviour) so unverifiable platforms still work.
All comparisons are constant-time.

| Platform | Mechanism | Config field |
|----------|-----------|--------------|
| Slack | HMAC-SHA256 over `v0:{ts}:{body}`, 5-min replay window | `signing_secret` |
| LINE | Base64 HMAC-SHA256 of the raw body | `channel_secret` |
| WhatsApp / Messenger / Instagram | `X-Hub-Signature-256` (HMAC-SHA256) | `app_secret` *(optional, new)* |
| Discord | Ed25519 over `{timestamp}{body}` (via `cryptography`) | `public_key` *(optional, new)* |
| WeChat | SHA1 of sorted `token,timestamp,nonce` (GET verify) | `verify_token` |
| Others | none available → accepted | — |

> To **enforce** verification on Meta platforms and Discord, set the new
> `app_secret` / `public_key` config fields on the hook. Without them,
> verification is skipped.

## Outbound replies

Replies go out through each processor's `send_response`. Notes:

- Meta platforms (WhatsApp/Messenger/Instagram) send the access token in the
  `Authorization` header (not the query string).
- LINE prefers **push-by-userId**; reply tokens expire (~1 min) and the agent
  reply is produced asynchronously, so a `reply:`-prefixed chat id is only used
  when no userId is available.
- WeChat keeps the short-lived `access_token` in the query string (required by
  the WeChat API).

## Adding a platform

1. Implement a `BaseHookProcessor` subclass in `domain/third_party/` with
   `extract_message`, `send_response`, and (recommended) `verify_request`.
2. Register it in `domain/third_party/registry.py` (`_REGISTRY`, labels, config
   fields).
3. Reuse `base_hook` helpers (`_http_post`, `hmac_sha256_hex`,
   `hmac_sha256_b64`, `_header`) rather than re-rolling HTTP/crypto.
