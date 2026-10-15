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
    suggested_questions: list[str] = []
    legality_status: str = "Legal"
    legal_alternatives: list[str] = []

class ChatRequest(BaseModel):
    message: str
    domain: str

class ChatResponse(BaseModel):
    reply: str

class QuestionsRequest(BaseModel):
    domain: str

class QuestionsResponse(BaseModel):
    questions: list[str] = []

class BatchSafeBrowsingRequest(BaseModel):
    urls: list[str]

class BatchSafeBrowsingItem(BaseModel):
    url: str
    verdict: str  # "clean" | "malicious" | "unknown"
    source: str = "Google Safe Browsing"

class BatchSafeBrowsingResponse(BaseModel):
    results: list[BatchSafeBrowsingItem]

class ReportFalsePositiveRequest(BaseModel):
    url: str
    domain: str
    verdict: str
    user_comment: Optional[str] = ""
    report_type: str = "false_positive" # or "false_negative"

