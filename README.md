# Parry AI 🛡️ — Smart Cybersecurity Browser Extension & Analysis Gateway

> **An AI-powered, privacy-first cybersecurity browser shield that defends users against phishing, typosquatting, malware downloads, and malicious search results with zero latency overhead and intuitive conversational reasoning.**

---

## 🌟 Key Features

1. **Autonomous Heuristic Shield (Phase 1 & 2)**
   - Pre-evaluates domain safety locally in sub-millisecond time.
   - Detects visual typosquatting, Levenshtein distance impersonations, Unicode homoglyph spoofing (IDN punycode attacks), and suspicious high-entropy subdomains.

2. **Multi-Signal Sensor Fusion (Phase 3)**
   - Integrates Google Safe Browsing v4 (with batch query optimization to conserve API quotas).
   - Real-time TLS certificate validation (expiration, cipher suite, issuer validation).
   - Automated Trustpilot reputation mining via SerpApi with resilient fallback cascades.
   - Smart Gemini categorization and legality classification (Piracy vs. Gray Area vs. Legal) with safe alternative recommendations.

3. **Conversational AI & Why-Explainer (Phase 4)**
   - Powered by Google Gemini (`gemini-3.6-flash`).
   - Plain-language, transparent reasoning explaining *why* a site was flagged without technical jargon.
   - **Typewriter Text Streaming**: Natural word-by-word streaming effect inspired by modern chat environments (ChatGPT/Claude) with glowing cybercursor indicators.
   - Contextual Suggested Questions: Automatically suggests intuitive, domain-specific safety questions.
   - Sanitized markdown responses with clean typography and zero unwanted asterisk/markdown artifacts.

4. **Zero-Click Google SERP Badging**
   - Inlines real-time security badges (🛡️ Safe / ⚠️ Threat) directly alongside Google Search result titles.
   - Uses batching and CSS isolation resets to prevent distortion, inversions, or layout breaks.

5. **Download Sandbox Guard**
   - Intercepts executable and archive downloads (`.exe`, `.msi`, `.dmg`, `.zip`, `.iso`, etc.).
   - Halts immediate execution with an amber sandbox warning modal, offering one-click cancellation or user-approved proceed options.

6. **Privacy & Exfiltration Radar**
   - Live DOM inspector scanning for third-party scripts, hidden tracking beacons, and unencrypted credential/credit card inputs.

7. **Production-Grade Resilience (Phases 3.5 & 6)**
   - **Local SQLite Verdict Cache**: Sub-10ms repeat domain checks with configurable TTLs and LRU eviction.
   - **Multi-Key API Rotator**: Seamless rotation across `GEMINI_API_KEY_1`, `_2`, `_3` on 429 rate limits or resource exhaustion.
   - **Testing & Cache Management**: In-extension "Erase Cache & Reset History" button paired with `POST /cache/clear` for testing.

---

## 🏗️ Architecture

```
                                  [ User Browses Web / Google SERP ]
                                                   │
                                        (content.js / background.js)
                                                   │
                     ┌─────────────────────────────┴─────────────────────────────┐
                     ▼                                                           ▼
         [ Fast-Path Cache / Heuristics ]                            [ Download / Privacy Radar ]
          - Sub-millisecond Typosquatting                             - Executable interception
          - Homoglyph & Punycode checks                               - Third-party tracker detector
                     │
                     ▼ (Cache Miss)
         [ FastAPI Gateway: /analyze ]
                     │
         ┌───────────┴───────────────────────────┐
         ▼                                       ▼
  [ Sensor Fusion ]                       [ Gemini Intelligence ]
  - Google Safe Browsing v4 API           - Why-Explainer Generator
  - Real TLS Inspector (Socket/SSL)       - Interactive Chatbot (/chat)
  - SerpApi Trustpilot Sentiment          - Smart Legality & Alternatives
  - Graceful Fallback Cascades            - Multi-Key Auto Rotator
         │                                       │
         └───────────────────┬───────────────────┘
                             ▼
                [ Risk Scoring Engine: 0.0 - 1.0 ]
                             ▼
               [ SQLite Cache: verdict_cache.db ]
                             ▼
               [ Parry AI Toast & Slideout UI ]
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python**: 3.10+ (tested on Python 3.14)
- **Node/Chrome**: Google Chrome, Brave, Edge, or any Chromium-based browser supporting Manifest V3.

### 2. Backend Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/sdharths/swe_lab_parryai.git
   cd swe_lab_parryai
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure your `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your API keys:
   ```env
   MOCK_MODE=False
   GEMINI_MODEL=gemini-3.6-flash
   GEMINI_API_KEY_1=your_first_gemini_api_key_here
   GEMINI_API_KEY_2=your_second_gemini_api_key_here
   GEMINI_API_KEY_3=your_third_gemini_api_key_here
   GOOGLE_SAFE_BROWSING_KEY=your_safe_browsing_key_here
   SERPAPI_KEY=your_serpapi_key_here
   ```
   *(Note: Set `MOCK_MODE=True` to run completely offline without external API keys).*

4. Start the backend server:
   ```bash
   uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   Interactive Swagger documentation is available at `http://127.0.0.1:8000/docs`.

---

### 3. Chrome Extension Installation
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the `extension/` directory from this repository.
4. Parry AI will now automatically shield your browsing and badge Google search results.

---

### 4. Interactive Frontend Sandbox (Optional Testing)
To test the extension UI components without loading the unpacked extension:
1. Open `frontend_sandbox/index.html` in your web browser.
2. Simulate various domain verdicts (Safe, Suspicious, Malicious, Downloading executables, Interactive Chat) in an isolated test environment.

---

## 🧪 Running Automated Tests

The backend includes comprehensive test suites across development phases:

```bash
# Set PYTHONPATH to repository root
$env:PYTHONPATH="."   # (PowerShell)
# export PYTHONPATH="." # (Linux / macOS)

# Phase 1: API schemas & endpoints
python backend/tests/test_phase1.py

# Phase 2: Typosquatting & Heuristic detection
python backend/tests/test_phase2.py

# Phase 3: Sensor Fusion & Live Integrations
python backend/tests/test_phase3.py

# Phase 3.5: SQLite Caching, Hit/Miss, & Expiration
python backend/tests/test_phase3_5.py
```

---

## 📁 Repository Structure

```
swe_lab_parryai/
├── backend/
│   ├── app/
│   │   ├── cache/             # SQLite async caching & LRU management
│   │   ├── llm/               # Gemini client, prompt templates, key rotator
│   │   ├── signals/           # Safe Browsing, TLS, Trustpilot sensors
│   │   ├── constants.py       # Cache TTLs & limits
│   │   ├── heuristics.py      # Typosquatting, homoglyphs, entropy
│   │   ├── main.py            # FastAPI endpoints & lifespan
│   │   ├── schemas.py         # Pydantic data models
│   │   └── scoring.py         # Weighted risk scoring algorithm
│   └── tests/                 # Unit & integration test suites
├── extension/
│   ├── background.js          # MV3 Service Worker (message router)
│   ├── content.js             # UI injection, SERP badging, download guard
│   ├── manifest.json          # Chrome Extension Manifest V3
│   └── toast.css              # Cyber-themed glassmorphism styling
├── frontend_sandbox/          # Standalone UI mock tester
├── eval/                      # Evaluation harness & benchmark suites
├── .env.example               # Environment variables template
├── .gitignore                 # Security exclusion (keeps .env and DB private)
├── requirements.txt           # Python dependencies
└── README.md
```

---

## 🔒 Security & Privacy Notice
- `.env` and SQLite database files (`*.db`) are strictly excluded from version control via `.gitignore`.
- API keys are handled securely in backend environment variables and never exposed to the Chrome Extension frontend.
- Zero browsing history or telemetry leaves your local machine unless specifically authorized.
