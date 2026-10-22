from typing import Dict, Any, Tuple

def calculate_risk(risk_matrix: Dict[str, Any]) -> Tuple[float, str]:
    """
    Phase 5: Adaptive Risk Scoring
    Combines all signals into a single weighted risk score (0.0 to 1.0)
    and maps it to a final verdict.
    """
    score = 0.0
    
    # Heuristic weights
    heuristics = risk_matrix.get("heuristic_flags", {})
    if heuristics.get("is_typosquat"):
        score += 0.4
    if heuristics.get("has_homoglyphs"):
        score += 0.5
        
    # Sensor fusion weights
    safe_browsing = risk_matrix.get("safe_browsing")
    if safe_browsing == "malicious":
        score += 0.8
        
    trustpilot = risk_matrix.get("trustpilot")
    if trustpilot == "bad":
        score += 0.3
    elif trustpilot == "good":
        score -= 0.2
        
    tls_valid = risk_matrix.get("tls_valid")
    if tls_valid is False:
        score += 0.2
        
    # Clamp score between 0.0 and 1.0
    score = max(0.0, min(1.0, score))
    
    # Map to verdict
    if score >= 0.7:
        verdict = "malicious"
    elif score >= 0.4:
        verdict = "suspicious"
    elif score <= 0.2:
        verdict = "safe"
    else:
        verdict = "uncertain"
    return score, verdict

def calculate_privacy(trackers_count: int = 0, scripts_count: int = 0, has_forms: bool = False, gemini_privacy_opinion: str = None) -> Tuple[float, str, str]:
    """
    Privacy Evaluation Formula:
    Calculates privacy score (1.0 = pristine privacy, 0.0 = extreme surveillance/telemetry)
    and assigns a letter grade (A, B, C, D, F).
    
    Penalties:
    - Trackers: -0.15 per detected tracker (ad/telemetry/session replay)
    - 3rd-party scripts: -0.04 per 3rd-party domain script
    - Unprotected or credential forms with high trackers: -0.20 exfiltration risk penalty
    - Gemini domain reputation penalty: -0.15 if flagged as heavy surveillance/data-broker
    """
    score = 1.0

    score -= (trackers_count or 0) * 0.15
    score -= (scripts_count or 0) * 0.04

    if has_forms and (trackers_count or 0) >= 3:
        score -= 0.20

    if gemini_privacy_opinion and "invasive" in gemini_privacy_opinion.lower():
        score -= 0.15

    score = max(0.0, min(1.0, round(score, 2)))

    if score >= 0.85:
        grade = "A"
        summary = "Excellent privacy. Minimal or zero tracking detected."
    elif score >= 0.70:
        grade = "B"
        summary = "Good privacy. Standard telemetry within reasonable bounds."
    elif score >= 0.50:
        grade = "C"
        summary = "Moderate privacy risk. Multiple third-party trackers active."
    elif score >= 0.30:
        grade = "D"
        summary = "Poor privacy. Heavy commercial tracking and script injection."
    else:
        grade = "F"
        summary = "Critical privacy risk. Aggressive tracking or data harvesting detected."

    return score, grade, summary
