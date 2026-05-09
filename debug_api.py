import requests
import json

url = "http://localhost:8000/api/v1/admin/positions"
try:
    r = requests.get(url)
    print(f"Status: {r.status_code}")
    print(r.text[:500])
except Exception as e:
    print(f"Error: {e}")
