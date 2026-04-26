from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserSchema(BaseModel):
    id: str
    name: str
    email: str
    role: str
    avatar: str | None = None
    joined_at: str | None = None

    @staticmethod
    def from_domain(u) -> "UserSchema":
        return UserSchema(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role,
            avatar=u.avatar or None,
            joined_at=u.joined_at or None,
        )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSchema


class UpdateProfileRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    avatar: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)
