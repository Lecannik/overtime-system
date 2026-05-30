import logging
import msal
import httpx
from typing import List, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

class MSGraphService:
    def __init__(self):
        self.client_id = settings.MS_CLIENT_ID
        self.secret = settings.MS_CLIENT_SECRET
        self.tenant_id = settings.MS_TENANT_ID
        self.authority = f"https://login.microsoftonline.com/{self.tenant_id}"
        self.scope = ["https://graph.microsoft.com/.default"]
        
        self._app = None

    async def _get_access_token(self):
        """Получает или обновляет токен доступа от Microsoft с использованием кэша MSAL."""
        if not all([self.client_id, self.secret, self.tenant_id]):
            logger.error("MS Graph Config Missing: ID, Secret or Tenant is not set!")
            return None

        if self._app is None:
            logger.debug(f"Initializing MS ConfidentialClientApplication for Tenant: {self.tenant_id}")
            self._app = msal.ConfidentialClientApplication(
                self.client_id,
                authority=self.authority,
                client_credential=self.secret
            )
            
        # Для client-credentials flow MSAL кэширует токен автоматически внутри acquire_token_for_client
        result = self._app.acquire_token_for_client(scopes=self.scope)
        if "access_token" in result:
            logger.info("MS Graph Access Token acquired successfully (cached or new)")
            return result["access_token"]
        else:
            logger.error(f"MS Auth Error: {result.get('error')} - {result.get('error_description')}")
            return None

    async def get_users(self) -> List[Dict[str, Any]]:
        """Получает список всех пользователей организации из Office 365."""
        token = await self._get_access_token()
        if not token:
            return []

        all_users = []
        url = "https://graph.microsoft.com/v1.0/users"
        
        async with httpx.AsyncClient() as client:
            while url:
                logger.debug(f"Calling MS Graph API: {url}")
                response = await client.get(
                    url, 
                    headers={"Authorization": f"Bearer {token}"}
                )
                
                if response.status_code != 200:
                    logger.error(f"MS Graph API Error: {response.status_code} - {response.text}")
                    break
                    
                data = response.json()
                users = data.get("value", [])
                all_users.extend(users)
                url = data.get("@odata.nextLink")
                
        logger.info(f"MS Graph returned {len(all_users)} users in total")
        return all_users

    async def send_email(self, recipient: str, subject: str, body_content: str):
        """Отправляет письмо через Microsoft Graph API."""
        token = await self._get_access_token()
        if not token or not settings.MS_SENDER_EMAIL:
            logger.error("MS Graph Send Email Config/Token missing")
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
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json=email_data
                )
                if response.status_code == 202:
                    logger.info(f"MS Graph successfully accepted email to {recipient}")
                    return True
                else:
                    logger.error(f"MS Graph API sendMail failed: {response.status_code} - {response.text}")
                    return False
        except Exception as e:
            logger.error(f"HTTP client error while sending MS Graph email: {str(e)}", exc_info=True)
            return False

ms_graph = MSGraphService()
