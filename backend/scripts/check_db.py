import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Add parent directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

async def check_db():
    user = os.getenv("POSTGRES_USER", "overtime_user")
    password = os.getenv("POSTGRES_PASSWORD", "supersecret")
    db = os.getenv("POSTGRES_DB", "overtime_db")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    
    url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db}"
    print(f"Connecting to {url}...")
    
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT version();"))
            row = result.fetchone()
            print(f"Connected! PostgreSQL version: {row[0]}")
            
            # Check tables
            result = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"))
            tables = [row[0] for row in result.fetchall()]
            print(f"Tables in public schema: {tables}")
            
    except Exception as e:
        print(f"Connection failed: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_db())
