from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from server.api.settings import settings
from server.api.security import create_access_token
from server.api.schemas.auth_user import UserSchema, GoogleLoginUrlResponse
from server.app.service.google_login_service import GoogleLoginService
from server.api.deps import get_user_service, current_user_dep
from server.app.service.user_service import UserService
from server.domain.errors import ValidationError
from server.domain.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _google_login_service() -> GoogleLoginService:
    return GoogleLoginService(
        client_id=settings.google_login_client_id,
        client_secret=settings.google_login_client_secret,
        redirect_uri=settings.google_login_redirect_uri,
        frontend_url=settings.frontend_url,
    )


@router.get("/google/login", response_model=GoogleLoginUrlResponse)
def google_login(
    svc: GoogleLoginService = Depends(_google_login_service),
) -> GoogleLoginUrlResponse:
    """Return the Google OAuth2 authorization URL for social sign-in.

    The frontend should redirect the user to `authorize_url`.
    """
    authorize_url, state = svc.build_authorization_url()
    return GoogleLoginUrlResponse(authorize_url=authorize_url, state=state)


@router.get("/google/callback")
def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    svc: GoogleLoginService = Depends(_google_login_service),
    user_service: UserService = Depends(get_user_service),
) -> RedirectResponse:
    """Handle Google OAuth2 callback.

    Google redirects here with `code` and `state`.  We exchange the code for
    tokens, fetch the user's profile, create/find the local account, issue a
    JWT, then redirect the browser to `{FRONTEND_URL}/auth/callback?token=...`.
    """
    if error:
        return RedirectResponse(svc.frontend_error_url(error), status_code=302)

    if not code or not state:
        return RedirectResponse(svc.frontend_error_url("Missing code or state"), status_code=302)

    try:
        userinfo = svc.exchange_code(
            code=code,
            state=state,
            authorization_response=str(request.url),
        )
    except HTTPException as exc:
        return RedirectResponse(svc.frontend_error_url(exc.detail), status_code=302)

    google_sub: str = userinfo.get("sub", "")
    email: str = userinfo.get("email", "")
    name: str = userinfo.get("name", "")
    picture: str = userinfo.get("picture", "")

    if not email or not google_sub:
        return RedirectResponse(svc.frontend_error_url("Google did not return an email"), status_code=302)
    # Only trust this email for linking to an existing local account if Google
    # itself has verified it — otherwise a Google account with an unverified
    # email claim could get silently linked to someone else's password account.
    if not userinfo.get("email_verified"):
        return RedirectResponse(svc.frontend_error_url("Google account email is not verified"), status_code=302)

    user = user_service.find_or_create_by_oauth(
        provider="google",
        provider_id=google_sub,
        email=email,
        name=name,
        avatar=picture,
    )

    token = create_access_token(subject=user.id)
    return RedirectResponse(svc.frontend_callback_url(token), status_code=302)


@router.post("/google/unlink", response_model=UserSchema)
def unlink_google(
    current_user: User = Depends(current_user_dep),
    user_service: UserService = Depends(get_user_service),
) -> UserSchema:
    """Unlink the Google account from the current user, keeping local-password login."""
    try:
        updated = user_service.unlink_oauth_provider(current_user.id)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return UserSchema.from_domain(updated)
