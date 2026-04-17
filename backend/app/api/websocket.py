import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.core.security import verify_token
from app.services.websocket_manager import manager

router = APIRouter(tags=["websocket"])


async def _authenticate_ws(websocket: WebSocket, token: str | None) -> str | None:
    """Verify JWT from query param. Returns user_id or None."""
    if token is None:
        return None
    payload = verify_token(token)
    if payload is None:
        return None
    return payload.get("sub")


@router.websocket("/ws/tournament/{tournament_id}")
async def ws_tournament(
    websocket: WebSocket,
    tournament_id: uuid.UUID,
    token: str | None = Query(None),
) -> None:
    """
    Authenticated WebSocket for tournament events.
    Connect with: ws://host/ws/tournament/{id}?token=<jwt>
    """
    user_id = await _authenticate_ws(websocket, token)
    if user_id is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    room_id = str(tournament_id)
    await manager.connect(websocket, room_id)
    try:
        # Send connection confirmation
        await manager.send_personal(
            websocket,
            {"event": "connected", "room": room_id, "user_id": user_id},
        )
        # Keep connection alive — listen for client pings
        while True:
            data = await websocket.receive_text()
            # Echo ping/pong
            if data == "ping":
                await manager.send_personal(websocket, {"event": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)


@router.websocket("/ws/display/{tournament_id}")
async def ws_display(
    websocket: WebSocket,
    tournament_id: uuid.UUID,
) -> None:
    """
    Public WebSocket for display screens (no auth required).
    Connect with: ws://host/ws/display/{id}
    """
    room_id = str(tournament_id)
    await manager.connect(websocket, room_id)
    try:
        await manager.send_personal(
            websocket,
            {"event": "connected", "room": room_id, "public": True},
        )
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await manager.send_personal(websocket, {"event": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
