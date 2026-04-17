import json
import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # room_id -> set of WebSocket connections
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, room_id: str) -> None:
        await websocket.accept()
        self._rooms[room_id].add(websocket)
        logger.info("WebSocket connected to room %s. Total: %d", room_id, len(self._rooms[room_id]))

    def disconnect(self, websocket: WebSocket, room_id: str) -> None:
        self._rooms[room_id].discard(websocket)
        if not self._rooms[room_id]:
            del self._rooms[room_id]
        logger.info("WebSocket disconnected from room %s", room_id)

    async def broadcast(self, room_id: str, message: dict) -> None:
        if room_id not in self._rooms:
            return
        dead: list[WebSocket] = []
        payload = json.dumps(message, default=str)
        for websocket in list(self._rooms[room_id]):
            try:
                await websocket.send_text(payload)
            except Exception:
                dead.append(websocket)
        for ws in dead:
            self.disconnect(ws, room_id)

    async def send_personal(self, websocket: WebSocket, message: dict) -> None:
        payload = json.dumps(message, default=str)
        await websocket.send_text(payload)


manager = ConnectionManager()
