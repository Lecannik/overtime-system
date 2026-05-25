import logging
import jwt
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.repositories.user import get_user_by_id
from app.services.websocket import ws_manager

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id_str = payload.get("sub")
        if not user_id_str:
            await websocket.close(code=1008)
            return
        user_id = int(user_id_str)
        
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            user = await get_user_by_id(session, user_id)
            if not user or not user.is_active:
                await websocket.close(code=1008)
                return
    except Exception as e:
        logger.error(f"WebSocket auth failed: {e}")
        await websocket.close(code=1008)
        return

    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        ws_manager.disconnect(websocket, user_id)
