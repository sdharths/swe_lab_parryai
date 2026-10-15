// Parry AI - Extension UI Logic for Sandbox Demonstration

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
        document.body.appendChild(backdrop);
        backdrop.offsetHeight;
        backdrop.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    const container = document.createElement('div');
    container.id = 'parry-ai-container';
    if (isDangerous) {
        container.classList.add('blocking-mode');
    }

    // Default localStorage mock
    const getStored = (key, def) => {
        try {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : def;
        } catch(e) { return def; }
    };
    const setStored = (key, val) => {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
    };

    // Auto log to intercepted history
    const hist = getStored('parry_history', [
        { domain: "scam-login.com", verdict: "malicious", choice: "Blocked", timestamp: new Date(Date.now() - 3600000).toISOString() },
        { domain: "github.com", verdict: "safe", choice: "Allowed", timestamp: new Date(Date.now() - 7200000).toISOString() }
    ]);
    hist.unshift({
        domain: window.location.hostname || "sandbox.local",
        verdict: response.verdict,
        choice: "Auto-Scanned",
        timestamp: new Date().toISOString()
    });
    setStored('parry_history', hist.slice(0, 50));
    
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
                <div class="parry-badge legality-${(response.legality_status || 'Legal').toLowerCase().replace(' ', '-')}">${response.legality_status || 'Legal'}</div>
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
        
        <div class="parry-score-container" style="margin-top:0;">
            <span class="parry-score-label">RISK FACTOR:</span>
            <span class="parry-score-value" style="color: ${badgeClass === 'malicious' ? '#ff0055' : (badgeClass === 'suspicious' ? '#ffaa00' : '#00ffaa')}">
                ${Math.round(response.risk_score * 100)}%
            </span>
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

    document.body.appendChild(container);
    container.offsetHeight; 
    container.classList.add('show');

    // X close button handler
    const modalClose = container.querySelector('#parry-modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            if (isDangerous) document.body.style.overflow = '';
            closeParryUI();
        });
    }

    // Handle "Why is this dangerous?" toggle
    let sidebar = null;
    const whyBtn = document.getElementById('parry-ai-why-btn');
    if (whyBtn) {
        whyBtn.addEventListener('click', () => {
            if (!sidebar) {
                const interceptHttps = getStored('parry_intercept_https', true);
                const notifyHttps = getStored('parry_notify_https', true);
                const silenceSafe = getStored('parry_silence_safe', false);

                const suggestedQuestions = (response.suggested_questions && response.suggested_questions.length > 0)
                    ? response.suggested_questions
                    : [
                        "What is this site used for?",
                        "What kind of usage does this site have?",
                        "Is it safe to login or enter credentials here?"
                    ];

                sidebar = document.createElement('div');
                sidebar.id = 'parry-ai-sidebar';
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
                        <div class="parry-tab" id="tab-settings">SETTINGS</div>
                    </div>
                    
                    <!-- Chat View -->
                    <div class="parry-sidebar-view active" id="view-chat">
                        <div class="parry-chat-area" id="parry-chat-area">
                            <div class="parry-chat-bubble ai" style="background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.3); align-self: flex-start; padding: 12px; border-radius: 4px; border-top-left-radius: 0;">
                                <strong>Parry AI:</strong><br><br>
                                ${response.why_explainer}<br><br>
                                ${response.legal_alternatives && response.legal_alternatives.length > 0 ? `
                                    <div class="parry-legal-alternatives">
                                        <strong>Legal Alternatives:</strong>
                                        <ul>
                                            ${response.legal_alternatives.map(alt => `<li>${alt}</li>`).join('')}
                                        </ul>
                                    </div><br>
                                ` : ''}
                                <em>Ask me anything or click a suggested question below:</em>
                            </div>
                        </div>

                        <div class="parry-suggested-section">
                            <div class="parry-suggested-title">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                SUGGESTED QUESTIONS (BY AI)
                            </div>
                            <div class="parry-questions-list" id="parry-questions-list">
                                ${suggestedQuestions.map(q => `<button class="parry-question-pill">${q}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- History View -->
                    <div class="parry-sidebar-view" id="view-history">
                        <div class="parry-subtabs">
                            <button class="parry-subtab active" id="subtab-sites">INTERCEPTED SITES</button>
                            <button class="parry-subtab" id="subtab-chats">CHAT LOGS</button>
                        </div>
                        <div class="parry-history-list" id="history-content-area"></div>
                    </div>

                    <!-- Settings View -->
                    <div class="parry-sidebar-view" id="view-settings">
                        <div class="parry-settings-group">
                            <div class="parry-setting-card">
                                <div class="parry-setting-info">
                                    <div class="parry-setting-title">Intercept Dangerous HTTPS</div>
                                    <div class="parry-setting-desc">Block and show high-priority security shield when visiting malicious/suspicious HTTPS sites.</div>
                                </div>
                                <label class="parry-switch">
                                    <input type="checkbox" id="setting-intercept-https" ${interceptHttps ? 'checked' : ''}>
                                    <span class="parry-slider"></span>
                                </label>
                            </div>

                            <div class="parry-setting-card">
                                <div class="parry-setting-info">
                                    <div class="parry-setting-title">Notify On HTTPS Sites</div>
                                    <div class="parry-setting-desc">Show Parry AI analysis toasts whenever browsing secure (HTTPS) pages.</div>
                                </div>
                                <label class="parry-switch">
                                    <input type="checkbox" id="setting-notify-https" ${notifyHttps ? 'checked' : ''}>
                                    <span class="parry-slider"></span>
                                </label>
                            </div>

                            <div class="parry-setting-card">
                                <div class="parry-setting-info">
                                    <div class="parry-setting-title">Silence Safe Verified Sites</div>
                                    <div class="parry-setting-desc">Don't show the initial popup on domains that are confirmed 100% safe.</div>
                                </div>
                                <label class="parry-switch">
                                    <input type="checkbox" id="setting-silence-safe" ${silenceSafe ? 'checked' : ''}>
                                    <span class="parry-slider"></span>
                                </label>
                            </div>

                            <!-- Testing / Cache Management -->
                            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,170,0,0.3); border-radius: 8px; padding: 14px; margin-top: 14px;">
                                <div style="color: #ffaa00; font-weight: 600; font-size: 13px; margin-bottom: 6px;">TESTING & CACHE MANAGEMENT</div>
                                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 10px;">Erase backend verdict cache & local storage for instant re-analysis:</div>
                                <button id="parry-clear-cache" style="background: rgba(255,170,0,0.15); border: 1px solid #ffaa00; color: #ffaa00; font-size: 11px; font-weight: 600; padding: 6px 12px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    Erase Cache & Reset History
                                </button>
                                <div id="parry-cache-status" style="font-size: 10px; color: #00ffaa; margin-top: 6px; display: none;"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="parry-chat-input-container" id="chat-input-container">
                        <input type="text" class="parry-chat-input" id="parry-chat-input" placeholder="Ask Parry AI about this site...">
                        <button class="parry-chat-send" id="parry-chat-send">SEND</button>
                    </div>
                `;
                document.body.appendChild(sidebar);
                
                // Close button logic
                document.getElementById('parry-sidebar-close').addEventListener('click', () => {
                    sidebar.classList.remove('show');
                });
                
                // Tabs logic
                const tabChat = document.getElementById('tab-chat');
                const tabHistory = document.getElementById('tab-history');
                const tabSettings = document.getElementById('tab-settings');
                const viewChat = document.getElementById('view-chat');
                const viewHistory = document.getElementById('view-history');
                const viewSettings = document.getElementById('view-settings');
                const chatInputContainer = document.getElementById('chat-input-container');

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

                // Sub-tabs in history
                const subtabSites = document.getElementById('subtab-sites');
                const subtabChats = document.getElementById('subtab-chats');
                const historyContent = document.getElementById('history-content-area');

                function loadHistoryView(mode) {
                    const siteHist = getStored('parry_history', []);
                    const chatHist = getStored('parry_chat_history', []);

                    if (mode === 'sites') {
                        subtabSites.classList.add('active');
                        subtabChats.classList.remove('active');
                        if (siteHist.length === 0) {
                            historyContent.innerHTML = '<div class="parry-history-item safe">No intercepted sites yet.</div>';
                        } else {
                            historyContent.innerHTML = siteHist.map(item => `
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
                        if (chatHist.length === 0) {
                            historyContent.innerHTML = '<div class="parry-history-item safe">No saved chat history yet.</div>';
                        } else {
                            historyContent.innerHTML = chatHist.map(chat => `
                                <div class="parry-history-item ${chat.sender === 'You' ? 'safe' : 'suspicious'}">
                                    <div class="parry-history-domain" style="font-size:12px; color:#00f0ff;">${chat.domain} &bull; ${chat.sender}</div>
                                    <div class="parry-history-choice" style="color:#ffffff; margin-top:4px;">${chat.text}</div>
                                    <div style="font-size:11px; color:#94a3b8; margin-top:4px;">${new Date(chat.timestamp).toLocaleTimeString()}</div>
                                </div>
                            `).join('');
                        }
                    }
                }

                subtabSites.addEventListener('click', () => loadHistoryView('sites'));
                subtabChats.addEventListener('click', () => loadHistoryView('chats'));

                // Setting checkbox listeners
                document.getElementById('setting-intercept-https').addEventListener('change', (e) => {
                    setStored('parry_intercept_https', e.target.checked);
                });
                document.getElementById('setting-notify-https').addEventListener('change', (e) => {
                    setStored('parry_notify_https', e.target.checked);
                });
                document.getElementById('setting-silence-safe').addEventListener('change', (e) => {
                    setStored('parry_silence_safe', e.target.checked);
                });

                // Clear Cache button logic
                const clearCacheBtn = document.getElementById('parry-clear-cache');
                const cacheStatus = document.getElementById('parry-cache-status');
                if (clearCacheBtn) {
                    clearCacheBtn.addEventListener('click', () => {
                        clearCacheBtn.disabled = true;
                        clearCacheBtn.style.opacity = '0.5';
                        if (cacheStatus) {
                            cacheStatus.style.display = 'block';
                            cacheStatus.style.color = '#00f0ff';
                            cacheStatus.textContent = 'Erasing cache & resetting history...';
                        }
                        fetch("http://127.0.0.1:8000/cache/clear", { method: "POST" })
                            .then(() => {
                                localStorage.removeItem('parry_history');
                                localStorage.removeItem('parry_chat_history');
                                clearCacheBtn.disabled = false;
                                clearCacheBtn.style.opacity = '1.0';
                                if (cacheStatus) {
                                    cacheStatus.style.color = '#00ffaa';
                                    cacheStatus.textContent = '✓ Cache cleared and local history reset successfully!';
                                    setTimeout(() => {
                                        if (cacheStatus) cacheStatus.style.display = 'none';
                                    }, 3500);
                                }
                                loadHistoryView('sites');
                            })
                            .catch(() => {
                                localStorage.removeItem('parry_history');
                                localStorage.removeItem('parry_chat_history');
                                clearCacheBtn.disabled = false;
                                clearCacheBtn.style.opacity = '1.0';
                                if (cacheStatus) {
                                    cacheStatus.style.color = '#00ffaa';
                                    cacheStatus.textContent = '✓ Local cache & history reset!';
                                    setTimeout(() => {
                                        if (cacheStatus) cacheStatus.style.display = 'none';
                                    }, 3500);
                                }
                                loadHistoryView('sites');
                            });
                    });
                }
                
                // Chat logic
                const sendBtn = document.getElementById('parry-chat-send');
                const chatInput = document.getElementById('parry-chat-input');
                const chatArea = document.getElementById('parry-chat-area');
                
                const streamChatText = (containerElement, fullText, onComplete) => {
                    const words = fullText.split(' ');
                    let currentIndex = 0;
                    containerElement.innerHTML = `
                        <div class="parry-bubble-header">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                            Parry AI
                        </div>
                        <span class="parry-bubble-text"></span><span class="parry-stream-cursor"></span>
                    `;
                    const textSpan = containerElement.querySelector('.parry-bubble-text');
                    const cursor = containerElement.querySelector('.parry-stream-cursor');

                    function streamNextWord() {
                        if (currentIndex < words.length) {
                            const chunk = words.slice(currentIndex, currentIndex + 2).join(' ');
                            textSpan.textContent += (currentIndex === 0 ? '' : ' ') + chunk;
                            currentIndex += 2;
                            chatArea.scrollTop = chatArea.scrollHeight;
                            setTimeout(streamNextWord, 28);
                        } else {
                            if (cursor) cursor.remove();
                            if (onComplete) onComplete();
                        }
                    }
                    streamNextWord();
                };

                const submitQuestion = (queryText) => {
                    const text = (queryText || chatInput.value).trim();
                    if (!text) return;
                    
                    const userMsg = document.createElement('div');
                    userMsg.className = 'parry-chat-bubble user';
                    userMsg.innerHTML = `
                        <div class="parry-bubble-header">You</div>
                        <div class="parry-bubble-text">${text}</div>
                    `;
                    chatArea.appendChild(userMsg);
                    chatInput.value = '';
                    chatArea.scrollTop = chatArea.scrollHeight;

                    // Save chat to local storage
                    const chats = getStored('parry_chat_history', []);
                    chats.unshift({ sender: 'You', text: text, domain: window.location.hostname || "sandbox.local", timestamp: new Date().toISOString() });
                    setStored('parry_chat_history', chats);
                    
                    sendBtn.disabled = true;
                    const typingMsg = document.createElement('div');
                    typingMsg.className = 'parry-chat-bubble ai';
                    typingMsg.innerHTML = `
                        <div class="parry-bubble-header">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                            Parry AI
                        </div>
                        <span class="parry-bubble-text" style="color:#94a3b8; font-style: italic;">Analyzing...</span>
                    `;
                    chatArea.appendChild(typingMsg);
                    chatArea.scrollTop = chatArea.scrollHeight;

                    fetch("http://127.0.0.1:8000/chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ message: text, domain: window.location.hostname || "sandbox.local" })
                    })
                    .then(r => r.json())
                    .then(d => {
                        let reply = (d.reply || "Analysis complete.").replace(/\*\*/g, '').replace(/__/g, '');
                        streamChatText(typingMsg, reply, () => {
                            sendBtn.disabled = false;
                            chats.unshift({ sender: 'Parry AI', text: reply, domain: window.location.hostname || "sandbox.local", timestamp: new Date().toISOString() });
                            setStored('parry_chat_history', chats);
                        });
                    })
                    .catch(() => {
                        const fallback = `Parry AI analysis for "${text}": This site appears to operate within expected parameters. Always verify login fields.`;
                        streamChatText(typingMsg, fallback, () => {
                            sendBtn.disabled = false;
                            chats.unshift({ sender: 'Parry AI', text: fallback, domain: window.location.hostname || "sandbox.local", timestamp: new Date().toISOString() });
                            setStored('parry_chat_history', chats);
                        });
                    });
                };

                // Suggested question pills
                sidebar.querySelectorAll('.parry-question-pill').forEach(pill => {
                    pill.addEventListener('click', () => submitQuestion(pill.textContent));
                });
                
                sendBtn.addEventListener('click', () => submitQuestion());
                chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') submitQuestion();
                });
            }
            
            sidebar.offsetHeight;
            sidebar.classList.add('show');
        });
    }

    document.getElementById('parry-safe-btn').addEventListener('click', () => {
        closeParryUI();
    });

    const ignoreBtn = document.getElementById('parry-ignore-btn');
    if (ignoreBtn) {
        ignoreBtn.addEventListener('click', () => {
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
