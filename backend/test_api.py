import asyncio
import httpx

async def test():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        # 1. Login
        resp = await client.post("/auth/login", data={"username": "lecannik@gmail.com", "password": "@dmin12345"})
        if resp.status_code != 200:
            print(f"Login failed: {resp.text}")
            return
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get overtimes
        resp = await client.get("/overtimes/", headers=headers)
        if resp.status_code != 200:
            print(f"Get overtimes failed: {resp.text}")
            return
            
        overtimes = resp.json()
        print(f"Found {len(overtimes)} overtimes")
        for ot in overtimes[:2]:
            print(f"ID: {ot['id']}")
            print(f"User: {ot.get('user')}")
            print(f"Project: {ot.get('project')}")
            print("-" * 10)

if __name__ == "__main__":
    asyncio.run(test())
