import json
import os
import sys
from datetime import datetime

# Ensure backend can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi.testclient import TestClient
from backend.app.main import app

def run_eval():
    client = TestClient(app)
    
    test_cases = [
        "http://google.com",
        "http://g00gle.com",
        "https://trustpilot.com",
        "http://malicious-test.com"
    ]
    
    results = []
    print("Starting Evaluation Harness...")
    
    # Use context manager to trigger lifespan events (like DB initialization)
    with client:
        for url in test_cases:
            print(f"Evaluating: {url}")
            try:
                response = client.post("/analyze", json={"url": url})
                if response.status_code == 200:
                    data = response.json()
                    results.append({
                        "url": url,
                        "verdict": data.get("verdict"),
                        "risk_score": data.get("risk_score"),
                        "cached": data.get("cached")
                    })
                else:
                    results.append({"url": url, "error": f"HTTP {response.status_code}"})
            except Exception as e:
                results.append({"url": url, "error": str(e)})
                
    os.makedirs(os.path.join(os.path.dirname(__file__), "results"), exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = os.path.join(os.path.dirname(__file__), f"results/report_{timestamp}.json")
    
    with open(report_path, "w") as f:
        json.dump(results, f, indent=2)
        
    print(f"Evaluation complete. Results saved to {report_path}")

if __name__ == "__main__":
    run_eval()
