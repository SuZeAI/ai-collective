from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from server.api.security import create_access_token
from server.api.schemas.auth_user import (
    RegisterRequest,
    LoginRequest,
    UserSchema,
    TokenResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
)
from server.api.deps import (
    get_account_deletion_service,
    get_user_service,
    current_user_dep,
)
from server.app.service.account_deletion_service import AccountDeletionService
from server.app.service.user_service import UserService
from server.domain.errors import ValidationError, NotFoundError
from server.domain.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest,
    user_service: UserService = Depends(get_user_service),
) -> TokenResponse:
    """Register a new user account."""
    try:
        user = user_service.register(name=body.name, email=body.email, password=body.password)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    token = create_access_token(subject=user.id)
    return TokenResponse(access_token=token, user=UserSchema.from_domain(user))


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    user_service: UserService = Depends(get_user_service),
) -> TokenResponse:
    """Authenticate with email + password and return a JWT token."""
    try:
        user = user_service.authenticate(email=body.email, password=body.password)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    token = create_access_token(subject=user.id)
    return TokenResponse(access_token=token, user=UserSchema.from_domain(user))


@router.get("/me", response_model=UserSchema)
def get_me(current_user: User = Depends(current_user_dep)) -> UserSchema:
    """Return the currently authenticated user's profile."""
    return UserSchema.from_domain(current_user)


_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_IMAGE_EXTENSION_BY_CONTENT_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
_AVATAR_DIR = Path("static/avatars")
_MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB


@router.patch("/profile", response_model=UserSchema)
def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(current_user_dep),
    user_service: UserService = Depends(get_user_service),
) -> UserSchema:
    """Update the current user's name, email, and/or avatar URL."""
    try:
        updated = user_service.update_profile(
            current_user.id,
            name=body.name,
            email=str(body.email) if body.email else None,
            avatar=body.avatar,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return UserSchema.from_domain(updated)


@router.post("/avatar", response_model=UserSchema)
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(current_user_dep),
    user_service: UserService = Depends(get_user_service),
) -> UserSchema:
    """Upload a new avatar image (JPEG, PNG, GIF, WebP; max 5 MB)."""
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP.")
    content = await file.read()
    if len(content) > _MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Max 5 MB.")
    # Derive the extension from the already-validated content type rather than
    # trusting the client-supplied filename, so a crafted filename can't pick
    # an arbitrary extension for the file written under _AVATAR_DIR.
    ext = _IMAGE_EXTENSION_BY_CONTENT_TYPE[file.content_type]
    _AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    dest = _AVATAR_DIR / f"{current_user.id}{ext}"
    # Offload blocking disk write so it doesn't stall the event loop.
    await asyncio.to_thread(dest.write_bytes, content)
    avatar_url = str(request.base_url).rstrip("/") + f"/static/avatars/{current_user.id}{ext}"
    updated = user_service.update_profile(current_user.id, avatar=avatar_url)
    return UserSchema.from_domain(updated)


@router.patch("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(current_user_dep),
    user_service: UserService = Depends(get_user_service),
) -> None:
    """Change the current user's password."""
    try:
        user_service.change_password(
            current_user.id,
            current_password=body.current_password,
            new_password=body.new_password,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(current_user: User = Depends(current_user_dep)) -> None:
    """Sign out — client should discard the JWT token."""
    return None


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    current_user: User = Depends(current_user_dep),
    account_deletion_service: AccountDeletionService = Depends(get_account_deletion_service),
) -> None:
    """Permanently delete the current user's account and everything they own."""
    account_deletion_service.delete_account(current_user.id)
    return None
