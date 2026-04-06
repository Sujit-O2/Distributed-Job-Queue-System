"""
PulseQueue – Auth Schema (v2.1.0)
----------------------------------
Relaxed validation to work with frontend forms.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class LogIn(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=128)


class Register(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., min_length=1, max_length=255)
    full_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=128)

    model_config = {"str_strip_whitespace": True}


class UpdateProfile(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=100)
    password: str | None = Field(None, min_length=1, max_length=128)

class PasswordReset(BaseModel):
    username_or_email: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=1, max_length=128)
