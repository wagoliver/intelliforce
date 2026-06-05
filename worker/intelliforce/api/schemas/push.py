"""Schemas de Web Push."""
from __future__ import annotations

from pydantic import BaseModel


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: PushKeys
    expirationTime: float | None = None  # ignorado pelo backend


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class PublicKeyOut(BaseModel):
    public_key: str
