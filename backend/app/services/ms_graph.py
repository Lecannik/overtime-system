import msal
import httpx
import logging
import sys
from typing import List, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)
# Гарантируем, что логи будут видны в Docker
logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

class MSGraphService:
    def __init__(self):
        self.client_id = settings.MS_CLIENT_ID
        self.secret = settings.MS_CLIENT_SECRET
        self.tenant_id = settings.MS_TENANT_ID
        self.authority = f"https://login.microsoftonline.com/{self.tenant_id}"
        self.redirect_uri = settings.MS_REDIRECT_URI
        self.scope = ["https://graph.microsoft.com/.default"]
        self.user_scopes = ["User.Read"]
        
        self._access_token = None

    def _get_msal_app(self):
        return msal.ConfidentialClientApplication(
            self.client_id,
            authority=self.authority,
            client_credential=self.secret
        )

    async def _get_access_token(self):
        """Получает или обновляет токен доступа от Microsoft."""
        if not all([self.client_id, self.secret, self.tenant_id]):
            logger.error("MS Graph Config Missing: ID, Secret or Tenant is not set!")
            return None

        logger.debug(f"Attempting MS Auth for Tenant: {self.tenant_id}")
        app = self._get_msal_app()
        
        result = app.acquire_token_for_client(scopes=self.scope)
        if "access_token" in result:
            logger.info("MS Graph Access Token acquired successfully")
            return result["access_token"]
        else:
            logger.error(f"MS Auth Error: {result.get('error')} - {result.get('error_description')}")
            return None

    def get_login_url(self) -> str:
        """Генерирует URL для перенаправления пользователя на страницу входа Microsoft."""
        app = self._get_msal_app()
        return app.get_authorization_request_url(
            self.user_scopes,
            redirect_uri=self.redirect_uri
        )

    async def get_user_info_from_code(self, code: str) -> Dict[str, Any]:
        """Обменивает код авторизации на данные пользователя."""
        app = self._get_msal_app()
        result = app.acquire_token_by_authorization_code(
            code,
            scopes=self.user_scopes,
            redirect_uri=self.redirect_uri
        )
        
        if "error" in result:
            logger.error(f"MS Token Exchange Error: {result.get('error_description')}")
            return None
            
        access_token = result.get("access_token")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if response.status_code == 200:
                return response.json()
            
            logger.error(f"MS Graph /me Error: {response.text}")
            return None

    async def get_users(self) -> List[Dict[str, Any]]:
        """Получает список пользователей организации из Office 365."""
        token = await self._get_access_token()
        if not token:
            return []

        async with httpx.AsyncClient() as client:
            # Упрощаем запрос до максимума
            url = "https://graph.microsoft.com/v1.0/users"
            logger.debug(f"Calling MS Graph API: {url}")
            response = await client.get(
                url, 
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                users = data.get("value", [])
                logger.info(f"MS Graph returned {len(users)} users")
                return users
            
            logger.error(f"MS Graph API Error: {response.status_code} - {response.text}")
            return []

    async def send_email(self, recipient: str, subject: str, body_content: str):
        """Отправляет письмо через Microsoft Graph API."""
        token = await self._get_access_token()
        if not token or not settings.MS_SENDER_EMAIL:
            return False

        email_data = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": body_content
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "address": recipient
                        }
                    }
                ]
            },
            "saveToSentItems": "false"
        }

        url = f"https://graph.microsoft.com/v1.0/users/{settings.MS_SENDER_EMAIL}/sendMail"
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=email_data
            )
            return response.status_code == 202

ms_graph = MSGraphService()
