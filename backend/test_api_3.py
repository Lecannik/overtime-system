import asyncio
import httpx

async def test():
    # Мы знаем, что API на 8000, а не 5173
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        # 1. Login
        resp = await client.post("/auth/login", data={"username": "lecannik@gmail.com", "password": "@dmin12345"})
        if resp.status_code != 200:
            print(f"Login failed: {resp.text}")
            return
        token_data = resp.json()
        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get overtimes
        resp = await client.get("/overtimes/", headers=headers)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        if data:
            for ot in data[:3]:
                print(f"OT ID {ot['id']}:")
                print(f"  Project: {ot.get('project')}")
                print(f"  User: {ot.get('user')}")
                print("-" * 10)

if __name__ == "__main__":
    asyncio.run(test())
