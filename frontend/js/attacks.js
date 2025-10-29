/* ---
   SSAD Attack Simulation Logic (attacks.js)
   --- */

document.addEventListener('DOMContentLoaded', () => {
    // --- Modal Elements ---
    const modal = document.getElementById('attacks-modal');
    if (!modal) return; // Don't run if modal isn't on the page

    // --- Tab Elements ---
    const tabs = modal.querySelectorAll('.attack-tabs .viz-tab');
    const tabPanels = modal.querySelectorAll('.attack-modal-body .viz-tab-panel');

    // --- Shared Containers ---
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
    const dictFileLabel = modal.querySelector('label[for="dict-file-input"]');
    const dictFileName = document.getElementById('dict-file-name');
    const dictStartBtn = document.getElementById('dict-start-btn');
    
    // --- Animation Stage Elements ---
    const animTitle = document.getElementById('attack-anim-title');
    const animGuessBox = document.querySelector('.attack-anim-guess-box'); // Select the box for flashing
    const animGuess = document.getElementById('attack-anim-guess');
    const animProgress = document.getElementById('attack-anim-progress');
    const animAttempts = document.getElementById('attack-anim-attempts');
    const animTime = document.getElementById('attack-anim-time');

    // --- Results Stage Elements ---
    const resultHeader = document.getElementById('attack-result-header');
    const resultTitle = document.getElementById('attack-result-title');
    const resultPasswordBox = document.getElementById('attack-result-password-box'); // Correct selector
    const resultPasswordCode = document.getElementById('attack-result-password');
    const resultStatsBox = document.getElementById('attack-result-stats');
    const resultAttempts = document.getElementById('attack-result-attempts');
    const resultTime = document.getElementById('attack-result-time');

    // --- State Variables ---
    let bfTarget = { id: null, username: null };
    let dictTarget = { id: null, username: null };
    let dictionaryFile = null;
    let searchDebounceTimer = null;
    let animInterval = null; 
    let timeInterval = null; 

    // --- 1. General Logic (Tabs, Forms, Reset) ---

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetPanel = document.getElementById(`attack-tab-${tab.dataset.tab}`);
            if (!targetPanel) return;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            tabPanels.forEach(p => p.classList.remove('active'));
            targetPanel.classList.add('active');
            resetAttackUI();
        });
    });

    function resetAttackUI() {
        setupContainer.style.display = 'block';
        simulationContainer.style.display = 'none';
        resultsContainer.style.display = 'none';
        
        bfTarget = { id: null, username: null };
        dictTarget = { id: null, username: null };
        dictionaryFile = null;

        bfForm.reset();
        dictForm.reset();
        
        bfSearchInput.value = '';
        bfSearchInput.readOnly = false;
        bfSearchClearBtn.style.display = 'none';
        bfSearchResults.innerHTML = '';
        bfSearchResults.classList.add('hidden'); // Ensure results are hidden initially
        
        dictSearchInput.value = '';
        dictSearchInput.readOnly = false;
        dictSearchClearBtn.style.display = 'none';
        dictSearchResults.innerHTML = '';
        dictSearchResults.classList.add('hidden'); // Ensure results are hidden initially
        
        dictFileInput.value = ''; // Clear file input
        dictFileName.textContent = 'Click to select a file...';
        dictFileLabel.classList.remove('file-selected');
        
        bfStartBtn.disabled = true;
        dictStartBtn.disabled = true;

        if (animInterval) clearInterval(animInterval);
        if (timeInterval) clearInterval(timeInterval);

        animProgress.style.width = '0%';
        animAttempts.innerHTML = '0';
        animTime.textContent = '0.00s';
        animGuess.textContent = '...';
        animGuessBox.classList.remove('flash-success', 'flash-fail'); // Reset flash
    }

    attackResetBtn.addEventListener('click', resetAttackUI);

    // --- 2. User Search Logic ---

    function handleAttackUserSearch(e, resultsContainer, clearBtn, onSelectCallback) {
        clearTimeout(searchDebounceTimer);
        const query = e.target.value.trim();
        resultsContainer.innerHTML = ''; 
        resultsContainer.classList.remove('hidden'); // Show results container
        onSelectCallback(null, null); 
        clearBtn.style.display = query.length > 0 ? 'block' : 'none'; // Show clear if typing

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
        clearBtn.addEventListener('click', () => {
            input.value = '';
            input.readOnly = false;
            resultsContainer.innerHTML = '';
            resultsContainer.classList.add('hidden');
            clearBtn.style.display = 'none';
            onClearCallback();
        });
    }

    // Attach BF search listeners
    bfSearchInput.addEventListener('input', (e) => handleAttackUserSearch(e, bfSearchResults, bfSearchClearBtn, (id, username) => {
        bfTarget = { id, username };
        bfStartBtn.disabled = !bfTarget.id;
    }));
    setupClearButton(bfSearchClearBtn, bfSearchInput, bfSearchResults, () => {
        bfTarget = { id: null, username: null };
        bfStartBtn.disabled = true;
    });

    // Attach Dict search listeners
    dictSearchInput.addEventListener('input', (e) => handleAttackUserSearch(e, dictSearchResults, dictSearchClearBtn, (id, username) => {
        dictTarget = { id, username };
        dictStartBtn.disabled = !dictTarget.id || !dictionaryFile;
    }));
    setupClearButton(dictSearchClearBtn, dictSearchInput, dictSearchResults, () => {
        dictTarget = { id: null, username: null };
        dictStartBtn.disabled = true;
    });

    // --- 3. Dictionary File Logic ---

    dictFileInput.addEventListener('change', () => {
        if (dictFileInput.files.length > 0) {
            dictionaryFile = dictFileInput.files[0];
            dictFileName.textContent = dictionaryFile.name;
            dictFileLabel.classList.add('file-selected');
            dictStartBtn.disabled = !dictTarget.id || !dictionaryFile;
        } else {
            dictionaryFile = null;
            dictFileName.textContent = 'Click to select a file...';
            dictFileLabel.classList.remove('file-selected');
            dictStartBtn.disabled = true;
        }
    });

    // --- 4. Attack Submission & Animation ---

    bfForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = bfPasswordType.value;
        const target = bfTarget.username;
        if (!target) return;
        
        setupContainer.style.display = 'none';
        simulationContainer.style.display = 'block';
        animTitle.textContent = `Running Brute Force (${type}) on "${target}"...`;
        
        runBruteForceAttack(target, type);
    });
    
    dictForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const target = dictTarget.username;
        if (!target || !dictionaryFile) return;

        setupContainer.style.display = 'none';
        simulationContainer.style.display = 'block';
        animTitle.textContent = `Running Dictionary Attack on "${target}"...`;
        
        runDictionaryAttack(target, dictionaryFile);
    });

    // --- "Hollywood" Brute Force Animation ---
    async function runBruteForceAttack(targetUsername, charsetType) {
        let realResult;
        try {
            const response = await secureFetch('/passwords-and-attacks/attack/bruteforce', {
                method: 'POST',
                body: JSON.stringify({
                    target_username: targetUsername,
                    charset_type: charsetType,
                    max_length: 8
                })
            });
            realResult = await response.json();
            if (!response.ok) throw new Error(realResult.detail || 'Attack failed');
        } catch (error) {
            showNotification(error.message, 'error');
            resetAttackUI();
            return;
        }
        
        let charset = "abcdef0123456789!@#$%^&*()"; // Expanded charset for better visual
        let len = 6;
        if (charsetType === 'type1') { charset = "234"; len = 3; }
        if (charsetType === 'type2') { charset = "0123456789"; len = 5; }
        // Type 3 uses the expanded charset above, len = 6

        const animDuration = 5000; // 5 second animation

        animGuessBox.classList.remove('flash-success', 'flash-fail'); // Reset flash

        anime({
            targets: animProgress,
            width: '100%',
            duration: animDuration,
            easing: 'easeInOutCubic', // Smoother easing
            complete: () => {
                clearInterval(animInterval);
                clearInterval(timeInterval);
                if(realResult.found) {
                    animGuess.textContent = realResult.password;
                    animGuess.style.color = 'var(--success)';
                    animGuessBox.classList.add('flash-success'); // Flash green
                } else {
                    animGuess.style.color = 'var(--error)';
                    animGuessBox.classList.add('flash-fail'); // Flash red
                }
                // Wait slightly longer for flash effect
                setTimeout(() => displayAttackResults(realResult), 1200);
            }
        });

        anime({
            targets: animAttempts,
            innerHTML: realResult.attempts,
            round: 1,
            duration: animDuration,
            easing: 'easeOutQuad'
        });

        animGuess.style.color = 'var(--accent-primary)'; 
        animInterval = setInterval(() => {
            let guess = "";
            for (let i = 0; i < len; i++) {
                guess += charset.charAt(Math.floor(Math.random() * charset.length));
            }
            animGuess.textContent = guess;
        }, 30); 

        let startTime = Date.now();
        timeInterval = setInterval(() => {
            let elapsed = (Date.now() - startTime) / 1000;
            // Stop timer visually when progress bar completes
            if (elapsed * 1000 >= animDuration) {
                 elapsed = animDuration / 1000;
                 clearInterval(timeInterval);
            }
            animTime.textContent = `${elapsed.toFixed(2)}s`;
        }, 30);
    }
    
    // --- "Hollywood" Dictionary Animation ---
    async function runDictionaryAttack(targetUsername, file) {
        let realResult;
        let fileWords = [];
        try {
            const fileContent = await file.text();
            fileWords = fileContent.split(/\r?\n/).filter(w => w); 

            const formData = new FormData();
            formData.append('dictionary_file', file);
            formData.append('target_username', targetUsername);

            const response = await secureFetch('/passwords-and-attacks/attack/dictionary', {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': undefined } 
            });
            realResult = await response.json();
            if (!response.ok) throw new Error(realResult.detail || 'Attack failed');

        } catch (error) {
            showNotification(error.message, 'error');
            resetAttackUI();
            return;
        }
        
        let totalWords = fileWords.length;
        if(totalWords === 0) {
            showNotification("Dictionary file is empty.", "error");
            resetAttackUI();
            return;
        }
        let animationDuration = Math.min(Math.max(totalWords * 15, 4000), 8000); // Slower per word, min 4s

        animGuessBox.classList.remove('flash-success', 'flash-fail'); // Reset flash

        anime({
            targets: animProgress,
            width: '100%',
            duration: animationDuration,
            easing: 'easeInOutCubic', // Smoother easing
            complete: () => {
                clearInterval(animInterval);
                clearInterval(timeInterval);
                if(realResult.found) {
                    animGuess.textContent = realResult.password;
                    animGuess.style.color = 'var(--success)';
                    animGuessBox.classList.add('flash-success'); // Flash green
                } else {
                    animGuess.textContent = fileWords[fileWords.length - 1]; 
                    animGuess.style.color = 'var(--error)';
                    animGuessBox.classList.add('flash-fail'); // Flash red
                }
                setTimeout(() => displayAttackResults(realResult), 1200);
            }
        });

        anime({
            targets: animAttempts,
            innerHTML: realResult.attempts,
            round: 1,
            duration: animationDuration,
            easing: 'easeOutQuad'
        });

        animGuess.style.color = 'var(--accent-primary)';
        let wordIndex = 0;
        animInterval = setInterval(() => {
            animGuess.textContent = fileWords[wordIndex % totalWords];
            wordIndex++;
        }, 35); // Slightly slower word flip

        let startTime = Date.now();
        timeInterval = setInterval(() => {
            let elapsed = (Date.now() - startTime) / 1000;
            if (elapsed * 1000 >= animationDuration) {
                 elapsed = animationDuration / 1000;
                 clearInterval(timeInterval);
            }
            animTime.textContent = `${elapsed.toFixed(2)}s`;
        }, 35);
    }

    // --- 5. Display Results (Animations + Password Fix) ---

    function displayAttackResults(result) {
        simulationContainer.style.display = 'none';
        resultsContainer.style.display = 'block';

        // Reset elements for animation
        resultHeader.querySelector('i').style.transform = 'scale(0)';
        resultTitle.style.opacity = 0;
        resultPasswordBox.style.opacity = 0; // Target the box
        resultPasswordBox.style.transform = 'translateY(20px)';
        resultStatsBox.querySelectorAll('.attack-stat-card').forEach(card => {
            card.style.transform = 'rotateY(-90deg)';
        });
        attackResetBtn.style.opacity = 0;
        attackResetBtn.style.transform = 'translateY(20px)';
        
        if (result.found) {
            resultHeader.className = 'attack-result-header success';
            resultTitle.innerHTML = 'Password Found!';
            resultHeader.querySelector('i').outerHTML = '<i data-lucide="shield-check"></i>';
            // [FIX] Show the parent BOX now
            resultPasswordBox.style.display = 'flex'; 
            resultPasswordCode.textContent = result.password;
        } else {
            resultHeader.className = 'attack-result-header fail';
            resultTitle.innerHTML = 'Password Not Found';
            resultHeader.querySelector('i').outerHTML = '<i data-lucide="shield-off"></i>';
            // [FIX] Hide the parent BOX now
            resultPasswordBox.style.display = 'none';
        }

        resultAttempts.textContent = result.attempts.toLocaleString();
        resultTime.textContent = `${result.time_taken.toFixed(4)}s`;
        
        lucide.createIcons(); 

        const tl = anime.timeline({
            easing: 'easeOutExpo',
            duration: 800
        });

        tl.add({
            targets: resultHeader.querySelector('i'),
            scale: [0, 1],
            rotate: '1turn',
            duration: 600
        })
        .add({
            targets: resultTitle,
            opacity: [0, 1],
        }, '-=400')
        .add({
            targets: resultStatsBox.querySelectorAll('.attack-stat-card'),
            transform: 'rotateY(0deg)',
            delay: anime.stagger(200),
            duration: 600
        }, '-=500')
        .add({
            // [FIX] Animate the BOX
            targets: resultPasswordBox, 
            opacity: [0, 1],
            translateY: 0,
            duration: 500
        }, '-=300')
         .add({
            targets: attackResetBtn,
            opacity: [0, 1],
            translateY: 0,
            duration: 500
        }, '-=200');
    }
});