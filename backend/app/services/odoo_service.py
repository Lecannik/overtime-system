"""
Сервис интеграции с Odoo CRM через External API (XML-RPC).

Документация Odoo External API:
https://www.odoo.com/documentation/16.0/developer/api/external_api.html

Odoo предоставляет два XML-RPC эндпоинта:
- /xmlrpc/2/common  — для аутентификации (authenticate)
- /xmlrpc/2/object  — для вызова методов ORM (execute_kw)

Стандартная библиотека Python содержит xmlrpc.client,
поэтому никаких дополнительных зависимостей не требуется.

Получаемые поля проекта из Odoo:
- id              — уникальный ID проекта в Odoo
- name            — название проекта
- display_name    — полное отображаемое имя (может содержать код)
- user_id         — менеджер проекта [id, name]
- partner_id      — клиент проекта [id, name]
- analytic_account_id — аналитический счёт (может содержать код)
"""

import xmlrpc.client
import asyncio
import logging
from typing import Any
from functools import partial

from app.core.config import settings

logger = logging.getLogger(__name__)


# DTO для проекта из Odoo
class OdooProject:
    """
    Представление проекта, полученного из Odoo CRM.

    Attributes:
        odoo_id:        Уникальный ID записи в Odoo.
        name:           Название проекта.
        code:           Код проекта (из аналитического счёта или display_name).
        manager_name:   Имя менеджера проекта.
        manager_email:  Email менеджера проекта (для маппинга на локального User).
    """

    def __init__(
        self,
        odoo_id: int,
        name: str,
        code: str | None,
        manager_name: str | None,
        manager_email: str | None,
    ):
        self.odoo_id = odoo_id
        self.name = name
        self.code = code
        self.manager_name = manager_name
        self.manager_email = manager_email

    def to_dict(self) -> dict:
        """Сериализовать в словарь для JSON-ответа."""
        return {
            "odoo_id": self.odoo_id,
            "name": self.name,
            "code": self.code,
            "manager_name": self.manager_name,
            "manager_email": self.manager_email,
        }


class OdooService:
    """
    Клиент для работы с Odoo CRM через XML-RPC External API.

    Поддерживает аутентификацию и получение данных о проектах.
    Все методы блокирующие (xmlrpc синхронный) — запускаются в threadpool
    через asyncio.get_event_loop().run_in_executor() для неблокирующего FastAPI.
    """

    def __init__(self):
        self.url = settings.ODOO_URL
        self.db = settings.ODOO_DB
        self.username = settings.ODOO_USER
        self.password = settings.ODOO_PASSWORD

    @property
    def is_configured(self) -> bool:
        """Проверяет, заданы ли все обязательные настройки Odoo."""
        return all([self.url, self.db, self.username, self.password])

    def _authenticate_sync(self) -> int:
        """
        Синхронная аутентификация в Odoo.

        Returns:
            uid: Числовой ID аутентифицированного пользователя в Odoo.

        Raises:
            ConnectionError: Если соединение с Odoo не установлено.
            ValueError: Если логин/пароль неверные.
        """
        common = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common")
        uid = common.authenticate(self.db, self.username, self.password, {})
        if not uid:
            raise ValueError(
                f"Ошибка аутентификации в Odoo для пользователя '{self.username}'. "
                "Проверьте ODOO_USER и ODOO_PASSWORD в .env"
            )
        logger.info(f"Odoo: аутентификация успешна, uid={uid}")
        return uid

    def _get_projects_sync(self, uid: int) -> list[OdooProject]:
        """
        Синхронное получение проектов из Odoo.

        Запрашивает модель project.project с нужными полями.
        Для получения email менеджера выполняется дополнительный запрос к res.users.

        Args:
            uid: ID аутентифицированного пользователя Odoo.

        Returns:
            Список объектов OdooProject.
        """
        models = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object")

        # Поля, которые запрашиваем у модели project.project
        fields = [
            "id",
            "name",
            "display_name",
            "user_id",           # [id, name] менеджера
            "analytic_account_id",  # [id, name] аналитического счёта (может содержать код)
        ]

        records: list[dict[str, Any]] = models.execute_kw(
            self.db,
            uid,
            self.password,
            "project.project",
            "search_read",
            # Только активные проекты
            [[["active", "=", True]]],
            {
                "fields": fields,
                "limit": 500,
                "order": "name asc",
            },
        )

        logger.info(f"Odoo: получено {len(records)} проектов")

        # Собираем ID менеджеров для запроса их email
        manager_user_ids = [
            rec["user_id"][0]
            for rec in records
            if rec.get("user_id") and isinstance(rec["user_id"], (list, tuple))
        ]

        # Получаем email менеджеров одним запросом к res.users
        manager_emails: dict[int, str] = {}
        if manager_user_ids:
            user_records = models.execute_kw(
                self.db,
                uid,
                self.password,
                "res.users",
                "read",
                [list(set(manager_user_ids))],
                {"fields": ["id", "login", "email"]},
            )
            for u in user_records:
                # Odoo хранит email в login или email
                email = u.get("email") or u.get("login", "")
                manager_emails[u["id"]] = email
                logger.debug(f"Odoo manager: id={u['id']}, email={email}")

        projects = []
        for rec in records:
            manager_id_raw = rec.get("user_id")
            manager_name: str | None = None
            manager_email: str | None = None

            if manager_id_raw and isinstance(manager_id_raw, (list, tuple)):
                manager_odoo_id = manager_id_raw[0]
                manager_name = manager_id_raw[1] if len(manager_id_raw) > 1 else None
                manager_email = manager_emails.get(manager_odoo_id)

            # Попытка извлечь код проекта из аналитического счёта (поле name может быть "KZ-0012 Название")
            code: str | None = None
            analytic_raw = rec.get("analytic_account_id")
            if analytic_raw and isinstance(analytic_raw, (list, tuple)) and len(analytic_raw) > 1:
                analytic_name: str = analytic_raw[1]
                # Ищем шаблон YYYY-NNNNN в начале строки
                import re
                match = re.match(r"(\d{4}-\d{5})", analytic_name)
                if match:
                    code = match.group(1)

            projects.append(
                OdooProject(
                    odoo_id=rec["id"],
                    name=rec["name"],
                    code=code,
                    manager_name=manager_name,
                    manager_email=manager_email,
                )
            )

        return projects

    async def get_projects(self) -> list[OdooProject]:
        """
        Асинхронное получение всех активных проектов из Odoo CRM.

        Запускает синхронные XML-RPC вызовы в отдельном потоке,
        чтобы не блокировать event loop FastAPI.

        Returns:
            Список объектов OdooProject.

        Raises:
            HTTPException: Пробрасывается выше через вызывающий код.
        """
        if not self.is_configured:
            logger.warning(
                "Odoo не настроен. Заполните ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD в .env"
            )
            return []

        loop = asyncio.get_event_loop()
        try:
            # Шаг 1: аутентификация
            uid = await loop.run_in_executor(None, self._authenticate_sync)
            # Шаг 2: получение проектов
            projects = await loop.run_in_executor(
                None, partial(self._get_projects_sync, uid)
            )
            return projects
        except xmlrpc.client.Fault as e:
            logger.error(f"Odoo XML-RPC Fault: {e.faultCode} — {e.faultString}")
            raise
        except Exception as e:
            logger.error(f"Ошибка подключения к Odoo: {e}")
            raise


# Singleton-экземпляр сервиса
odoo_service = OdooService()
