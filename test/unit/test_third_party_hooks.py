import time

from server.domain.third_party.discord_hook import DiscordHookProcessor
from server.domain.third_party.instagram_hook import InstagramHookProcessor
from server.domain.third_party.messenger_hook import MessengerHookProcessor
from server.domain.third_party.slack_hook import SlackHookProcessor
from server.domain.third_party.whatsapp_hook import WhatsAppHookProcessor
from server.domain.third_party.base_hook import hmac_sha256_hex


def _slack_signature(secret: str, timestamp: str, body: bytes) -> str:
    basestring = f"v0:{timestamp}:".encode("utf-8") + body
    return "v0=" + hmac_sha256_hex(secret, basestring)


def test_slack_verify_request_accepts_valid_signature():
    processor = SlackHookProcessor()
    secret = "shhh"
    body = b'{"type":"event_callback"}'
    timestamp = str(int(time.time()))
    headers = {
        "X-Slack-Request-Timestamp": timestamp,
        "X-Slack-Signature": _slack_signature(secret, timestamp, body),
    }
    assert processor.verify_request(headers, body, {"signing_secret": secret}) is True


def test_slack_verify_request_rejects_wrong_signature():
    processor = SlackHookProcessor()
    body = b'{"type":"event_callback"}'
    timestamp = str(int(time.time()))
    headers = {
        "X-Slack-Request-Timestamp": timestamp,
        "X-Slack-Signature": "v0=deadbeef",
    }
    assert processor.verify_request(headers, body, {"signing_secret": "shhh"}) is False


def test_slack_verify_request_rejects_replayed_old_timestamp():
    processor = SlackHookProcessor()
    secret = "shhh"
    body = b'{"type":"event_callback"}'
    old_timestamp = str(int(time.time()) - 60 * 10)  # 10 minutes old
    headers = {
        "X-Slack-Request-Timestamp": old_timestamp,
        "X-Slack-Signature": _slack_signature(secret, old_timestamp, body),
    }
    assert processor.verify_request(headers, body, {"signing_secret": secret}) is False


def test_slack_verify_request_rejects_tampered_body():
    processor = SlackHookProcessor()
    secret = "shhh"
    timestamp = str(int(time.time()))
    signature = _slack_signature(secret, timestamp, b'{"type":"event_callback"}')
    headers = {"X-Slack-Request-Timestamp": timestamp, "X-Slack-Signature": signature}
    tampered_body = b'{"type":"event_callback","injected":true}'
    assert processor.verify_request(headers, tampered_body, {"signing_secret": secret}) is False


def test_slack_verify_request_accepts_when_no_secret_configured():
    processor = SlackHookProcessor()
    assert processor.verify_request({}, b"anything", {}) is True


def test_slack_verify_request_rejects_missing_headers_when_secret_configured():
    processor = SlackHookProcessor()
    assert processor.verify_request({}, b"anything", {"signing_secret": "shhh"}) is False


def test_discord_verify_request_accepts_valid_ed25519_signature():
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    public_key_hex = public_key.public_bytes_raw().hex()

    processor = DiscordHookProcessor()
    timestamp = "1234567890"
    body = b'{"type":1}'
    signature = private_key.sign(timestamp.encode("utf-8") + body).hex()
    headers = {"X-Signature-Ed25519": signature, "X-Signature-Timestamp": timestamp}

    assert processor.verify_request(headers, body, {"public_key": public_key_hex}) is True


def test_discord_verify_request_rejects_invalid_signature():
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    private_key = Ed25519PrivateKey.generate()
    public_key_hex = private_key.public_key().public_bytes_raw().hex()

    processor = DiscordHookProcessor()
    headers = {"X-Signature-Ed25519": "00" * 64, "X-Signature-Timestamp": "1234567890"}
    assert processor.verify_request(headers, b'{"type":1}', {"public_key": public_key_hex}) is False


def test_discord_verify_request_accepts_when_no_key_configured():
    processor = DiscordHookProcessor()
    assert processor.verify_request({}, b"anything", {}) is True


def test_discord_post_challenge_response_answers_ping():
    processor = DiscordHookProcessor()
    assert processor.post_challenge_response({"type": 1}, {}) == {"type": 1}
    assert processor.post_challenge_response({"type": 2}, {}) is None


# --------------------------------------------------------------------------- #
# Meta platform GET-verification handshake (WhatsApp / Instagram / Messenger)  #
# --------------------------------------------------------------------------- #

_META_PROCESSORS = [WhatsAppHookProcessor, InstagramHookProcessor, MessengerHookProcessor]


def test_meta_get_verification_response_echoes_challenge_on_valid_token():
    for cls in _META_PROCESSORS:
        processor = cls()
        result = processor.get_verification_response(
            {"hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "abc123"},
            {"verify_token": "tok"},
        )
        assert result == {"content": "abc123"}, cls.__name__


def test_meta_get_verification_response_rejects_wrong_token():
    for cls in _META_PROCESSORS:
        processor = cls()
        result = processor.get_verification_response(
            {"hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "abc123"},
            {"verify_token": "tok"},
        )
        assert result is None, cls.__name__


def test_meta_get_verification_response_none_when_not_configured():
    for cls in _META_PROCESSORS:
        processor = cls()
        result = processor.get_verification_response(
            {"hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "abc123"},
            {},
        )
        assert result is None, cls.__name__


# --------------------------------------------------------------------------- #
# Instagram / Messenger message extraction                                     #
# --------------------------------------------------------------------------- #

def _messaging_body(object_type: str, text: str = "hi there") -> dict:
    return {
        "object": object_type,
        "entry": [
            {
                "messaging": [
                    {"sender": {"id": "user-1"}, "message": {"text": text}},
                ]
            }
        ],
    }


def test_instagram_extract_message_returns_text():
    processor = InstagramHookProcessor()
    msg = processor.extract_message(_messaging_body("instagram"))
    assert msg is not None
    assert msg.chat_id == "user-1"
    assert msg.text == "hi there"


def test_instagram_extract_message_none_for_wrong_object_type():
    processor = InstagramHookProcessor()
    assert processor.extract_message(_messaging_body("page")) is None


def test_instagram_extract_message_skips_echo():
    processor = InstagramHookProcessor()
    body = _messaging_body("instagram")
    body["entry"][0]["messaging"][0]["message"]["is_echo"] = True
    assert processor.extract_message(body) is None


def test_messenger_extract_message_returns_text():
    processor = MessengerHookProcessor()
    msg = processor.extract_message(_messaging_body("page"))
    assert msg is not None
    assert msg.chat_id == "user-1"
    assert msg.text == "hi there"


def test_messenger_extract_message_none_for_wrong_object_type():
    processor = MessengerHookProcessor()
    assert processor.extract_message(_messaging_body("instagram")) is None
