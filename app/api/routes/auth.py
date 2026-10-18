from datetime import timedelta
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.core import auth, security, totp
from app.core.config import settings
from app.core.rate_limit import (
    rate_limit_account,
    rate_limit_login,
    rate_limit_register,
    rate_limit_two_factor,
)
from app.models.users import User
from app.schemas.users import (
    AccountDelete,
    LoginResponse,
    PasswordChange,
    Token,
    TwoFactorCode,
    TwoFactorDisable,
    TwoFactorLogin,
    TwoFactorSetup,
    UserCreate,
    UserRead,
    UserUpdate,
)
from app.services.cipher import CipherService

router = APIRouter()
cipher = CipherService()

TWO_FACTOR_CHALLENGE_MINUTES = 5


def _issue_access_token(user: User) -> dict:
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = auth.create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


def _require_password(user: User, password: str | None) -> None:
    if not password or not security.verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")


def _verify_totp(user: User, code: str) -> bool:
    if not user.totp_secret:
        return False
    return totp.verify_code(cipher.decrypt(user.totp_secret), code)


@router.post(
    "/register", response_model=UserRead, dependencies=[Depends(rate_limit_register)]
)
def register(user_in: UserCreate, session: SessionDep):
    # Check if email exists
    statement = select(User).where(User.email == user_in.email)
    if session.exec(statement).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User.model_validate(
        user_in, update={"hashed_password": security.hash_password(user_in.password)}
    )

    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post(
    "/login", response_model=LoginResponse, dependencies=[Depends(rate_limit_login)]
)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], session: SessionDep
):
    # Authenticate
    statement = select(User).where(User.email == form_data.username)
    user = session.exec(statement).first()

    if not user or not security.verify_password(
        form_data.password, user.hashed_password
    ):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # With 2FA on, hand back a short-lived challenge instead of a session token
    if user.totp_enabled:
        challenge = auth.create_access_token(
            subject=user.id,
            expires_delta=timedelta(minutes=TWO_FACTOR_CHALLENGE_MINUTES),
            token_type="2fa",
        )
        return {"requires_2fa": True, "challenge_token": challenge}

    return _issue_access_token(user)


@router.post(
    "/login/2fa", response_model=Token, dependencies=[Depends(rate_limit_two_factor)]
)
def login_two_factor(body: TwoFactorLogin, session: SessionDep):
    invalid = HTTPException(status_code=400, detail="Invalid or expired code")
    try:
        payload = jwt.decode(
            body.challenge_token,
            settings.secret_key.get_secret_value(),
            algorithms=[settings.algorithm],
        )
    except jwt.InvalidTokenError as e:
        raise invalid from e

    if payload.get("type") != "2fa":
        raise invalid

    user = session.get(User, UUID(payload["sub"]))
    if not user or not user.is_active or not user.totp_enabled:
        raise invalid
    if not _verify_totp(user, body.code):
        raise invalid

    return _issue_access_token(user)


@router.get("/me", response_model=UserRead)
def read_users_me(current_user: CurrentUser):
    return current_user


@router.patch("/me", response_model=UserRead)
def update_me(body: UserUpdate, current_user: CurrentUser, session: SessionDep):
    if body.email is not None and body.email != current_user.email:
        _require_password(current_user, body.current_password)
        existing = session.exec(select(User).where(User.email == body.email)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = body.email

    if body.full_name is not None:
        current_user.full_name = body.full_name.strip() or None

    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.post("/me/password", dependencies=[Depends(rate_limit_account)])
def change_password(body: PasswordChange, current_user: CurrentUser, session: SessionDep):
    _require_password(current_user, body.current_password)
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400, detail="New password must differ from the current one"
        )

    current_user.hashed_password = security.hash_password(body.new_password)
    session.add(current_user)
    session.commit()
    return {"ok": True}


@router.delete("/me", dependencies=[Depends(rate_limit_account)])
def delete_me(body: AccountDelete, current_user: CurrentUser, session: SessionDep):
    _require_password(current_user, body.password)
    session.delete(current_user)
    session.commit()
    return {"ok": True}


# ── Two-factor authentication ──


@router.post("/2fa/setup", response_model=TwoFactorSetup)
def two_factor_setup(current_user: CurrentUser, session: SessionDep):
    """Generate a new (unconfirmed) TOTP secret for the user."""
    if current_user.totp_enabled:
        raise HTTPException(
            status_code=400, detail="Two-factor authentication is already enabled"
        )

    secret = totp.generate_secret()
    current_user.totp_secret = cipher.encrypt(secret)
    session.add(current_user)
    session.commit()

    return {
        "secret": secret,
        "otpauth_uri": totp.provisioning_uri(secret, current_user.email),
    }


@router.post(
    "/2fa/enable", response_model=UserRead, dependencies=[Depends(rate_limit_two_factor)]
)
def two_factor_enable(body: TwoFactorCode, current_user: CurrentUser, session: SessionDep):
    if current_user.totp_enabled:
        raise HTTPException(
            status_code=400, detail="Two-factor authentication is already enabled"
        )
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="Start two-factor setup first")
    if not _verify_totp(current_user, body.code):
        raise HTTPException(status_code=400, detail="Invalid code")

    current_user.totp_enabled = True
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.post(
    "/2fa/disable", response_model=UserRead, dependencies=[Depends(rate_limit_two_factor)]
)
def two_factor_disable(
    body: TwoFactorDisable, current_user: CurrentUser, session: SessionDep
):
    if not current_user.totp_enabled:
        raise HTTPException(
            status_code=400, detail="Two-factor authentication is not enabled"
        )
    _require_password(current_user, body.password)
    if not _verify_totp(current_user, body.code):
        raise HTTPException(status_code=400, detail="Invalid code")

    current_user.totp_enabled = False
    current_user.totp_secret = None
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user
