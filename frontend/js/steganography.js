/* ---
   SSAD Steganography Logic (steganography.js)
   [MODIFIED FOR NEW CARD-BASED VISUALIZATION & BUG FIXES]
   --- */

document.addEventListener('DOMContentLoaded', () => {
    // --- Modal Elements ---
    const modal = document.getElementById('stego-modal');
    if (!modal) return; 

    // --- State Variables ---
    let currentMode = 'encode'; 
    let currentFileType = 'image'; 
    let selectedFile = null;
    let visualizationSteps = [];
    let currentStepIndex = 0;
    let finalDownloadData = null; 

    // --- Selectors (Setup) ---
    const tabs = modal.querySelectorAll('.stego-tabs .viz-tab');
    const fileTypeRadios = modal.querySelectorAll('input[name="stegoFileType"]');
    const fileInput = document.getElementById('stego-file-input');
    const fileLabel = modal.querySelector('.stego-file-label');
    const fileNameDisplay = document.getElementById('stego-file-name');
    const fileIcon = document.getElementById('stego-file-icon');
    const filePreview = document.getElementById('stego-file-preview');
    const messageGroup = document.getElementById('stego-secret-message-group');
    const secretMessageInput = document.getElementById('stego-secret-message');
    const capacityInfo = document.getElementById('stego-capacity-info');
    const startVizBtn = document.getElementById('stego-start-viz-btn');
    const setupContainer = document.getElementById('stego-setup-container');
    const description = document.getElementById('stego-description');

    // --- Selectors (Animation) ---
    const animContainer = document.getElementById('stego-anim-container');
    const animTitle = document.getElementById('stego-anim-step-title');
    const animCounter = document.getElementById('stego-anim-step-counter');
    const animDescription = document.getElementById('stego-anim-step-description');
    const animStage = document.getElementById('stego-anim-stage');
    const animPrevBtn = document.getElementById('stego-anim-prev-btn');
    const animNextBtn = document.getElementById('stego-anim-next-btn');
    const finalActions = document.getElementById('stego-final-actions');
    const downloadBtn = document.getElementById('stego-download-btn');
    const newOpBtn = document.getElementById('stego-new-op-btn');

    // --- UI/State Helpers (Unchanged) ---

    function showStatus(message, type = 'error') {
        if(typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.warn("showNotification not found. Using console.", message);
            const statusEl = document.getElementById('stego-status-message') || document.createElement('div');
            statusEl.id = 'stego-status-message';
            statusEl.textContent = message;
            statusEl.className = `stego-status ${type}`; 
            statusEl.style.display = 'block';
            if(!statusEl.parentElement) setupContainer.prepend(statusEl);
        }
    }

    function clearStatus() {
        const statusEl = document.getElementById('stego-status-message');
        if (statusEl) {
            statusEl.style.display = 'none';
        }
    }

    function clearFileInput() {
        selectedFile = null;
        fileInput.value = ''; 
        fileNameDisplay.textContent = 'Click to select file...';
        fileLabel.classList.remove('file-selected', 'dragover');
        fileIcon.setAttribute('data-lucide', 'upload-cloud');
        if(typeof lucide !== 'undefined') lucide.createIcons();
        filePreview.innerHTML = ''; 
        capacityInfo.textContent = '';
        updateButtonStates();
    }
    
    function updateButtonStates() {
        const message = secretMessageInput.value.trim();
        const canStart = selectedFile && (currentMode === 'decode' || (currentMode === 'encode' && message.length > 0));
        startVizBtn.disabled = !canStart;
    }
    
    function updateUIVisibility() {
        clearStatus();
        clearFileInput(); 
        
        description.textContent = currentMode === 'encode' 
            ? `Hide a secret text message inside an ${currentFileType} file.`
            : `Extract a secret text message from an ${currentFileType} file.`;
            
        messageGroup.style.display = currentMode === 'encode' ? 'block' : 'none';
        
        animContainer.style.display = 'none';
        setupContainer.style.display = 'flex';
        finalActions.style.display = 'none';
    }

    function updateFileInputAccept() {
        if (currentFileType === 'image') {
            fileInput.accept = 'image/*';
        } else if (currentFileType === 'audio') {
            fileInput.accept = 'audio/wav'; 
        } else if (currentFileType === 'video') {
            fileInput.accept = 'video/*';
        }
    }

    // --- Core UI Logic (Unchanged) ---

    // 1. Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            currentMode = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updateUIVisibility();
        });
    });

    // 2. File Type Selection
    fileTypeRadios.forEach(radio => {
        radio.addEventListener('click', () => {
            currentFileType = radio.value;
            updateFileInputAccept();
            clearFileInput(); 
        });
    });

    // 3. File Selection
    fileInput.addEventListener('change', handleFileSelect);
    fileLabel.addEventListener('dragover', (e) => { e.preventDefault(); fileLabel.classList.add('dragover'); });
    fileLabel.addEventListener('dragleave', (e) => { e.preventDefault(); fileLabel.classList.remove('dragover'); });
    fileLabel.addEventListener('drop', (e) => { 
        e.preventDefault(); 
        fileLabel.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files; 
            handleFileSelect();
        }
    });

    function handleFileSelect() {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const isValid = (currentFileType === 'image' && file.type.startsWith('image/')) ||
                            (currentFileType === 'audio' && file.type === 'audio/wav') ||
                            (currentFileType === 'video' && file.type.startsWith('video/'));
            if (!isValid) {
                showStatus(`Invalid file type. Please select a correct ${currentFileType} file.`, 'error');
                clearFileInput(); 
                return;
            }
            selectedFile = file;
            fileNameDisplay.textContent = selectedFile.name;
            fileLabel.classList.add('file-selected');
            fileIcon.setAttribute('data-lucide', 'check-circle');
            if(typeof lucide !== 'undefined') lucide.createIcons();
            showFilePreview(selectedFile);
            clearStatus();
            updateButtonStates();
        } else {
            clearFileInput();
        }
    }
    
    function showFilePreview(file) {
        filePreview.innerHTML = ''; 
        const reader = new FileReader();
        reader.onload = (e) => {
            let mediaEl;
            const url = e.target.result;
            if (file.type.startsWith('image/')) {
                mediaEl = document.createElement('img');
            } else if (file.type === 'audio/wav') {
                mediaEl = document.createElement('audio');
                mediaEl.controls = true;
            } else if (file.type.startsWith('video/')) {
                mediaEl = document.createElement('video');
                mediaEl.controls = true;
            }
            if (mediaEl) {
                mediaEl.src = url;
                filePreview.appendChild(mediaEl);
            }
        };
        reader.readAsDataURL(file);
    }
    
    secretMessageInput.addEventListener('input', updateButtonStates);

    // 4. Animation Controls (Unchanged)
    animNextBtn.addEventListener('click', () => { renderAnimationStep(currentStepIndex + 1); });
    animPrevBtn.addEventListener('click', () => { renderAnimationStep(currentStepIndex - 1); });
    downloadBtn.addEventListener('click', handleDownloadEncodedFile);
    newOpBtn.addEventListener('click', updateUIVisibility);

    // 5. Start Visualization (Unchanged)
    startVizBtn.addEventListener('click', async () => {
        if (!selectedFile) {
             showStatus("Please select a file.", 'info');
             return;
        }
        if (currentMode === 'encode' && secretMessageInput.value.trim() === '') {
             showStatus("Please enter a secret message to hide.", 'info');
             return;
        }

        setButtonLoading(startVizBtn, true);
        clearStatus();
        
        const mode = currentMode;
        const file = selectedFile;
        const message = mode === 'encode' ? secretMessageInput.value : '';
        const media_type = currentFileType;

        try {
            const formData = new FormData();
            formData.append('file', file);
            if (mode === 'encode') {
                formData.append('secret_message', message);
            }

            const endpoint = `/storage/steganography/visualize/${media_type}/${mode}`;
            const response = await secureFetch(endpoint, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': undefined }
            });

            const data = await response.json(); 
            
            if (!response.ok) {
                throw new Error(data.detail || `Visualization failed (${response.status})`);
            }
            
            if (!data || !Array.isArray(data.steps) || data.steps.length === 0) {
                 throw new Error("Visualization data invalid or empty steps returned.");
            }

            visualizationSteps = data.steps;
            finalDownloadData = data.final_result_data;
            currentStepIndex = 0;

            setupContainer.style.display = 'none';
            animContainer.style.display = 'block';
            
            renderAnimationStep(currentStepIndex); 

        } catch (error) {
            console.error("Visualization Error:", error);
            showStatus(error.message, 'error');
            setupContainer.style.display = 'flex';
            animContainer.style.display = 'none';
        } finally {
            setButtonLoading(startVizBtn, false);
        }
    });
    
    // Download Handler (Unchanged)
    function handleDownloadEncodedFile() {
        if (!finalDownloadData?.data_url) {
            showStatus('Encoded file data not available for download.', 'error');
            return;
        }
        const dataUrl = finalDownloadData.data_url;
        const mimeType = finalDownloadData.mime_type || 'application/octet-stream';
        const base64Index = dataUrl.indexOf(';base64,');
        if (base64Index === -1) {
             showStatus('Error: Invalid Base64 data URL format.', 'error');
             return;
        }
        const byteCharacters = atob(dataUrl.substring(base64Index + 8));
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const originalName = finalDownloadData.original_filename.split('.').slice(0, -1).join('.') || 'encoded_file';
        let extension = currentFileType === 'image' ? 'png' : finalDownloadData.original_filename.split('.').pop() || 'bin';
        if (currentFileType === 'video' && finalDownloadData.original_filename?.includes('.')) {
             extension = finalDownloadData.original_filename.split('.').pop();
        }
        link.download = `${originalName}_stego.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        showStatus('Encoded file downloaded!', 'success');
    }
    
    // --- 6. Helper Renderers (Detailed Visuals) ---

    /**
     * [MODIFIED] Renders the Step 1 "Message to Bits" block with a clean table.
     */
    function renderMessageToBits(media, data) {
         // Fallback for safety
         data = data || {};
         
         let bitStreamHtml = (data.message_bits || '...').match(/.{1,8}/g) || [];
         
         let messageTableHtml = `
             <div class="stego-table-container">
                 <table class="stego-conversion-table">
                     <thead><tr><th>Char</th><th>ASCII (Dec)</th><th>Binary (8 Bits)</th></tr></thead>
                     <tbody>
                     ${(data.message_data || []).slice(0, 5).map(item => `
                         <tr>
                             <td>${(item.char === ' ' ? '[Space]' : item.char) || '?'}</td>
                             <td>${item.ascii || '?'}</td>
                             <td>${item.binary || '...'}</td>
                         </tr>
                     `).join('')}
                     </tbody>
                 </table>
             </div>
             <p class="dim" style="margin-top: 10px;">Showing first 5 characters (including delimiter if present).</p>
         `;

         let html = `
             <div class="stego-block stego-conversion" style="opacity:1; transform:translateY(0);">
                 <h4>Character-to-Binary Conversion Matrix</h4>
                 ${messageTableHtml}
                 <h4 style="margin-top: 1.5rem;">Assembled Binary Stream</h4>
                 <p class="viz-description">This stream of ${data.message_bits?.length || '...'} bits is inserted LSB by LSB into the ${media} file.</p>
                 <code class="stego-hex-view" style="font-size: 0.85rem; padding: 0.75rem 1rem;">
                     ${bitStreamHtml.map(b => `<span class="highlight-byte dim">${b}</span>`).join(' ')}
                 </code>
                 <div class="stego-capacity-bar" style="margin-top:1.5rem;">
                     <div class="stego-capacity-progress ${data.is_capacity_ok === false ? 'error' : ''}" style="width: ${Math.min(100, (data.message_bits?.length || 0) / (data.capacity || 1) * 100)}%;">
                         <span>${Math.round((data.message_bits?.length || 0) / (data.capacity || 1) * 100)}% Used</span>
                     </div>
                 </div>
                 <p class="stego-message-info" style="margin-top: 5px;">File Capacity: ${data.capacity?.toLocaleString() || '...'} bits</p>
             </div>
         `;
         if (data.is_capacity_ok === false) {
             showStatus(`Message too long! ${data.message_bits?.length} bits exceeds file capacity of ${data.capacity} bits.`, 'error');
             animNextBtn.disabled = true;
         }
         return html;
    }

    /**
     * [MODIFIED] Renders the LSB operation in the "card" format.
     * Fixes "undefined" bugs and adds color preview.
     */
    function renderLsbOperationMatrix(media, step) {
        const data = step.data || {}; // Safety fallback
        const mode = step.mode;
        const isImage = media === 'image';
        const isEncode = mode === 'encode';

        let channels = [];
        let containerHtml = '<div class="stego-lsb-viz-container">';
        
        // --- 1. Add Color Preview for Images ---
        if (isImage) {
            // Use fallbacks for all values to prevent "undefined"
            const r_orig = data.r_orig ?? 0;
            const g_orig = data.g_orig ?? 0;
            const b_orig = data.b_orig ?? 0;
            const r_new = data.r_new ?? 0;
            const g_new = data.g_new ?? 0;
            const b_new = data.b_new ?? 0;

            containerHtml += `
                <div class="stego-color-preview-block">
                    <h4>Pixel ${data.index ?? '?'} Color Change</h4>
                    <div class="stego-color-preview">
                        <div class="color-box" style="background-color: rgb(${r_orig}, ${g_orig}, ${b_orig})" title="Original: rgb(${r_orig}, ${g_orig}, ${b_orig})"></div>
                        <span class="color-arrow">&rarr;</span>
                        <div class="color-box" style="background-color: rgb(${r_new}, ${g_new}, ${b_new})" title="New: rgb(${r_new}, ${g_new}, ${b_new})"></div>
                    </div>
                </div>
            `;
        }

        // --- 2. Populate Channel Data ---
        if (isImage) {
            // IMAGE: R, G, B channels
            channels = [
                { name: 'Red', orig: data.r_orig, bin: data.r_orig_bin, bit: isEncode ? data.bit_to_hide_r : data.bit_extracted_r, new_val: data.r_new, new_bin: data.r_new_bin, mask: '254' },
                { name: 'Green', orig: data.g_orig, bin: data.g_orig_bin, bit: isEncode ? data.bit_to_hide_g : data.bit_extracted_g, new_val: data.g_new, new_bin: data.g_new_bin, mask: '254' },
                { name: 'Blue', orig: data.b_orig, bin: data.b_orig_bin, bit: isEncode ? data.bit_to_hide_b : data.bit_extracted_b, new_val: data.b_new, new_bin: data.b_new_bin, mask: '254' }
            ];
        } else {
            // AUDIO: Single "Sample" channel
            channels = [
                { name: 'Sample', orig: data.sample_orig, bin: data.sample_orig_bin, bit: isEncode ? data.bit_to_hide : data.bit_extracted, new_val: data.sample_new, new_bin: data.sample_new_bin, mask: '~1' }
            ];
        }
        
        // --- 3. Build Channel Cards ---
        containerHtml += `<div class="stego-lsb-viz ${isImage ? 'image' : 'audio'}">`;

        // Helper to format binary string
        const formatBinary = (binStr, lsbClass) => {
            const safeBin = binStr || '...';
            if (safeBin.length < 2) return `<span class="lsb ${lsbClass}">${safeBin}</span>`;
            return `${safeBin.slice(0, -1)}<span class="lsb ${lsbClass}">${safeBin.slice(-1)}</span>`;
        };
        
        channels.forEach(ch => {
            // Add fallbacks (?? 0 or ?? '?') to prevent "undefined"
            const bit = ch.bit ?? '?';
            const op = isEncode ? `(Value & ${ch.mask}) | ${bit}` : `Value & 1`;
            const bitClass = isEncode ? 'modified' : 'extracted';
            const bitLabel = isEncode ? 'Hidden Bit' : 'Extracted Bit';
            
            containerHtml += `
                <div class="stego-lsb-channel-card ${ch.name}">
                    <h4>${ch.name} Channel</h4>
                    
                    <div class="stego-lsb-group">
                        <label>Before</label>
                        <span class="value">${ch.orig ?? 0}</span>
                        <span class="binary">${formatBinary(ch.bin, '')}</span>
                    </div>
                    
                    <div class="stego-lsb-group">
                        <label>Calculation</label>
                        <span class="op">${op}</span>
                        <span class="bit ${isEncode ? '' : 'decode'}">${bitLabel}: ${bit}</span>
                    </div>
                    
                    <div class="stego-lsb-group">
                        <label>After</label>
                        <span class="value new">${ch.new_val ?? 0}</span>
                        <span class="binary new">${formatBinary(ch.new_bin, bitClass)}</span>
                    </div>
                </div>
            `;
        });
        
        containerHtml += `</div></div>`; // Close .stego-lsb-viz and .stego-lsb-viz-container
        return containerHtml;
    }


    /**
     * [MODIFIED] Renders the byte assembly block with a cleaner table.
     */
    function renderLsbAssembly(media, data) {
         data = data || {}; // Safety fallback
         let binaryString = data.binary_stream || '';
         let blocks = [];
         
         const chr = (charCode) => {
             try { return String.fromCharCode(charCode); } catch { return '?'; }
         };
         
         for (let i = 0; i < binaryString.length; i += 8) {
             let block = binaryString.substring(i, i + 8);
             if (block.length >= 8) { 
                 blocks.push({ block: block.substring(0, 8), char: chr(parseInt(block.substring(0, 8), 2)), isFull: true });
             } else {
                 blocks.push({ block: block, char: '...', isFull: false });
             }
         }
         
         const isEncoding = currentMode === 'encode';

         return `
             <div class="stego-block" style="opacity:1; transform:translateY(0);">
                 <h4>${isEncoding ? 'Byte Concealment' : 'Byte Extraction & Reconstruction'}</h4>
                 
                 <div style="margin-bottom: 1rem;">
                     <label class="dim" style="font-weight: 600; font-size: 0.9rem;">Current Assembled Binary Stream:</label>
                     <code class="stego-hex-view" style="font-size: 0.85rem; padding: 0.75rem 1rem;">
                         ${(data.message_bits || binaryString).match(/.{1,8}/g)?.map((b, i) => {
                             const isFullByte = blocks[i] && blocks[i].isFull;
                             return `<span class="highlight-byte ${isFullByte ? '' : 'dim'}" title="${isFullByte ? blocks[i].char : 'Incomplete'}">${b}</span>`;
                         }).join(' ') || '...'}
                     </code>
                 </div>
                 
                 <div class="stego-table-container">
                     <table class="stego-conversion-table">
                         <thead>
                             <tr>
                                 <th>Total Units Used</th>
                                 <th>First 8 Bits</th>
                                 <th>Assembled Character</th>
                             </tr>
                         </thead>
                         <tbody>
                            ${blocks.length > 0 ? `
                                <tr>
                                    <td>${data.units_used || '...'} ${media === 'image' ? 'Channels' : 'Samples'}</td>
                                    <td>${blocks[0].block || '...'}</td>
                                    <td>'${blocks[0].char || '?'}' (ASCII: ${parseInt(blocks[0].block, 2) || '?'})</td>
                                </tr>
                            ` : `
                                <tr>
                                    <td colspan="3">Collecting more bits to form first character...</td>
                                </tr>
                            `}
                         </tbody>
                     </table>
                 </div>
                 <p class="dim" style="margin-top:1rem; text-align:center;">Status: ${currentMode === 'decode' ? 'Checking' : 'Continuing'} for delimiter '####'.</p>
             </div>
         `;
    }

    /**
     * [MODIFIED] Renders the Append (Video) step with cleaner Hex view.
     */
    function renderAppendStep(media, step) {
        const data = step.data || {}; // Safety fallback
        const isEncode = step.mode === 'encode';
        let hexViewContent = '';
        
        const original_size = data.original_size || 0;
        const total_new_size = data.total_new_size || 0;
        
        if (isEncode) {
             if (step.step_title.includes("File Structure")) {
                 hexViewContent = `
                    <p class="viz-description">Original File Size: **${original_size.toLocaleString()}** Bytes.</p>
                    <label class="dim" style="font-weight: 600; font-size: 0.9rem;">File Header (Start):</label>
                    <code class="stego-hex-view" style="font-size: 0.85rem;">${data.file_hex_start || '...'}</code>
                    <label class="dim" style="font-weight: 600; font-size: 0.9rem; margin-top: 1rem;">File Tail (End):</label>
                    <code class="stego-hex-view" style="font-size: 0.85rem;">${data.file_hex_end || '...'}</code>
                 `;
             } else if (step.step_title.includes("Concatenating")) {
                 hexViewContent = `
                    <p class="viz-description">New Total File Size: **${total_new_size.toLocaleString()}** Bytes.</p>
                    <label class="dim" style="font-weight: 600; font-size: 0.9rem;">Appended Data Stream (Hexadecimal View):</label>
                    <code class="stego-hex-view" style="font-size:0.9rem; word-break: break-all;">
                        <span class="dim" title="Original File End">... ${data.original_hex_end || ''}</span>
                        <span class="highlight-delimiter" title="Delimiter">${data.delimiter_hex || '...'}</span>
                        <span class="highlight-message" title="Secret Message">${data.message_hex_start || '...'} ... ${data.message_hex_end || '...'}</span>
                    </code>
                 `;
             } else {
                 // Fallback for other encode steps
                 hexViewContent = `<p class="dim">${step.description}</p>`;
             }
        } else { // Decode
             if (data.is_found === false) {
                  hexViewContent = `
                    <div class="stego-results" style="border-color: var(--error);">
                        <h4 style="color: var(--error);"><i data-lucide="alert-triangle" style="width:18px; height:18px; margin-right: 5px;"></i>Delimiter Not Found</h4>
                        <pre style="background-color: var(--bg-primary); color: var(--error);">Scanning stopped after checking ${data.file_size?.toLocaleString() || '...'} bytes.</pre>
                    </div>
                `;
             } else if (step.step_title.includes("Byte-to-Character Conversion")) {
                 hexViewContent = `
                    <div class="stego-results" style="border-color: var(--success);">
                        <h4 style="color: var(--success);"><i data-lucide="check" style="width:18px; height:18px; margin-right: 5px;"></i>Message Stream Decoded</h4>
                        <p class="dim" style="font-size: 0.9rem; margin-bottom: 0.5rem;">Extracted ${data.message_size?.toLocaleString() || '?'} bytes and converted from UTF-8.</p>
                        <pre>${data.final_message_preview || '...'}</pre>
                    </div>
                `;
             } else if (step.step_title.includes("Message Identified")) {
                 hexViewContent = `
                    <p class="dim">File Size: ${data.file_size?.toLocaleString() || '...'} Bytes.</p>
                    <p class="viz-description" style="font-weight: 600; color:var(--success);">Delimiter found! The subsequent **${data.message_size?.toLocaleString() || '?'} bytes** are the hidden message.</p>
                    <label class="dim" style="font-weight: 600; font-size: 0.9rem; margin-top: 1rem;">Message Stream (Hex Preview):</label>
                     <code class="stego-hex-view" style="font-size:0.9rem; word-break: break-all;">
                        <span class="highlight-message" title="Secret Message">${data.message_bytes_hex_start || '...'} ... ${data.message_bytes_hex_end || '...'}</span>
                    </code>
                `;
             } else {
                 // Fallback for other decode steps
                 hexViewContent = `<p class="dim">${step.description}</p>`;
             }
        }
        
        return `
            <div class="stego-block" style="opacity:1; transform:translateY(0);">
                ${hexViewContent}
            </div>
        `;
    }

    /**
     * [MODIFIED] Renders the final result block with a cleaner layout.
     */
    function renderFinalResult(mode, data) {
        data = data || {}; // Safety fallback
        let resultHtml = '';
        if (mode === 'encode') {
            finalActions.style.display = 'flex';
            downloadBtn.style.display = 'flex';
            resultHtml = `
                <div style="display: flex; flex-direction:column; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
                    <i data-lucide="check-circle" style="width:40px; height: 40px; color:var(--success);"></i>
                    <h3 style="color:var(--success);">ENCODING COMPLETE</h3>
                </div>
                <p class="viz-description" style="max-width: 450px; text-align: center;">The message was successfully concealed. Click **Download** to get the steganographic file.</p>
                <div class="attack-anim-stats" style="max-width: 500px; margin-top: 1rem;">
                    <div class="attack-stat-card">
                        <label>Total Hidden Bits/Bytes</label>
                        <span>${(data.message_bits_count || data.message_size || 0).toLocaleString()} ${currentFileType === 'video' ? 'Bytes' : 'Bits'}</span>
                    </div>
                    <div class="attack-stat-card">
                        <label>Data Units Modified</label>
                        <span>${(data.pixels_modified || data.samples_modified || 'N/A').toLocaleString()}</span>
                    </div>
                </div>
            `;
        } else {
            finalActions.style.display = 'flex';
            downloadBtn.style.display = 'none';
            resultHtml = `
                <div style="display: flex; flex-direction:column; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
                    <i data-lucide="lock-open" style="width:40px; height: 40px; color:var(--accent-primary);"></i>
                    <h3 style="color:var(--accent-primary);">DECODING COMPLETE</h3>
                </div>
                <p class="viz-description" style="max-width: 500px; text-align: center;">The secret message was successfully extracted from the file:</p>
                <div class="stego-results" style="max-width: 500px; width: 100%;">
                    <h4>Decoded Message:</h4>
                    <pre id="stego-decoded-message">${data.final_message || '[No hidden message found]'}</pre>
                </div>
            `;
        }
        return `<div class="stego-block" style="opacity:1; transform:translateY(0); align-items:center;">${resultHtml}</div>`;
    }

    // --- 7. Main Step Renderer ---
    
    function renderAnimationStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= visualizationSteps.length) return;
        
        currentStepIndex = stepIndex;
        const step = visualizationSteps[stepIndex];
        const media = step.media_type;
        const mode = step.mode;

        animStage.innerHTML = '';
        finalActions.style.display = 'none';
        anime.remove('.stego-block'); 

        animTitle.textContent = step.step_title;
        animDescription.innerHTML = (step.description || '...').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Parse markdown bold
        animCounter.textContent = `Step ${currentStepIndex + 1} / ${visualizationSteps.length}`;
        animPrevBtn.disabled = (currentStepIndex === 0);
        animNextBtn.disabled = (currentStepIndex === visualizationSteps.length - 1);
        
        let contentHtml = '';

        // --- [MODIFIED] Simplified Step Logic ---

        if (step.step_title.includes("Final Summary") || step.step_title.includes("Final Decoded Result")) {
             contentHtml = renderFinalResult(mode, step.data);
        
        } else if (step.step_title.includes("Message Conversion") || step.step_title.includes("Delimiter Preparation")) {
            contentHtml = renderMessageToBits(media, step.data);
        
        } else if (media === 'image' || media === 'audio') {
            // LSB Steps
            if (step.step_title.includes("LSB") || step.step_title.includes("Initial Pixel") || step.step_title.includes("Initial Sample")) {
                contentHtml = renderLsbOperationMatrix(media, step);
            } else if (step.step_title.includes("Byte Assembly") || step.step_title.includes("Hiding the First Byte")) {
                contentHtml = renderLsbAssembly(media, step.data);
            } else if (step.step_title.includes("Continuous LSB") || step.step_title.includes("Delimiter Search") || step.step_title.includes("Processing Subsequent Samples")) {
                 contentHtml = `
                    <div class="stego-block" style="opacity:1; transform:translateY(0);">
                        <h4>Continuous LSB Operation</h4>
                        <p class="viz-description">${step.description}</p>
                        <div class="stego-table-container">
                             <table class="stego-conversion-table"> <!-- Re-using this table style -->
                                 <thead><tr><th>Operation</th><th>Units ${mode === 'encode' ? 'Modified' : 'Checked'}</th><th>Units Remaining</th><th>Status</th></tr></thead>
                                 <tbody>
                                    <tr>
                                        <td>${step.step_title}</td>
                                        <td class="highlight-cell">${(step.data.pixels_modified || step.data.samples_modified || 0).toLocaleString()}</td>
                                        <td class="dim">${(step.data.pixels_unchanged || step.data.samples_unchanged || '...').toLocaleString()}</td>
                                        <td class="dim">${step.data.delimiter_status || '...'}</td>
                                    </tr>
                                 </tbody>
                             </table>
                         </div>
                    </div>
                 `;
            } else {
                // Fallback for any missed LSB step
                contentHtml = `<div class="stego-block" style="opacity:1; transform:translateY(0);"><p>${step.description}</p></div>`;
            }
        
        } else if (media === 'video') {
            // Append Steps
            contentHtml = renderAppendStep(media, step); 
        }
        
        // --- Append & Animate ---
        animStage.innerHTML = contentHtml;
        anime({ targets: animStage.querySelectorAll('.stego-block'), opacity: [0, 1], translateY: [10, 0], duration: 500, delay: anime.stagger(100) });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    // --- Initial setup calls ---
    updateUIVisibility();
    updateFileInputAccept();

});