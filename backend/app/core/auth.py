from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx
from functools import lru_cache
from app.core.config import get_settings

bearer_scheme = HTTPBearer()


@lru_cache
def _get_supabase_jwks() -> dict:
    """
    Fetches Supabase's JWKS (JSON Web Key Set) for JWT verification.
    Cached at process startup — Supabase keys rotate rarely.
    """
    settings = get_settings()
    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    response = httpx.get(url, timeout=10)
    response.raise_for_status()
    return response.json()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """
    FastAPI dependency that verifies the Supabase JWT and returns the user_id (sub claim).
    Raises HTTP 401 on any verification failure.
    """
    token = credentials.credentials
    settings = get_settings()

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        jwks = _get_supabase_jwks()
        # Decode header to find the key id
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        # Find matching key
        rsa_key = {}
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                rsa_key = key
                break

        if not rsa_key:
            raise credentials_exception

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience="authenticated",
            options={"verify_exp": True},
        )

        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception

        return user_id

    except JWTError:
        raise credentials_exception
