// Parry AI Background Service Worker

const API_URL = "http://127.0.0.1:8000/analyze";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyze_url") {
        const urlToAnalyze = request.url;
        
        fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: urlToAnalyze,
                trackers_count: request.trackers_count || 0,
                third_party_scripts_count: request.third_party_scripts_count || 0,
                has_input_forms: Boolean(request.has_input_forms)
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then(data => {
            sendResponse({ success: true, data: data });
        })
        .catch(error => {
            console.error("Parry AI Backend Error:", error);
            // Phase 6 fallback logic sent to content script
            sendResponse({ 
                success: false, 
                data: {
                    verdict: "local_fallback",
                    risk_score: 0.5,
                    why_explainer: "Could not connect to Parry AI backend. Please ensure the local server is running.",
                    cached: false
                }
            });
        });
        
        // Return true to indicate asynchronous response
        return true;
    } else if (request.action === "chat_ai") {
        fetch(API_URL.replace("/analyze", "/chat"), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: request.text, domain: request.domain })
        })
        .then(response => {
            if (!response.ok) throw new Error("Chat response not ok");
            return response.json();
        })
        .then(data => {
            sendResponse({ success: true, reply: data.reply });
        })
        .catch(error => {
            console.error("Chat Error:", error);
            sendResponse({ success: false, reply: "Sorry, I couldn't connect to the Parry AI server to answer your question." });
        });
        
        return true;
    } else if (request.action === "get_suggested_questions") {
        fetch(API_URL.replace("/analyze", "/suggested-questions"), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ domain: request.domain })
        })
        .then(response => {
            if (!response.ok) throw new Error("Questions response not ok");
            return response.json();
        })
        .then(data => {
            sendResponse({ success: true, questions: data.questions || [] });
        })
        .catch(error => {
            console.error("Suggested Questions Error:", error);
            sendResponse({ 
                success: false, 
                questions: [
                    `What is ${request.domain} used for?`,
                    `Is it safe to login on ${request.domain}?`,
                    `What precautions should I take on ${request.domain}?`
                ] 
            });
        });

        return true;
    } else if (request.action === "batch_safe_browsing") {
        fetch(API_URL.replace("/analyze", "/batch-safe-browsing"), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ urls: request.urls })
        })
        .then(response => {
            if (!response.ok) throw new Error("Batch safe browsing failed");
            return response.json();
        })
        .then(data => {
            sendResponse({ success: true, results: data.results || [] });
        })
        .catch(error => {
            console.error("Batch Safe Browsing Error:", error);
            sendResponse({ success: false, results: [] });
        });

        return true;
    } else if (request.action === "report_verdict") {
        fetch(API_URL.replace("/analyze", "/report-verdict"), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: request.url,
                domain: request.domain,
                verdict: request.verdict,
                report_type: request.report_type || "false_positive",
                user_comment: request.user_comment || ""
            })
        })
        .then(response => {
            if (!response.ok) throw new Error("Report failed");
            return response.json();
        })
        .then(data => {
            sendResponse({ success: true, data: data });
        })
        .catch(error => {
            console.error("Report Error:", error);
            sendResponse({ success: false });
        });

        return true;
    } else if (request.action === "clear_cache") {
        fetch(API_URL.replace("/analyze", "/cache/clear"), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            sendResponse({ success: true, data: data });
        })
        .catch(error => {
            console.error("Clear Cache Error:", error);
            sendResponse({ success: false });
        });

        return true;
    }
});

