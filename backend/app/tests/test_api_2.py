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
        print(f"Status: {resp.status_code}")
        # print(resp.json())
        data = resp.json()
        if data:
            print(f"First OT keys: {data[0].keys()}")
            print(f"First OT user: {data[0]['user']}")
            print(f"First OT project: {data[0]['project']}")

if __name__ == "__main__":
    asyncio.run(test())
