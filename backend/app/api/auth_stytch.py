"""Stytch session-JWT → backend-JWT exchange endpoint.

This lets us delegate email/password/magic-link/OTP/OAuth to Stytch while keeping
the existing app-level JWT + UUID user model unchanged.  The seeded
`admin@admin.com` account does *not* exist in Stytch, so the classic
`/api/auth/login` path stays in place for admin access.
"""
from __future__ import annotations

import logging
import uuid
from datetime import timedelta
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from jose.exceptions import JWTError
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import create_access_token
from app.database import get_db
from app.models.player import Player
from app.models.user import User, UserRole
from app.schemas.auth import TokenResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

STYTCH_PROJECT_ID = "project-test-1ebd7b7e-47c1-4275-b802-cd8b0cd2cb31"
STYTCH_JWKS_URL = (
    f"https://test.stytch.com/v1/sessions/jwks/{STYTCH_PROJECT_ID}"
)
STYTCH_SESSION_CLAIM = "https://stytch.com/session"
# Stytch session JWTs are signed RS256 and have `iss` = this value.
STYTCH_EXPECTED_ISSUER = f"stytch.com/{STYTCH_PROJECT_ID}"

# Process-lifetime JWKS cache.
_JWKS_CACHE: dict[str, Any] | None = None


class StytchExchangeRequest(BaseModel):
    session_jwt: str


async def _get_jwks() -> dict[str, Any]:
    global _JWKS_CACHE
    if _JWKS_CACHE is not None:
        return _JWKS_CACHE
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(STYTCH_JWKS_URL)
        resp.raise_for_status()
        _JWKS_CACHE = resp.json()
    return _JWKS_CACHE


def _pick_key(jwks: dict[str, Any], kid: str) -> dict[str, Any] | None:
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    return None


async def _verify_stytch_jwt(session_jwt: str) -> dict[str, Any]:
    """Validate the Stytch session JWT signature + basic claims.

    Returns the decoded claims dict on success.
    """
    try:
        header = jwt.get_unverified_header(session_jwt)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Stytch JWT header: {exc}",
        ) from exc

    kid = header.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Stytch JWT missing kid",
        )

    jwks = await _get_jwks()
    key = _pick_key(jwks, kid)
    if key is None:
        # Key may have rotated — bust the cache and retry once.
        global _JWKS_CACHE
        _JWKS_CACHE = None
        jwks = await _get_jwks()
        key = _pick_key(jwks, kid)
    if key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No matching JWKS key for Stytch JWT",
        )

    try:
        claims = jwt.decode(
            session_jwt,
            key,
            algorithms=[header.get("alg", "RS256")],
            issuer=STYTCH_EXPECTED_ISSUER,
            # Stytch session JWTs don't always carry a standard aud claim we need to enforce.
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Stytch JWT: {exc}",
        ) from exc

    return claims


def _extract_email(claims: dict[str, Any]) -> str | None:
    """Pull the user's email out of Stytch session claims.

    The Stytch session claim block lives under `https://stytch.com/session` and
    contains (among other things) an `authentication_factors` list. Each factor
    can have `email_factor.email_address`. We also accept a top-level `email`
    or `emails` fallback.
    """
    # Direct fields occasionally present.
    direct = claims.get("email")
    if isinstance(direct, str) and "@" in direct:
        return direct.lower()

    emails = claims.get("emails")
    if isinstance(emails, list) and emails:
        first = emails[0]
        if isinstance(first, str) and "@" in first:
            return first.lower()
        if isinstance(first, dict):
            addr = first.get("email") or first.get("email_address")
            if isinstance(addr, str):
                return addr.lower()

    session_block = claims.get(STYTCH_SESSION_CLAIM) or {}
    factors = session_block.get("authentication_factors") or []
    for factor in factors:
        if not isinstance(factor, dict):
            continue
        ef = factor.get("email_factor")
        if isinstance(ef, dict):
            addr = ef.get("email_address")
            if isinstance(addr, str) and "@" in addr:
                return addr.lower()
        # OAuth factor sometimes stores email under provider_values.
        of = factor.get("oauth_factor") or factor.get("google_oauth_factor")
        if isinstance(of, dict):
            addr = of.get("email_address") or of.get("email")
            if isinstance(addr, str) and "@" in addr:
                return addr.lower()

    return None


def _derive_names_from_email(email: str) -> tuple[str, str]:
    local = email.split("@", 1)[0]
    # Split on common separators.
    parts = [p for p in local.replace(".", " ").replace("_", " ").replace("-", " ").split() if p]
    if len(parts) >= 2:
        return parts[0].capitalize(), " ".join(parts[1:]).capitalize()
    if len(parts) == 1:
        return parts[0].capitalize(), ""
    return "", ""


@router.post("/stytch-exchange", response_model=TokenResponse)
async def stytch_exchange(
    body: StytchExchangeRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Exchange a Stytch session_jwt for a backend access token.

    - Verifies the Stytch JWT signature via JWKS.
    - Looks up the user by email (case-insensitive); creates one with role
      PLAYER and a blank Player profile if missing.
    - Issues and returns our own HS256 JWT.
    """
    claims = await _verify_stytch_jwt(body.session_jwt)

    email = _extract_email(claims)
    if not email:
        logger.warning("Stytch JWT had no usable email claim: keys=%s", list(claims.keys()))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No email found in Stytch session",
        )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        first, last = _derive_names_from_email(email)
        user = User(
            id=uuid.uuid4(),
            email=email,
            # Stytch owns the credentials — this hash is unusable on purpose.
            password_hash="!stytch!",
            role=UserRole.PLAYER,
        )
        db.add(user)
        await db.flush()
        player = Player(
            id=uuid.uuid4(),
            user_id=user.id,
            first_name=first,
            last_name=last,
            fft_license=None,
            points=0,
            club=None,
        )
        db.add(player)
        await db.commit()
        await db.refresh(user)
        logger.info("Created new user from Stytch exchange: %s", email)
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")

    token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(access_token=token)
