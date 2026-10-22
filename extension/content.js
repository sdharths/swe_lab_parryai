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

const CURRENT_DOMAIN = window.location.hostname || "unknown";

// Initialize Privacy Radar, Download Guard, and Google SERP badging
initPrivacyRadar();
initDownloadGuard();
initGoogleSerpBadging();

// 2. Ask Background for Analysis (Checking Custom Whitelist first)
chrome.storage.local.get({ whitelist: [] }, (stored) => {
    const whitelist = stored.whitelist || [];
    if (whitelist.includes(CURRENT_DOMAIN)) {
        console.log(`[Parry AI] ${CURRENT_DOMAIN} is on your Custom Whitelist. Skipping interception.`);
        return;
    }

    const privacyStats = window._parryPrivacyStats || { trackers: 0, thirdPartyScripts: 0, forms: 0, risk: "Low" };
    chrome.runtime.sendMessage({
        action: "analyze_url",
        url: window.location.href,
        trackers_count: privacyStats.trackers || 0,
        third_party_scripts_count: privacyStats.thirdPartyScripts || 0,
        has_input_forms: (privacyStats.forms || 0) > 0
    }, (response) => {
        if (response && response.data) {
            checkSettingsAndRender(response.data);
        }
    });
});

function checkSettingsAndRender(apiResponse) {
    chrome.storage.local.get({
        neverShowSafe: false,
        interceptHttps: true,
        notifyHttps: true,
        compactMiniPopup: false
    }, (settings) => {
        const isHttps = window.location.protocol === 'https:';

        // Check user setting toggle for HTTPS intercept / block
        if (isHttps && !settings.interceptHttps) {
            const isDangerous = (apiResponse.verdict === 'malicious' || apiResponse.verdict === 'suspicious');
            if (isDangerous) {
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

        // If user opted into Compact Mini Popup and site is NOT malicious (or user configured mini mode)
        const isDangerous = (apiResponse.verdict === 'malicious');
        if (settings.compactMiniPopup && !isDangerous) {
            renderMiniParryPill(apiResponse);
        } else {
            renderParryAIToast(apiResponse);
        }
    });
}

function calculateThreatTheme(verdict, legality) {
    const v = (verdict || "").toLowerCase();
    const l = (legality || "").toLowerCase();

    if (v === "malicious" || l === "illegal") {
        return "threat-theme-high";
    }
    if (v === "suspicious" || l.includes("gray")) {
        return "threat-theme-medium";
    }
    return "threat-theme-low";
}

function renderMiniParryPill(response) {
    if (document.getElementById('parry-ai-mini-container') || document.getElementById('parry-ai-container')) return;

    const mini = document.createElement('div');
    mini.id = 'parry-ai-mini-container';

    let badgeClass = "safe";
    if (response.verdict === "malicious") badgeClass = "malicious";
    else if (response.verdict === "suspicious") badgeClass = "suspicious";

    const privGrade = response.privacy_grade || "A";
    const legality = response.legality_status || "Legal";

    mini.innerHTML = `
        <div class="parry-mini-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            PARRY
        </div>
        <div class="parry-mini-badges">
            <span class="parry-mini-badge ${badgeClass}">${response.verdict}</span>
            <span class="parry-mini-badge legality-${legality.toLowerCase().replace(' ', '-')}">${legality}</span>
            <span class="parry-mini-badge privacy-${privGrade.toLowerCase()}">P-${privGrade}</span>
        </div>
        <button class="parry-mini-close" id="parry-mini-close" title="Dismiss">&times;</button>
    `;

    injectWhenReady(mini, () => {
        mini.offsetHeight;
        mini.classList.add('show');
    });

    const closeBtn = mini.querySelector('#parry-mini-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mini.classList.remove('show');
            setTimeout(() => mini.remove(), 250);
        });
    }

    // Clicking anywhere else on the pill expands into the full toast & dashboard
    mini.addEventListener('click', () => {
        mini.classList.remove('show');
        setTimeout(() => {
            mini.remove();
            renderParryAIToast(response);
        }, 200);
    });
}

function renderParryAIToast(response) {
    if (document.getElementById('parry-ai-container')) return;

    const isDangerous = (response.verdict === "malicious" || response.verdict === "suspicious");

    let badgeClass = "safe";
    if (response.verdict === "malicious") badgeClass = "malicious";
    else if (response.verdict === "suspicious") badgeClass = "suspicious";

    const threatThemeClass = calculateThreatTheme(response.verdict, response.legality_status);

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
    container.classList.add(threatThemeClass);
    if (isDangerous) container.classList.add('blocking-mode');
    
    // Automatically log this site interception to history and recap stats
    logHistory('Auto-Scanned');

    // Extract privacy stats
    const privacyStats = window._parryPrivacyStats || { trackers: 0, thirdPartyScripts: 0, forms: 0, risk: "Low" };

    // Format legal alternatives pills
    const legalAlts = response.legal_alternatives || [];
    const legalAltsHtml = legalAlts.length > 0 ? `
        <div style="margin-top: 14px; text-align: left;">
            <div style="font-size: 11px; font-weight: 700; color: #00f0ff; letter-spacing: 0.5px; text-transform: uppercase;">
                🛡️ Verified Legal Alternatives:
            </div>
            <div class="parry-alt-pills">
                ${legalAlts.map(alt => {
                    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(alt)}`;
                    return `<a href="${searchUrl}" target="_blank" class="parry-alt-pill" title="Search for ${alt}">+ ${alt}</a>`;
                }).join('')}
            </div>
        </div>
    ` : '';

    container.innerHTML = `
        <div class="parry-header">
            <h2 class="parry-title">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                PARRY AI
            </h2>
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: nowrap;">
                <div class="parry-badge ${badgeClass}">${response.verdict}</div>
                <div class="parry-badge legality-${(response.legality_status || 'Legal').toLowerCase().replace(' ', '-')}">${response.legality_status || 'Legal'}</div>
                <div class="parry-badge privacy-${(response.privacy_grade || 'A').toLowerCase()}">P:${response.privacy_grade || 'A'}</div>
                <button class="parry-close-btn" id="parry-modal-close" title="Close Notification">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        </div>
        
        <div class="parry-body">
            ${isDangerous ? 'This site has been flagged as potentially dangerous. Access has been halted to protect your security.' : 'This site appears safe based on our current analysis.'}
        </div>
        
        <button class="parry-ai-btn" id="parry-ai-why-btn" style="margin-bottom: 12px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            ${isDangerous ? 'Why is this dangerous?' : 'Open Shield Dashboard & AI'}
        </button>
        
        <div class="parry-score-container" style="margin-top: 0;">
            <span class="parry-score-label">RISK FACTOR:</span>
            <span class="parry-score-value" style="color: ${badgeClass === 'malicious' ? '#ff0055' : (badgeClass === 'suspicious' ? '#ffaa00' : '#00ffaa')}">
                ${Math.round(response.risk_score * 100)}%
            </span>
        </div>

        <!-- Privacy & Exfiltration Radar Box -->
        <div class="parry-radar-card">
            <div class="parry-radar-header">
                <span>📡 PRIVACY GRADE: <strong style="color: #00f0ff;">${response.privacy_grade || 'A'}</strong> (${Math.round((response.privacy_score !== undefined ? response.privacy_score : 1.0) * 100)}%)</span>
                <span style="color: ${privacyStats.risk === 'High' ? '#ff0055' : (privacyStats.risk === 'Moderate' ? '#ffaa00' : '#00ffaa')}">${privacyStats.risk} Exfil Risk</span>
            </div>
            <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 8px;">
                ${response.privacy_details || 'Standard telemetry profile.'}
            </div>
            <div class="parry-radar-stats">
                <span class="parry-radar-chip">${privacyStats.trackers} Trackers</span>
                <span class="parry-radar-chip">${privacyStats.thirdPartyScripts} 3rd-Party Scripts</span>
                <span class="parry-radar-chip">${privacyStats.forms} Input Forms</span>
            </div>
        </div>

        ${legalAltsHtml}
        
        <div class="parry-feedback-container" style="margin-top: 14px;">
            <div style="display: flex; gap: 8px;">
                <button class="parry-whitelist-btn" id="parry-btn-whitelist" title="Whitelist domain">+ Whitelist Domain</button>
                <button class="parry-report-btn" id="parry-btn-report-fp" title="Report Incorrect Rating">⚠️ Report Rating</button>
            </div>
            <div style="display: flex; gap: 6px;">
                <button class="parry-feedback-btn" id="parry-feedback-up" title="Accurate">👍</button>
                <button class="parry-feedback-btn" id="parry-feedback-down" title="Inaccurate">👎</button>
            </div>
        </div>
        
        <div class="parry-footer" style="margin-top: 16px;">
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

        // Force-enable all buttons so host-page CSS can't override them
        container.querySelectorAll('button').forEach(btn => {
            btn.style.setProperty('pointer-events', 'all', 'important');
            btn.style.setProperty('cursor', 'pointer', 'important');
        });
    });

    // Top Right X Button Listener
    const modalCloseBtn = container.querySelector('#parry-modal-close');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            logHistory('Dismissed via X');
            if (isDangerous && document.body) {
                document.body.style.overflow = '';
            }
            closeParryUI();
        });
    }

    // Whitelist Domain Button
    const whitelistBtn = container.querySelector('#parry-btn-whitelist');
    if (whitelistBtn) {
        whitelistBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.storage.local.get({ whitelist: [] }, (res) => {
                const list = res.whitelist || [];
                if (!list.includes(CURRENT_DOMAIN)) {
                    list.push(CURRENT_DOMAIN);
                    chrome.storage.local.set({ whitelist: list }, () => {
                        whitelistBtn.textContent = '✓ Whitelisted';
                        whitelistBtn.style.color = '#00ffaa';
                        setTimeout(() => closeParryUI(), 1000);
                    });
                }
            });
        });
    }

    // False Positive Reporting Button
    const reportBtn = container.querySelector('#parry-btn-report-fp');
    if (reportBtn) {
        reportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const reason = prompt(`Report verdict error for ${CURRENT_DOMAIN}:\nWhy is this rating inaccurate? (Optional)`);
            if (reason !== null) {
                chrome.runtime.sendMessage({
                    action: "report_verdict",
                    url: window.location.href,
                    domain: CURRENT_DOMAIN,
                    verdict: response.verdict,
                    report_type: isDangerous ? "false_positive" : "false_negative",
                    user_comment: reason
                }, (resp) => {
                    reportBtn.textContent = "✓ Report Sent";
                    reportBtn.style.color = "#00ffaa";
                });
            }
        });
    }

    // Interception / Site History helper
    function logHistory(choice) {
        chrome.storage.local.get({ history: [], recapStats: { totalScanned: 0, threatsBlocked: 0, piracyFlagged: 0 } }, (result) => {
            const hist = result.history || [];
            hist.unshift({
                domain: CURRENT_DOMAIN,
                verdict: response.verdict,
                legality: response.legality_status || "Legal",
                choice: choice,
                timestamp: new Date().toISOString()
            });
            if (hist.length > 60) hist.pop();

            const stats = result.recapStats || { totalScanned: 0, threatsBlocked: 0, piracyFlagged: 0 };
            stats.totalScanned += 1;
            if (response.verdict === 'malicious' || response.verdict === 'suspicious') {
                stats.threatsBlocked += 1;
            }
            if ((response.legality_status || "").toLowerCase() === 'illegal' || (response.legality_status || "").toLowerCase().includes('gray')) {
                stats.piracyFlagged += 1;
            }

            chrome.storage.local.set({ history: hist, recapStats: stats });
        });
    }

    // Chat History helper
    function saveChatEntry(sender, text, domain) {
        chrome.storage.local.get({ chatHistory: [] }, (result) => {
            const chats = result.chatHistory || [];
            chats.unshift({
                sender: sender,
                text: text,
                domain: domain || CURRENT_DOMAIN,
                timestamp: new Date().toISOString()
            });
            if (chats.length > 100) chats.pop();
            chrome.storage.local.set({ chatHistory: chats });
        });
    }

    // Feedback logic
    const upBtn = container.querySelector('#parry-feedback-up');
    const downBtn = container.querySelector('#parry-feedback-down');
    
    function handleFeedback(isAccurate) {
        upBtn.classList.toggle('selected', isAccurate);
        downBtn.classList.toggle('selected', !isAccurate);
        
        chrome.storage.local.get({ userFeedback: [] }, (result) => {
            const feedbacks = result.userFeedback || [];
            const filtered = feedbacks.filter(f => f.domain !== CURRENT_DOMAIN);
            filtered.unshift({
                domain: CURRENT_DOMAIN,
                verdict: response.verdict,
                accurate: isAccurate,
                timestamp: new Date().toISOString()
            });
            if (filtered.length > 100) filtered.pop();
            chrome.storage.local.set({ userFeedback: filtered });
        });
    }
    
    if (upBtn && downBtn) {
        upBtn.addEventListener('click', (e) => { e.stopPropagation(); handleFeedback(true); });
        downBtn.addEventListener('click', (e) => { e.stopPropagation(); handleFeedback(false); });
    }

    // Sidebar Logic
    let sidebar = null;
    const whyBtn = container.querySelector('#parry-ai-why-btn');
    if (whyBtn) {
        whyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!sidebar) {
                sidebar = document.createElement('div');
                sidebar.id = 'parry-ai-sidebar';
                
                // Fetch storage state
                chrome.storage.local.get({ 
                    history: [], 
                    chatHistory: [],
                    neverShowSafe: false,
                    interceptHttps: true,
                    notifyHttps: true,
                    recapStats: { totalScanned: 0, threatsBlocked: 0, piracyFlagged: 0 },
                    whitelist: []
                }, (stored) => {
                    renderSidebarContent(stored);
                });
            } else {
                sidebar.classList.add('show');
            }
        });
    }

    function renderSidebarContent(stored) {
        const suggestedList = (response.suggested_questions && response.suggested_questions.length > 0)
            ? response.suggested_questions
            : [
                `What is ${CURRENT_DOMAIN} used for?`,
                `What kind of usage does ${CURRENT_DOMAIN} have?`,
                `Is it safe to log in or share details here?`
            ];

        const recap = stored.recapStats || { totalScanned: 1, threatsBlocked: 0, piracyFlagged: 0 };

        sidebar.innerHTML = `
            <div class="parry-sidebar-header">
                <h2 class="parry-sidebar-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    Parry AI Shield
                </h2>
                <button class="parry-sidebar-close" id="parry-sidebar-close" title="Close Sidebar">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            
            <div class="parry-sidebar-tabs">
                <div class="parry-tab active" id="tab-chat">CHAT & WHY</div>
                <div class="parry-tab" id="tab-recap">SAFETY RECAP</div>
                <div class="parry-tab" id="tab-history">HISTORY</div>
                <div class="parry-tab" id="tab-settings">SETTINGS</div>
            </div>
            
            <!-- CHAT VIEW -->
            <div class="parry-sidebar-view active" id="view-chat">
                <div class="parry-chat-area" id="parry-chat-area">
                    <div class="parry-chat-bubble ai" style="background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.3); align-self: flex-start; padding: 12px; border-radius: 4px; border-top-left-radius: 0;">
                        <strong>Parry AI Analysis:</strong><br><br>
                        ${response.why_explainer}<br><br>
                        ${response.legal_alternatives && response.legal_alternatives.length > 0 ? `
                            <div class="parry-legal-alternatives">
                                <strong>Vetted Legal Alternatives:</strong>
                                <ul>
                                    ${response.legal_alternatives.map(alt => `<li>${alt}</li>`).join('')}
                                </ul>
                            </div><br>
                        ` : ''}
                        <em>Ask me anything about ${CURRENT_DOMAIN}:</em>
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
            
            <!-- RECAP DASHBOARD VIEW -->
            <div class="parry-sidebar-view" id="view-recap">
                <div style="font-weight: 700; color: #00f0ff; margin-bottom: 12px; font-size: 14px; font-family: 'Orbitron', sans-serif;">
                    🛡️ WEEKLY SECURITY RECAP
                </div>
                <div class="parry-recap-grid">
                    <div class="parry-recap-box">
                        <div class="parry-recap-num">${recap.totalScanned || 0}</div>
                        <div class="parry-recap-label">Sites Scanned</div>
                    </div>
                    <div class="parry-recap-box">
                        <div class="parry-recap-num" style="color: #ff0055;">${recap.threatsBlocked || 0}</div>
                        <div class="parry-recap-label">Threats Blocked</div>
                    </div>
                    <div class="parry-recap-box">
                        <div class="parry-recap-num" style="color: #ffaa00;">${recap.piracyFlagged || 0}</div>
                        <div class="parry-recap-label">Piracy / Gray Area</div>
                    </div>
                </div>

                <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(0,240,255,0.2); border-radius: 8px; padding: 14px; font-size: 12px; line-height: 1.6;">
                    <div style="color: #00f0ff; font-weight: 600; margin-bottom: 4px;">CURRENT SESSION RADAR</div>
                    <div>Domain: <strong>${CURRENT_DOMAIN}</strong></div>
                    <div>Safe Browsing: <strong>${response.risk_matrix?.safe_browsing || 'clean'}</strong></div>
                    <div>TLS / Certificate: <strong>${response.risk_matrix?.tls_valid ? 'Valid SSL' : 'Invalid / Missing'}</strong></div>
                    <div>Legality: <strong>${response.legality_status || 'Legal'}</strong></div>
                </div>
            </div>

            <!-- HISTORY VIEW -->
            <div class="parry-sidebar-view" id="view-history">
                <div class="parry-subtabs">
                    <button class="parry-subtab active" id="subtab-sites">INTERCEPTED SITES</button>
                    <button class="parry-subtab" id="subtab-chats">CHAT LOGS</button>
                </div>
                <div class="parry-history-list" id="history-content-area"></div>
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

                    <div class="parry-setting-card">
                        <div class="parry-setting-info">
                            <div class="parry-setting-title">Compact Mini Popup Mode</div>
                            <div class="parry-setting-desc">Display a small, unobtrusive floating pill in the corner. Clicking it expands into the full dashboard & chatbot.</div>
                        </div>
                        <label class="parry-switch">
                            <input type="checkbox" id="setting-compact-mini" ${stored.compactMiniPopup ? 'checked' : ''}>
                            <span class="parry-slider"></span>
                        </label>
                    </div>

                    <!-- Faculty Heuristic Formula Reference Card -->
                    <div class="parry-formula-card">
                        <div class="parry-formula-title">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            ACADEMIC HEURISTIC EVALUATION FORMULA
                        </div>
                        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">
                            Multi-source weighted threat risk score formulation:
                        </div>
                        <div class="parry-formula-box">
Score = clamp[0.0, 1.0](
  + 0.40 &times; 𝕀(Typosquatting)
  + 0.50 &times; 𝕀(Homoglyphs/IDN)
  + 0.80 &times; 𝕀(GoogleSafeBrowsing == Malicious)
  + 0.30 &times; 𝕀(Trustpilot == Bad)
  - 0.20 &times; 𝕀(Trustpilot == Good)
  + 0.20 &times; 𝕀(TLS_Valid == False)
)
                        </div>
                        <div class="parry-formula-box" style="color: #4ade80; border-color: rgba(0,255,170,0.4);">
Privacy = clamp[0.0, 1.0](
  1.0 - (0.15 &times; N_trackers) - (0.04 &times; N_3rdPartyScripts)
      - (0.20 &times; 𝕀(HasCredentials & N_trackers &ge; 3))
)
                        </div>
                        <div class="parry-formula-breakdown">
                            <div><span class="parry-formula-tag parry-tag-heur">Heuristics</span> Levenshtein string distance & Unicode homoglyphs</div>
                            <div><span class="parry-formula-tag parry-tag-sensor">Sensor Fusion</span> Google Safe Browsing v4 + SerpApi Trustpilot + TLS Handshake</div>
                            <div><span class="parry-formula-tag parry-tag-privacy">Privacy</span> Telemetry tracking ratio, credential exposure, and telemetry density</div>
                            <div style="margin-top: 4px; color: #cbd5e1;">Thresholds: <strong>&ge;0.70</strong> Malicious | <strong>&ge;0.40</strong> Suspicious | <strong>&le;0.20</strong> Safe</div>
                        </div>
                    </div>

                    <!-- Whitelist Manager -->
                    <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(0,240,255,0.2); border-radius: 8px; padding: 14px; margin-top: 14px;">
                        <div style="color: #00f0ff; font-weight: 600; font-size: 13px; margin-bottom: 6px;">CUSTOM WHITELIST</div>
                        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 10px;">Domains that Parry AI will never intercept:</div>
                        <div id="parry-whitelist-tags" style="display: flex; flex-wrap: wrap; gap: 6px;">
                            ${(stored.whitelist && stored.whitelist.length > 0) 
                                ? stored.whitelist.map(d => `<span class="parry-radar-chip" style="color:#00ffaa;">${d}</span>`).join('') 
                                : '<span style="color:#64748b; font-size:11px;">No domains whitelisted yet.</span>'}
                        </div>
                        <button id="parry-clear-whitelist" style="margin-top: 10px; background: transparent; border: 1px solid #ff0055; color: #ff0055; font-size: 11px; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                            Clear Whitelist
                        </button>
                    </div>

                    <!-- Cache & Testing Manager -->
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
        
        injectWhenReady(sidebar, () => {
            // Force-enable all buttons in the sidebar
            sidebar.querySelectorAll('button').forEach(btn => {
                btn.style.setProperty('pointer-events', 'all', 'important');
                btn.style.setProperty('cursor', 'pointer', 'important');
            });

            sidebar.querySelector('#parry-sidebar-close').addEventListener('click', (e) => {
                e.stopPropagation();
                sidebar.classList.remove('show');
            });
            
            const tabChat = sidebar.querySelector('#tab-chat');
            const tabRecap = sidebar.querySelector('#tab-recap');
            const tabHistory = sidebar.querySelector('#tab-history');
            const tabSettings = sidebar.querySelector('#tab-settings');

            const viewChat = sidebar.querySelector('#view-chat');
            const viewRecap = sidebar.querySelector('#view-recap');
            const viewHistory = sidebar.querySelector('#view-history');
            const viewSettings = sidebar.querySelector('#view-settings');
            const chatInputContainer = sidebar.querySelector('#chat-input-container');

            function switchMainTab(activeTab, activeView, showInput) {
                [tabChat, tabRecap, tabHistory, tabSettings].forEach(t => t.classList.remove('active'));
                [viewChat, viewRecap, viewHistory, viewSettings].forEach(v => v.classList.remove('active'));
                activeTab.classList.add('active');
                activeView.classList.add('active');
                chatInputContainer.style.display = showInput ? 'flex' : 'none';
            }
        
            tabChat.addEventListener('click', () => switchMainTab(tabChat, viewChat, true));
            tabRecap.addEventListener('click', () => switchMainTab(tabRecap, viewRecap, false));
            tabHistory.addEventListener('click', () => {
                switchMainTab(tabHistory, viewHistory, false);
                loadHistoryView('sites');
            });
            tabSettings.addEventListener('click', () => switchMainTab(tabSettings, viewSettings, false));

            // Whitelist clear listener
            const clearWhitelistBtn = sidebar.querySelector('#parry-clear-whitelist');
            if (clearWhitelistBtn) {
                clearWhitelistBtn.addEventListener('click', () => {
                    chrome.storage.local.set({ whitelist: [] }, () => {
                        const tagsContainer = sidebar.querySelector('#parry-whitelist-tags');
                        if (tagsContainer) tagsContainer.innerHTML = '<span style="color:#64748b; font-size:11px;">No domains whitelisted yet.</span>';
                    });
                });
            }

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
                                    <div class="parry-history-choice">Verdict: <strong>${item.verdict}</strong> (${item.legality || 'Legal'}) | Action: ${item.choice}</div>
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

            const settingCompactMini = sidebar.querySelector('#setting-compact-mini');
            if (settingCompactMini) {
                settingCompactMini.addEventListener('change', () => {
                    chrome.storage.local.set({ compactMiniPopup: settingCompactMini.checked });
                });
            }

            // Erase Cache listener
            const clearCacheBtn = sidebar.querySelector('#parry-clear-cache');
            const cacheStatus = sidebar.querySelector('#parry-cache-status');
            if (clearCacheBtn) {
                clearCacheBtn.addEventListener('click', () => {
                    clearCacheBtn.disabled = true;
                    clearCacheBtn.style.opacity = '0.5';
                    if (cacheStatus) {
                        cacheStatus.style.display = 'block';
                        cacheStatus.style.color = '#00f0ff';
                        cacheStatus.textContent = 'Erasing cache & resetting history...';
                    }

                    chrome.runtime.sendMessage({ action: "clear_cache" }, (res) => {
                        chrome.storage.local.set({ history: [], chatHistory: [] }, () => {
                            clearCacheBtn.disabled = false;
                            clearCacheBtn.style.opacity = '1.0';
                            if (cacheStatus) {
                                cacheStatus.style.color = '#00ffaa';
                                cacheStatus.textContent = '✓ Cache cleared and local history reset successfully!';
                                setTimeout(() => {
                                    if (cacheStatus) cacheStatus.style.display = 'none';
                                }, 3500);
                            }
                            // Refresh history view if visible
                            loadHistoryView('sites');
                        });
                    });
                });
            }
        
            const sendBtn = sidebar.querySelector('#parry-chat-send');
            const chatInput = sidebar.querySelector('#parry-chat-input');
            const chatArea = sidebar.querySelector('#parry-chat-area');
            
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
                        // Append 1-2 words per frame for an organic, responsive flow
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

                saveChatEntry('You', text, CURRENT_DOMAIN);
                
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
                
                chrome.runtime.sendMessage({
                    action: "chat_ai", 
                    text: text, 
                    domain: CURRENT_DOMAIN
                }, (chatResponse) => {
                    let aiReply = (chatResponse && chatResponse.reply) 
                        ? chatResponse.reply 
                        : "Sorry, I couldn't connect to the Parry AI server to answer your question.";
                    aiReply = aiReply.replace(/\*\*/g, '').replace(/__/g, '');

                    streamChatText(typingMsg, aiReply, () => {
                        sendBtn.disabled = false;
                        saveChatEntry('Parry AI', aiReply, CURRENT_DOMAIN);
                    });
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
            
            sidebar.offsetHeight;
            sidebar.classList.add('show');
        });
    }

    container.querySelector('#parry-safe-btn').addEventListener('click', (e) => {
        e.stopPropagation();
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
        ignoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
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

// 3. Privacy & Exfiltration Radar Detection
function initPrivacyRadar() {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    let thirdPartyScripts = 0;
    let trackers = 0;

    const knownTrackers = ["google-analytics", "doubleclick", "facebook.net", "segment", "hotjar", "criteo", "mixpanel", "clarity.ms", "amplitude"];

    scripts.forEach(s => {
        try {
            const srcUrl = new URL(s.src, window.location.href);
            if (srcUrl.hostname !== window.location.hostname) {
                thirdPartyScripts++;
                if (knownTrackers.some(t => srcUrl.hostname.includes(t) || srcUrl.pathname.includes(t))) {
                    trackers++;
                }
            }
        } catch (e) {}
    });

    const forms = document.querySelectorAll('input[type="password"], input[type="email"], input[name*="card"]').length;
    let risk = "Low";
    if (trackers >= 4 || (forms > 0 && thirdPartyScripts > 8)) {
        risk = "High";
    } else if (trackers >= 1 || thirdPartyScripts >= 3) {
        risk = "Moderate";
    }

    window._parryPrivacyStats = {
        trackers,
        thirdPartyScripts,
        forms,
        risk
    };
}

// 4. Download Guard & Sandbox Checker
function initDownloadGuard() {
    const dangerousExtensions = ['.exe', '.dmg', '.iso', '.zip', '.apk', '.bat', '.cmd', '.scr', '.vbs', '.msi'];

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link || !link.href) return;

        const href = link.href.toLowerCase();
        const isDangerousDownload = dangerousExtensions.some(ext => href.split('?')[0].endsWith(ext));

        if (isDangerousDownload) {
            e.preventDefault();
            e.stopPropagation();

            showDownloadGuardModal(link.href);
        }
    }, true);
}

function showDownloadGuardModal(downloadUrl) {
    if (document.getElementById('parry-download-guard')) return;

    const toast = document.createElement('div');
    toast.id = 'parry-download-guard';

    const filename = downloadUrl.split('/').pop().split('?')[0] || "Executable file";

    toast.innerHTML = `
        <div class="parry-download-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            DOWNLOAD SANDBOX GUARD
        </div>
        <div class="parry-download-body">
            Parry AI intercepted an executable/archive download: <strong>${filename}</strong>.<br>
            Files from this domain should be treated with caution.
        </div>
        <div class="parry-download-actions">
            <button id="parry-cancel-dl" class="parry-btn parry-btn-primary" style="padding: 6px 12px; font-size: 11px;">Cancel</button>
            <button id="parry-proceed-dl" class="parry-btn parry-btn-danger" style="padding: 6px 12px; font-size: 11px;">Proceed Anyway</button>
        </div>
    `;

    injectWhenReady(toast);

    toast.querySelector('#parry-cancel-dl').addEventListener('click', () => {
        toast.remove();
    });

    toast.querySelector('#parry-proceed-dl').addEventListener('click', () => {
        toast.remove();
        window.location.href = downloadUrl;
    });
}

// 5. Zero-Click Google Search SERP Badging
function initGoogleSerpBadging() {
    const isGoogleSearch = window.location.hostname.includes("google.") && window.location.pathname.startsWith("/search");
    if (!isGoogleSearch) return;

    function scanSerpLinks() {
        const searchAnchors = Array.from(document.querySelectorAll('a[jsname="UWckNb"], div.yuRUbf > a, div.MjjYud a[href^="http"]'));
        if (searchAnchors.length === 0) return;

        const linksToScan = [];
        const mapAnchorToUrl = new Map();

        searchAnchors.forEach(a => {
            if (a.getAttribute('data-parry-scanned')) return;
            const href = a.href;
            if (!href || href.startsWith("https://www.google.") || href.startsWith("http://localhost")) return;

            a.setAttribute('data-parry-scanned', 'true');
            linksToScan.push(href);
            mapAnchorToUrl.set(a, href);
        });

        if (linksToScan.length === 0) return;

        // Batch Safe Browsing query to preserve API quotas
        chrome.runtime.sendMessage({
            action: "batch_safe_browsing",
            urls: linksToScan.slice(0, 30)
        }, (res) => {
            const results = (res && res.results) ? res.results : [];
            const verdictMap = {};
            results.forEach(r => {
                verdictMap[r.url] = r.verdict;
            });

            mapAnchorToUrl.forEach((url, anchor) => {
                const verdict = verdictMap[url] || "clean";
                const badge = document.createElement('span');
                badge.className = `parry-serp-badge ${verdict === 'clean' ? 'safe' : 'malicious'}`;
                
                const isClean = (verdict === 'clean');
                badge.innerHTML = `
                    <span class="parry-serp-icon">${isClean ? '🛡️' : '⚠️'}</span>
                    <span class="parry-serp-text">${isClean ? 'Safe' : 'Threat'}</span>
                    <span class="parry-serp-source">[Safe Browsing]</span>
                `;
                badge.title = `Rating provided by Google Safe Browsing API. Verified by Parry AI.`;
                
                // Avoid placing inside complex SVG/flex elements. Target the h3 heading inside the anchor if present
                const heading = anchor.querySelector('h3') || anchor;
                if (heading !== anchor) {
                    heading.appendChild(badge);
                } else if (anchor.parentElement) {
                    anchor.insertAdjacentElement('afterend', badge);
                } else {
                    anchor.appendChild(badge);
                }
            });
        });
    }

    // Run on initial load and observe dynamic results
    setTimeout(scanSerpLinks, 800);
    const observer = new MutationObserver(() => scanSerpLinks());
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
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
