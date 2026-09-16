import socket

import pytest

from server.api.settings import settings
from server.domain.tools._ssrf import BlockedURLError, resolve_validated_ip, validate_public_url


def _fake_getaddrinfo(*ips: str):
    def fake(host, port, proto=None):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, port)) for ip in ips]

    return fake


@pytest.fixture(autouse=True)
def guard_enabled(monkeypatch):
    monkeypatch.setattr(settings.security, "allow_private_http", False)


def test_blocks_non_http_scheme():
    with pytest.raises(BlockedURLError, match="scheme"):
        validate_public_url("ftp://example.com/file")


def test_blocks_missing_host():
    with pytest.raises(BlockedURLError, match="missing host"):
        validate_public_url("http:///path")


def test_allows_public_ip(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("93.184.216.34"))
    validate_public_url("http://example.com/")  # does not raise


def test_blocks_private_ip(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("10.0.0.5"))
    with pytest.raises(BlockedURLError, match="non-public"):
        validate_public_url("http://internal.example.com/")


def test_blocks_loopback_ip(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("127.0.0.1"))
    with pytest.raises(BlockedURLError):
        validate_public_url("http://localhost/")


def test_blocks_cloud_metadata_link_local_ip(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("169.254.169.254"))
    with pytest.raises(BlockedURLError):
        validate_public_url("http://169.254.169.254/latest/meta-data/")


def test_blocks_if_any_resolved_address_is_private(monkeypatch):
    # Multi-answer DNS: even one private address among several public ones
    # must block the whole request (defense against selective-answer rebinding).
    def fake(host, port, proto=None):
        return [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.1", port)),
        ]

    monkeypatch.setattr(socket, "getaddrinfo", fake)
    with pytest.raises(BlockedURLError):
        validate_public_url("http://mixed.example.com/")


def test_dns_resolution_failure_raises(monkeypatch):
    def fake(host, port, proto=None):
        raise socket.gaierror("name not known")

    monkeypatch.setattr(socket, "getaddrinfo", fake)
    with pytest.raises(BlockedURLError, match="Could not resolve"):
        validate_public_url("http://nonexistent.invalid/")


def test_guard_disabled_allows_private_ip(monkeypatch):
    monkeypatch.setattr(settings.security, "allow_private_http", True)
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("10.0.0.5"))
    validate_public_url("http://internal.example.com/")  # does not raise


def test_resolve_validated_ip_returns_public_ip(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("93.184.216.34"))
    assert resolve_validated_ip("example.com", 80) == "93.184.216.34"


def test_resolve_validated_ip_blocks_private(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _fake_getaddrinfo("10.0.0.5"))
    with pytest.raises(BlockedURLError):
        resolve_validated_ip("internal.example.com", 80)


def test_resolve_validated_ip_returns_none_when_guard_disabled(monkeypatch):
    monkeypatch.setattr(settings.security, "allow_private_http", True)
    assert resolve_validated_ip("anything.invalid", 80) is None
