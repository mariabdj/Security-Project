/* ---
   SSAD Steganography Logic (steganography.js)
   [MODIFIED FOR MATRIX VISUALIZATION, MAXIMUM DETAIL, AND ROBUSTNESS]
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

    // --- UI/State Helpers ---

    function showStatus(message, type = 'error') {
        const statusEl = document.getElementById('stego-status-message');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `stego-status ${type}`; 
            statusEl.style.display = 'block';
             anime({ targets: statusEl, opacity: [0, 1], translateY: [-10, 0], duration: 300 });
        }
    }

    function clearStatus() {
        const statusEl = document.getElementById('stego-status-message');
        if (statusEl) {
             anime({ targets: statusEl, opacity: 0, translateY: [0, -10], duration: 200, complete: () => { statusEl.style.display = 'none'; } });
        }
    }

    function clearFileInput() {
        selectedFile = null;
        fileInput.value = ''; 
        fileNameDisplay.textContent = 'Click to select file...';
        fileLabel.classList.remove('file-selected', 'dragover');
        fileIcon.setAttribute('data-lucide', 'upload-cloud');
        lucide.createIcons();
        filePreview.innerHTML = ''; 
        capacityInfo.textContent = '';
        updateButtonStates();
    }
    
    function updateButtonStates() {
        const message = secretMessageInput.value.trim();
        // Decode only requires a file
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

    // --- Core UI Logic ---

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
            lucide.createIcons();
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

    // --- 4. Animation Controls ---
    animNextBtn.addEventListener('click', () => { renderAnimationStep(currentStepIndex + 1); });
    animPrevBtn.addEventListener('click', () => { renderAnimationStep(currentStepIndex - 1); });
    downloadBtn.addEventListener('click', handleDownloadEncodedFile);
    newOpBtn.addEventListener('click', updateUIVisibility);

    // --- 5. Start Visualization ---

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
            // Log the raw error to console for debugging
            console.error("Visualization Error:", error);
            // Display a user-friendly message
            showStatus(error.message, 'error');
            setupContainer.style.display = 'flex';
            animContainer.style.display = 'none';
        } finally {
            setButtonLoading(startVizBtn, false);
        }
    });

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
        // For video append, maintain original extension
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

    function renderMessageToBits(media, data) {
         let bitStreamHtml = (data.message_bits || '').match(/.{1,8}/g) || [];
         
         let messageTableHtml = `
             <table class="stego-conversion-table">
                 <thead><tr><th>Char</th><th>ASCII (Dec)</th><th>Binary (8 Bits)</th></tr></thead>
                 <tbody>
                 ${(data.message_data || []).slice(0, 5).map(item => `
                     <tr>
                         <td>${item.char}</td>
                         <td>${item.ascii}</td>
                         <td>${item.binary}</td>
                     </tr>
                 `).join('')}
                 </tbody>
             </table>
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

    function renderLsbOperationMatrix(media, step) {
        const data = step.data;
        const mode = step.mode;
        const isImage = media === 'image';
        const isEncode = mode === 'encode';

        // Prepare Channel Data Array
        let channels;
        if (isImage) {
            channels = [
                { name: 'Red', val: data.r_orig, bin: data.r_orig_bin, new_val: data.r_new, new_bin: data.r_new_bin, bit: data.bit_to_hide || (data.r_orig & 1) },
                { name: 'Green', val: data.g_orig, bin: data.g_orig_bin, new_val: data.g_new, new_bin: data.g_new_bin, bit: data.bit_to_hide_g || (data.g_orig & 1) },
                { name: 'Blue', val: data.b_orig, bin: data.b_orig_bin, new_val: data.b_new, new_bin: data.b_new_bin, bit: data.bit_to_hide_b || (data.b_orig & 1) }
            ].filter(c => c.val !== undefined);
        } else {
            // Audio (Sample)
            channels = [
                { name: 'Sample', val: data.sample_orig, bin: data.sample_orig_bin, new_val: data.sample_new, new_bin: data.sample_new_bin, bit: data.bit_to_hide || (data.sample_orig & 1) }
            ];
        }

        const tableHeaders = [
            isImage ? 'Channel' : 'Unit', 'Decimal (Orig)', 'Binary (Orig)', 'Operation', isEncode ? 'Hidden Bit' : 'Extracted Bit', 'Binary (New)', 'Decimal (New)'
        ];

        const renderCell = (content, highlight = false) => `<td class="${highlight ? 'highlight-cell' : ''}">${content}</td>`;
        
        let tableRows = channels.map((channel, i) => {
            const isTarget = i === (data.target_channel_index || 0);
            
            const origLsb = channel.bin?.slice(-1) || '?';
            const newLsb = channel.new_bin?.slice(-1) || '?';
            const bit = channel.bit;
            
            // For LSB, the mask is 0b11111110 (or ~1 for signed int16)
            const mask = isImage ? '11111110' : '...11111110';
            
            const operation = isEncode 
                ? `(Val & ${mask}) | ${bit}`
                : `Val & 1`;
                
            const finalBinary = isEncode 
                ? (channel.new_bin?.slice(0, -1) || '...') + `<span class="lsb modified">${newLsb}</span>`
                : (channel.bin?.slice(0, -1) || '...') + `<span class="lsb extracted">${origLsb}</span>`;
            
            const newDecimal = isEncode 
                ? channel.new_val
                : channel.val; // Decoding doesn't change the value

            return `<tr class="${isTarget ? 'active-row' : 'dim'}">
                ${renderCell(channel.name)}
                ${renderCell(channel.val)}
                ${renderCell(channel.bin?.slice(0, -1) + `<span class="lsb">${origLsb}</span>`)}
                ${renderCell(operation)}
                ${renderCell(bit, true)}
                ${renderCell(finalBinary)}
                ${renderCell(newDecimal)}
            </tr>`;
        }).join('');
        
        const unitType = isImage ? `Pixel ${data.index}` : `Sample ${data.index}`;

        return `
            <div class="stego-block" style="opacity:1; transform:translateY(0);">
                <h4>LSB ${isEncode ? 'Modification' : 'Extraction'} Matrix (${unitType})</h4>
                <p class="viz-description">**Target Unit:** ${unitType}. Showing how the bitwise operation directly manipulates the **Least Significant Bit (LSB)**.</p>
                <div class="stego-table-container">
                    <table class="stego-operation-matrix">
                        <thead>
                            <tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function renderLsbAssembly(media, data) {
         let binaryString = data.binary_stream || '';
         let blocks = [];
         
         const chr = (charCode) => {
             try { return String.fromCharCode(charCode); } catch { return '?'; }
         };
         
         // Only show the assembled bytes
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
                     <label class="dim">Current Assembled Binary Stream:</label>
                     <code class="stego-hex-view" style="font-size: 0.85rem; padding: 0.75rem 1rem;">
                         ${(data.message_bits || binaryString).match(/.{1,8}/g).map((b, i) => {
                             const isFullByte = blocks[i]?.isFull;
                             return `<span class="highlight-byte ${isFullByte ? '' : 'dim'}" title="${isFullByte ? blocks[i].char : 'Incomplete'}">${b}</span>`;
                         }).join(' ')}
                     </code>
                 </div>
                 
                 <div class="stego-calc" style="text-align: center; font-size: 1.1rem; font-weight: 500;">
                    ${blocks.length > 0 ? `
                        <p>Total Units Used for 1st Byte: <span class="highlight-bit">${data.units_used || '...'} ${media === 'image' ? 'Channels' : 'Samples'}</span></p>
                        <p style="margin-top: 10px;">First Decoded Character: <span class="highlight-bit">${blocks[0].char} (ASCII: ${parseInt(blocks[0].block, 2)})</span></p>
                    ` : `
                        <p>Bits Collected: ${binaryString.length} / 8. Collecting more bits to form first character...</p>
                    `}
                 </div>
                 
                 <p class="dim" style="margin-top:1rem;">Status: ${currentMode === 'decode' ? 'Checking' : 'Continuing'} for delimiter '####'.</p>
             </div>
         `;
    }

    function renderAppendStep(media, step) {
        const data = step.data;
        const isEncode = step.mode === 'encode';
        let hexViewContent = '';
        
        // Use optional chaining/default values safely
        const original_size = data.original_size || 0;
        const total_new_size = data.total_new_size || 0;
        const message_size = data.message_size || 0;
        const original_end_hex = (original_size - 1).toString(16).toUpperCase();
        const total_new_size_hex = (total_new_size - 1).toString(16).toUpperCase();
        
        if (isEncode) {
             if (step.step_title.includes("File Structure")) {
                 hexViewContent = `
                    <p class="dim">Original File Size: **${original_size.toLocaleString()}** Bytes (Ends at 0x${original_end_hex}).</p>
                    <p class="dim">Video Header Preview (First 40 Bytes):</p>
                    <code class="stego-hex-view" style="font-size: 0.85rem;">${(data.file_header_view || 'N/A').match(/.{1,16}/g)?.join(' ') || '...'}</code>
                    <p style="margin-top: 10px;">Video players use this initial metadata and stop reading at the reported end.</p>
                 `;
             } else {
                 hexViewContent = `
                    <p class="dim">Original File Stream</p>
                    <i data-lucide="chevrons-down" style="width:24px; color:var(--accent-primary); margin:1rem 0;"></i>
                    <p class="dim" style="text-align: center;">Appended Data Stream (Hexadecimal View):</p>
                    <code class="stego-hex-view" style="font-size:0.9rem; word-break: break-all;">
                        <span class="highlight-delimiter" title="Delimiter">${data.delimiter_bytes_hex || '...'}</span>
                        <span class="highlight-message" title="Secret Message">${data.message_bytes_prefix || '...'}</span><span class="dim">...</span><span class="highlight-message">${data.message_bytes_suffix || '...'}</span>
                    </code>
                    <p style="font-weight: 600; margin-top: 1rem;">New Total File Size: ${total_new_size.toLocaleString()} Bytes (Ends at 0x${total_new_size_hex})</p>
                 `;
             }
        } else { // Decode
             if (data.is_found === false) {
                  hexViewContent = `
                    <div class="stego-calc" style="background-color: var(--bg-primary); border: 2px solid var(--error);">
                        <p style="font-weight: 700; color:var(--error);">Delimiter **${data.delimiter || '...'}** was NOT found in the file.</p>
                        <i data-lucide="alert-triangle" style="width:24px; color:var(--error); margin:1rem 0;"></i>
                        <p>Scanning stopped after checking ${data.file_size?.toLocaleString() || '...'} bytes.</p>
                    </div>
                `;
             } else if (step.step_title.includes("Byte-to-Character Conversion")) {
                 hexViewContent = `
                    <p class="dim">Extracted Message Bytes (${message_size.toLocaleString()} Bytes):</p>
                    <code class="stego-hex-view" style="font-size:0.9rem; word-break: break-all;">
                        <span class="highlight-message">${data.message_bytes_prefix || '...'}</span><span class="dim">...</span><span class="highlight-message">${data.message_bytes_suffix || '...'}</span>
                    </code>
                    <div class="stego-calc" style="text-align: center; margin-top: 1rem;">
                        <p>Decoded Text Length: ${data.final_message_length?.toLocaleString() || '...'} Characters</p>
                        <p style="font-weight: 700; color:var(--success); font-size: 1.2rem; margin-top: 5px;">Preview: "${(data.final_message || '...').substring(0, 30)}..."</p>
                    </div>
                `;
             } else if (step.step_title.includes("Message Identified")) {
                 hexViewContent = `
                    <p class="dim">File Size: ${data.file_size?.toLocaleString() || '...'} Bytes.</p>
                    <p class="dim">Search Status: <span style="color: var(--success); font-weight: 600;">Delimiter found!</span></p>
                    <i data-lucide="chevrons-down" style="width:24px; color:var(--success); margin:1rem 0;"></i>
                    <p>The message stream is the final **${message_size.toLocaleString()}** bytes after the delimiter.</p>
                 `;
             }
        }
        
        return `
            <div class="stego-block" style="opacity:1; transform:translateY(0);">
                <h4>${step.step_title}</h4>
                ${hexViewContent}
            </div>
        `;
    }

    function renderFinalResult(mode, data) {
        let resultHtml = '';
        if (mode === 'encode') {
            finalActions.style.display = 'flex';
            downloadBtn.style.display = 'flex';
            resultHtml = `
                <h3 style="color:var(--success);"><i data-lucide="check-circle" style="width:32px; margin-right:10px;"></i> ENCODING COMPLETE</h3>
                <p class="viz-description" style="max-width: 400px; text-align: center;">The message was successfully concealed. Click **Download** to get the steganographic file.</p>
                <div class="attack-anim-stats" style="max-width: 500px;">
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
                <h3 style="color:var(--accent-primary);"><i data-lucide="lock-open" style="width:32px; margin-right:10px;"></i> DECODING COMPLETE</h3>
                <p class="viz-description" style="max-width: 400px; text-align: center;">The secret message was successfully extracted from the file:</p>
                <div class="stego-results" style="max-width: 500px; width: 100%; border: 1px solid var(--accent-primary);">
                    <h4>Decoded Message:</h4>
                    <pre id="stego-decoded-message" style="background-color:var(--bg-input);">${data.final_message || '[No hidden message found]'}</pre>
                </div>
            `;
        }
        return `<div class="stego-block" style="opacity:1; transform:translateY(0); text-align:center;">${resultHtml}</div>`;
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
        animDescription.textContent = step.description;
        animCounter.textContent = `Step ${currentStepIndex + 1} / ${visualizationSteps.length}`;
        animPrevBtn.disabled = (currentStepIndex === 0);
        animNextBtn.disabled = (currentStepIndex === visualizationSteps.length - 1);
        
        let contentHtml = '';

        if (step.step_title.includes("Final Summary") || step.step_title.includes("Final Decoded Result")) {
             contentHtml = renderFinalResult(mode, step.data);
        } else if (step.step_title.includes("Message Conversion") || step.step_title.includes("Delimiter Preparation")) {
            contentHtml = renderMessageToBits(media, step.data);
        } else if (media === 'image' || media === 'audio') {
            // New matrix view for step 2 & 3
            if (step.step_title.includes("LSB Modification Matrix") || step.step_title.includes("LSB Extraction Matrix")) {
                contentHtml = renderLsbOperationMatrix(media, step);
            } else if (step.step_title.includes("Completion of Pixel 0") || step.step_title.includes("First Character Assembled") || step.step_title.includes("Hiding the First Byte")) {
                contentHtml = renderLsbAssembly(media, step.data);
            } else if (step.step_title.includes("Subsequent Pixels Modification") || step.step_title.includes("Processing Subsequent Samples") || step.step_title.includes("Delimiter Search")) {
                 contentHtml = `
                    <div class="stego-block" style="opacity:1; transform:translateY(0);">
                        <h4>Continuous LSB Operation</h4>
                        <p class="viz-description">${step.description}</p>
                        <div class="stego-calc">
                            <p style="font-weight: 700;">Operation continues on subsequent data units:</p>
                            <p>Units ${mode === 'encode' ? 'Modified' : 'Checked'}: <span class="highlight-bit">${(step.data.pixels_modified || step.data.samples_modified || 0).toLocaleString()}</span></p>
                            <p>Units Unchanged: <span class="dim">${(step.data.pixels_unchanged || step.data.samples_unchanged || '...').toLocaleString()}</span></p>
                            <p class="dim" style="margin-top: 10px;">Status: Checking stream for delimiter '####'.</p>
                        </div>
                    </div>
                 `;
            } else if (step.step_title.includes("Initial Pixel Data") || step.step_title.includes("Initial Sample Data")) {
                 // Special step for decoding/encoding start
                 contentHtml = `
                    <div class="stego-block" style="opacity:1; transform:translateY(0);">
                        <h4>Media Data Structure (Initial Unit)</h4>
                        <p class="viz-description">${step.description}</p>
                        ${renderLsbOperationMatrix(media, step)}
                        <p class="dim" style="margin-top:1rem;">Extraction/Modification will start with the least significant bit (LSB).</p>
                    </div>
                 `;
            }
        } else if (media === 'video') {
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
