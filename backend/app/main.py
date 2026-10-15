from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from urllib.parse import urlparse
from backend.app.schemas import (
    AnalyzeRequest, AnalyzeResponse, RiskMatrix, ChatRequest, ChatResponse,
    QuestionsRequest, QuestionsResponse, BatchSafeBrowsingRequest,
    BatchSafeBrowsingResponse, BatchSafeBrowsingItem, ReportFalsePositiveRequest
)
from backend.app.llm.key_rotator import KeyRotator
from backend.app.heuristics import run_heuristics
from backend.app.signals.sensors import run_sensor_fusion, check_safe_browsing_batch
from backend.app.cache.cache import VerdictCache
from backend.app.llm.gemini_client import generate_why_explainer, generate_chat_reply, generate_suggested_questions, get_gemini_threat_intelligence
from backend.app.scoring import calculate_risk
from contextlib import asynccontextmanager

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MOCK_MODE = os.getenv("MOCK_MODE", "True").lower() in ["true", "1", "yes"]

# Load all GEMINI_API_KEY_1, GEMINI_API_KEY_2, ... from env (with fallback to GEMINI_API_KEY)
def _load_gemini_keys() -> list[str]:
    keys = []
    # Numbered keys (GEMINI_API_KEY_1, _2, _3, ...)
    i = 1
    while True:
        k = os.getenv(f"GEMINI_API_KEY_{i}")
        if not k:
            break
        keys.append(k)
        i += 1
    # Legacy single key fallback
    if not keys:
        single = os.getenv("GEMINI_API_KEY")
        if single:
            keys.append(single)
    return keys

key_rotator = KeyRotator(keys=_load_gemini_keys())

cache = VerdictCache()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await cache.init_db()
    yield

app = FastAPI(title="AI Link Shield Gateway", lifespan=lifespan)

# Add CORS Middleware to allow Chrome Extension to talk to localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def extract_domain(url: str) -> str:
    """Helper to extract domain from URL for mocked caching/analysis"""
    try:
        parsed_url = urlparse(url)
        if not parsed_url.netloc:
            parsed_url = urlparse("http://" + url)
        return parsed_url.netloc or "unknown"
    except Exception:
        return "unknown"

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_url(req: AnalyzeRequest):
    """
    Phase 1: Mock endpoint for URL analysis.
    Returns a mocked response that perfectly fits the defined schema.
    """
    domain = extract_domain(req.url)
    
    # 1. Check cache first
    cached_resp = await cache.get(domain)
    if cached_resp:
        cached_resp.url = req.url
        return cached_resp
        
    # 2. Cache miss, run heuristics and sensors
    suggested_questions = []
    try:
        heuristic_flags = run_heuristics(domain)
        sensor_data = run_sensor_fusion(req.url, domain)
        
        risk_matrix_dict = {
            "heuristic_flags": heuristic_flags,
            "safe_browsing": sensor_data["safe_browsing"],
            "trustpilot": sensor_data["trustpilot"],
            "tls_valid": sensor_data["tls_valid"]
        }
        
        # Phase 3b: Gemini Smart Sensor for Legality & Category
        threat_intel = {}
        for _attempt in range(len(key_rotator.keys) or 1):
            try:
                threat_intel = get_gemini_threat_intelligence(
                    domain=domain,
                    mock_mode=MOCK_MODE,
                    api_key=key_rotator.get_key()
                )
                break
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e).upper():
                    key_rotator.rotate()
                else:
                    break
        
        legality_status = threat_intel.get("legality_status", "Legal")
        legal_alternatives = threat_intel.get("legal_alternatives", [])
        
        # 3. Phase 5: Calculate risk score and verdict
        risk_score, verdict = calculate_risk(risk_matrix_dict)
        
        # 4. Phase 4: Generate LLM explainer (with key rotation on rate limit)
        for _attempt in range(len(key_rotator.keys) or 1):
            try:
                why_explainer = generate_why_explainer(
                    domain=domain,
                    risk_matrix=risk_matrix_dict,
                    mock_mode=MOCK_MODE,
                    api_key=key_rotator.get_key()
                )
                break
            except Exception as llm_err:
                if "429" in str(llm_err) or "RESOURCE_EXHAUSTED" in str(llm_err).upper():
                    key_rotator.rotate()
                else:
                    why_explainer = f"LLM Error: {str(llm_err)}"
                    break
        else:
            why_explainer = "All API keys are rate-limited. Please try again shortly."

        # 5. Generate contextual intuitive suggested questions (with key rotation)
        for _attempt in range(len(key_rotator.keys) or 1):
            try:
                suggested_questions = generate_suggested_questions(
                    domain=domain,
                    mock_mode=MOCK_MODE,
                    api_key=key_rotator.get_key()
                )
                break
            except Exception as q_err:
                if "429" in str(q_err) or "RESOURCE_EXHAUSTED" in str(q_err).upper():
                    key_rotator.rotate()
                else:
                    break
        else:
            suggested_questions = [
                f"What is {domain} used for?",
                f"Is it safe to share information on {domain}?",
                "What security precautions should I take here?"
            ]
        
    except Exception as e:
        # Phase 6: Graceful Degradation / Offline Fallback
        # If any of the above fails catastrophically, fallback to a safe default
        risk_matrix_dict = {
            "heuristic_flags": {"error": str(e)},
            "safe_browsing": "unknown",
            "trustpilot": "unknown",
            "tls_valid": False
        }
        risk_score = 0.5
        verdict = "local_fallback"
        why_explainer = f"Analysis failed: {str(e)}. Please check your API keys or network connection."
        suggested_questions = [
            f"What is {domain}?",
            f"Is {domain} secure to browse?",
            "What should I do if a site fails verification?"
        ]

    response = AnalyzeResponse(
        url=req.url,
        domain=domain,
        verdict=verdict,
        risk_score=risk_score,
        risk_matrix=RiskMatrix(**risk_matrix_dict),
        why_explainer=why_explainer,
        cached=False,
        analyzed_at=datetime.now(timezone.utc).isoformat(),
        suggested_questions=suggested_questions,
        legality_status=legality_status if 'legality_status' in locals() else "Legal",
        legal_alternatives=legal_alternatives if 'legal_alternatives' in locals() else []
    )
    
    # 3. Store in cache
    await cache.put(domain, response)
    return response

@app.post("/suggested-questions", response_model=QuestionsResponse)
async def get_suggested_questions(req: QuestionsRequest):
    """
    Generate intuitive questions about a specific domain on demand.
    """
    domain = extract_domain(req.domain)
    # Try each key on rate limit
    for _attempt in range(len(key_rotator.keys) or 1):
        try:
            questions = generate_suggested_questions(
                domain=domain,
                mock_mode=MOCK_MODE,
                api_key=key_rotator.get_key()
            )
            return QuestionsResponse(questions=questions)
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e).upper():
                key_rotator.rotate()
            else:
                break
    
    # Fallback if all keys fail
    return QuestionsResponse(questions=[
        f"What is {domain} used for?",
        f"Is it safe to login on {domain}?",
        "What security precautions should I take here?"
    ])

@app.post("/chat", response_model=ChatResponse)
async def chat_with_ai(req: ChatRequest):
    """
    Endpoint for interactive AI chat via the Chrome Extension sidebar.
    """
    domain = extract_domain(req.domain)
    # Try each key on rate limit
    for _attempt in range(len(key_rotator.keys) or 1):
        try:
            reply = generate_chat_reply(
                message=req.message,
                domain=domain,
                mock_mode=MOCK_MODE,
                api_key=key_rotator.get_key()
            )
            return ChatResponse(reply=reply)
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e).upper():
                key_rotator.rotate()
            else:
                return ChatResponse(reply=f"Error connecting to Parry AI: {str(e)}")
    return ChatResponse(reply="All API keys are currently rate-limited. Please try again in a moment.")

@app.post("/admin/shadow-refresh")
async def shadow_refresh():
    """Manual trigger to re-validate cached entries (Phase 3.5)."""
    # Just a stub for now
    await cache.shadow_refresh_all()
    return {"status": "refresh triggered"}

@app.post("/cache/clear")
async def clear_cache():
    """
    Manually clear cached verdicts for testing purposes.
    """
    await cache.clear_all()
    return {"status": "success", "message": "Verdict cache cleared"}

@app.post("/batch-safe-browsing", response_model=BatchSafeBrowsingResponse)
async def batch_safe_browsing_check(req: BatchSafeBrowsingRequest):
    """
    Zero-Click SERP endpoint:
    Checks a batch of URLs using Google Safe Browsing in a single call to preserve API limits.
    """
    raw_results = check_safe_browsing_batch(req.urls)
    results = [
        BatchSafeBrowsingItem(
            url=url,
            verdict=verdict,
            source="Google Safe Browsing"
        )
        for url, verdict in raw_results.items()
    ]
    return BatchSafeBrowsingResponse(results=results)

@app.post("/report-verdict")
async def report_verdict(req: ReportFalsePositiveRequest):
    """
    Endpoint for users to report false positives/negatives directly to the backend.
    """
    domain = extract_domain(req.domain or req.url)
    # Log report to cache or persistent structure
    await cache.record_report(
        domain=domain,
        url=req.url,
        verdict=req.verdict,
        report_type=req.report_type,
        user_comment=req.user_comment or ""
    )
    return {"status": "success", "message": f"Report received for {domain}"}

@app.get("/health")
async def health_check():
    """Health check endpoint to ensure API is running"""
    return {"status": "ok", "version": "1.0.0"}

