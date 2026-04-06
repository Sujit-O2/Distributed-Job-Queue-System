"""
PulseQueue – WebSocket Router (v3.0)
--------------------------------------
Real-time job status push notifications.
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

logger = logging.getLogger("PulseQueue.WebSocket")
router = APIRouter(tags=["WebSocket"])

# In-memory connection registry: user_id -> set of WebSocket connections
_connections: dict[int, set[WebSocket]] = defaultdict(set)


async def broadcast_to_user(user_id: int, event: dict[str, Any]):
    """Push an event to all active WebSocket connections for a user."""
    dead = set()
    for ws in _connections.get(user_id, set()):
        try:
            await ws.send_json(event)
        except Exception:
            dead.add(ws)
    # Clean up dead connections
    if dead:
        _connections[user_id] -= dead


@router.websocket("/ws/jobs")
async def websocket_jobs(
    websocket: WebSocket,
    token: str = Query(None),
    user_id: int = Query(None),
):
    """
    WebSocket endpoint for real-time job status updates.
    Connect with: ws://host/ws/jobs?user_id=123&token=jwt_token
    """
    if user_id is None:
        await websocket.close(code=4001, reason="user_id query param required")
        return

    # Optional JWT validation (relaxed for dev)
    if token:
        try:
            from src.security import decode_token
            payload = decode_token(token)
            token_user_id = int(payload.get("sub", 0))
            if token_user_id != user_id:
                await websocket.close(code=4003, reason="Token user mismatch")
                return
        except Exception:
            await websocket.close(code=4003, reason="Invalid token")
            return

    await websocket.accept()
    _connections[user_id].add(websocket)
    logger.info(f"WebSocket connected for user {user_id} (total: {len(_connections[user_id])})")

    try:
        # Send initial handshake
        await websocket.send_json({"type": "connected", "user_id": user_id})

        # Keep connection alive — client can send pings
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        _connections[user_id].discard(websocket)
        logger.info(f"WebSocket disconnected for user {user_id}")
