from fastapi.testclient import TestClient
from backend.app.main import app

def test_caching_layer():
    # Use TestClient as a context manager to trigger lifespan events
    with TestClient(app) as client:
        # First request should be a cache miss
        response1 = client.post("/analyze", json={"url": "http://example.com/test1"})
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["cached"] is False
        
        # Second request to the same domain should be a cache hit
        response2 = client.post("/analyze", json={"url": "http://example.com/test2"})
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["cached"] is True
        
        # Third request to a different domain should be a miss
        response3 = client.post("/analyze", json={"url": "http://different.com/test"})
        assert response3.status_code == 200
        data3 = response3.json()
        assert data3["cached"] is False
        
        print("All Phase 3.5 Caching tests passed!")

if __name__ == "__main__":
    test_caching_layer()
