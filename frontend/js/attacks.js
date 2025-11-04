/* ---
   SSAD Attack Simulation Logic
   [MODIFIED TO SIMULATE CAPTCHA BLOCK on BF/Dictionary]
   --- */

document.addEventListener('DOMContentLoaded', () => {
    // --- Modal Elements ---
    const modal = document.getElementById('attacks-modal');
    if (!modal) return; 

    // --- Tab Elements ---
    const tabs = modal.querySelectorAll('.attack-tabs .viz-tab');
    const tabPanels = modal.querySelectorAll('.attack-modal-body .viz-tab-panel');

    // --- Conteneurs ---
    const setupContainer = document.getElementById('attack-setup-container');
    const simulationContainer = document.getElementById('attack-simulation-stage');
    const resultsContainer = document.getElementById('attack-results-container');
    const attackResetBtn = document.getElementById('attack-reset-btn');

    // --- Brute Force (BF) Elements ---
    const bfForm = document.getElementById('attack-form-bruteforce');
    const bfSearchInput = document.getElementById('bf-search-input');
    const bfSearchClearBtn = document.getElementById('bf-clear-btn');
    const bfSearchResults = document.getElementById('bf-search-results');
    const bfPasswordType = document.getElementById('bf-password-type');
    const bfStartBtn = document.getElementById('bf-start-btn');

    // --- Dictionary (Dict) Elements ---
    const dictForm = document.getElementById('attack-form-dictionary');
    const dictSearchInput = document.getElementById('dict-search-input');
    const dictSearchClearBtn = document.getElementById('dict-clear-btn');
    const dictSearchResults = document.getElementById('dict-search-results');
    const dictFileInput = document.getElementById('dict-file-input');
    const dictFileDropzone = document.getElementById('dict-file-dropzone');
    const dictFileName = document.getElementById('dict-file-name');
    const dictFilePrompt = document.getElementById('dict-file-prompt');
    const dictFileIcon = dictFileDropzone.querySelector('.dropzone-icon');
    const dictStartBtn = document.getElementById('dict-start-btn');
    
    // --- Animation Stage (BF/Dict) ---
    const animTitle = document.getElementById('attack-anim-title');
    const animProgress = document.getElementById('attack-anim-progress');
    
    // --- Results Stage (BF/Dict) ---
    const resultHeader = document.getElementById('attack-result-header');
    const resultTitle = document.getElementById('attack-result-title');
    const resultPasswordBox = document.getElementById('attack-result-password-box'); 
    const resultPasswordCode = document.getElementById('attack-result-password');
    const resultMessageBox = document.getElementById('attack-result-message-box');
    const resultMessage = document.getElementById('attack-result-message');
    const resultStatsBox = document.getElementById('attack-result-stats');
    const resultAttempts = document.getElementById('attack-result-attempts');
    const resultTime = document.getElementById('attack-result-time');

    // --- [NEW] MiTM Elements ---
    const mitmSetupContainer = document.getElementById('mitm-container-setup');
    const mitmActiveContainer = document.getElementById('mitm-container-active');
    const mitmResultsContainer = document.getElementById('mitm-container-results');
    
    const mitmStartBtn = document.getElementById('mitm-start-btn');
    const mitmStopBtn = document.getElementById('mitm-stop-btn');
    const mitmStatusText = document.getElementById('mitm-status-text');
    
    const mitmResultsTitle = document.getElementById('mitm-results-title');
    const mitmPacketList = document.getElementById('mitm-packet-list');
    const mitmContinueBtn = document.getElementById('mitm-continue-btn');
    const mitmStopResultsBtn = document.getElementById('mitm-stop-results-btn');
    
    // --- State Variables ---
    let bfTarget = { id: null, username: null };
    let dictTarget = { id: null, username: null };
    let dictionaryFile = null;
    let searchDebounceTimer = null;
    
    // --- [NEW] MiTM State ---
    let isMitmAttacking = false;
    let mitmPollInterval = null;
    let interceptedPackets = [];
    
    // --- 1. General Logic (Tabs, Forms, Reset) ---

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetPanel = document.getElementById(`attack-tab-${tab.dataset.tab}`);
            if (!targetPanel) return;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            tabPanels.forEach(p => p.classList.remove('active'));
            targetPanel.classList.add('active');
            
            // Stop MiTM polling if we switch away
            if (tab.dataset.tab !== 'mitm' && isMitmAttacking) {
                stopMitmAttack(false); // Stop silently
            }
            // Reset other attack UIs
            if(tab.dataset.tab !== 'bruteforce' && tab.dataset.tab !== 'dictionary') {
                resetAttackUI();
            }
            // Reset MiTM UI if we switch to it
            if(tab.dataset.tab === 'mitm') {
                resetMitmUI();
            }
        });
    });

    function resetAttackUI() {
        // This function now only resets BF and Dictionary
        setupContainer.style.display = 'block';
        simulationContainer.style.display = 'none';
        simulationContainer.classList.remove('visible');
        resultsContainer.style.display = 'none'; 
        resultsContainer.classList.remove('visible'); 

        bfTarget = { id: null, username: null };
        dictTarget = { id: null, username: null };
        dictionaryFile = null;

        if (bfForm) bfForm.reset();
        if (dictForm) dictForm.reset();
        
        if(bfSearchInput) {
            bfSearchInput.value = '';
            bfSearchInput.readOnly = false;
            bfSearchClearBtn.style.display = 'none';
            bfSearchResults.innerHTML = '';
            bfSearchResults.classList.add('hidden');
            bfStartBtn.disabled = true;
        }
        
        if(dictSearchInput) {
            dictSearchInput.value = '';
            dictSearchInput.readOnly = false;
            dictSearchClearBtn.style.display = 'none';
            dictSearchResults.innerHTML = '';
            dictSearchResults.classList.add('hidden');
            
            dictFileInput.value = ''; 
            dictFileName.textContent = 'Click to upload or drag & drop';
            dictFilePrompt.textContent = 'Supports: .txt files';
            dictFileDropzone.classList.remove('file-selected');
            dictFileIcon.innerHTML = '<i data-lucide="file-up"></i>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            
            dictStartBtn.disabled = true;
        }
        
        if(animProgress) {
            animProgress.style.transition = 'none'; 
            animProgress.style.width = '0%';
        }
        
        const existingIcon = resultHeader ? resultHeader.querySelector('svg') : null;
        if (existingIcon) {
            existingIcon.remove();
        }
    }

    if(attackResetBtn) attackResetBtn.addEventListener('click', resetAttackUI);

    // --- 2. User Search Logic (BF/Dict) ---

    function handleAttackUserSearch(e, resultsContainer, clearBtn, onSelectCallback) {
        clearTimeout(searchDebounceTimer);
        const query = e.target.value.trim();
        resultsContainer.innerHTML = ''; 
        resultsContainer.classList.remove('hidden'); 
        onSelectCallback(null, null); 
        clearBtn.style.display = query.length > 0 ? 'block' : 'none'; 

        if (query.length < 2) {
            resultsContainer.innerHTML = `<div class="chat-list-placeholder">Enter 2+ characters...</div>`;
            return;
        }

        searchDebounceTimer = setTimeout(async () => {
            try {
                resultsContainer.innerHTML = `<div class="chat-list-placeholder">Searching...</div>`;
                const response = await secureFetch(`/users/search?query=${encodeURIComponent(query)}`);
                if (!response.ok) throw new Error('Search failed.');
                const users = await response.json();
                
                resultsContainer.innerHTML = '';
                
                if (users.length === 0) {
                    resultsContainer.innerHTML = `<div class="chat-list-placeholder">No users found.</div>`;
                    return;
                }

                users.forEach(user => {
                    const avatarLetter = user.username.charAt(0).toUpperCase();
                    const userEl = document.createElement('button');
                    userEl.className = 'chat-list-item';
                    userEl.type = 'button'; 
                    userEl.innerHTML = `
                        <div class="avatar">${avatarLetter}</div>
                        <div class="chat-info"><h3>${user.username}</h3><p>Select as target</p></div>
                    `;
                    userEl.addEventListener('click', () => {
                        e.target.value = user.username; 
                        e.target.readOnly = true;        
                        resultsContainer.innerHTML = ''; 
                        resultsContainer.classList.add('hidden'); 
                        clearBtn.style.display = 'block'; 
                        onSelectCallback(user.id, user.username); 
                    });
                    resultsContainer.appendChild(userEl);
                });

            } catch (error) {
                showNotification(error.message, 'error');
                resultsContainer.innerHTML = `<div class="chat-list-placeholder">Search error.</div>`;
            }
        }, 300);
    }
    
    function setupClearButton(clearBtn, input, resultsContainer, onClearCallback) {
        if(!clearBtn) return;
        clearBtn.addEventListener('click', () => {
            input.value = '';
            input.readOnly = false;
            resultsContainer.innerHTML = '';
            resultsContainer.classList.add('hidden');
            clearBtn.style.display = 'none';
            onClearCallback();
        });
    }

    if(bfSearchInput) {
        bfSearchInput.addEventListener('input', (e) => handleAttackUserSearch(e, bfSearchResults, bfSearchClearBtn, (id, username) => {
            bfTarget = { id, username };
            bfStartBtn.disabled = !bfTarget.id;
        }));
        setupClearButton(bfSearchClearBtn, bfSearchInput, bfSearchResults, () => {
            bfTarget = { id: null, username: null };
            bfStartBtn.disabled = true;
        });
    }

    if(dictSearchInput) {
        dictSearchInput.addEventListener('input', (e) => handleAttackUserSearch(e, dictSearchResults, dictSearchClearBtn, (id, username) => {
            dictTarget = { id, username };
            dictStartBtn.disabled = !dictTarget.id || !dictionaryFile;
        }));
        setupClearButton(dictSearchClearBtn, dictSearchInput, dictSearchResults, () => {
            dictTarget = { id: null, username: null };
            dictStartBtn.disabled = true;
        });
    }
    
    // --- 3. File Dropzone Logic (BF/Dict) ---

    function handleFileSelect(file) {
        if (!file) {
            dictionaryFile = null;
            dictStartBtn.disabled = true;
            return;
        }

        if (file.type !== 'text/plain') {
            showNotification('Invalid file type. Please upload a .txt file.', 'error');
            dictFileDropzone.classList.remove('file-selected', 'dragover');
            return;
        }

        dictionaryFile = file;
        dictFileName.textContent = file.name;
        dictFilePrompt.textContent = `${(file.size / 1024).toFixed(1)} KB`;
        dictFileDropzone.classList.add('file-selected');
        dictFileIcon.innerHTML = '<i data-lucide="check-circle"></i>'; 
        if (typeof lucide !== 'undefined') lucide.createIcons();
        dictStartBtn.disabled = !dictTarget.id || !dictionaryFile;
    }

    if(dictFileInput) {
        dictFileInput.addEventListener('change', () => {
            if (dictFileInput.files.length > 0) {
                handleFileSelect(dictFileInput.files[0]);
            }
        });

        dictFileDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dictFileDropzone.classList.add('dragover');
        });
        dictFileDropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dictFileDropzone.classList.remove('dragover');
        });
        dictFileDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dictFileDropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                dictFileInput.files = e.dataTransfer.files; 
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
    }

    // --- [MODIFIED] 4. Attack Submission (BF/Dict) ---
    
    /**
     * [MODIFIED] This function NO LONGER calls the backend.
     * It simulates an attack animation and then shows a hard-coded "Failed" result
     * to demonstrate that CAPTCHA blocked the attack.
     */
    async function simulateBlockedAttack(button, title) {
        setupContainer.style.display = 'none'; 
        simulationContainer.style.display = 'flex'; 
        simulationContainer.classList.add('visible'); 
        animTitle.textContent = `Running ${title}...`;
        
        animProgress.style.width = '0%'; 
        animProgress.style.transition = 'none'; 
        
        // Run a fake progress bar for 2 seconds to simulate the "attack"
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { 
                 animProgress.style.transition = `width 2000ms cubic-bezier(0.25, 1, 0.5, 1)`;
                 animProgress.style.width = '100%'; // Show it "try" and "fail"
            });
        });

        // Wait for the animation
        await new Promise(resolve => setTimeout(resolve, 2000));

        // As requested: create a FAKE result object
        const fakeResult = {
            found: false,
            message: "Attack Failed: CAPTCHA protection is active and blocked the automated script.",
            attempts: 0,
            time_taken: 0.0
        };
        
        // Display the fake result
        displayAttackResults(fakeResult);
        
        // Re-enable the button
        setButtonLoading(button, false);
    }

    if(bfForm) {
        bfForm.addEventListener('submit', (e) => {
            e.preventDefault();
            setButtonLoading(bfStartBtn, true);
            // Call the MODIFIED simulation function
            simulateBlockedAttack(bfStartBtn, 'Brute Force Attack');
        });
    }

    if(dictForm) {
        dictForm.addEventListener('submit', (e) => {
            e.preventDefault();
            setButtonLoading(dictStartBtn, true);
            // Call the MODIFIED simulation function
            simulateBlockedAttack(dictStartBtn, 'Dictionary Attack');
        });
    }
    
    // --- 5. Results Display Logic (BF/Dict) ---
    // This function is unchanged and works perfectly with the fake result.
    function displayAttackResults(result) {
        if(!simulationContainer || !resultsContainer) return;
        
        simulationContainer.style.display = 'none'; 
        resultsContainer.classList.add('visible'); 
        resultsContainer.style.display = 'flex'; 

        const existingIcon = resultHeader.querySelector('svg');
        if (existingIcon) existingIcon.remove();
        
        resultTitle.style.opacity = 0;
        resultPasswordBox.style.display = 'none';
        resultMessageBox.style.display = 'none';
        resultPasswordBox.style.opacity = 0; 
        resultMessageBox.style.opacity = 0;
        resultPasswordBox.style.transform = 'translateY(20px)';
        resultMessageBox.style.transform = 'translateY(20px)';
        
        resultStatsBox.style.transform = 'none'; 
        resultStatsBox.querySelectorAll('.attack-stat-card').forEach(card => {
            card.style.transform = 'rotateY(-90deg)';
        });
        attackResetBtn.style.opacity = 0;
        attackResetBtn.style.transform = 'translateY(20px)';
        
        const iconEl = document.createElement('i'); 
        
        // Use the fake 0.0 time
        const timeInMs = (result.time_taken * 1000).toFixed(2);
        // Use the fake 0 attempts
        const attemptsStr = result.attempts.toLocaleString();
        
        if (result.found) {
            // This part will no longer be reached by BF/Dict, but we keep it
            resultHeader.className = 'attack-result-header success';
            resultTitle.innerHTML = 'Success: Password Found!';
            iconEl.setAttribute('data-lucide', 'shield-check');
            resultHeader.prepend(iconEl);
            
            resultPasswordBox.style.display = 'flex'; 
            resultPasswordCode.textContent = result.password; 
            resultMessageBox.style.display = 'none'; 
        } else {
            // This part WILL be reached
            resultHeader.className = 'attack-result-header fail';
            resultTitle.innerHTML = 'Attack Failed'; // Title
            iconEl.setAttribute('data-lucide', 'shield-off');
            resultHeader.prepend(iconEl);

            resultPasswordBox.style.display = 'none'; 
            resultMessageBox.style.display = 'block'; 
            // Display the custom CAPTCHA message
            resultMessage.innerHTML = result.message || 'Password not found.';
        }

        // Display the 0 attempts and 0.00 ms time
        resultAttempts.textContent = attemptsStr;
        resultTime.textContent = `${timeInMs} ms`;
        
        if (typeof lucide !== 'undefined') lucide.createIcons(); 

        // Animate the results
        if (typeof anime !== 'undefined') {
            const tl = anime.timeline({ easing: 'easeOutExpo', duration: 800 });
            tl.add({ targets: resultHeader.querySelector('svg'), scale: [0, 1], rotate: '1turn', duration: 600 })
            .add({ targets: resultTitle, opacity: [0, 1], }, '-=400')
            .add({ targets: resultStatsBox.querySelectorAll('.attack-stat-card'), transform: 'rotateY(0deg)', delay: anime.stagger(200), duration: 600 }, '-=500')
            .add({ targets: [resultPasswordBox, resultMessageBox], opacity: [0, 1], translateY: 0, duration: 500 }, '-=300')
            .add({ targets: attackResetBtn, opacity: [0, 1], translateY: 0, duration: 500 }, '-=200');
        } else {
             // Fallback
             resultTitle.style.opacity = 1;
             resultPasswordBox.style.opacity = 1; 
             resultMessageBox.style.opacity = 1;
             resultPasswordBox.style.transform = 'translateY(0)';
             resultMessageBox.style.transform = 'translateY(0)';
             resultStatsBox.querySelectorAll('.attack-stat-card').forEach(card => card.style.transform = 'rotateY(0deg)');
             attackResetBtn.style.opacity = 1;
             attackResetBtn.style.transform = 'translateY(0)';
        }
    }

    // --- 6. MiTM Attack Logic (Unchanged from previous version) ---

    function resetMitmUI() {
        if(isMitmAttacking) {
            stopMitmAttack(false); // Stop silently
        }
        interceptedPackets = [];
        mitmSetupContainer.style.display = 'flex';
        mitmActiveContainer.style.display = 'none';
        mitmResultsContainer.style.display = 'none';
        mitmPacketList.innerHTML = '';
        setButtonLoading(mitmStartBtn, false);
    }

    async function startMitmAttack() {
        setButtonLoading(mitmStartBtn, true);
        try {
            const response = await secureFetch('/mitm/start', {
                method: 'POST',
                body: JSON.stringify({ attacker_username: CURRENT_USERNAME })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Failed to start listener');

            isMitmAttacking = true;
            mitmSetupContainer.style.display = 'none';
            mitmResultsContainer.style.display = 'none';
            mitmActiveContainer.style.display = 'flex';
            mitmStatusText.textContent = 'Listening for packets...';
            
            // Start polling
            if(mitmPollInterval) clearInterval(mitmPollInterval);
            mitmPollInterval = setInterval(pollMitmPackets, 2000);

        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setButtonLoading(mitmStartBtn, false);
        }
    }

    async function stopMitmAttack(showAlert = true) {
        if (mitmPollInterval) clearInterval(mitmPollInterval);
        mitmPollInterval = null;
        isMitmAttacking = false;
        
        // Reset UI to initial setup state
        mitmSetupContainer.style.display = 'flex';
        mitmActiveContainer.style.display = 'none';
        mitmResultsContainer.style.display = 'none';
        interceptedPackets = [];
        mitmPacketList.innerHTML = '';

        try {
            await secureFetch('/mitm/stop', {
                method: 'POST',
                body: JSON.stringify({ attacker_username: CURRENT_USERNAME })
            });
            if(showAlert) showNotification('MiTM attack stopped.', 'success');
        } catch (error) {
            if(showAlert) showNotification('Failed to stop listener, but polling has ended.', 'error');
        }
    }

    async function pollMitmPackets() {
        if (!isMitmAttacking) return;
        
        try {
            const response = await secureFetch('/mitm/packets');
            if (!response.ok) {
                console.error('MiTM poll failed');
                return;
            }
            
            const newPackets = await response.json();
            
            if (newPackets.length > 0) {
                if (mitmPollInterval) clearInterval(mitmPollInterval); 
                
                interceptedPackets.unshift(...newPackets); 
                
                mitmActiveContainer.style.display = 'none';
                mitmResultsContainer.style.display = 'flex';
                
                mitmResultsTitle.textContent = `Intercepted ${newPackets.length} new packet(s)!`;
                renderMitmPackets();
            } else {
                mitmStatusText.textContent = `Listening... (Last check: ${new Date().toLocaleTimeString()})`;
            }

        } catch (error) {
            console.error('MiTM poll error:', error);
            stopMitmAttack(true);
            showNotification('MiTM attack stopped due to an error.', 'error');
        }
    }
    
    function renderMitmPackets() {
        mitmPacketList.innerHTML = '';
        if (interceptedPackets.length === 0) {
            mitmPacketList.innerHTML = '<div class="chat-list-placeholder"><i data-lucide="ghost"></i><p>No packets intercepted yet.</p></div>';
            lucide.createIcons();
            return;
        }

        interceptedPackets.forEach(packet => {
            const packetEl = document.createElement('div');
            packetEl.className = 'mitm-packet';
            
            let icon = 'help-circle';
            let title = 'Unknown Packet';
            let dataContent = JSON.stringify(packet.data, null, 2);

            switch (packet.packet_type) {
                case 'login':
                    icon = 'log-in';
                    title = 'Login Attempt';
                    dataContent = `{\n  "username": "${packet.data.username}",\n  "password_hash_capture": "${packet.data.password_hash_capture}"\n}`;
                    break;
                case 'signup':
                    icon = 'user-plus';
                    title = 'Signup Attempt';
                    dataContent = `{\n  "username": "${packet.data.username}",\n  "password_hash_capture": "${packet.data.password_hash_capture}" \n}`;
                    break;
                case 'chat_request':
                    icon = 'mail-plus';
                    title = 'Chat Request';
                    dataContent = JSON.stringify(packet.data, null, 2);
                    break;
                case 'chat_message':
                    icon = 'message-square';
                    title = 'Chat Message';
                    dataContent = `{\n  "chat_id": "${packet.data.chat_id}",\n  "sender_id": "${packet.data.sender_id}",\n  "content_type": "${packet.data.content_type}",\n  "encrypted_content": "${packet.data.encrypted_content}"\n}`;
                    break;
            }

            const timestamp = new Date(packet.created_at).toLocaleString();
            
            packetEl.innerHTML = `
                <div class="mitm-packet-header">
                    <h4><i data-lucide="${icon}"></i> ${title}</h4>
                    <span class="timestamp">${timestamp}</span>
                </div>
                <pre>${dataContent}</pre>
            `;
            mitmPacketList.appendChild(packetEl);
        });
        
        lucide.createIcons();
    }
    
    function continueMitmAttack() {
        mitmResultsContainer.style.display = 'none';
        mitmActiveContainer.style.display = 'flex';
        mitmStatusText.textContent = 'Listening for packets...';
        
        if(mitmPollInterval) clearInterval(mitmPollInterval);
        mitmPollInterval = setInterval(pollMitmPackets, 2000);
    }
    
    if(mitmStartBtn) mitmStartBtn.addEventListener('click', startMitmAttack);
    if(mitmStopBtn) mitmStopBtn.addEventListener('click', () => stopMitmAttack(true));
    if(mitmContinueBtn) mitmContinueBtn.addEventListener('click', continueMitmAttack);
    if(mitmStopResultsBtn) mitmStopResultsBtn.addEventListener('click', () => stopMitmAttack(true));

});

