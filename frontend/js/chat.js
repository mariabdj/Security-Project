/* ---
   SSAD Chat Modal Logic (chat.js)
   --- */

document.addEventListener('DOMContentLoaded', () => {

    // --- STATE VARIABLES ---
    let activeChatData = null; 
    let allChatRequests = []; 
    let chatSessionKeys = {}; 
    let searchDebounceTimer = null;
    let activeChatState = { id: null, isDecrypted: false };
    let messagePollInterval = null;
    let currentUserId = '';
    
    try {
        currentUserId = JSON.parse(atob(TOKEN.split('.')[1])).sub;
    } catch (e) { 
        console.error("Could not decode token:", e);
        if(typeof logoutUser === 'function') logoutUser();
        else window.location.href = 'index.html';
    }

    // --- ELEMENT SELECTORS ---
    const chatModal = document.getElementById('chat-modal');
    if (!chatModal) return;
    
    const openChatBtn = document.getElementById('open-chat-modal');
    const chatWrapper = chatModal.querySelector('.chat-wrapper');
    const chatNav = chatModal.querySelector('.chat-nav');
    const chatSidebar = chatModal.querySelector('.chat-sidebar');
    const chatMain = chatModal.querySelector('.chat-main');
    const chatNavLinks = chatNav.querySelectorAll('.chat-nav-link');
    const chatRequestsCount = document.getElementById('chat-requests-count');
    document.getElementById('chat-current-username').textContent = CURRENT_USERNAME;
    const sidebarPanels = chatSidebar.querySelectorAll('.chat-sidebar-panel');
    const chatListContainer = document.getElementById('chat-list-container');
    const chatRequestsContainer = document.getElementById('chat-requests-container');
    const chatSearchInput = document.getElementById('chat-search-input');
    const chatSearchResultsContainer = document.getElementById('chat-search-results-container');
    const mainPanels = {
        placeholder: document.getElementById('chat-main-placeholder'),
        messages: document.getElementById('chat-message-area'),
        request: document.getElementById('chat-request-area')
    };
    const chatBackButton = document.getElementById('chat-back-btn');
    const msgHeaderUsername = document.getElementById('chat-active-username');
    const msgHeaderCryptoMethod = document.getElementById('chat-crypto-method');
    const msgHeaderCryptoIcon = document.getElementById('chat-crypto-icon');
    const msgDecryptBtn = document.getElementById('chat-decrypt-btn');
    const msgContainer = document.getElementById('chat-messages-container');
    const msgForm = document.getElementById('chat-message-form');
    const msgInput = document.getElementById('chat-message-input');
    const msgSendBtn = document.getElementById('chat-send-btn');
    const msgAttachBtn = document.getElementById('chat-attach-file-btn');
    const msgFileInput = document.getElementById('chat-file-input');
    const reqForm = document.getElementById('chat-request-form');
    const reqUsername = document.getElementById('chat-request-username');
    const reqMethod = document.getElementById('chat-request-method');
    const reqShiftGroup = document.getElementById('chat-request-shift-group');
    const reqKeyGroup = document.getElementById('chat-request-key-group');
    const reqSizeGroup = document.getElementById('chat-request-size-group'); // Hill
    const reqShiftInput = document.getElementById('chat-request-shift');
    const reqKeyInput = document.getElementById('chat-request-key');
    const reqSizeInput = document.getElementById('chat-request-size'); // Hill

    // [NOUVEAU] Sélecteurs pour Playfair
    const reqSizeGroupPlayfair = document.getElementById('chat-request-size-group-playfair');
    const reqSizePlayfairInput = document.getElementById('chat-request-size-playfair');

    const keyPrompt = document.getElementById('chat-key-prompt');
    const keyPromptForm = document.getElementById('chat-key-prompt-form');
    const keyPromptCancel = document.getElementById('chat-key-prompt-cancel');
    const keyPromptMethod = document.getElementById('chat-key-prompt-method');
    const keyPromptInput = document.getElementById('chat-key-prompt-input');

    // --- INITIALIZATION & POLLING (Inchangés) ---
    
    function stopMessagePolling() {
        if (messagePollInterval) clearInterval(messagePollInterval);
        messagePollInterval = null;
    }
    
    function startMessagePolling(chatId) {
        stopMessagePolling(); 
        fetchMessages(chatId, false);
        messagePollInterval = setInterval(() => {
            if (activeChatData && activeChatData.id === chatId) {
                fetchMessages(chatId, true); 
            } else {
                stopMessagePolling();
            }
        }, 3000); // Poll every 3 seconds
    }

    async function initChatModal() {
        chatSessionKeys = {}; // Réinitialiser les clés de session
        activeChatData = null;
        activeChatState = { id: null, isDecrypted: false };
        stopMessagePolling(); 
        showMainPanel('placeholder');
        switchPanel('chats'); 
        updateUIState();
        await fetchAllChatData();
    }

    // --- DATA FETCHING (Inchangé) ---
    
    async function fetchAllChatData() {
        try {
            const response = await secureFetch('/chats/requests');
            if (!response.ok) throw new Error('Failed to fetch chat data.');
            allChatRequests = await response.json();
            const pendingRequests = allChatRequests.filter(r => 
                r.status === 'pending' && r.sender_id !== currentUserId
            );
            const activeChats = allChatRequests.filter(r => r.status === 'accepted');

            renderRequestList(pendingRequests);
            renderChatList(activeChats);
            
            if (pendingRequests.length > 0) {
                chatRequestsCount.textContent = pendingRequests.length;
                chatRequestsCount.style.display = 'block';
                chatRequestsCount.classList.add('visible');
            } else {
                chatRequestsCount.classList.remove('visible');
                chatRequestsCount.style.display = 'none';
            }
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
    
    async function fetchMessages(chatId, isPoll = false) {
        if (!chatId) return;
        try {
            const response = await secureFetch(`/chats/${chatId}/messages`);
            if (!response.ok) throw new Error('Failed to fetch messages.');
            const messages = await response.json();
            const existingMessageCount = msgContainer.querySelectorAll('.chat-message').length;
            if (isPoll && messages.length === existingMessageCount) return;
            renderMessages(messages, activeChatData);
        } catch (error) {
            if (!isPoll) showNotification(error.message, 'error');
            else console.warn("Message poll failed silently:", error);
        }
    }

    // --- UI RENDERING (Fonctions de rendu inchangées) ---
    
    function switchPanel(panelName) {
        sidebarPanels.forEach(p => p.classList.remove('active'));
        document.getElementById(`chat-panel-${panelName}`).classList.add('active');
        chatNavLinks.forEach(l => l.classList.remove('active'));
        document.getElementById(`chat-nav-${panelName}`).classList.add('active');
    }
    
    function showMainPanel(panelName) {
        if (panelName !== 'messages') stopMessagePolling();
        
        Object.values(mainPanels).forEach(p => {
            p.style.display = 'none';
            p.classList.remove('active');
        });
        
        if (panelName === 'placeholder') {
            mainPanels.placeholder.style.display = 'flex';
        } else if (panelName === 'messages') {
            mainPanels.messages.style.display = 'flex';
            mainPanels.messages.classList.add('active');
        } else if (panelName === 'request') {
            mainPanels.request.style.display = 'flex';
            mainPanels.request.classList.add('active');
        }
        
        // Gérer le placeholder
        if (mainPanels.messages.classList.contains('active') || mainPanels.request.classList.contains('active')) {
             mainPanels.placeholder.style.display = 'none';
        } else {
             mainPanels.placeholder.style.display = 'flex';
        }
        
        updateUIState();
    }
    
    function renderChatList(chats) {
        chatListContainer.innerHTML = ''; 
        if (chats.length === 0) {
            chatListContainer.innerHTML = `<div class="chat-list-placeholder"><i data-lucide="message-circle"></i><p>You have no active chats. Click "New Chat" to find a user.</p></div>`;
            lucide.createIcons(); return;
        }
        chats.forEach(chat => {
            const displayName = chat.sender_id === currentUserId ? chat.receiver_username : chat.sender_username;
            const avatarLetter = displayName.charAt(0).toUpperCase();
            const chatEl = document.createElement('button');
            chatEl.className = 'chat-list-item';
            chatEl.dataset.chatId = chat.id;
            chatEl.innerHTML = `
                <div class="avatar">${avatarLetter}</div>
                <div class="chat-info">
                    <h3>${displayName}</h3>
                    <p>Encryption: ${chat.encryption_method}</p>
                </div>
            `;
            chatEl.addEventListener('click', () => selectChat(chat));
            chatListContainer.appendChild(chatEl);
        });
        lucide.createIcons();
    }
    
    function renderRequestList(requests) {
        chatRequestsContainer.innerHTML = '';
        if (requests.length === 0) {
            chatRequestsContainer.innerHTML = `<div class="chat-list-placeholder"><i data-lucide="user-plus"></i><p>You have no pending chat requests.</p></div>`;
            lucide.createIcons(); return;
        }
        requests.forEach(req => {
            const avatarLetter = req.sender_username.charAt(0).toUpperCase();
            const reqEl = document.createElement('div');
            reqEl.className = 'chat-list-item';
            reqEl.dataset.requestId = req.id;
            reqEl.innerHTML = `
                <div class="avatar">${avatarLetter}</div>
                <div class="chat-info">
                    <h3>${req.sender_username}</h3>
                    <p>Wants to chat via ${req.encryption_method}</p>
                </div>
                <div class="request-actions">
                    <button class="btn-icon accept" title="Accept"><i data-lucide="check"></i></button>
                    <button class="btn-icon reject" title="Reject"><i data-lucide="x"></i></button>
                </div>
            `;
            reqEl.querySelector('.accept').addEventListener('click', (e) => { e.stopPropagation(); handleRespondToRequest(req.id, 'accepted'); });
            reqEl.querySelector('.reject').addEventListener('click', (e) => { e.stopPropagation(); handleRespondToRequest(req.id, 'rejected'); });
            chatRequestsContainer.appendChild(reqEl);
        });
        lucide.createIcons();
    }
    
    function renderSearchResults(users) {
        chatSearchResultsContainer.innerHTML = '';
        if (users.length === 0) {
            chatSearchResultsContainer.innerHTML = `<div class="chat-list-placeholder"><i data-lucide="user-x"></i><p>No users found matching that query.</p></div>`;
            lucide.createIcons(); return;
        }
        users.forEach(user => {
            const avatarLetter = user.username.charAt(0).toUpperCase();
            const userEl = document.createElement('button');
            userEl.className = 'chat-list-item';
            userEl.dataset.userId = user.id;
            userEl.dataset.username = user.username;
            userEl.innerHTML = `
                <div class="avatar">${avatarLetter}</div>
                <div class="chat-info">
                    <h3>${user.username}</h3>
                    <p>Click to send a chat request</p>
                </div>
            `;
            userEl.addEventListener('click', () => showRequestForm(user));
            chatSearchResultsContainer.appendChild(userEl);
        });
        lucide.createIcons();
    }
    
    function renderMessages(messages, chatData) {
        msgContainer.innerHTML = '';
        if (!messages || messages.length === 0) {
            msgContainer.innerHTML = `<div class="chat-list-placeholder"><i data-lucide="messages-square"></i><p>This is the beginning of your secure conversation.</p></div>`;
            lucide.createIcons(); return;
        }
        const shouldScroll = msgContainer.scrollTop + msgContainer.clientHeight >= msgContainer.scrollHeight - 50;
        messages.forEach(msg => { renderSingleMessage(msg, chatData, false); });
        if (shouldScroll) msgContainer.scrollTop = msgContainer.scrollHeight;
    }
    
    function renderSingleMessage(message, chatData, isNew) {
        const isDecrypted = activeChatState.isDecrypted;
        const sessionKey = chatSessionKeys[chatData.id];
        const isSent = message.sender_id === currentUserId;
        const messageType = isSent ? 'sent' : 'received';
        let contentHtml = '';
        if (message.content_type === 'steg_file_link') {
            let filename = 'encrypted_file';
            let decryptedUrl = '#';
            let isLinkReady = false;
            if (isDecrypted && sessionKey) {
                decryptedUrl = decryptMessage(message.encrypted_content, chatData, sessionKey);
                try {
                    const match = decryptedUrl.match(/[a-f0-9-]{36}-(.*)/i);
                    filename = match ? decodeURIComponent(match[1]) : 'downloaded_file';
                } catch (e) { filename = 'downloaded_file'; }
                isLinkReady = true;
            }
            contentHtml = `<a class="chat-message-file-btn" data-url="${isLinkReady ? decryptedUrl : ''}" data-filename="${filename}" title="${isLinkReady ? 'Click to download' : 'Decrypt chat to download'}"><i data-lucide="${isLinkReady ? 'download' : 'file-lock-2'}"></i><span>${filename}</span><div class="loader"></div></a>`;
        } else {
            if (isDecrypted && sessionKey) {
                contentHtml = decryptMessage(message.encrypted_content, chatData, sessionKey);
            } else {
                contentHtml = message.encrypted_content;
            }
        }
        const msgEl = document.createElement('div');
        msgEl.className = `chat-message ${messageType}`;
        msgEl.innerHTML = `<div class="chat-message-content ${isDecrypted ? 'decrypted' : 'encrypted'}" data-encrypted-text="${message.encrypted_content}" data-content-type="${message.content_type}">${contentHtml}</div>`;
        msgContainer.appendChild(msgEl);
        if (isNew) {
            msgEl.style.animation = 'slide-in 0.3s ease-out';
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }
        lucide.createIcons();
    }
    
    function reRenderAllMessages() {
        if (!activeChatData) return;
        const allMessageElements = Array.from(msgContainer.querySelectorAll('.chat-message-content'));
        const reconstructedMessages = allMessageElements.map(el => ({
            sender_id: el.parentElement.classList.contains('sent') ? currentUserId : 'other', 
            encrypted_content: el.dataset.encryptedText,
            content_type: el.dataset.contentType
        }));
        renderMessages(reconstructedMessages, activeChatData);
    }

    // --- CORE CHAT LOGIC (Partiellement modifié) ---
    
    async function selectChat(chatData) {
        activeChatData = chatData;
        activeChatState = { id: chatData.id, isDecrypted: !!chatSessionKeys[chatData.id] };
        
        const displayName = chatData.sender_id === currentUserId ? chatData.receiver_username : chatData.sender_username;
        msgHeaderUsername.textContent = `Chat with ${displayName}`;
        msgHeaderCryptoMethod.textContent = chatData.encryption_method;
        
        updateDecryptButtonState();
        showMainPanel('messages');
        startMessagePolling(chatData.id);
    }
    
    function showRequestForm(user) {
        activeChatData = null; 
        activeChatState = { id: null, isDecrypted: false };
        reqUsername.textContent = user.username;
        reqForm.dataset.receiverId = user.id; 
        showMainPanel('request');
    }
    
    function handleDecryptToggle() {
        if (!activeChatData) return;
        const chatId = activeChatData.id;
        if (activeChatState.isDecrypted) {
            activeChatState.isDecrypted = false;
            updateDecryptButtonState();
            reRenderAllMessages(); 
        } else {
            if (chatSessionKeys[chatId]) {
                activeChatState.isDecrypted = true;
                updateDecryptButtonState();
                reRenderAllMessages(); 
            } else {
                showKeyPrompt(activeChatData);
            }
        }
    }

    function showKeyPrompt(chatData) {
        let methodDesc = chatData.encryption_method;
        if (methodDesc === 'playfair') {
            methodDesc += ` (${chatData.encryption_params.size}x${chatData.encryption_params.size})`;
        } else if (methodDesc === 'hill') {
            methodDesc += ` (${chatData.encryption_params.size}x${chatData.encryption_params.size})`;
        }
        keyPromptMethod.textContent = methodDesc;
        keyPrompt.classList.add('visible');
        keyPromptInput.focus();
        keyPrompt.dataset.chatId = chatData.id;
    }

    function handleKeyPromptSubmit(e) {
        e.preventDefault();
        const chatId = keyPrompt.dataset.chatId;
        const key = keyPromptInput.value;
        if (!key || !chatId) return;
        chatSessionKeys[chatId] = key; 
        activeChatState.isDecrypted = true; 
        keyPrompt.classList.remove('visible');
        keyPromptInput.value = '';
        updateDecryptButtonState();
        reRenderAllMessages(); 
    }

    function updateDecryptButtonState() {
        if (!msgDecryptBtn) return; 
        const btnIcon = msgDecryptBtn.querySelector('i');
        const btnText = msgDecryptBtn.querySelector('span');
        if (activeChatState.isDecrypted) {
            msgDecryptBtn.classList.remove('encrypted');
            msgDecryptBtn.classList.add('decrypted');
            if (btnText) btnText.textContent = 'Encrypt';
            if (btnIcon) btnIcon.outerHTML = '<i data-lucide="unlock"></i>';
        } else {
            msgDecryptBtn.classList.remove('decrypted');
            msgDecryptBtn.classList.add('encrypted');
            if (btnText) btnText.textContent = 'Decrypt';
            if (btnIcon) btnIcon.outerHTML = '<i data-lucide="lock"></i>';
        }
        lucide.createIcons();
    }
    
    async function handleSendMessage(e) {
        e.preventDefault();
        const text = msgInput.value.trim();
        if (!text || !activeChatData) return;
        const sessionKey = chatSessionKeys[activeChatData.id];
        if (!sessionKey) {
            showNotification('Please decrypt the chat once (by entering the key) to enable sending messages.', 'error');
            return;
        }
        setButtonLoading(msgSendBtn, true);
        try {
            const encryptedText = encryptMessage(text, activeChatData, sessionKey);
            const payload = { encrypted_content: encryptedText, content_type: 'text' };
            const response = await secureFetch(`/chats/${activeChatData.id}/messages`, { method: 'POST', body: JSON.stringify(payload) });
            if (!response.ok) throw new Error('Failed to send message.');
            const newMessage = await response.json();
            renderSingleMessage(newMessage, activeChatData, true);
            msgInput.value = '';
            msgInput.style.height = 'auto'; 
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setButtonLoading(msgSendBtn, false);
        }
    }
    
    async function handleSendFile() {
        if (!activeChatData) return;
        const file = msgFileInput.files[0];
        if (!file) return;
        const sessionKey = chatSessionKeys[activeChatData.id];
        if (!sessionKey) {
            showNotification('Please decrypt the chat once (by entering the key) to enable sending files.', 'error');
            return;
        }
        const formData = new FormData();
        formData.append('file', file);
        showNotification('Uploading file... this may take a moment.', 'success');
        setButtonLoading(msgSendBtn, true); 
        try {
            const storageResponse = await secureFetch('/storage/upload', { method: 'POST', body: formData, headers: { 'Content-Type': undefined } });
            if (!storageResponse.ok) { const errData = await storageResponse.json(); throw new Error(errData.detail || 'Failed to upload file to storage.'); }
            const storageData = await storageResponse.json();
            const fileUrl = storageData.file_url;
            const encryptedUrl = encryptMessage(fileUrl, activeChatData, sessionKey);
            const payload = { encrypted_content: encryptedUrl, content_type: 'steg_file_link' };
            const msgResponse = await secureFetch(`/chats/${activeChatData.id}/messages`, { method: 'POST', body: JSON.stringify(payload) });
            if (!msgResponse.ok) throw new Error('Failed to send file message.');
            const newMessage = await msgResponse.json();
            renderSingleMessage(newMessage, activeChatData, true);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setButtonLoading(msgSendBtn, false);
            msgFileInput.value = '';
        }
    }
    
    async function handleFileDownload(e) {
        const button = e.target.closest('.chat-message-file-btn');
        if (!button) return;
        const url = button.dataset.url;
        const filename = button.dataset.filename;
        const loader = button.querySelector('.loader');
        if (!url || url === '#') {
            showNotification('You must decrypt the chat to download files.', 'error');
            return;
        }
        loader.style.display = 'block';
        try {
            const response = await secureFetch(url); 
            if (!response.ok) throw new Error('File not found or access denied.');
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const tempLink = document.createElement('a');
            tempLink.href = objectUrl;
            tempLink.download = filename;
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            loader.style.display = 'none';
        }
    }
    
    function handleSearchInput() {
        clearTimeout(searchDebounceTimer);
        const query = chatSearchInput.value.trim();
        if (query.length < 2) {
            chatSearchResultsContainer.innerHTML = `<div class="chat-list-placeholder"><i data-lucide="users"></i><p>Enter at least 2 characters to search.</p></div>`;
            lucide.createIcons(); return;
        }
        searchDebounceTimer = setTimeout(async () => {
            try {
                chatSearchResultsContainer.innerHTML = `<div class_name="loader-container" style="display:flex; justify-content:center; padding:2rem;"><div class="loader"></div></div>`;
                const response = await secureFetch(`/users/search?query=${encodeURIComponent(query)}`);
                if (!response.ok) throw new Error('Search failed.');
                const users = await response.json();
                renderSearchResults(users);
            } catch (error) {
                showNotification(error.message, 'error');
                renderSearchResults([]); 
            }
        }, 300);
    }
    
    // [MODIFIÉ] Gérer l'envoi de la demande
    async function handleSendRequest(e) {
        e.preventDefault();
        setButtonLoading(reqSendBtn, true);
        let key; 
        
        try {
            const receiverId = reqForm.dataset.receiverId;
            const method = reqMethod.value;
            let params = {};

            if (method === 'caesar') {
                const shift = parseInt(reqShiftInput.value);
                if (isNaN(shift)) throw new Error('Caesar shift must be a number.');
                params = { shift };
                key = String(shift); 
            } else if (method === 'playfair') {
                key = reqKeyInput.value.trim().toUpperCase();
                // [NOUVEAU] Récupérer la taille pour Playfair
                const size = parseInt(reqSizePlayfairInput.value);
                if (!key) throw new Error('Playfair key is required.');
                if (![5, 6].includes(size)) throw new Error('Playfair size must be 5 or 6.');
                // Validation côté client (basée sur la logique Python)
                if (size === 6 && !/\d/.test(key)) throw new Error('Playfair 6x6 key must contain at least one digit.');
                
                params = { key, size }; // Envoyer la clé et la taille
            } else if (method === 'hill') {
                key = reqKeyInput.value.trim().toUpperCase();
                const size = parseInt(reqSizeInput.value);
                if (isNaN(size) || size < 2 || size > 3) throw new Error('Hill size must be 2 or 3.');
                if (!key || !/^[A-Z]+$/.test(key)) throw new Error('Hill key must be letters only.');
                if (key.length !== size * size) throw new Error(`Hill key must be ${size*size} letters for a ${size}x${size} matrix.`);
                params = { key, size };
            } else {
                throw new Error('Please select an encryption method.');
            }

            const payload = {
                receiver_id: receiverId,
                encryption_method: method,
                encryption_params: params
            };

            const response = await secureFetch('/chats/request', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Failed to send request.');

            showNotification('Chat request sent!', 'success');
            
            chatSessionKeys[data.id] = key; // Sauvegarder la clé (sans la taille, gérée par params)
            
            await fetchAllChatData(); 
            switchPanel('chats');
            showMainPanel('placeholder'); 
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setButtonLoading(reqSendBtn, false);
        }
    }
    
    async function handleRespondToRequest(requestId, status) {
        try {
            const response = await secureFetch(`/chats/requests/${requestId}`, { method: 'PUT', body: JSON.stringify({ status }) });
            if (!response.ok) throw new Error('Failed to respond to request.');
            
            if (status === 'accepted') {
                showNotification('Chat request accepted!', 'success');
                const originalRequest = allChatRequests.find(r => r.id === requestId);
                showKeyPrompt(originalRequest); 
            } else {
                showNotification('Chat request rejected.', 'success');
            }
            await fetchAllChatData();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    function updateUIState() {
        if (window.innerWidth <= 768) {
            if (mainPanels.messages.style.display === 'flex' || mainPanels.request.style.display === 'flex') {
                chatWrapper.classList.add('chat-active');
            } else {
                chatWrapper.classList.remove('chat-active');
            }
        } else {
            chatWrapper.classList.remove('chat-active');
        }
    }

    // --- EVENT LISTENERS (Partiellement modifié) ---
    
    openChatBtn.addEventListener('click', initChatModal);

    chatNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            const panelName = link.dataset.panel;
            switchPanel(panelName);
            showMainPanel('placeholder');
            if(panelName === 'search') chatSearchInput.focus();
        });
    });

    chatSearchInput.addEventListener('input', handleSearchInput);
    msgForm.addEventListener('submit', handleSendMessage);
    msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }
    });
    msgInput.addEventListener('input', () => {
        msgInput.style.height = 'auto';
        msgInput.style.height = `${msgInput.scrollHeight}px`;
    });
    
    msgAttachBtn.addEventListener('click', () => msgFileInput.click());
    msgFileInput.addEventListener('change', handleSendFile);
    msgContainer.addEventListener('click', handleFileDownload);
    msgDecryptBtn.addEventListener('click', handleDecryptToggle);
    reqForm.addEventListener('submit', handleSendRequest);

    // [MODIFIÉ] Listener de changement de méthode de requête
    reqMethod.addEventListener('change', () => {
        const method = reqMethod.value;
        reqShiftGroup.style.display = 'none';
        reqKeyGroup.style.display = 'none';
        reqSizeGroup.style.display = 'none'; // Hill
        reqSizeGroupPlayfair.style.display = 'none'; // Playfair
        
        if (method === 'caesar') {
            reqShiftGroup.style.display = 'block';
        } else if (method === 'playfair') { 
            reqKeyGroup.style.display = 'block';
            reqSizeGroupPlayfair.style.display = 'block'; // Afficher la taille Playfair
        } else if (method === 'hill') {
            reqKeyGroup.style.display = 'block';
            reqSizeGroup.style.display = 'block'; // Afficher la taille Hill
        }
    });
    
    keyPromptForm.addEventListener('submit', handleKeyPromptSubmit);
    keyPromptCancel.addEventListener('click', () => {
        keyPrompt.classList.remove('visible');
        keyPromptInput.value = '';
    });
    
    chatBackButton.addEventListener('click', () => {
        showMainPanel('placeholder');
        activeChatData = null;
    });

    window.addEventListener('resize', updateUIState);

    // ---
    // --- [SECTION] CLIENT-SIDE CRYPTO IMPLEMENTATIONS ---
    // ---
    
    // [MODIFIÉ] Fonctions wrapper pour passer 'size'
    function encryptMessage(text, chatData, key) {
        const { encryption_method, encryption_params } = chatData;
        try {
            if (encryption_method === 'caesar') {
                return caesarEncrypt(text, parseInt(key));
            }
            if (encryption_method === 'playfair') {
                return playfairEncrypt(text, key, parseInt(encryption_params.size));
            }
            if (encryption_method === 'hill') {
                return hillEncrypt(text, key, parseInt(encryption_params.size));
            }
            return text; 
        } catch (e) {
            console.error("Encryption Error:", e);
            showNotification(`Client Encryption Error: ${e.message}`, 'error');
            return "ENCRYPTION_ERROR";
        }
    }
    
    function decryptMessage(text, chatData, key) {
        const { encryption_method, encryption_params } = chatData;
        try {
            if (encryption_method === 'caesar') {
                return caesarDecrypt(text, parseInt(key));
            }
            if (encryption_method === 'playfair') {
                return playfairDecrypt(text, key, parseInt(encryption_params.size));
            }
            if (encryption_method === 'hill') {
                return hillDecrypt(text, key, parseInt(encryption_params.size));
            }
            return text; 
        } catch (e) {
            console.error("Decryption Error:", e);
            return "[DECRYPTION FAILED: Invalid Key?]";
        }
    }

    // --- César (Inchangé) ---
    function caesarEncrypt(text, shift) {
        return text.split('').map(char => {
            if (char >= 'a' && char <= 'z') {
                let newOrd = char.charCodeAt(0) + (shift % 26);
                if (newOrd > 'z'.charCodeAt(0)) newOrd -= 26;
                if (newOrd < 'a'.charCodeAt(0)) newOrd += 26;
                return String.fromCharCode(newOrd);
            } else if (char >= 'A' && char <= 'Z') {
                let newOrd = char.charCodeAt(0) + (shift % 26);
                if (newOrd > 'Z'.charCodeAt(0)) newOrd -= 26;
                if (newOrd < 'A'.charCodeAt(0)) newOrd += 26;
                return String.fromCharCode(newOrd);
            }
            return char;
        }).join('');
    }
    function caesarDecrypt(text, shift) {
        return caesarEncrypt(text, -shift);
    }

    // --- [MODIFIÉ] Logique Playfair (pour gérer 5x5 et 6x6) ---
    
    // Cache pour les matrices générées
    let pfMatrixCache = {};

    // Fonction de nettoyage (portage de la logique Python)
    const pf_nettoyer_texte = (texte, taille) => {
        texte = texte.toLowerCase();
        texte = texte.replace(/[éèê]/g, "e").replace(/[àâ]/g, "a").replace(/ç/g, "c");
        texte = texte.replace(/[^a-z0-9]/g, "").toUpperCase();
        
        let lettres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let chiffres = "0123456789";
        let texte_nettoye = "";

        if (taille == 5) {
            lettres = lettres.replace("J", ""); // J exclu
            for (const c of texte) {
                if (lettres.includes(c)) texte_nettoye += (c === 'J' ? 'I' : c); // Convert J to I
            }
        } else if (taille == 6) {
            for (const c of texte) {
                if ((lettres + chiffres).includes(c)) texte_nettoye += c;
            }
        }
        return texte_nettoye;
    };

    function getPlayfairMatrix(key, size) {
        const cacheKey = `${key}_${size}`;
        if (pfMatrixCache[cacheKey]) return pfMatrixCache[cacheKey];

        const cle_nettoyee = pf_nettoyer_texte(key, size); // Nettoyer la clé
        
        let grille = [];
        let deja_vu = "";
        let alphabet_base = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        
        if (size == 5) {
            alphabet_base = alphabet_base.replace("J", "I"); // I/J sont fusionnés
        } else {
            alphabet_base += "0123456789";
        }
        
        (cle_nettoyee + alphabet_base).split('').forEach(c => {
             if (!deja_vu.includes(c)) {
                grille.push(c);
                deja_vu += c;
             }
        });

        // Convertir en 2D
        let matrix2D = [];
        for (let i = 0; i < size; i++) {
            matrix2D.push(grille.slice(i * size, (i + 1) * size));
        }
        
        pfMatrixCache[cacheKey] = matrix2D;
        return matrix2D;
    }

    function findPlayfairPos(matrix, char, size) {
        if (char === 'J' && size === 5) char = 'I';
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (matrix[r][c] === char) return {r, c};
            }
        }
        return null; // Ne devrait pas arriver
    }
    
    const pf_paires = (texte) => {
        let resultat = [];
        let i = 0;
        while (i < texte.length) {
            let a = texte[i];
            let b = (i+1 < texte.length) ? texte[i+1] : 'X';
            if (a === b) {
                resultat.push([a, 'X']);
                i += 1;
            } else {
                resultat.push([a, b]);
                i += 2;
            }
        }
        return resultat;
    };

    function playfairEncrypt(text, key, size) {
        const matrix = getPlayfairMatrix(key, size);
        const texte_nettoye = pf_nettoyer_texte(text, size);
        const liste_paires = pf_paires(texte_nettoye);
        
        let cipher = "";
        liste_paires.forEach(paire => {
            let c1 = paire[0];
            let c2 = paire[1];
            let pos1 = findPlayfairPos(matrix, c1, size);
            let pos2 = findPlayfairPos(matrix, c2, size);
            if (!pos1 || !pos2) return; 

            if (pos1.r === pos2.r) {
                cipher += matrix[pos1.r][(pos1.c + 1) % size];
                cipher += matrix[pos2.r][(pos2.c + 1) % size];
            } else if (pos1.c === pos2.c) {
                cipher += matrix[(pos1.r + 1) % size][pos1.c];
                cipher += matrix[(pos2.r + 1) % size][pos2.c];
            } else {
                cipher += matrix[pos1.r][pos2.c];
                cipher += matrix[pos2.r][pos1.c];
            }
        });
        return cipher;
    }

    function playfairDecrypt(text, key, size) {
        const matrix = getPlayfairMatrix(key, size);
        let plain = "";
        let prepared = pf_nettoyer_texte(text, size); 
        
        for (let i = 0; i < prepared.length; i += 2) {
            let c1 = prepared[i];
            let c2 = prepared[i+1];
            if(!c2) continue; 
            let pos1 = findPlayfairPos(matrix, c1, size);
            let pos2 = findPlayfairPos(matrix, c2, size);
            if (!pos1 || !pos2) continue; 

            if (pos1.r === pos2.r) {
                plain += matrix[pos1.r][(pos1.c + size - 1) % size];
                plain += matrix[pos2.r][(pos2.c + size - 1) % size];
            } else if (pos1.c === pos2.c) {
                plain += matrix[(pos1.r + size - 1) % size][pos1.c];
                plain += matrix[(pos2.r + size - 1) % size][pos2.c];
            } else {
                plain += matrix[pos1.r][pos2.c];
                plain += matrix[pos2.r][pos1.c];
            }
        }
        return plain;
    }
    
    // --- Hill (Avec correction de bug) ---
    const A = 'A'.charCodeAt(0);
    const charToNum = (c) => c.charCodeAt(0) - A;
    const numToChar = (n) => String.fromCharCode(mod(n, 26) + A);

    function hillEncrypt(text, key, size) {
        const keyMatrix = createHillMatrix(key, size);
        let prepared = text.toUpperCase().replace(/[^A-Z]/g, '');
        while (prepared.length % size !== 0) prepared += 'X';
        
        let cipher = "";
        for (let i = 0; i < prepared.length; i += size) {
            const block = prepared.slice(i, i + size);
            const vector = block.split('').map(charToNum);
            const resultVector = multiplyMatrixVector(keyMatrix, vector);
            cipher += resultVector.map(n => numToChar(n)).join('');
        }
        return cipher;
    }
    function hillDecrypt(text, key, size) {
        const keyMatrix = createHillMatrix(key, size);
        const decryptMatrix = getHillDecryptMatrix(keyMatrix, size);
        if (!decryptMatrix) throw new Error("Hill key is not invertible (mod 26).");
        
        let plain = "";
        for (let i = 0; i < text.length; i += size) {
            const block = text.slice(i, i + size);
            if (block.length < size) continue; 
            const vector = block.split('').map(charToNum);
            const resultVector = multiplyMatrixVector(decryptMatrix, vector);
            plain += resultVector.map(n => numToChar(n)).join('');
        }
        return plain;
    }
    function createHillMatrix(key, size) {
        let matrix = Array(size).fill(0).map(() => Array(size));
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                matrix[r][c] = charToNum(key[r * size + c]);
            }
        }
        return matrix;
    }
    function multiplyMatrixVector(matrix, vector) {
        const size = matrix.length;
        let result = Array(size).fill(0);
        for (let r = 0; r < size; r++) {
            let sum = 0;
            for (let c = 0; c < size; c++) {
                sum += matrix[r][c] * vector[c];
            }
            result[r] = mod(sum, 26);
        }
        return result;
    }
    function mod(n, m) { return ((n % m) + m) % m; }
    function modInverse(a, m) {
        a = mod(a, m);
        for (let x = 1; x < m; x++) {
            if (mod(a * x, m) === 1) return x;
        }
        return null;
    }
    function determinant(matrix) {
        const n = matrix.length;
        if (n === 1) return matrix[0][0];
        if (n === 2) {
            return mod((matrix[0][0] * matrix[1][1]) - (matrix[0][1] * matrix[1][0]), 26);
        }
        if (n === 3) {
            const det = matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
                        matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
                        matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
            return mod(det, 26);
        }
        throw new Error("Only 2x2 and 3x3 matrices supported for client-side Hill.");
    }
    function getHillDecryptMatrix(matrix, size) {
        const det = determinant(matrix);
        const detInv = modInverse(det, 26);
        if (detInv === null) return null;
        let adjugate = Array(size).fill(0).map(() => Array(size));
        if (size === 2) {
            adjugate[0][0] = matrix[1][1];
            adjugate[0][1] = -matrix[0][1];
            adjugate[1][0] = -matrix[1][0];
            adjugate[1][1] = matrix[0][0];
        } else if (size === 3) {
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    let minor = [
                        [matrix[(r+1)%3][(c+1)%3], matrix[(r+1)%3][(c+2)%3]],
                        // [CORRIGÉ] Bug t -> c
                        [matrix[(r+2)%3][(c+1)%3], matrix[(r+2)%3][(c+2)%3]]
                    ];
                    let cofactor = (minor[0][0] * minor[1][1]) - (minor[0][1] * minor[1][0]);
                    if ((r + c) % 2 !== 0) cofactor = -cofactor;
                    adjugate[c][r] = cofactor; 
                }
            }
        } else {
            throw new Error("Only 2x2 and 3x3 matrices supported.");
        }
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                adjugate[r][c] = mod(adjugate[r][c] * detInv, 26);
            }
        }
        return adjugate;
    }
});
