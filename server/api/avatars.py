from __future__ import annotations


def sanitize_avatar_fields(
    avatar_icon: str | None, avatar_color: str | None, avatar_url: str | None
) -> tuple[str, str, str]:
    return (
        (avatar_icon or "").strip(),
        (avatar_color or "").strip(),
        (avatar_url or "").strip(),
    )
