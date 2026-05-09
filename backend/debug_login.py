import asyncio
import sys
import os

# Добавляем корень проекта в пути поиска
sys.path.append(os.getcwd())

from app.repositories.user import get_user_by_email
from app.core.database import get_session
from app.schemas.user import UserResponse

async def test():
    print("Starting debug test...")
    try:
        async for session in get_session():
            print("Database session obtained.")
            user = await get_user_by_email(session, 'admin@example.com')
            if not user:
                print("User admin@example.com not found!")
                return
            
            print(f"User found: {user.email}")
            print(f"Position ID: {user.position_id}")
            print(f"Is Active: {user.is_active}")
            
            # Попробуем валидировать через UserResponse
            try:
                resp = UserResponse.model_validate(user)
                print("Serialization success!")
                print(resp.model_dump_json(indent=2))
            except Exception as e:
                print(f"Serialization FAILED: {str(e)}")
                import traceback
                traceback.print_exc()
            
            break
    except Exception as e:
        print(f"Test FAILED with error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
