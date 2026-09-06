import urllib.request
import json

def test_api():
    print("Testing FastAPI endpoints...")

    # 1. Login
    req_data = json.dumps({"email": "owner@fixflow.com", "password": "owner123"}).encode("utf-8")
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/auth/login",
        data=req_data,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        token = res["access_token"]
        user = res["user"]
        print(f"[OK] Login success! Logged in as: {user['name']} (Role: {user['role']})")

    headers = {"Authorization": f"Bearer {token}"}

    # 2. List Jobs
    req = urllib.request.Request("http://127.0.0.1:8000/api/jobs", headers=headers)
    with urllib.request.urlopen(req) as resp:
        jobs = json.loads(resp.read().decode("utf-8"))
        print(f"[OK] Jobs retrieved: {len(jobs)} jobs in database.")
        for j in jobs[:2]:
            print(f"   - {j['id']}: {j['customer_name']} ({j['appliance_type']}) - Status: {j['status']} - GPS: ({j['latitude']}, {j['longitude']})")

    # 3. List Technicians
    req = urllib.request.Request("http://127.0.0.1:8000/api/technicians", headers=headers)
    with urllib.request.urlopen(req) as resp:
        techs = json.loads(resp.read().decode("utf-8"))
        print(f"[OK] Technicians retrieved: {len(techs)} techs in database.")
        for t in techs:
            print(f"   - {t['name']} ({t['id']}) - GPS: ({t['current_lat']}, {t['current_lon']})")

    print("\n[SUCCESS] ALL API TESTS PASSED!")

if __name__ == "__main__":
    test_api()
