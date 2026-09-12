from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from urllib.parse import urlparse
from backend.app.schemas import AnalyzeRequest, AnalyzeResponse, RiskMatrix, ChatRequest, ChatResponse, QuestionsRequest, QuestionsResponse
from backend.app.llm.key_rotator import KeyRotator
from backend.app.heuristics import run_heuristics
from backend.app.signals.sensors import run_sensor_fusion
from backend.app.cache.cache import VerdictCache
from backend.app.llm.gemini_client import generate_why_explainer, generate_chat_reply, generate_suggested_questions
from backend.app.scoring import calculate_risk
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MOCK_MODE = os.getenv("MOCK_MODE", "True").lower() in ["true", "1", "yes"]
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

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

# Mock key rotator for now
key_rotator = KeyRotator(keys=["mock_key_1", "mock_key_2"])

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
        
        # 3. Phase 5: Calculate risk score and verdict
        risk_score, verdict = calculate_risk(risk_matrix_dict)
        
        # 4. Phase 4: Generate LLM explainer
        why_explainer = generate_why_explainer(
            domain=domain, 
            risk_matrix=risk_matrix_dict, 
            mock_mode=MOCK_MODE,
            api_key=GEMINI_API_KEY
        )

        # 5. Generate contextual intuitive suggested questions
        suggested_questions = generate_suggested_questions(
            domain=domain,
            mock_mode=MOCK_MODE,
            api_key=GEMINI_API_KEY
        )
        
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
        suggested_questions=suggested_questions
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
    questions = generate_suggested_questions(
        domain=domain,
        mock_mode=MOCK_MODE,
        api_key=GEMINI_API_KEY
    )
    return QuestionsResponse(questions=questions)

@app.post("/chat", response_model=ChatResponse)
async def chat_with_ai(req: ChatRequest):
    """
    Endpoint for interactive AI chat via the Chrome Extension sidebar.
    """
    domain = extract_domain(req.domain)
    try:
        reply = generate_chat_reply(
            message=req.message,
            domain=domain,
            mock_mode=MOCK_MODE,
            api_key=GEMINI_API_KEY
        )
        return ChatResponse(reply=reply)
    except Exception as e:
        return ChatResponse(reply=f"Error connecting to Parry AI: {str(e)}")

@app.post("/admin/shadow-refresh")
async def shadow_refresh():
    """Manual trigger to re-validate cached entries (Phase 3.5)."""
    # Just a stub for now
    await cache.shadow_refresh_all()
    return {"status": "refresh triggered"}

@app.get("/health")
async def health_check():
    """Health check endpoint to ensure API is running"""
    return {"status": "ok", "version": "1.0.0"}
