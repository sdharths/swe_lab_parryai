// Parry AI - Extension UI Logic

function renderParryAIToast(response) {
    // Prevent duplicate injections
    if (document.getElementById('parry-ai-container')) {
        return;
    }

    const isDangerous = (response.verdict === "malicious" || response.verdict === "suspicious");

    // Determine badge class
    let badgeClass = "safe";
    if (response.verdict === "malicious") badgeClass = "malicious";
    else if (response.verdict === "suspicious") badgeClass = "suspicious";

    // 1. Inject Backdrop if dangerous
    let backdrop = null;
    if (isDangerous) {
        backdrop = document.createElement('div');
        backdrop.id = 'parry-ai-backdrop';
        document.body.appendChild(backdrop);
        
        // Trigger reflow
        backdrop.offsetHeight;
        backdrop.classList.add('show');
        
        // Prevent scrolling on the body
        document.body.style.overflow = 'hidden';
    }

    // 2. Build the Main Container
    const container = document.createElement('div');
    container.id = 'parry-ai-container';
    if (isDangerous) {
        container.classList.add('blocking-mode');
    }
    
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
        
        ${isDangerous ? `
            <button class="parry-ai-btn" id="parry-ai-why-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                Why is this dangerous?
            </button>
        ` : ''}
        
        <div class="parry-score-container">
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

    // Trigger reflow
    container.offsetHeight; 
    container.classList.add('show');

    // Handle "Why is this dangerous?" toggle
    let sidebar = null;
    const whyBtn = document.getElementById('parry-ai-why-btn');
    if (whyBtn) {
        whyBtn.addEventListener('click', () => {
            if (!sidebar) {
                // Create sidebar on first click
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
                    </div>
                    
                    <!-- Chat View -->
                    <div class="parry-sidebar-view active" id="view-chat">
                        <div class="parry-chat-area" id="parry-chat-area">
                            <div class="parry-chat-bubble ai">
                                <strong>Gemini 1.5 Flash:</strong><br><br>
                                ${response.why_explainer}
                            </div>
                        </div>
                    </div>
                    
                    <!-- History View -->
                    <div class="parry-sidebar-view" id="view-history">
                        <div class="parry-history-list">
                            <div class="parry-history-item malicious">
                                <div class="parry-history-domain">scam-login.com</div>
                                <div class="parry-history-choice">Verdict: Malicious | Your Choice: Blocked</div>
                            </div>
                            <div class="parry-history-item suspicious">
                                <div class="parry-history-domain">unusual-bank.net</div>
                                <div class="parry-history-choice">Verdict: Suspicious | Your Choice: Ignored & Proceeded</div>
                            </div>
                            <div class="parry-history-item safe">
                                <div class="parry-history-domain">github.com</div>
                                <div class="parry-history-choice">Verdict: Safe | Your Choice: Allowed</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Chat Input Container (only visible when Chat is active) -->
                    <div class="parry-chat-input-container" id="chat-input-container">
                        <input type="text" class="parry-chat-input" id="parry-chat-input" placeholder="Ask Gemini about this site...">
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
                const viewChat = document.getElementById('view-chat');
                const viewHistory = document.getElementById('view-history');
                const chatInputContainer = document.getElementById('chat-input-container');
                
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
                
                // Chat logic
                const sendBtn = document.getElementById('parry-chat-send');
                const chatInput = document.getElementById('parry-chat-input');
                const chatArea = document.getElementById('parry-chat-area');
                
                const handleSend = () => {
                    const text = chatInput.value.trim();
                    if (!text) return;
                    
                    // Add User message
                    const userMsg = document.createElement('div');
                    userMsg.className = 'parry-chat-bubble user';
                    userMsg.innerHTML = `<strong>You:</strong><br><br>${text}`;
                    chatArea.appendChild(userMsg);
                    chatInput.value = '';
                    chatArea.scrollTop = chatArea.scrollHeight;
                    
                    // Simulate AI typing delay
                    setTimeout(() => {
                        const aiMsg = document.createElement('div');
                        aiMsg.className = 'parry-chat-bubble ai';
                        aiMsg.innerHTML = `<strong>Gemini 1.5 Flash:</strong><br><br>I'm a mock AI responding to your question: "${text}". In the final version, this will be sent to the Gemini API for a real follow-up response!`;
                        chatArea.appendChild(aiMsg);
                        chatArea.scrollTop = chatArea.scrollHeight;
                    }, 800);
                };
                
                sendBtn.addEventListener('click', handleSend);
                chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') handleSend();
                });
            }
            
            // Trigger reflow and show
            sidebar.offsetHeight;
            sidebar.classList.add('show');
        });
    }

    // Handle "Return to Safety" / "Acknowledge"
    document.getElementById('parry-safe-btn').addEventListener('click', () => {
        if (!isDangerous) {
            const neverShow = document.getElementById('parry-never-show')?.checked;
            if (neverShow) {
                alert("Settings saved: Parry AI safe popups will be disabled.");
            }
        } else {
            // In a real extension, we might close the tab or go back
            alert("Parry AI: Returning to safety (would close tab or navigate back).");
        }
        closeParryUI();
    });

    // Handle "Ignore & Proceed"
    const ignoreBtn = document.getElementById('parry-ignore-btn');
    if (ignoreBtn) {
        ignoreBtn.addEventListener('click', () => {
            // Remove the block and allow the user to view the site
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
        }, 400); // Wait for transition
    }
}
