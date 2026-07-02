"""Supabase JWT verification for FastAPI routes."""

from __future__ import annotations

import os
from typing import Optional

from supabase import create_client

_SUPABASE_URL = os.getenv("SUPABASE_URL")
_SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
_auth_client = None

if _SUPABASE_URL and _SUPABASE_SERVICE_ROLE_KEY:
    try:
        _auth_client = create_client(_SUPABASE_URL, _SUPABASE_SERVICE_ROLE_KEY)
    except Exception:
        _auth_client = None


def verify_supabase_access_token(token: str) -> Optional[str]:
    """Return user UUID from a Supabase access token, or None if invalid."""
    if not token or not _auth_client:
        return None
    try:
        response = _auth_client.auth.get_user(token)
        user = getattr(response, "user", None) or (response.get("user") if isinstance(response, dict) else None)
        if user and getattr(user, "id", None):
            return str(user.id)
        if isinstance(user, dict) and user.get("id"):
            return str(user["id"])
    except Exception:
        return None
    return None


def resolve_user_id(
    authorization: Optional[str],
    claimed_user_id: Optional[str] = None,
) -> Optional[str]:
    """
    Prefer user id from verified JWT.
    Fall back to claimed_user_id only when no Bearer token is sent (local demo mode).
    """
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        verified = verify_supabase_access_token(token)
        return verified
    return claimed_user_id
