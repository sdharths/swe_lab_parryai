import os
from google import genai
from google.genai import types

def generate_why_explainer(domain: str, risk_matrix: dict, mock_mode: bool = True, api_key: str = None) -> str:
    """
    Phase 4: LLM Reasoning Layer using Gemini 3.6 Flash.
    If mock_mode is True, returns a fast local response.
    """
    if mock_mode or not api_key:
        # Mock behavior for Phase 4
        if risk_matrix.get('is_typosquat'):
            return f"This site appears to be a typosquat of a popular domain. Please be careful, it is likely trying to deceive you."
        if risk_matrix.get('safe_browsing') == 'malicious':
            return f"Google Safe Browsing flagged this site as malicious. Do not proceed."
        return f"This site appears normal based on our initial checks, but always exercise caution."

    try:
        # Initialize the GenAI client with the provided key
        client = genai.Client(api_key=api_key)
        
        prompt = f"""
        Analyze this domain and risk matrix for a user. Keep it under 2 sentences. Be direct and helpful.
        Domain: {domain}
        Risk Matrix: {risk_matrix}
        """
        
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        return f"LLM Error: {str(e)}"

def generate_chat_reply(message: str, domain: str, mock_mode: bool = True, api_key: str = None) -> str:
    """
    Interactive chat layer using Gemini 3.6 Flash.
    """
    if mock_mode or not api_key:
        return f"I'm a mock AI responding to your question: \"{message}\"."

    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""
        You are Parry AI, a strict, privacy-first cybersecurity AI extension. 
        The user is currently asking about the domain: {domain}
        User's message: {message}
        
        Provide a helpful, direct, and concise answer (under 3 sentences). Keep it professional but cyber-themed.
        """
        
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        return f"Chat Error: {str(e)}"

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

    try:
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
            model='gemini-3.6-flash',
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
            return [str(q).strip() for q in parsed[:3]]
        return default_questions
    except Exception:
        return default_questions

