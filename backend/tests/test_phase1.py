import asyncio
import json
from backend.app.main import app, analyze_url
from backend.app.schemas import AnalyzeRequest
from fastapi.testclient import TestClient

def run_tests():
    print("Testing /analyze endpoint...")
    with TestClient(app) as client:
        response = client.post("/analyze", json={"url": "http://example.com/login"})
        print("Status code:", response.status_code)
        try:
            data = response.json()
            print("Response JSON:")
            print(json.dumps(data, indent=2))
            assert "verdict" in data, "Verdict missing"
            assert "risk_matrix" in data, "Risk matrix missing"
            assert "why_explainer" in data, "Why explainer missing"
            print("TEST PASSED: Endpoint returned valid schema.")
        except Exception as e:
            print(f"TEST FAILED: {e}")

if __name__ == "__main__":
    run_tests()
