import re
from uuid import UUID

from pydantic import EmailStr, field_validator
from sqlmodel import Field, SQLModel


# Base: Shared properties (visible in API and DB)
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)

    # only for display
    full_name: str | None = Field(default=None, max_length=255)

    is_active: bool = True


# Create: Input for Sign Up (client -> server)
class UserCreate(UserBase):
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
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


# Read: Output for API Responses (server -> client)
class UserRead(UserBase):
    id: UUID


# Update: Input for Editing Profile (PATCH requests)
class UserUpdate(SQLModel):
    email: EmailStr | None = None
    full_name: str | None = None
    password: str | None = None
    is_active: bool | None = None


class Token(SQLModel):
    access_token: str
    token_type: str
