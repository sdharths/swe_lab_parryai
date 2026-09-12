// Parry AI Content Script

// 1. Inject Fonts
const fontLink1 = document.createElement('link');
fontLink1.rel = 'preconnect';
fontLink1.href = 'https://fonts.googleapis.com';
document.head.appendChild(fontLink1);

const fontLink2 = document.createElement('link');
fontLink2.rel = 'preconnect';
fontLink2.href = 'https://fonts.gstatic.com';
fontLink2.crossOrigin = 'anonymous';
document.head.appendChild(fontLink2);

const fontLink3 = document.createElement('link');
fontLink3.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Orbitron:wght@500;700;900&display=swap';
fontLink3.rel = 'stylesheet';
document.head.appendChild(fontLink3);


// 2. Ask Background for Analysis
chrome.runtime.sendMessage({ action: "analyze_url", url: window.location.href }, (response) => {
    if (response && response.data) {
        checkSettingsAndRender(response.data);
    }
});

function checkSettingsAndRender(apiResponse) {
    chrome.storage.local.get(['neverShowSafe'], (result) => {
        if (apiResponse.verdict === 'safe' && result.neverShowSafe) {
            // User opted out of safe toasts
            return;
        }
        renderParryAIToast(apiResponse);
    });
}

function renderParryAIToast(response) {
    if (document.getElementById('parry-ai-container')) return;

    const isDangerous = (response.verdict === "malicious" || response.verdict === "suspicious");

    let badgeClass = "safe";
    if (response.verdict === "malicious") badgeClass = "malicious";
    else if (response.verdict === "suspicious") badgeClass = "suspicious";

    let backdrop = null;
    if (isDangerous) {
        backdrop = document.createElement('div');
        backdrop.id = 'parry-ai-backdrop';
        injectWhenReady(backdrop);
        backdrop.offsetHeight;
        backdrop.classList.add('show');
        if (document.body) document.body.style.overflow = 'hidden';
    }

    const container = document.createElement('div');
    container.id = 'parry-ai-container';
    if (isDangerous) container.classList.add('blocking-mode');
    
    container.innerHTML = `
        <div class="parry-header">
            <h2 class="parry-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                PARRY AI
            </h2>
            <div class="parry-badge ${badgeClass}">${response.verdict}</div>
        </div>
        
        <div class="parry-body">
            ${isDangerous ? 'This site has been flagged as potentially dangerous. Access has been halted to protect your security.' : 'This site appears safe based on our current analysis.'}
        </div>
        
        <button class="parry-ai-btn" id="parry-ai-why-btn" style="margin-bottom: 16px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            ${isDangerous ? 'Why is this dangerous?' : 'Why is this safe?'}
        </button>
        
        <div class="parry-score-container" style="margin-top: 0;">
            <span class="parry-score-label">RISK FACTOR:</span>
            <span class="parry-score-value" style="color: ${badgeClass === 'malicious' ? '#ff0055' : (badgeClass === 'suspicious' ? '#ffaa00' : '#00ffaa')}">
                ${Math.round(response.risk_score * 100)}%
            </span>
        </div>
        
        <div class="parry-feedback-container">
            <span style="font-size: 13px; color: #94a3b8;">Was this verdict accurate?</span>
            <div style="display: flex; gap: 8px;">
                <button class="parry-feedback-btn" id="parry-feedback-up" title="Accurate">👍</button>
                <button class="parry-feedback-btn" id="parry-feedback-down" title="Inaccurate">👎</button>
            </div>
        </div>
        
        <div class="parry-footer">
            ${isDangerous ? `
                <div class="parry-actions">
                    <button class="parry-btn parry-btn-danger" id="parry-ignore-btn">Ignore & Proceed</button>
                    <button class="parry-btn parry-btn-primary" id="parry-safe-btn">Return to Safety</button>
                </div>
            ` : `
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; color:#e2e8f0; font-size:13px;">
                    <input type="checkbox" id="parry-never-show" style="accent-color:#00f0ff; width:16px; height:16px;">
                    Don't show this again
                </label>
                <button class="parry-btn parry-btn-primary" id="parry-safe-btn">Acknowledge</button>
            `}
        </div>
    `;

    injectWhenReady(container, () => {
        container.offsetHeight; 
        container.classList.add('show');
    });

    // History log logic (Phase 8)
    function logHistory(choice) {
        chrome.storage.local.get({ history: [] }, (result) => {
            const hist = result.history;
            hist.unshift({
                domain: window.location.hostname,
                verdict: response.verdict,
                choice: choice,
                timestamp: new Date().toISOString()
            });
            // Keep last 50 items
            if (hist.length > 50) hist.pop();
            chrome.storage.local.set({ history: hist });
        });
    }

    // Feedback logic (Phase 8)
    const upBtn = container.querySelector('#parry-feedback-up');
    const downBtn = container.querySelector('#parry-feedback-down');
    
    function handleFeedback(isAccurate) {
        upBtn.classList.toggle('selected', isAccurate);
        downBtn.classList.toggle('selected', !isAccurate);
        
        chrome.storage.local.get({ userFeedback: [] }, (result) => {
            const feedbacks = result.userFeedback;
            // Remove previous feedback for this domain if exists
            const filtered = feedbacks.filter(f => f.domain !== window.location.hostname);
            filtered.unshift({
                domain: window.location.hostname,
                verdict: response.verdict,
                accurate: isAccurate,
                timestamp: new Date().toISOString()
            });
            if (filtered.length > 100) filtered.pop();
            chrome.storage.local.set({ userFeedback: filtered });
        });
    }
    
    if (upBtn && downBtn) {
        upBtn.addEventListener('click', () => handleFeedback(true));
        downBtn.addEventListener('click', () => handleFeedback(false));
    }

    // Sidebar Logic
    let sidebar = null;
    const whyBtn = container.querySelector('#parry-ai-why-btn');
    if (whyBtn) {
        whyBtn.addEventListener('click', () => {
            if (!sidebar) {
                sidebar = document.createElement('div');
                sidebar.id = 'parry-ai-sidebar';
                
                // Fetch actual history to render
                chrome.storage.local.get({ history: [] }, (result) => {
                    const historyHtml = result.history.length > 0 
                        ? result.history.map(item => `
                            <div class="parry-history-item ${item.verdict}">
                                <div class="parry-history-domain">${item.domain}</div>
                                <div class="parry-history-choice">Verdict: ${item.verdict} | Choice: ${item.choice}</div>
                            </div>
                        `).join('')
                        : '<div class="parry-history-item safe">No history recorded yet.</div>';

                    sidebar.innerHTML = `
                        <div class="parry-sidebar-header">
                            <h2 class="parry-sidebar-title">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                                AI Analysis
                            </h2>
                            <button class="parry-sidebar-close" id="parry-sidebar-close">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        
                        <div class="parry-sidebar-tabs">
                            <div class="parry-tab active" id="tab-chat">CHAT</div>
                            <div class="parry-tab" id="tab-history">HISTORY</div>
                        </div>
                        
                        <div class="parry-sidebar-view active" id="view-chat">
                            <div class="parry-chat-area" id="parry-chat-area">
                                <div class="parry-chat-bubble ai">
                                    <strong>Parry AI:</strong><br><br>
                                    ${response.why_explainer}<br><br>
                                    <em>How can I assist you further?</em>
                                </div>
                            </div>
                        </div>
                        
                        <div class="parry-sidebar-view" id="view-history">
                            <div class="parry-history-list">
                                ${historyHtml}
                            </div>
                        </div>
                        
                        <div class="parry-chat-input-container" id="chat-input-container">
                            <input type="text" class="parry-chat-input" id="parry-chat-input" placeholder="Ask Gemini about this site...">
                            <button class="parry-chat-send" id="parry-chat-send">SEND</button>
                        </div>
                    `;
                    
                    injectWhenReady(sidebar, () => {
                        sidebar.querySelector('#parry-sidebar-close').addEventListener('click', () => {
                            sidebar.classList.remove('show');
                        });
                        
                        const tabChat = sidebar.querySelector('#tab-chat');
                        const tabHistory = sidebar.querySelector('#tab-history');
                        const viewChat = sidebar.querySelector('#view-chat');
                        const viewHistory = sidebar.querySelector('#view-history');
                        const chatInputContainer = sidebar.querySelector('#chat-input-container');
                    
                    tabChat.addEventListener('click', () => {
                        tabChat.classList.add('active');
                        tabHistory.classList.remove('active');
                        viewChat.classList.add('active');
                        viewHistory.classList.remove('active');
                        chatInputContainer.style.display = 'flex';
                    });
                    
                    tabHistory.addEventListener('click', () => {
                        tabHistory.classList.add('active');
                        tabChat.classList.remove('active');
                        viewHistory.classList.add('active');
                        viewChat.classList.remove('active');
                        chatInputContainer.style.display = 'none';
                    });
                    
                    const sendBtn = sidebar.querySelector('#parry-chat-send');
                    const chatInput = sidebar.querySelector('#parry-chat-input');
                    const chatArea = sidebar.querySelector('#parry-chat-area');
                    
                    const handleSend = () => {
                        const text = chatInput.value.trim();
                        if (!text) return;
                        
                        const userMsg = document.createElement('div');
                        userMsg.className = 'parry-chat-bubble user';
                        userMsg.innerHTML = `<strong>You:</strong><br><br>${text}`;
                        chatArea.appendChild(userMsg);
                        chatInput.value = '';
                        chatArea.scrollTop = chatArea.scrollHeight;
                        
                        const typingMsg = document.createElement('div');
                        typingMsg.className = 'parry-chat-bubble ai';
                        typingMsg.innerHTML = `<strong>Parry AI:</strong><br><br><em>Typing...</em>`;
                        chatArea.appendChild(typingMsg);
                        chatArea.scrollTop = chatArea.scrollHeight;
                        
                        chrome.runtime.sendMessage({
                            action: "chat_ai", 
                            text: text, 
                            domain: window.location.hostname
                        }, (chatResponse) => {
                            if (chatResponse && chatResponse.reply) {
                                typingMsg.innerHTML = `<strong>Parry AI:</strong><br><br>${chatResponse.reply}`;
                            } else {
                                typingMsg.innerHTML = `<strong>Parry AI:</strong><br><br><em>Error connecting to AI.</em>`;
                            }
                            chatArea.scrollTop = chatArea.scrollHeight;
                        });
                    };
                    
                    sendBtn.addEventListener('click', handleSend);
                    chatInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') handleSend();
                    });
                    
                    // Show sidebar
                    sidebar.offsetHeight;
                    sidebar.classList.add('show');
                });
            }); // Close chrome.storage.local.get
        } else {
            sidebar.classList.add('show');
        }
        });
    }

    container.querySelector('#parry-safe-btn').addEventListener('click', () => {
        if (!isDangerous) {
            const neverShow = container.querySelector('#parry-never-show')?.checked;
            if (neverShow) {
                chrome.storage.local.set({ neverShowSafe: true });
            }
        } else {
            logHistory('Returned to Safety');
            window.history.back(); // Or window.close()
        }
        closeParryUI();
    });

    const ignoreBtn = container.querySelector('#parry-ignore-btn');
    if (ignoreBtn) {
        ignoreBtn.addEventListener('click', () => {
            logHistory('Ignored Blockade');
            document.body.style.overflow = '';
            closeParryUI();
        });
    }

    function closeParryUI() {
        container.classList.remove('show');
        if (backdrop) backdrop.classList.remove('show');
        if (sidebar) sidebar.classList.remove('show');
        
        setTimeout(() => {
            container.remove();
            if (backdrop) backdrop.remove();
            if (sidebar) sidebar.remove();
        }, 400); 
    }
}

// Safe Injection Helper
function injectWhenReady(element, callback) {
    if (document.body) {
        document.body.appendChild(element);
        if (callback) callback();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(element);
            if (callback) callback();
        });
    }
}
