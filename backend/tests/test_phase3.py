import json
from backend.app.signals.sensors import check_safe_browsing, check_trustpilot, check_tls, run_sensor_fusion

def test_check_safe_browsing():
    assert check_safe_browsing("http://example.com/phishing") == "malicious"
    assert check_safe_browsing("http://example.com/clean") == "clean"

def test_check_trustpilot():
    assert check_trustpilot("google.com") == "good"
    assert check_trustpilot("scam-site.com") == "bad"
    assert check_trustpilot("unknown-site.com") == "neutral"

def test_check_tls():
    # google.com should have a valid TLS cert
    assert check_tls("google.com") is True
    # this domain is not reachable, should fail gracefully
    assert check_tls("this-domain-should-not-exist-123456789.com") is False

def test_run_sensor_fusion():
    url = "https://google.com/"
    domain = "google.com"
    result = run_sensor_fusion(url, domain)
    assert result["safe_browsing"] == "clean"
    assert result["trustpilot"] == "good"
    assert result["tls_valid"] is True

if __name__ == "__main__":
    test_check_safe_browsing()
    test_check_trustpilot()
    test_check_tls()
    test_run_sensor_fusion()
    print("All Phase 3 Sensor Fusion tests passed!")
