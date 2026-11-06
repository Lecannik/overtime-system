"""
Модуль управления WebSocket-соединениями и безопасной доставки событий.

Обеспечивает авторизованное распределение real-time сообщений с защитой от горизонтальных
утечек данных (BOLA / IDOR): события по заявкам доставляются строго автору, курирующему
менеджеру, руководителю отдела и администраторам системы.
"""

import json
import logging
from typing import Dict, Iterable, List, Set

from fastapi import WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Department, Project
from app.models.overtime import Overtime
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Менеджер активных WebSocket-подключений пользователей."""

    def __init__(self):
        # user_id -> список активных WebSocket-клиентов
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int) -> None:
        """
        Регистрирует новое WebSocket-соединение для пользователя.

        Args:
            websocket: Экземпляр открытого WebSocket-сокета.
            user_id: Идентификатор авторизованного пользователя.
        """
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(
            "User %s connected to WebSocket. Total connections for user: %s",
            user_id,
            len(self.active_connections[user_id]),
        )

    def disconnect(self, websocket: WebSocket, user_id: int) -> None:
        """
        Удаляет закрытое WebSocket-соединение из реестра.

        Args:
            websocket: Экземпляр закрытого WebSocket-сокета.
            user_id: Идентификатор пользователя.
        """
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info("User %s disconnected from WebSocket.", user_id)

    async def broadcast_to_user(self, user_id: int, message: dict) -> None:
        """
        Отправляет сообщение конкретному пользователю на все его активные устройства.

        Args:
            user_id: Идентификатор целевого пользователя.
            message: Словарь с полезной нагрузкой события.
        """
        if user_id in self.active_connections:
            text_data = json.dumps(message)
            for connection in list(self.active_connections[user_id]):
                try:
                    await connection.send_text(text_data)
                except Exception as e:
                    logger.error("Error sending message to user %s: %s", user_id, e)
                    self.disconnect(connection, user_id)

    async def broadcast_to_users(self, user_ids: Iterable[int], message: dict) -> None:
        """
        Отправляет сообщение группе пользователей (BOLA / IDOR protection).

        Args:
            user_ids: Итерируемый набор идентификаторов пользователей.
            message: Словарь с полезной нагрузкой события.
        """
        text_data = json.dumps(message)
        for user_id in set(user_ids):
            if user_id in self.active_connections:
                for connection in list(self.active_connections[user_id]):
                    try:
                        await connection.send_text(text_data)
                    except Exception as e:
                        logger.error("Error sending message to user %s: %s", user_id, e)
                        self.disconnect(connection, user_id)

    async def broadcast_to_all(self, message: dict) -> None:
        """
        Широковещательная рассылка всем подключенным пользователям (только для системных уведомлений).

        Args:
            message: Словарь с полезной нагрузкой события.
        """
        text_data = json.dumps(message)
        for user_id, connections in list(self.active_connections.items()):
            for connection in list(connections):
                try:
                    await connection.send_text(text_data)
                except Exception as e:
                    logger.error("Error broadcasting message to user %s: %s", user_id, e)
                    self.disconnect(connection, user_id)


ws_manager = ConnectionManager()


async def get_authorized_overtime_recipients(session: AsyncSession, overtime: Overtime) -> Set[int]:
    """
    Вычисляет список user_id, имеющих право получать уведомления и обновления по данной переработке.

    В список входят:
    1. Автор переработки (overtime.user_id)
    2. Менеджер проекта (project.manager_id)
    3. Руководитель отдела автора (department.head_id)
    4. Все активные администраторы системы (UserRole.admin)

    Args:
        session: Асинхронная сессия SQLAlchemy.
        overtime: Экземпляр модели переработки Overtime.

    Returns:
        Set[int]: Множество ID авторизованных пользователей-получателей.
    """
    recipients: Set[int] = set()

    # 1. Автор заявки
    if overtime.user_id:
        recipients.add(overtime.user_id)

    # 2. Менеджер проекта
    if overtime.project and overtime.project.manager_id:
        recipients.add(overtime.project.manager_id)
    elif overtime.project_id:
        project = await session.get(Project, overtime.project_id)
        if project and project.manager_id:
            recipients.add(project.manager_id)

    # 3. Руководитель отдела автора
    author = overtime.user or (await session.get(User, overtime.user_id) if overtime.user_id else None)
    if author and author.department_id:
        dept = await session.get(Department, author.department_id)
        if dept and dept.head_id:
            recipients.add(dept.head_id)

    # 4. Администраторы системы (только активные)
    admin_stmt = select(User.id).where(User.role == UserRole.admin, User.is_active == True)
    admin_res = await session.execute(admin_stmt)
    for admin_id in admin_res.scalars().all():
        recipients.add(admin_id)

    return recipients


async def broadcast_overtime_event(session: AsyncSession, overtime: Overtime, message: dict) -> None:
    """
    Безопасная таргетированная отправка WebSocket-событий по переработке.

    Защищает от горизонтальных утечек персональных данных (CWE-200 / CWE-284).

    Args:
        session: Асинхронная сессия SQLAlchemy.
        overtime: Экземпляр модели переработки.
        message: Полезная нагрузка WebSocket-события.
    """
    try:
        recipients = await get_authorized_overtime_recipients(session, overtime)
        await ws_manager.broadcast_to_users(recipients, message)
    except Exception as exc:
        logger.error("Ошибка таргетированной WebSocket рассылки по заявке %s: %s", getattr(overtime, "id", None), exc)
