/* ---
   SSAD Attack Simulation Logic (attacks_v3.js)
   [FINAL FIXES FOR STATS AND ICON]
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
    
    // --- Éléments de l'étape d'animation ---
    const animTitle = document.getElementById('attack-anim-title');
    const animProgress = document.getElementById('attack-anim-progress');
    
    // --- Éléments de l'étape de résultats ---
    const resultHeader = document.getElementById('attack-result-header');
    const resultTitle = document.getElementById('attack-result-title');
    const resultPasswordBox = document.getElementById('attack-result-password-box'); 
    const resultPasswordCode = document.getElementById('attack-result-password');
    const resultMessageBox = document.getElementById('attack-result-message-box');
    const resultMessage = document.getElementById('attack-result-message');
    const resultStatsBox = document.getElementById('attack-result-stats');
    const resultAttempts = document.getElementById('attack-result-attempts');
    const resultTime = document.getElementById('attack-result-time');

    // --- State Variables ---
    let bfTarget = { id: null, username: null };
    let dictTarget = { id: null, username: null };
    let dictionaryFile = null;
    let searchDebounceTimer = null;
    
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
        simulationContainer.classList.remove('visible');
        resultsContainer.style.display = 'none'; 
        resultsContainer.classList.remove('visible'); 

        bfTarget = { id: null, username: null };
        dictTarget = { id: null, username: null };
        dictionaryFile = null;

        bfForm.reset();
        dictForm.reset();
        
        bfSearchInput.value = '';
        bfSearchInput.readOnly = false;
        bfSearchClearBtn.style.display = 'none';
        bfSearchResults.innerHTML = '';
        bfSearchResults.classList.add('hidden'); 
        
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
        
        bfStartBtn.disabled = true;
        dictStartBtn.disabled = true;

        animProgress.style.transition = 'none'; 
        animProgress.style.width = '0%';
        
        // --- [BUG FIX] Supprimer l'icône de résultat (SVG) lors de la réinitialisation
        const existingIcon = resultHeader.querySelector('svg');
        if (existingIcon) {
            existingIcon.remove();
        }
    }

    attackResetBtn.addEventListener('click', resetAttackUI);

    // --- 2. User Search Logic (Inchangée) ---

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
        clearBtn.addEventListener('click', () => {
            input.value = '';
            input.readOnly = false;
            resultsContainer.innerHTML = '';
            resultsContainer.classList.add('hidden');
            clearBtn.style.display = 'none';
            onClearCallback();
        });
    }

    bfSearchInput.addEventListener('input', (e) => handleAttackUserSearch(e, bfSearchResults, bfSearchClearBtn, (id, username) => {
        bfTarget = { id, username };
        bfStartBtn.disabled = !bfTarget.id;
    }));
    setupClearButton(bfSearchClearBtn, bfSearchInput, bfSearchResults, () => {
        bfTarget = { id: null, username: null };
        bfStartBtn.disabled = true;
    });

    dictSearchInput.addEventListener('input', (e) => handleAttackUserSearch(e, dictSearchResults, dictSearchClearBtn, (id, username) => {
        dictTarget = { id, username };
        dictStartBtn.disabled = !dictTarget.id || !dictionaryFile;
    }));
    setupClearButton(dictSearchClearBtn, dictSearchInput, dictSearchResults, () => {
        dictTarget = { id: null, username: null };
        dictStartBtn.disabled = true;
    });

    // --- 3. File Dropzone Logic (Inchangée) ---

    function handleFileSelect(file) {
        if (!file) {
            dictionaryFile = null;
            dictStartBtn.disabled = true;
            return;
        }

        if (file.type !== 'text/plain') {
            showNotification('Invalid file type. Please upload a .txt file.', 'error');
            dictFileDropzone.classList.remove('file-selected');
            dictFileDropzone.classList.remove('dragover');
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


    // --- 4. Attack Submission & Animation (Inchangée) ---

    bfForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = bfPasswordType.value;
        const target = bfTarget.username;
        if (!target) return;
        
        setupContainer.style.display = 'none'; 
        simulationContainer.style.display = 'flex'; 
        simulationContainer.classList.add('visible'); 
        animTitle.textContent = `Running Brute Force (${type}) on "${target}"...`;
        
        runBruteForceAttack(target, type);
    });
    
    dictForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const target = dictTarget.username;
        if (!target || !dictionaryFile) return;

        setupContainer.style.display = 'none'; 
        simulationContainer.style.display = 'flex'; 
        simulationContainer.classList.add('visible'); 
        animTitle.textContent = `Running Dictionary Attack on "${target}"...`;
        
        runDictionaryAttack(target, dictionaryFile);
    });
    
    async function runAttackAnimation(attackPromise) {
        
        animProgress.style.width = '0%'; 

        const MIN_ANIMATION_DURATION = 3000; 
        const animationTimer = new Promise(resolve => setTimeout(resolve, MIN_ANIMATION_DURATION));
        
        animProgress.style.transition = 'none'; 
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { 
                 animProgress.style.transition = `width ${MIN_ANIMATION_DURATION}ms cubic-bezier(0.25, 1, 0.5, 1)`;
                 animProgress.style.width = '100%';
            });
        });

        let realResult;
        try {
            const [fetchResult] = await Promise.all([
                attackPromise,
                animationTimer
            ]);
            
            realResult = fetchResult; 
            
            if (!realResult.ok) {
                const errorData = await realResult.json();
                throw new Error(errorData.detail || 'Attack failed');
            }
            
            realResult = await realResult.json(); 

        } catch (error) {
            showNotification(error.message, 'error');
            resetAttackUI(); 
            return;
        }

        displayAttackResults(realResult);
    }

    function runBruteForceAttack(targetUsername, charsetType) {
        const attackPromise = secureFetch('/passwords-and-attacks/attack/bruteforce', {
            method: 'POST',
            body: JSON.stringify({
                target_username: targetUsername,
                charset_type: charsetType
            })
        });
        
        runAttackAnimation(attackPromise);
    }
    
    function runDictionaryAttack(targetUsername, file) {
        const formData = new FormData();
        formData.append('dictionary_file', file);
        formData.append('target_username', targetUsername);

        const attackPromise = secureFetch('/passwords-and-attacks/attack/dictionary', {
            method: 'POST',
            body: formData,
            headers: { 'Content-Type': undefined } 
        });
        
        runAttackAnimation(attackPromise);
    }


    // --- 5. Results Display Logic (MODIFIED) ---

    function displayAttackResults(result) {
        simulationContainer.style.display = 'none'; 
        resultsContainer.classList.add('visible'); 
        resultsContainer.style.display = 'flex'; 

        // --- [LE VRAI FIX POUR L'ICÔNE] ---
        // Sélectionne le <svg> que Lucide crée, pas la balise <i>.
        const existingIcon = resultHeader.querySelector('svg');
        if (existingIcon) {
            existingIcon.remove();
        }
        
        // Réinitialiser les animations
        resultTitle.style.opacity = 0;
        resultPasswordBox.style.display = 'none';
        resultMessageBox.style.display = 'none';
        resultPasswordBox.style.opacity = 0; 
        resultMessageBox.style.opacity = 0;
        resultPasswordBox.style.transform = 'translateY(20px)';
        resultMessageBox.style.transform = 'translateY(20px)';
        
        // --- [LE VRAI FIX POUR LES STATS] ---
        // Réinitialiser la transformation sur le CONTENEUR des stats
        resultStatsBox.style.transform = 'none'; 
        // Réinitialiser les cartes individuelles
        resultStatsBox.querySelectorAll('.attack-stat-card').forEach(card => {
            card.style.transform = 'rotateY(-90deg)';
        });

        attackResetBtn.style.opacity = 0;
        attackResetBtn.style.transform = 'translateY(20px)';
        
        const iconEl = document.createElement('i'); // Crée la balise <i>
        
        if (result.found) {
            resultHeader.className = 'attack-result-header success';
            resultTitle.innerHTML = 'Password Found!';
            iconEl.setAttribute('data-lucide', 'shield-check');
            resultHeader.prepend(iconEl); // Ajoute <i>
            
            resultPasswordBox.style.display = 'flex'; 
            resultPasswordCode.textContent = result.password; 
        } else {
            resultHeader.className = 'attack-result-header fail';
            resultTitle.innerHTML = 'Attack Failed';
            iconEl.setAttribute('data-lucide', 'shield-off');
            resultHeader.prepend(iconEl); // Ajoute <i>

            resultPasswordBox.style.display = 'none'; 
            resultMessageBox.style.display = 'block'; 
            resultMessage.textContent = result.message || "Password not found.";
        }

        // Les stats sont définies ici, que l'attaque ait réussi ou non
        resultAttempts.textContent = result.attempts.toLocaleString();
        resultTime.textContent = `${result.time_taken.toFixed(4)}s`;
        
        // Lucide transforme <i> en <svg>
        if (typeof lucide !== 'undefined') lucide.createIcons(); 

        // Animer les résultats
        if (typeof anime !== 'undefined') {
            const tl = anime.timeline({
                easing: 'easeOutExpo',
                duration: 800
            });

            tl.add({
                targets: resultHeader.querySelector('svg'), // Cible le <svg>
                scale: [0, 1],
                rotate: '1turn',
                duration: 600
            })
            .add({
                targets: resultTitle,
                opacity: [0, 1],
            }, '-=400')
            .add({
                // Les stats sont animées ici
                targets: resultStatsBox.querySelectorAll('.attack-stat-card'),
                transform: 'rotateY(0deg)',
                delay: anime.stagger(200),
                duration: 600
            }, '-=500')
            .add({
                targets: [resultPasswordBox, resultMessageBox], 
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
        } else {
             // Fallback
             resultTitle.style.opacity = 1;
             resultPasswordBox.style.opacity = 1; 
             resultMessageBox.style.opacity = 1;
             resultPasswordBox.style.transform = 'translateY(0)';
             resultMessageBox.style.transform = 'translateY(0)';
             resultStatsBox.querySelectorAll('.attack-stat-card').forEach(card => {
                card.style.transform = 'rotateY(0deg)';
             });
             attackResetBtn.style.opacity = 1;
             attackResetBtn.style.transform = 'translateY(0)';
        }
    }
});