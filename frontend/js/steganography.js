/* ---
   SSAD Steganography Logic (steganography.js)
   --- */

document.addEventListener('DOMContentLoaded', () => {
    // --- Modal Elements ---
    const modal = document.getElementById('stego-modal');
    if (!modal) return; // Don't run if modal isn't on the page

    // --- Tabs ---
    const tabs = modal.querySelectorAll('.stego-tabs .viz-tab');
    const encodeTabBtn = modal.querySelector('[data-tab="encode"]');
    const decodeTabBtn = modal.querySelector('[data-tab="decode"]');

    // --- File Type Selection ---
    const fileTypeRadios = modal.querySelectorAll('input[name="stegoFileType"]');
    
    // --- File Input ---
    const fileInput = document.getElementById('stego-file-input');
    const fileLabel = modal.querySelector('.stego-file-label');
    const fileNameDisplay = document.getElementById('stego-file-name');
    const fileIcon = document.getElementById('stego-file-icon');
    const filePreview = document.getElementById('stego-file-preview');

    // --- Message & Actions ---
    const messageGroup = document.getElementById('stego-secret-message-group');
    const secretMessageInput = document.getElementById('stego-secret-message');
    const encodeBtn = document.getElementById('stego-encode-btn');
    const decodeBtn = document.getElementById('stego-decode-btn');

    // --- Results & Status ---
    const resultsArea = document.getElementById('stego-results-area');
    const decodedMessageDisplay = document.getElementById('stego-decoded-message');
    const statusMessage = document.getElementById('stego-status-message');
    const description = document.getElementById('stego-description');

    // --- State ---
    let currentMode = 'encode'; // 'encode' or 'decode'
    let currentFileType = 'image'; // 'image', 'audio', 'video'
    let selectedFile = null;

    // --- 1. Tab Switching Logic ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            currentMode = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updateUIVisibility();
        });
    });

    // --- 2. File Type Selection Logic ---
    fileTypeRadios.forEach(radio => {
        radio.addEventListener('click', () => {
            currentFileType = radio.value;
            updateFileInputAccept();
            clearFileInput(); // Clear file when type changes
        });
    });

    function updateFileInputAccept() {
        if (currentFileType === 'image') {
            fileInput.accept = 'image/*';
        } else if (currentFileType === 'audio') {
            fileInput.accept = 'audio/wav'; // Backend only supports WAV
        } else if (currentFileType === 'video') {
            fileInput.accept = 'video/*';
        }
    }

    // --- 3. File Input Handling ---
    fileInput.addEventListener('change', handleFileSelect);

    function handleFileSelect() {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            
            // Basic validation
            if (currentFileType === 'image' && !file.type.startsWith('image/')) {
                showStatus('Please select an image file.', 'error');
                clearFileInput(); return;
            }
            if (currentFileType === 'audio' && file.type !== 'audio/wav') {
                showStatus('Please select a WAV audio file (.wav).', 'error');
                clearFileInput(); return;
            }
            if (currentFileType === 'video' && !file.type.startsWith('video/')) {
                showStatus('Please select a video file.', 'error');
                clearFileInput(); return;
            }

            selectedFile = file;
            fileNameDisplay.textContent = selectedFile.name;
            fileLabel.classList.add('file-selected');
            fileIcon.setAttribute('data-lucide', 'check-circle');
            lucide.createIcons();
            showFilePreview(selectedFile);
            clearStatus();
            updateButtonStates();

        } else {
            clearFileInput();
        }
    }

    function clearFileInput() {
        selectedFile = null;
        fileInput.value = ''; // Important to clear the input
        fileNameDisplay.textContent = 'Click to select file...';
        fileLabel.classList.remove('file-selected');
        fileIcon.setAttribute('data-lucide', 'upload-cloud');
        lucide.createIcons();
        filePreview.innerHTML = ''; // Clear preview
        updateButtonStates();
    }

    function showFilePreview(file) {
        filePreview.innerHTML = ''; // Clear previous
        const reader = new FileReader();

        reader.onload = (e) => {
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = e.target.result;
                filePreview.appendChild(img);
            } else if (file.type === 'audio/wav') {
                const audio = document.createElement('audio');
                audio.controls = true;
                audio.src = e.target.result;
                filePreview.appendChild(audio);
            } else if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.controls = true;
                video.src = e.target.result;
                filePreview.appendChild(video);
            }
        };

        reader.readAsDataURL(file);
    }

    // --- 4. Update UI Based on State ---

    function updateUIVisibility() {
        clearStatus();
        clearFileInput(); // Also clears file selection
        resultsArea.style.display = 'none'; // Hide results initially

        if (currentMode === 'encode') {
            description.textContent = `Hide a secret text message inside an ${currentFileType} file.`;
            messageGroup.style.display = 'block';
            encodeBtn.style.display = 'flex';
            decodeBtn.style.display = 'none';
        } else { // decode
            description.textContent = `Extract a secret text message from an ${currentFileType} file.`;
            messageGroup.style.display = 'none';
            encodeBtn.style.display = 'none';
            decodeBtn.style.display = 'flex';
        }
        updateButtonStates();
    }

    function updateButtonStates() {
        const message = secretMessageInput.value.trim();
        encodeBtn.disabled = !selectedFile || (currentMode === 'encode' && !message);
        decodeBtn.disabled = !selectedFile || currentMode !== 'decode';
    }

    // Update buttons when typing secret message
    secretMessageInput.addEventListener('input', updateButtonStates);

    // --- 5. Status Messages ---

    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.className = `stego-status ${type}`; // Add type class
        statusMessage.style.display = 'block';
    }

    function clearStatus() {
        statusMessage.textContent = '';
        statusMessage.style.display = 'none';
    }

    // --- 6. API Calls ---

    // Encode Logic
    encodeBtn.addEventListener('click', async () => {
        if (encodeBtn.disabled) return;

        const secret = secretMessageInput.value;
        const file = selectedFile;
        const type = currentFileType;

        setButtonLoading(encodeBtn, true);
        clearStatus();
        resultsArea.style.display = 'none';

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('secret_message', secret);

            const response = await secureFetch(`/storage/steganography/${type}/encode`, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': undefined } // Let browser set for FormData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Encoding failed (${response.status})`);
            }

            // The response IS the file blob
            const blob = await response.blob();
            
            // Trigger download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Get original filename without extension, handle potential errors
            const originalName = file.name.split('.').slice(0, -1).join('.') || 'encoded_file';
            // Determine extension based on blob type or original type
            let extension = blob.type.split('/')[1] || file.name.split('.').pop() || 'bin';
            if (type === 'image') extension = 'png'; // Force PNG for images
            if (type === 'audio') extension = 'wav';

            a.download = `${originalName}_encoded.${extension}`;
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showStatus('Encoding successful! File downloaded.', 'success');
            // Optionally clear form after success?
            // clearFileInput();
            // secretMessageInput.value = '';

        } catch (error) {
            showStatus(error.message, 'error');
        } finally {
            setButtonLoading(encodeBtn, false);
        }
    });

    // Decode Logic
    decodeBtn.addEventListener('click', async () => {
        if (decodeBtn.disabled) return;

        const file = selectedFile;
        const type = currentFileType;

        setButtonLoading(decodeBtn, true);
        clearStatus();
        resultsArea.style.display = 'none'; // Hide old results
        decodedMessageDisplay.textContent = 'Decoding...'; // Placeholder

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await secureFetch(`/storage/steganography/${type}/decode`, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': undefined } // Let browser set for FormData
            });

            const data = await response.json(); // Expect JSON response

            if (!response.ok) {
                throw new Error(data.detail || `Decoding failed (${response.status})`);
            }

            // Success
            decodedMessageDisplay.textContent = data.secret_message;
            resultsArea.style.display = 'block';
            showStatus('Decoding successful!', 'success');


        } catch (error) {
            showStatus(error.message, 'error');
            resultsArea.style.display = 'none'; // Hide results area on error
        } finally {
            setButtonLoading(decodeBtn, false);
        }
    });

    // --- Initialize ---
    updateUIVisibility();
    updateFileInputAccept();

});