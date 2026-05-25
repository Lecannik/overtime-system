import json
import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # user_id -> list of active WebSockets
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected to WebSocket. Total connections for user: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"User {user_id} disconnected from WebSocket.")

    async def broadcast_to_user(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            text_data = json.dumps(message)
            for connection in list(self.active_connections[user_id]):
                try:
                    await connection.send_text(text_data)
                except Exception as e:
                    logger.error(f"Error sending message to user {user_id}: {e}")
                    self.disconnect(connection, user_id)

    async def broadcast_to_all(self, message: dict):
        text_data = json.dumps(message)
        for user_id, connections in list(self.active_connections.items()):
            for connection in list(connections):
                try:
                    await connection.send_text(text_data)
                except Exception as e:
                    logger.error(f"Error broadcasting message to user {user_id}: {e}")
                    self.disconnect(connection, user_id)


ws_manager = ConnectionManager()
