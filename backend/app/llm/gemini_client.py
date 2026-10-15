import os
from google import genai
from google.genai import types

def get_gemini_model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

def _clean_markdown(text: str) -> str:
    """Removes double asterisks and markdown bolding from text."""
    if not text:
        return ""
    return text.replace("**", "").replace("__", "").strip()

def generate_why_explainer(domain: str, risk_matrix: dict, mock_mode: bool = True, api_key: str = None) -> str:
    """
    Phase 4: LLM Reasoning Layer using configured Gemini Model.
    If mock_mode is True, returns a fast local response.
    """
    if mock_mode or not api_key:
        # Mock behavior for Phase 4
        if risk_matrix.get('is_typosquat'):
            return f"This site appears to be a typosquat of a popular domain. Please be careful, it is likely trying to deceive you."
        if risk_matrix.get('safe_browsing') == 'malicious':
            return f"Google Safe Browsing flagged this site as malicious. Do not proceed."
        return f"This site appears normal based on our initial checks, but always exercise caution."

    # Initialize the GenAI client with the provided key
    client = genai.Client(api_key=api_key)
    
    prompt = f"""
    Analyze this domain and risk matrix for a user. Keep it under 2 sentences. Be direct and helpful.
    Do NOT use double asterisks (**) or markdown bolding around domain names or any text.
    Domain: {domain}
    Risk Matrix: {risk_matrix}
    """
    
    response = client.models.generate_content(
        model=get_gemini_model(),
        contents=prompt,
    )
    return _clean_markdown(response.text)

def generate_chat_reply(message: str, domain: str, mock_mode: bool = True, api_key: str = None) -> str:
    """
    Interactive chat layer using configured Gemini Model.
    """
    if mock_mode or not api_key:
        return f"I'm a mock AI responding to your question: \"{message}\"."

    client = genai.Client(api_key=api_key)
    prompt = f"""
    You are Parry AI, a strict, privacy-first cybersecurity AI extension. 
    The user is currently asking about the domain: {domain}
    User's message: {message}
    
    Provide a helpful, direct, and concise answer (under 3 sentences). Keep it professional but cyber-themed.
    Strict formatting rule: Do NOT use double asterisks (**) or any markdown bold/italic tags around domain names or words.
    """
    
    response = client.models.generate_content(
        model=get_gemini_model(),
        contents=prompt,
    )
    return _clean_markdown(response.text)


def generate_suggested_questions(domain: str, mock_mode: bool = True, api_key: str = None) -> list[str]:
    """
    Generates 3 intuitive contextual questions about what the site is for,
    its typical usage, and security considerations.
    """
    default_questions = [
        f"What is {domain} used for?",
        f"Is it safe to login or enter personal details on {domain}?",
        f"What security precautions should I take on {domain}?"
    ]
    if mock_mode or not api_key:
        return default_questions

    import json
    client = genai.Client(api_key=api_key)
    prompt = f"""
    Given the domain "{domain}", generate exactly 3 intuitive, practical questions that a user browsing this site would ask an AI cybersecurity assistant.
    Questions should cover what this site is for, its common usage, and safety/data security advice.
    Keep each question under 15 words.
    Return ONLY a JSON array of 3 strings, with no markdown code fences or other text.
    Example: ["What is this site used for?", "Is it safe to login or buy products here?", "What precautions should I take on this site?"]
    """
    response = client.models.generate_content(
        model=get_gemini_model(),
        contents=prompt,
    )
    raw_text = response.text.strip()
    # Remove potential backticks/formatting
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`")
        if raw_text.startswith("json"):
            raw_text = raw_text[4:].strip()
    parsed = json.loads(raw_text)
    if isinstance(parsed, list) and len(parsed) > 0:
        return [_clean_markdown(str(q)) for q in parsed[:3]]
    return default_questions

def get_gemini_threat_intelligence(domain: str, mock_mode: bool = True, api_key: str = None) -> dict:
    """
    Acts as a Smart Sensor in Phase 3. Categorizes the domain and evaluates legality.
    """
    default_intel = {
        "legality_status": "Legal",
        "category": "Unknown",
        "legal_alternatives": []
    }
    
    if mock_mode or not api_key:
        return default_intel

    import json
    client = genai.Client(api_key=api_key)
    prompt = f"""
    Analyze the domain: "{domain}".
    1. Determine its primary category (e.g., E-commerce, Piracy, Adult, Finance, Search Engine, etc.).
    2. Determine its legality status. If it's widely known for distributing illegal/unlicensed content (like piracy), mark it "Illegal". If it's a gray market, mark it "Gray Area". Otherwise, mark it "Legal".
    3. If it's "Illegal" or "Gray Area", suggest 1-3 well-known, safe, legal alternative sites (e.g., if piracy of anime, suggest Crunchyroll). If "Legal", return an empty list.
    
    Return EXACTLY a JSON object with this structure, and absolutely NO markdown formatting or backticks:
    {{
        "legality_status": "Legal" | "Gray Area" | "Illegal",
        "category": "string",
        "legal_alternatives": ["string", "string"]
    }}
    """
    try:
        response = client.models.generate_content(
            model=get_gemini_model(),
            contents=prompt,
        )

        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.strip("`")
            if raw_text.startswith("json"):
                raw_text = raw_text[4:].strip()
                
        parsed = json.loads(raw_text)
        return {
            "legality_status": parsed.get("legality_status", "Legal"),
            "category": parsed.get("category", "Unknown"),
            "legal_alternatives": parsed.get("legal_alternatives", [])
        }
    except Exception as e:
        return default_intel

