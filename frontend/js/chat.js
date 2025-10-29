/* ---
   SSAD Chat Modal Logic (chat.js)
   --- */

document.addEventListener('DOMContentLoaded', () => {

    // --- STATE VARIABLES ---
    let activeChatData = null; // Stores data of the currently open chat
    let allChatRequests = []; // Caches all fetched chat requests
    
    // [FIX] This variable will now reset to {} on every page load,
    // as we are no longer using sessionStorage.
    let chatSessionKeys = {}; // { "chat-id": "decryption_key" }
    
    let searchDebounceTimer = null;
    let activeChatState = { id: null, isDecrypted: false };
    let messagePollInterval = null;

    let currentUserId = '';
    try {
        currentUserId = JSON.parse(atob(TOKEN.split('.')[1])).sub;
    } catch (e) { 
        console.error("Could not decode token:", e);
        showNotification('Invalid session. Please log in again.', 'error');
        // Call the global logoutUser function if it exists
        if(typeof logoutUser === 'function') {
            logoutUser();
        } else {
            // Fallback
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'index.html';
        }
    }

    // --- ELEMENT SELECTORS ---
    const chatModal = document.getElementById('chat-modal');
    if (!chatModal) {
        return;
    }
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
    const reqSizeGroup = document.getElementById('chat-request-size-group');
    const reqShiftInput = document.getElementById('chat-request-shift');
    const reqKeyInput = document.getElementById('chat-request-key');
    const reqSizeInput = document.getElementById('chat-request-size');
    const reqSendBtn = document.getElementById('chat-send-request-btn');
    const keyPrompt = document.getElementById('chat-key-prompt');
    const keyPromptForm = document.getElementById('chat-key-prompt-form');
    const keyPromptCancel = document.getElementById('chat-key-prompt-cancel');
    const keyPromptMethod = document.getElementById('chat-key-prompt-method');
    const keyPromptInput = document.getElementById('chat-key-prompt-input');

    // --- INITIALIZATION ---
    // [FIX] Removed loadSessionKeys() and saveSessionKeys() functions.
    // The keys are now only stored in the `chatSessionKeys` variable.

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
        }, 3000);
    }

    async function initChatModal() {
        // [FIX] No longer loading keys from sessionStorage.
        // `chatSessionKeys` is guaranteed to be {} at this point.
        activeChatData = null;
        activeChatState = { id: null, isDecrypted: false };
        stopMessagePolling(); 
        showMainPanel('placeholder');
        switchPanel('chats'); 
        updateUIState();
        await fetchAllChatData();
    }

    // --- DATA FETCHING ---
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
            if (isPoll && messages.length === existingMessageCount) {
                return; // No new messages
            }

            renderMessages(messages, activeChatData);
        } catch (error) {
            if (!isPoll) showNotification(error.message, 'error');
            else console.warn("Message poll failed silently:", error);
        }
    }

    // --- UI RENDERING ---
    function switchPanel(panelName) {
        sidebarPanels.forEach(p => p.classList.remove('active'));
        document.getElementById(`chat-panel-${panelName}`).classList.add('active');
        chatNavLinks.forEach(l => l.classList.remove('active'));
        document.getElementById(`chat-nav-${panelName}`).classList.add('active');
    }

    function showMainPanel(panelName) {
        if (panelName !== 'messages') {
            stopMessagePolling();
        }
        
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
        updateUIState();
    }

    function renderChatList(chats) {
        chatListContainer.innerHTML = ''; 
        if (chats.length === 0) {
            chatListContainer.innerHTML = `
                <div class="chat-list-placeholder">
                    <i data-lucide="message-circle"></i>
                    <p>You have no active chats. Click "New Chat" to find a user.</p>
                </div>`;
            lucide.createIcons();
            return;
        }

        chats.forEach(chat => {
            const displayName = chat.sender_username; 
            const avatarLetter = displayName.charAt(0).toUpperCase();
            const chatEl = document.createElement('button');
            chatEl.className = 'chat-list-item';
            chatEl.dataset.chatId = chat.id;
            chatEl.innerHTML = `
                <div class="avatar" style="--avatar-color: #3b82f6;">${avatarLetter}</div>
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
            chatRequestsContainer.innerHTML = `
                <div class="chat-list-placeholder">
                    <i data-lucide="user-plus"></i>
                    <p>You have no pending chat requests.</p>
                </div>`;
            lucide.createIcons();
            return;
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
            reqEl.querySelector('.accept').addEventListener('click', (e) => {
                e.stopPropagation();
                handleRespondToRequest(req.id, 'accepted');
            });
            reqEl.querySelector('.reject').addEventListener('click', (e) => {
                e.stopPropagation();
                handleRespondToRequest(req.id, 'rejected');
            });
            chatRequestsContainer.appendChild(reqEl);
        });
        lucide.createIcons();
    }

    function renderSearchResults(users) {
        chatSearchResultsContainer.innerHTML = '';
        if (users.length === 0) {
            chatSearchResultsContainer.innerHTML = `
                <div class="chat-list-placeholder">
                    <i data-lucide="user-x"></i>
                    <p>No users found matching that query.</p>
                </div>`;
            lucide.createIcons();
            return;
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
            lucide.createIcons();
            return;
        }
        
        const shouldScroll = msgContainer.scrollTop + msgContainer.clientHeight >= msgContainer.scrollHeight - 50;
        
        messages.forEach(msg => {
            renderSingleMessage(msg, chatData, false);
        });
        
        if (shouldScroll) {
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }
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
            
            contentHtml = `
                <a class="chat-message-file-btn" 
                   data-url="${isLinkReady ? decryptedUrl : ''}" 
                   data-filename="${filename}" 
                   title="${isLinkReady ? 'Click to download' : 'Decrypt chat to download'}">
                    <i data-lucide="${isLinkReady ? 'download' : 'file-lock-2'}"></i>
                    <span>${filename}</span>
                    <div class="loader"></div>
                </a>`;

        } else {
            // It's a text message.
            if (isDecrypted && sessionKey) {
                contentHtml = decryptMessage(message.encrypted_content, chatData, sessionKey);
            } else {
                contentHtml = message.encrypted_content;
            }
        }
        
        const msgEl = document.createElement('div');
        msgEl.className = `chat-message ${messageType}`;
        msgEl.innerHTML = `
            <div class="chat-message-content ${isDecrypted ? 'decrypted' : 'encrypted'}" 
                 data-encrypted-text="${message.encrypted_content}"
                 data-content-type="${message.content_type}">
                ${contentHtml}
            </div>`;

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

    // --- CORE CHAT LOGIC ---
    async function selectChat(chatData) {
        activeChatData = chatData;
        activeChatState = { id: chatData.id, isDecrypted: !!chatSessionKeys[chatData.id] };
        
        const displayName = chatData.sender_username; 
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
        keyPromptMethod.textContent = chatData.encryption_method;
        keyPrompt.classList.add('visible');
        keyPromptInput.focus();
        keyPrompt.dataset.chatId = chatData.id;
    }

    function handleKeyPromptSubmit(e) {
        e.preventDefault();
        const chatId = keyPrompt.dataset.chatId;
        const key = keyPromptInput.value;
        
        if (!key || !chatId) return;
        
        chatSessionKeys[chatId] = key; // Save key for this session
        // [FIX] No longer saving to sessionStorage
        
        activeChatState.isDecrypted = true; 
        
        keyPrompt.classList.remove('visible');
        keyPromptInput.value = '';
        
        updateDecryptButtonState();
        reRenderAllMessages(); // Re-render
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

            const response = await secureFetch(`/chats/${activeChatData.id}/messages`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
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
            const storageResponse = await secureFetch('/storage/upload', {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': undefined }
            });
            
            if (!storageResponse.ok) {
                const errData = await storageResponse.json();
                throw new Error(errData.detail || 'Failed to upload file to storage.');
            }
            const storageData = await storageResponse.json();
            const fileUrl = storageData.file_url;

            const encryptedUrl = encryptMessage(fileUrl, activeChatData, sessionKey);
            
            const payload = { encrypted_content: encryptedUrl, content_type: 'steg_file_link' };
            const msgResponse = await secureFetch(`/chats/${activeChatData.id}/messages`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
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
            chatSearchResultsContainer.innerHTML = `
                <div class="chat-list-placeholder">
                    <i data-lucide="users"></i>
                    <p>Enter at least 2 characters to search.</p>
                </div>`;
            lucide.createIcons();
            return;
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
                if (!key || !/^[A-Z]+$/.test(key)) throw new Error('Playfair key must be letters only.');
                params = { key };
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
            
            chatSessionKeys[data.id] = key; // Save key for this new chat
            // [FIX] No longer saving to sessionStorage
            
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
            const response = await secureFetch(`/chats/requests/${requestId}`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
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

    // --- EVENT LISTENERS ---
    openChatBtn.addEventListener('click', initChatModal);

    chatNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            const panelName = link.dataset.panel;
            switchPanel(panelName);
            showMainPanel('placeholder');
            if(panelName === 'search') {
                chatSearchInput.focus();
            }
        });
    });

    chatSearchInput.addEventListener('input', handleSearchInput);

    msgForm.addEventListener('submit', handleSendMessage);
    msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            handleSendMessage(e); 
        }
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
    reqMethod.addEventListener('change', () => {
        const method = reqMethod.value;
        reqShiftGroup.style.display = 'none';
        reqKeyGroup.style.display = 'none';
        reqSizeGroup.style.display = 'none';
        if (method === 'caesar') reqShiftGroup.style.display = 'block';
        else if (method === 'playfair') reqKeyGroup.style.display = 'block';
        else if (method === 'hill') {
            reqKeyGroup.style.display = 'block';
            reqSizeGroup.style.display = 'block';
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
    
    function encryptMessage(text, chatData, key) {
        const { encryption_method, encryption_params } = chatData;
        try {
            if (encryption_method === 'caesar') {
                return caesarEncrypt(text, parseInt(key));
            }
            if (encryption_method === 'playfair') {
                return playfairEncrypt(text, key);
            }
            if (encryption_method === 'hill') {
                return hillEncrypt(text, key, encryption_params.size);
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
                return playfairDecrypt(text, key);
            }
            if (encryption_method === 'hill') {
                return hillDecrypt(text, key, encryption_params.size);
            }
            return text; 
        } catch (e) {
            console.error("Decryption Error:", e);
            return "[DECRYPTION FAILED: Invalid Key?]";
        }
    }

    // --- Caesar ---
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

    // --- Playfair ---
    let pfMatrixCache = {};
    function getPlayfairMatrix(key) {
        if (pfMatrixCache[key]) return pfMatrixCache[key];
        let matrix = Array(5).fill(0).map(() => Array(5));
        let keySquare = "";
        const alphabet = "ABCDEFGHIKLMNOPQRSTUVWXYZ";
        key.toUpperCase().replace(/J/g, 'I').split('').forEach(c => {
            if (alphabet.includes(c) && !keySquare.includes(c)) keySquare += c;
        });
        alphabet.split('').forEach(c => {
            if (!keySquare.includes(c)) keySquare += c;
        });
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                matrix[r][c] = keySquare[r * 5 + c];
            }
        }
        pfMatrixCache[key] = matrix;
        return matrix;
    }
    function findPlayfairPos(matrix, char) {
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (matrix[r][c] === char) return {r, c};
            }
        }
        return null;
    }
    function playfairEncrypt(text, key) {
        const matrix = getPlayfairMatrix(key);
        let prepared = text.toUpperCase().replace(/J/g, 'I').replace(/[^A-Z]/g, '');
        let i = 0;
        let digraphs = [];
        while (i < prepared.length) {
            if (i === prepared.length - 1) {
                digraphs.push(prepared[i] + 'X');
                i += 2; 
            } else if (prepared[i] === prepared[i+1]) {
                digraphs.push(prepared[i] + 'X');
                i += 1; 
            } else {
                digraphs.push(prepared.slice(i, i+2));
                i += 2; 
            }
        }
        
        let cipher = "";
        digraphs.forEach(digraph => {
            let c1 = digraph[0];
            let c2 = digraph[1];
            let pos1 = findPlayfairPos(matrix, c1);
            let pos2 = findPlayfairPos(matrix, c2);
            if (!pos1 || !pos2) return; 
            if (pos1.r === pos2.r) {
                cipher += matrix[pos1.r][(pos1.c + 1) % 5];
                cipher += matrix[pos2.r][(pos2.c + 1) % 5];
            } else if (pos1.c === pos2.c) {
                cipher += matrix[(pos1.r + 1) % 5][pos1.c];
                cipher += matrix[(pos2.r + 1) % 5][pos2.c];
            } else {
                cipher += matrix[pos1.r][pos2.c];
                cipher += matrix[pos2.r][pos1.c];
            }
        });
        return cipher;
    }
    function playfairDecrypt(text, key) {
        const matrix = getPlayfairMatrix(key);
        let plain = "";
        for (let i = 0; i < text.length; i += 2) {
            let c1 = text[i];
            let c2 = text[i+1];
            if(!c2) continue; 
            let pos1 = findPlayfairPos(matrix, c1);
            let pos2 = findPlayfairPos(matrix, c2);
            if (!pos1 || !pos2) continue; 
            if (pos1.r === pos2.r) {
                plain += matrix[pos1.r][(pos1.c + 4) % 5];
                plain += matrix[pos2.r][(pos2.c + 4) % 5];
            } else if (pos1.c === pos2.c) {
                plain += matrix[(pos1.r + 4) % 5][pos1.c];
                plain += matrix[(pos2.r + 4) % 5][pos2.c];
            } else {
                plain += matrix[pos1.r][pos2.c];
                plain += matrix[pos2.r][pos1.c];
            }
        }
        return plain;
    }
    
    // --- Hill ---
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