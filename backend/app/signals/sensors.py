import ssl
import socket
import os
import requests
from typing import Dict, Any

POPULAR_DOMAINS = {"google.com", "youtube.com", "facebook.com", "twitter.com", "github.com", "amazon.com", "reddit.com", "instagram.com", "linkedin.com", "netflix.com"}

def check_safe_browsing(url: str) -> str:
    """
    Real Google Safe Browsing v4 lookup.
    """
    res = check_safe_browsing_batch([url])
    return res.get(url, "unknown")

def check_safe_browsing_batch(urls: list[str]) -> Dict[str, str]:
    """
    Batch Google Safe Browsing lookup in a single API call (maximizes free quota efficiency).
    Returns dict mapping url -> 'clean' | 'malicious' | 'unknown'.
    """
    if not urls:
        return {}

    api_key = os.getenv("GOOGLE_SAFE_BROWSING_KEY")
    if not api_key:
        # Fallback if key is not configured
        return {u: "clean" for u in urls}

    endpoint = f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={api_key}"
    threat_entries = [{"url": u} for u in urls[:50]]  # limit to 50 per batch

    payload = {
        "client": {
            "clientId": "parry-ai",
            "clientVersion": "1.0.0"
        },
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": threat_entries
        }
    }

    results = {u: "clean" for u in urls}
    try:
        resp = requests.post(endpoint, json=payload, timeout=3.5)
        if resp.status_code == 200:
            data = resp.json()
            matches = data.get("matches", [])
            for m in matches:
                matched_url = m.get("threat", {}).get("url")
                if matched_url:
                    results[matched_url] = "malicious"
            return results
    except Exception:
        pass

    return {u: "unknown" for u in urls}


def check_trustpilot(domain: str) -> str:
    """
    Real SerpApi Trustpilot reputation lookup.
    """
    # Fast path: Save SerpApi credits for very obvious sites
    if domain in POPULAR_DOMAINS:
        return "good"
        
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return "neutral"
        
    try:
        params = {
            "engine": "google",
            "q": f"site:trustpilot.com {domain}",
            "api_key": api_key,
            "num": 3
        }
        resp = requests.get("https://serpapi.com/search.json", params=params, timeout=4.0)
        if resp.status_code == 200:
            data = resp.json()
            organic_results = data.get("organic_results", [])
            
            for res in organic_results:
                if "trustpilot.com/review" in res.get("link", ""):
                    snippet = res.get("snippet", "").lower()
                    title = res.get("title", "").lower()
                    
                    # Try to parse the rich snippet rating if Google extracted it (e.g., 4.5/5)
                    try:
                        rating_str = res.get("rich_snippet", {}).get("top", {}).get("detected_extensions", {}).get("rating")
                        if rating_str:
                            rating = float(rating_str)
                            if rating >= 4.0: return "good"
                            if rating <= 2.5: return "bad"
                            return "neutral"
                    except Exception:
                        pass
                        
                    # Fallback keyword sentiment analysis on snippet
                    if "scam" in snippet or "fraud" in snippet or "fake" in snippet:
                        return "bad"
                    if "excellent" in snippet or "great" in snippet:
                        return "good"
            
            return "neutral"
    except Exception:
        pass
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
