import asyncio
import httpx

async def test():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        # 1. Login
        resp = await client.post("/auth/login", data={"username": "lecannik@gmail.com", "password": "@dmin12345"})
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get overtimes
        resp = await client.get("/overtimes/", headers=headers)
        data = resp.json()
        if data:
            print(f"OT ID {data[0]['id']} user: {data[0].get('user')}")
            print(f"OT ID {data[0]['id']} project: {data[0].get('project')}")

if __name__ == "__main__":
    asyncio.run(test())
