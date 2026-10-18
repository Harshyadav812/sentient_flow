import re
from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, field_validator
from sqlmodel import Field, SQLModel


# Base: Shared properties (visible in API and DB)
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)

    # only for display
    full_name: str | None = Field(default=None, max_length=255)

    is_active: bool = True


def check_password_complexity(v: str) -> str:
    """Enforce password complexity: min 8 chars, 1 upper, 1 lower, 1 digit."""
    if not re.search(r"[A-Z]", v):
        msg = "Password must contain at least one uppercase letter"
        raise ValueError(msg)
    if not re.search(r"[a-z]", v):
        msg = "Password must contain at least one lowercase letter"
        raise ValueError(msg)
    if not re.search(r"\d", v):
        msg = "Password must contain at least one digit"
        raise ValueError(msg)
    return v


# Create: Input for Sign Up (client -> server)
class UserCreate(UserBase):
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        return check_password_complexity(v)


# Read: Output for API Responses (server -> client)
class UserRead(UserBase):
    id: UUID
    totp_enabled: bool = False
    created_at: datetime | None = None


# Update: Input for Editing Profile (PATCH /auth/me)
class UserUpdate(SQLModel):
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, max_length=255)
    # Required when changing email
    current_password: str | None = None


class PasswordChange(SQLModel):
    current_password: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        return check_password_complexity(v)


class AccountDelete(SQLModel):
    password: str


class Token(SQLModel):
    access_token: str
    token_type: str


# Login either returns a token, or a short-lived challenge when 2FA is on
class LoginResponse(SQLModel):
    access_token: str | None = None
    token_type: str = "bearer"
    requires_2fa: bool = False
    challenge_token: str | None = None


class TwoFactorLogin(SQLModel):
    challenge_token: str
    code: str


class TwoFactorSetup(SQLModel):
    secret: str
    otpauth_uri: str


class TwoFactorCode(SQLModel):
    code: str


class TwoFactorDisable(SQLModel):
    password: str
    code: str
