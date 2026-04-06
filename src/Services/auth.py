"""
PulseQueue – Auth Service (v2.1.0)
-----------------------------------
Uses bcrypt directly (no passlib) to avoid version incompatibility.
"""

import bcrypt
from src.modles.user_model import User
from sqlalchemy.orm import Session


def _hash_password(password: str) -> str:
    """Hash password with bcrypt. Truncate to 72 bytes (bcrypt limit)."""
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        pw_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pw_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def login_user(self, log_in):
        user = self.db.query(User).filter(
            (User.username == log_in.username) | (User.email == log_in.username)
        ).first()

        if user and _verify_password(log_in.password, user.password):
            return user
        return None

    def register_user(self, register):
        existing_user = self.db.query(User).filter(
            (User.username == register.username) | (User.email == register.email)
        ).first()

        if existing_user:
            return None

        new_user = User(
            username=register.username,
            email=register.email,
            full_name=register.full_name,
            password=_hash_password(register.password)
        )
        self.db.add(new_user)
        self.db.commit()
        self.db.refresh(new_user)
        return new_user

    def update_profile(self, user_id: int, update_data):
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return None
        
        if getattr(update_data, "full_name", None):
            user.full_name = update_data.full_name
        if getattr(update_data, "password", None):
            user.password = _hash_password(update_data.password)

        self.db.commit()
        self.db.refresh(user)
        return user

    def reset_password(self, reset_param):
        user = self.db.query(User).filter(
            (User.username == reset_param.username_or_email) | 
            (User.email == reset_param.username_or_email)
        ).first()

        if not user:
            return False

        user.password = _hash_password(reset_param.new_password)
        self.db.commit()
        return True
