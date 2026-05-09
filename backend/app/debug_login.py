import asyncio
import sys
import os

sys.path.append("/app")

from app.core.security import verify_password, hash_password
from app.repositories.user import get_user_by_email
from app.core.database import get_session

async def test():
    print("Testing password verification...")
    try:
        async for session in get_session():
            user = await get_user_by_email(session, 'admin@example.com')
            if not user:
                print("User not found!")
                return
            
            print(f"User: {user.email}")
            print(f"Hashed in DB: {user.hashed_password}")
            
            test_pass = "admin123"
            is_valid = verify_password(test_pass, user.hashed_password)
            print(f"Verify 'admin123': {is_valid}")
            
            # Попробуем создать новый хеш и проверить его
            new_hash = hash_password(test_pass)
            print(f"New hash: {new_hash}")
            is_valid_new = verify_password(test_pass, new_hash)
            print(f"Verify NEW hash with 'admin123': {is_valid_new}")
            
            break
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
