import re
from typing import Dict, Any, List

POPULAR_DOMAINS = [
    "google.com", "facebook.com", "amazon.com", "apple.com", 
    "microsoft.com", "netflix.com", "paypal.com", "bankofamerica.com",
    "chase.com", "wellsfargo.com", "linkedin.com", "twitter.com",
    "instagram.com", "github.com"
]

def levenshtein_distance(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]

def check_typosquatting(domain: str, popular_domains: List[str] = POPULAR_DOMAINS) -> bool:
    """
    Returns True if the domain is a typosquat of a popular domain
    (distance of 1, but not exact match).
    """
    domain = domain.lower()
    for pop in popular_domains:
        if domain == pop:
            return False  # Exact match is not a typosquat
        if levenshtein_distance(domain, pop) == 1:
            return True
    return False

def check_homoglyphs(domain: str) -> bool:
    """
    Returns True if the domain contains punycode (xn--) or non-ascii chars.
    """
    domain = domain.lower()
    if domain.startswith("xn--") or "xn--" in domain:
        return True
    
    # Check for any non-ascii characters
    if not re.match(r'^[\x00-\x7F]+$', domain):
        return True
        
    return False

def run_heuristics(domain: str) -> Dict[str, Any]:
    """
    Run all local heuristics and return the flags.
    """
    return {
        "is_typosquat": check_typosquatting(domain),
        "has_homoglyphs": check_homoglyphs(domain)
    }
