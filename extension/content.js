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
fontLink3.rel = 'stylesheet';
fontLink3.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Orbitron:wght@500;700;900&display=swap';
document.head.appendChild(fontLink3);

// 2. Ask Background for Analysis
chrome.runtime.sendMessage({ action: "analyze_url", url: window.location.href }, (response) => {
    if (response && response.data) {
        checkSettingsAndRender(response.data);
    }
});

function checkSettingsAndRender(apiResponse) {
    chrome.storage.local.get({
        neverShowSafe: false,
        interceptHttps: true,
        notifyHttps: true
    }, (settings) => {
        const isHttps = window.location.protocol === 'https:';

        // Check user setting toggle for HTTPS intercept / block
        if (isHttps && !settings.interceptHttps) {
            const isDangerous = (apiResponse.verdict === 'malicious' || apiResponse.verdict === 'suspicious');
            if (isDangerous) {
                // User disabled intercepting/blocking on HTTPS
                return;
            }
        }

        // Check user setting toggle for HTTPS notifications
        if (isHttps && !settings.notifyHttps) {
            return;
        }

        // Check legacy neverShowSafe flag
        if (apiResponse.verdict === 'safe' && settings.neverShowSafe) {
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
    
    // Automatically log this site interception to history
    logHistory('Auto-Scanned');

    container.innerHTML = `
        <div class="parry-header">
            <h2 class="parry-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                PARRY AI
            </h2>
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="parry-badge ${badgeClass}">${response.verdict}</div>
                <button class="parry-close-btn" id="parry-modal-close" title="Close Notification">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
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

    // Top Right X Button Listener
    const modalCloseBtn = container.querySelector('#parry-modal-close');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            logHistory('Dismissed via X');
            if (isDangerous && document.body) {
                document.body.style.overflow = '';
            }
            closeParryUI();
        });
    }

    // Interception / Site History helper
    function logHistory(choice) {
        chrome.storage.local.get({ history: [] }, (result) => {
            const hist = result.history;
            hist.unshift({
                domain: window.location.hostname || "current-site",
                verdict: response.verdict,
                choice: choice,
                timestamp: new Date().toISOString()
            });
            // Keep last 60 items
            if (hist.length > 60) hist.pop();
            chrome.storage.local.set({ history: hist });
        });
    }

    // Chat History helper
    function saveChatEntry(sender, text, domain) {
        chrome.storage.local.get({ chatHistory: [] }, (result) => {
            const chats = result.chatHistory;
            chats.unshift({
                sender: sender,
                text: text,
                domain: domain || window.location.hostname,
                timestamp: new Date().toISOString()
            });
            if (chats.length > 100) chats.pop();
            chrome.storage.local.set({ chatHistory: chats });
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
                
                // Fetch storage state
                chrome.storage.local.get({ 
                    history: [], 
                    chatHistory: [],
                    neverShowSafe: false,
                    interceptHttps: true,
                    notifyHttps: true
                }, (stored) => {
                    renderSidebarContent(stored);
                });
            } else {
                sidebar.classList.add('show');
            }
        });
    }

    function renderSidebarContent(stored) {
        // Suggested questions from API response or fallbacks
        const suggestedList = (response.suggested_questions && response.suggested_questions.length > 0)
            ? response.suggested_questions
            : [
                `What is ${window.location.hostname} used for?`,
                `What kind of usage does ${window.location.hostname} have?`,
                `Is it safe to log in or share details here?`
            ];

        sidebar.innerHTML = `
            <div class="parry-sidebar-header">
                <h2 class="parry-sidebar-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    AI Analysis
                </h2>
                <button class="parry-sidebar-close" id="parry-sidebar-close" title="Close Sidebar">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            
            <div class="parry-sidebar-tabs">
                <div class="parry-tab active" id="tab-chat">CHAT</div>
                <div class="parry-tab" id="tab-history">HISTORY</div>
                <div class="parry-tab" id="tab-settings">SETTINGS</div>
            </div>
            
            <!-- CHAT VIEW -->
            <div class="parry-sidebar-view active" id="view-chat">
                <div class="parry-chat-area" id="parry-chat-area">
                    <div class="parry-chat-bubble ai">
                        <strong>Parry AI:</strong><br><br>
                        ${response.why_explainer}<br><br>
                        <em>How can I assist you with this site?</em>
                    </div>
                </div>

                <div class="parry-suggested-section" id="parry-suggested-section">
                    <div class="parry-suggested-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        SUGGESTED QUESTIONS (BY AI)
                    </div>
                    <div class="parry-questions-list" id="parry-questions-list">
                        ${suggestedList.map(q => `<button class="parry-question-pill">${q}</button>`).join('')}
                    </div>
                </div>
            </div>
            
            <!-- HISTORY VIEW -->
            <div class="parry-sidebar-view" id="view-history">
                <div class="parry-subtabs">
                    <button class="parry-subtab active" id="subtab-sites">INTERCEPTED SITES</button>
                    <button class="parry-subtab" id="subtab-chats">CHAT LOGS</button>
                </div>
                <div class="parry-history-list" id="history-content-area">
                    <!-- Populated dynamically -->
                </div>
            </div>

            <!-- SETTINGS VIEW -->
            <div class="parry-sidebar-view" id="view-settings">
                <div class="parry-settings-group">
                    <div class="parry-setting-card">
                        <div class="parry-setting-info">
                            <div class="parry-setting-title">Intercept Dangerous HTTPS</div>
                            <div class="parry-setting-desc">Block and show high-priority security shield when visiting malicious/suspicious HTTPS sites.</div>
                        </div>
                        <label class="parry-switch">
                            <input type="checkbox" id="setting-intercept-https" ${stored.interceptHttps ? 'checked' : ''}>
                            <span class="parry-slider"></span>
                        </label>
                    </div>

                    <div class="parry-setting-card">
                        <div class="parry-setting-info">
                            <div class="parry-setting-title">Notify On HTTPS Sites</div>
                            <div class="parry-setting-desc">Show Parry AI analysis toasts whenever browsing secure (HTTPS) pages.</div>
                        </div>
                        <label class="parry-switch">
                            <input type="checkbox" id="setting-notify-https" ${stored.notifyHttps ? 'checked' : ''}>
                            <span class="parry-slider"></span>
                        </label>
                    </div>

                    <div class="parry-setting-card">
                        <div class="parry-setting-info">
                            <div class="parry-setting-title">Silence Safe Verified Sites</div>
                            <div class="parry-setting-desc">Don't show the initial popup on domains that are confirmed 100% safe.</div>
                        </div>
                        <label class="parry-switch">
                            <input type="checkbox" id="setting-silence-safe" ${stored.neverShowSafe ? 'checked' : ''}>
                            <span class="parry-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="parry-chat-input-container" id="chat-input-container">
                <input type="text" class="parry-chat-input" id="parry-chat-input" placeholder="Ask Parry AI about this site...">
                <button class="parry-chat-send" id="parry-chat-send">SEND</button>
            </div>
        `;
        
        injectWhenReady(sidebar, () => {
            sidebar.querySelector('#parry-sidebar-close').addEventListener('click', () => {
                sidebar.classList.remove('show');
            });
            
            const tabChat = sidebar.querySelector('#tab-chat');
            const tabHistory = sidebar.querySelector('#tab-history');
            const tabSettings = sidebar.querySelector('#tab-settings');
            const viewChat = sidebar.querySelector('#view-chat');
            const viewHistory = sidebar.querySelector('#view-history');
            const viewSettings = sidebar.querySelector('#view-settings');
            const chatInputContainer = sidebar.querySelector('#chat-input-container');

            function switchMainTab(activeTab, activeView, showInput) {
                [tabChat, tabHistory, tabSettings].forEach(t => t.classList.remove('active'));
                [viewChat, viewHistory, viewSettings].forEach(v => v.classList.remove('active'));
                activeTab.classList.add('active');
                activeView.classList.add('active');
                chatInputContainer.style.display = showInput ? 'flex' : 'none';
            }
        
            tabChat.addEventListener('click', () => switchMainTab(tabChat, viewChat, true));
            tabHistory.addEventListener('click', () => {
                switchMainTab(tabHistory, viewHistory, false);
                loadHistoryView('sites');
            });
            tabSettings.addEventListener('click', () => switchMainTab(tabSettings, viewSettings, false));

            // Sub-tabs in History View
            const subtabSites = sidebar.querySelector('#subtab-sites');
            const subtabChats = sidebar.querySelector('#subtab-chats');
            const historyContentArea = sidebar.querySelector('#history-content-area');

            function loadHistoryView(mode) {
                chrome.storage.local.get({ history: [], chatHistory: [] }, (res) => {
                    if (mode === 'sites') {
                        subtabSites.classList.add('active');
                        subtabChats.classList.remove('active');
                        if (res.history.length === 0) {
                            historyContentArea.innerHTML = '<div class="parry-history-item safe">No intercepted sites recorded yet.</div>';
                        } else {
                            historyContentArea.innerHTML = res.history.map(item => `
                                <div class="parry-history-item ${item.verdict}">
                                    <div class="parry-history-domain">${item.domain}</div>
                                    <div class="parry-history-choice">Verdict: <strong>${item.verdict}</strong> | Action: ${item.choice}</div>
                                    <div style="font-size:11px; color:#94a3b8; margin-top:4px;">${new Date(item.timestamp).toLocaleTimeString()}</div>
                                </div>
                            `).join('');
                        }
                    } else {
                        subtabChats.classList.add('active');
                        subtabSites.classList.remove('active');
                        if (res.chatHistory.length === 0) {
                            historyContentArea.innerHTML = '<div class="parry-history-item safe">No chat history recorded yet.</div>';
                        } else {
                            historyContentArea.innerHTML = res.chatHistory.map(chat => `
                                <div class="parry-history-item ${chat.sender === 'You' ? 'safe' : 'suspicious'}">
                                    <div class="parry-history-domain" style="font-size:12px; color:#00f0ff;">${chat.domain} &bull; ${chat.sender}</div>
                                    <div class="parry-history-choice" style="color:#ffffff; margin-top:4px;">${chat.text}</div>
                                    <div style="font-size:11px; color:#94a3b8; margin-top:4px;">${new Date(chat.timestamp).toLocaleTimeString()}</div>
                                </div>
                            `).join('');
                        }
                    }
                });
            }

            subtabSites.addEventListener('click', () => loadHistoryView('sites'));
            subtabChats.addEventListener('click', () => loadHistoryView('chats'));

            // Settings Checkbox listeners
            const settingIntercept = sidebar.querySelector('#setting-intercept-https');
            const settingNotify = sidebar.querySelector('#setting-notify-https');
            const settingSilence = sidebar.querySelector('#setting-silence-safe');

            settingIntercept.addEventListener('change', () => {
                chrome.storage.local.set({ interceptHttps: settingIntercept.checked });
            });
            settingNotify.addEventListener('change', () => {
                chrome.storage.local.set({ notifyHttps: settingNotify.checked });
            });
            settingSilence.addEventListener('change', () => {
                chrome.storage.local.set({ neverShowSafe: settingSilence.checked });
            });
        
            const sendBtn = sidebar.querySelector('#parry-chat-send');
            const chatInput = sidebar.querySelector('#parry-chat-input');
            const chatArea = sidebar.querySelector('#parry-chat-area');
            
            const submitQuestion = (queryText) => {
                const text = (queryText || chatInput.value).trim();
                if (!text) return;
                
                const userMsg = document.createElement('div');
                userMsg.className = 'parry-chat-bubble user';
                userMsg.innerHTML = `<strong>You:</strong><br><br>${text}`;
                chatArea.appendChild(userMsg);
                chatInput.value = '';
                chatArea.scrollTop = chatArea.scrollHeight;

                saveChatEntry('You', text, window.location.hostname);
                
                const typingMsg = document.createElement('div');
                typingMsg.className = 'parry-chat-bubble ai';
                typingMsg.innerHTML = `<strong>Parry AI:</strong><br><br><em>Analyzing...</em>`;
                chatArea.appendChild(typingMsg);
                chatArea.scrollTop = chatArea.scrollHeight;
                
                chrome.runtime.sendMessage({
                    action: "chat_ai", 
                    text: text, 
                    domain: window.location.hostname
                }, (chatResponse) => {
                    const aiReply = (chatResponse && chatResponse.reply) 
                        ? chatResponse.reply 
                        : "Sorry, I couldn't connect to the Parry AI server to answer your question.";
                    typingMsg.innerHTML = `<strong>Parry AI:</strong><br><br>${aiReply}`;
                    saveChatEntry('Parry AI', aiReply, window.location.hostname);
                    chatArea.scrollTop = chatArea.scrollHeight;
                });
            };

            // Hook up suggested question pills
            const questionPills = sidebar.querySelectorAll('.parry-question-pill');
            questionPills.forEach(pill => {
                pill.addEventListener('click', () => {
                    submitQuestion(pill.textContent);
                });
            });
            
            sendBtn.addEventListener('click', () => submitQuestion());
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submitQuestion();
            });
            
            // Show sidebar
            sidebar.offsetHeight;
            sidebar.classList.add('show');
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
            window.history.back();
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
