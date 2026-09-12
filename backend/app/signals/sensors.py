import ssl
import socket
from typing import Dict, Any

def check_safe_browsing(url: str) -> str:
    """
    Mocked Google Safe Browsing v4 lookup.
    Returns "clean", "malicious", or "unknown"
    """
    # For testing, we mock some known behaviors
    if "malicious" in url or "phishing" in url:
        return "malicious"
    return "clean"

def check_trustpilot(domain: str) -> str:
    """
    Mocked SerpApi Trustpilot reputation lookup.
    Returns "good", "bad", or "neutral"
    """
    # Mock behavior
    if domain in ["google.com", "amazon.com", "github.com"]:
        return "good"
    if "scam" in domain:
        return "bad"
    return "neutral"

def check_tls(domain: str) -> bool:
    """
    Real TLS/SSL certificate inspector.
    Fails gracefully if port 443 is unreachable or SSL handshake fails.
    """
    # Remove any port numbers if provided
    domain = domain.split(":")[0]
    
    # Fast timeout to avoid hanging the pipeline
    context = ssl.create_default_context()
    try:
        with socket.create_connection((domain, 443), timeout=3.0) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                # If we get here, handshake was successful
                return True
    except Exception:
        # Fails gracefully without crashing the pipeline
        return False

def run_sensor_fusion(url: str, domain: str) -> Dict[str, Any]:
    """
    Run all sensors and return their results.
    """
    return {
        "safe_browsing": check_safe_browsing(url),
        "trustpilot": check_trustpilot(domain),
        "tls_valid": check_tls(domain)
    }
