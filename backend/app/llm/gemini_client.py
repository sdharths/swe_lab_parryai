import os
from google import genai
from google.genai import types

def generate_why_explainer(domain: str, risk_matrix: dict, mock_mode: bool = True, api_key: str = None) -> str:
    """
    Phase 4: LLM Reasoning Layer using Gemini 1.5 Flash.
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
            model='gemini-3.5-flash',
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        return f"LLM Error: {str(e)}"

def generate_chat_reply(message: str, domain: str, mock_mode: bool = True, api_key: str = None) -> str:
    """
    Interactive chat layer using Gemini 3.5 Flash.
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
            model='gemini-3.5-flash',
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        return f"Chat Error: {str(e)}"
