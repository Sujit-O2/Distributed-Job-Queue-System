"""
PulseQueue – JWT Security Module
---------------------------------
Production-grade OAuth2 Bearer token pipeline:
  • HS256 token signing (#45)
  • Configurable expiration via env vars (#47)
  • Automatic user extraction from token
  • Proper error responses with WWW-Authenticate
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer

# Configuration via environment variables (#47)
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "SUPER_SECRET_OCR_JWT_PRODUCTION_KEY_CHANGE_ME")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", str(60 * 24)))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Sign a JWT token with the given data payload."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises on failure."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user_id(token: str = Depends(oauth2_scheme), request: Request = None) -> int:
    """FastAPI dependency: extract user ID from JWT Bearer token or X-API-Key header."""
    # Check for API key first
    if request:
        api_key_raw = request.headers.get("X-API-Key")
        if api_key_raw:
            return _resolve_api_key(api_key_raw)

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_token(token)
    user_id = payload.get("sub")
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return int(user_id)


def _resolve_api_key(raw_key: str) -> int:
    """Validate an API key and return the associated user_id."""
    import hashlib
    from src.database.database import SessionLocal
    from src.modles.api_key_model import ApiKey
    from datetime import datetime

    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    db = SessionLocal()
    try:
        api_key = (
            db.query(ApiKey)
            .filter(ApiKey.key_hash == key_hash, ApiKey.is_active == True)
            .first()
        )
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked API key",
            )
        # Update last_used_at
        api_key.last_used_at = datetime.utcnow()
        db.commit()
        return api_key.user_id
    finally:
        db.close()

