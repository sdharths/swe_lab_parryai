from pydantic import BaseModel
from typing import Dict, Any, Optional

class RiskMatrix(BaseModel):
    heuristic_flags: Dict[str, Any] = {}
    safe_browsing: Optional[str] = None
    trustpilot: Optional[str] = None
    tls_valid: Optional[bool] = None

class AnalyzeRequest(BaseModel):
    url: str

class AnalyzeResponse(BaseModel):
    url: str
    domain: str
    verdict: str            # "safe" | "suspicious" | "malicious" | "uncertain" | "local_fallback"
    risk_score: float       # 0.0 - 1.0
    risk_matrix: RiskMatrix
    why_explainer: str
    cached: bool
    analyzed_at: str

class ChatRequest(BaseModel):
    message: str
    domain: str

class ChatResponse(BaseModel):
    reply: str
