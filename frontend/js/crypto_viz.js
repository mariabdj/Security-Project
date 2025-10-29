/* ---
   SSAD Visualization Modal Logic (crypto_viz.js)
   --- */

document.addEventListener('DOMContentLoaded', () => {

    // --- Tab Navigation ---
    const tabs = document.querySelectorAll('.viz-tab');
    const tabPanels = document.querySelectorAll('.viz-tab-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetPanel = document.getElementById(`viz-tab-${tab.dataset.tab}`);
            if (!targetPanel) return;
            tabs.forEach(t => t.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            targetPanel.classList.add('active');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    });

    // --- Simple View Form Logic ---
    const simpleForm = document.getElementById('viz-simple-form');
    if (simpleForm) {
        const simpleMethodSelect = document.getElementById('simple-method');
        const shiftGroup = document.getElementById('simple-shift-group');
        const keyGroup = document.getElementById('simple-key-group');
        const sizeGroup = document.getElementById('simple-size-group');
        const textInput = document.getElementById('simple-text');
        const shiftInput = document.getElementById('simple-shift');
        const keyInput = document.getElementById('simple-key');
        const sizeInput = document.getElementById('simple-size');
        const resultTextarea = document.getElementById('simple-result');

        function toggleParamInputs() {
            const method = simpleMethodSelect.value;
            if (shiftGroup) shiftGroup.style.display = 'none';
            if (keyGroup) keyGroup.style.display = 'none';
            if (sizeGroup) sizeGroup.style.display = 'none';
            if (method === 'caesar' && shiftGroup) shiftGroup.style.display = 'block';
            else if (method === 'playfair' && keyGroup) keyGroup.style.display = 'block';
            else if (method === 'hill' && keyGroup && sizeGroup) {
                keyGroup.style.display = 'block';
                sizeGroup.style.display = 'block';
            }
        }
        if (simpleMethodSelect) { simpleMethodSelect.addEventListener('change', toggleParamInputs); toggleParamInputs(); }

        async function handleSimpleSubmit(e) {
             e.preventDefault(); // This is the fix for the page reload
             const action = e.submitter.dataset.action;
             const button = e.submitter;
             setButtonLoading(button, true);
             if (resultTextarea) resultTextarea.value = 'Processing...';
             try {
                 const text = textInput ? textInput.value : '';
                 const method = simpleMethodSelect ? simpleMethodSelect.value : '';
                 const shiftValue = method === 'caesar' && shiftInput && shiftInput.value !== '' ? parseInt(shiftInput.value) : undefined;
                 const keyValue = (method === 'playfair' || method === 'hill') && keyInput ? keyInput.value : undefined;
                 const sizeValue = method === 'hill' && sizeInput && sizeInput.value !== '' ? parseInt(sizeInput.value) : undefined;
                 const payload = { text: text, method: method, shift: shiftValue, key: keyValue, size: sizeValue };
                 // Validation...
                 if (method === 'caesar' && payload.shift === undefined) throw new Error("Shift is required for Caesar.");
                 if (method === 'playfair' && !payload.key) throw new Error("Key is required for Playfair.");
                 if (method === 'hill' && (!payload.key || payload.size === undefined)) throw new Error("Key and size are required for Hill.");
                 if (method === 'hill' && payload.key && payload.size && payload.key.length !== payload.size * payload.size) {
                      throw new Error(`Hill key length must be ${payload.size * payload.size} for a ${payload.size}x${payload.size} matrix.`);
                 }
                 const endpoint = `/crypto/${action}`;
                 const response = await secureFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
                 const data = await response.json();
                 if (!response.ok) throw new Error(data.detail || `Failed to ${action}.`);
                 if (resultTextarea) resultTextarea.value = data.result_text;
             } catch (error) {
                 if (resultTextarea) resultTextarea.value = `Error: ${error.message}`;
                 showNotification(error.message, 'error');
             } finally {
                 setButtonLoading(button, false);
             }
         }
        simpleForm.addEventListener('submit', handleSimpleSubmit);
    } else { console.warn('Simple visualization form not found.'); }


    // --- Animated View Logic ---
    const animForm = document.getElementById('viz-anim-form');
    if (animForm) {
        let animationSteps = [];
        let currentStepIndex = 0;
        let activeAlgorithm = '';
        const animMethodSelect = document.getElementById('anim-method');
        const animStartBtn = document.getElementById('start-anim-btn');
        const animPlayer = document.getElementById('anim-player');
        const animPlaceholder = document.getElementById('anim-player-placeholder');
        const animShiftGroup = document.getElementById('anim-shift-group');
        const animKeyGroup = document.getElementById('anim-key-group');
        const animSizeGroup = document.getElementById('anim-size-group');
        const animTextInput = document.getElementById('anim-text');
        const animShiftInput = document.getElementById('anim-shift');
        const animKeyInput = document.getElementById('anim-key');
        const animKeyHillInput = document.getElementById('anim-key-hill');
        const animSizeInput = document.getElementById('anim-size');
        const animStepTitle = document.getElementById('anim-step-title');
        const animStepCounter = document.getElementById('anim-step-counter');
        const animStepDescription = document.getElementById('anim-step-description');
        const animStepStage = document.getElementById('anim-step-stage');
        const animPrevBtn = document.getElementById('anim-prev-btn');
        const animNextBtn = document.getElementById('anim-next-btn');

        function toggleAnimParamInputs() {
             const method = animMethodSelect ? animMethodSelect.value : null;
             if (animShiftGroup) animShiftGroup.style.display = 'none';
             if (animKeyGroup) animKeyGroup.style.display = 'none';
             if (animSizeGroup) animSizeGroup.style.display = 'none';
             if (method === 'caesar' && animShiftGroup) animShiftGroup.style.display = 'block';
             else if (method === 'playfair' && animKeyGroup) animKeyGroup.style.display = 'block';
             else if (method === 'hill' && animSizeGroup) animSizeGroup.style.display = 'block';
        }
        if (animMethodSelect) { animMethodSelect.addEventListener('change', toggleAnimParamInputs); toggleAnimParamInputs(); }

        animForm.addEventListener('submit', async (e) => {
             e.preventDefault(); // This is the fix for the page reload
             if (!animStartBtn || !animMethodSelect || !animTextInput) {
                 console.error("Animation form elements not found!");
                 return;
             }
             setButtonLoading(animStartBtn, true);
             animationSteps = []; currentStepIndex = 0;
             if (animPlayer) animPlayer.style.display = 'none';
             if (animPlaceholder) animPlaceholder.style.display = 'flex';
             try {
                 activeAlgorithm = animMethodSelect.value;
                 const shiftValue = activeAlgorithm === 'caesar' && animShiftInput && animShiftInput.value !== '' ? parseInt(animShiftInput.value) : undefined;
                 const keyValue = activeAlgorithm === 'playfair' ? (animKeyInput ? animKeyInput.value : undefined)
                                : activeAlgorithm === 'hill' ? (animKeyHillInput ? animKeyHillInput.value : undefined)
                                : undefined;
                 const sizeValue = activeAlgorithm === 'hill' && animSizeInput && animSizeInput.value !== '' ? parseInt(animSizeInput.value) : undefined;
                 const payload = { text: animTextInput.value, shift: shiftValue, key: keyValue, size: sizeValue };
                 // Validation...
                 if (activeAlgorithm === 'caesar' && payload.shift === undefined) throw new Error("Shift is required for Caesar.");
                 if (activeAlgorithm === 'playfair' && (!payload.key || !/^[a-zA-Z]+$/.test(payload.key))) throw new Error("Playfair key must be alphabetic characters.");
                 if (activeAlgorithm === 'hill' && (!payload.key || payload.size === undefined)) throw new Error("Key and size are required for Hill.");
                 if (activeAlgorithm === 'hill' && payload.key && payload.size) {
                      if (!/^[a-zA-Z]+$/.test(payload.key)) throw new Error("Hill key must be alphabetic characters.");
                      if (payload.key.length !== payload.size * payload.size) {
                          throw new Error(`Hill key "${payload.key}" is invalid. Expected ${payload.size * payload.size} alphabetic characters for size ${payload.size}.`);
                      }
                 }
                 // Fetch...
                 const response = await secureFetch('/visualize/encrypt', { method: 'POST', body: JSON.stringify(payload) });
                 const data = await response.json();
                 if (!response.ok) throw new Error(data.detail || 'Failed to get visualization data.');
                 animationSteps = data.steps;
                 // Render...
                 if (animationSteps.length > 0) {
                     if (animPlayer) animPlayer.style.display = 'flex';
                     if (animPlaceholder) animPlaceholder.style.display = 'none';
                     renderAnimationStep(currentStepIndex);
                 } else { throw new Error('No visualization steps were returned.'); }
             } catch (error) {
                 showNotification(error.message, 'error');
                 if (animPlayer) animPlayer.style.display = 'none';
                 if (animPlaceholder) animPlaceholder.style.display = 'flex';
             } finally { setButtonLoading(animStartBtn, false); }
         });

        // --- Helper: Render Matrix ---
        function renderMatrix(matrixData, highlightPos = [], outputPos = [], highlightRows = [], highlightCols = []) {
            if (!matrixData) return '';
            const isHill = Array.isArray(matrixData[0]) && typeof matrixData[0][0] === 'number';
            const size = matrixData.length;
            let matrixHtml = `<div class="viz-matrix ${isHill ? `hill-${size}` : 'playfair'}" id="anim-matrix">`;
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const content = matrixData[r][c];
                    let classes = 'viz-matrix-cell';
                    if (highlightPos.some(pos => pos && pos.length === 2 && pos[0] === r && pos[1] === c)) classes += ' highlight-input';
                    if (outputPos.some(pos => pos && pos.length === 2 && pos[0] === r && pos[1] === c)) classes += ' highlight-output';
                    if (highlightRows.includes(r)) classes += ' highlight-row';
                    if (highlightCols.includes(c)) classes += ' highlight-col';
                    if (!isHill && highlightPos.length === 2 && highlightPos.every(p => p && p.length === 2) && highlightPos[0][0] !== highlightPos[1][0] && highlightPos[0][1] !== highlightPos[1][1]) {
                        if ((r === highlightPos[0][0] && c === highlightPos[1][1]) || (r === highlightPos[1][0] && c === highlightPos[0][1])) classes += ' highlight-rect';
                    }
                    classes += ` cell-row-${r} cell-col-${c}`;
                    matrixHtml += `<div class="${classes}" data-row="${r}" data-col="${c}">${content}</div>`;
                }
            }
            matrixHtml += '</div>';
            return `<div class="viz-matrix-container">${matrixHtml}</div>`;
        }

        // --- Helper: Render Vector ---
        function renderVector(vectorData, title = "Vector", highlightIndices = []) {
             if (!vectorData || vectorData.length === 0) return ''; // Add check for empty vector
             let vectorHtml = `<div class="viz-vector-container" id="vector-${title.toLowerCase()}"><h4>${title}:</h4><div class="viz-vector">`;
             vectorData.forEach((val, index) => {
                 vectorHtml += `<div class="viz-vector-cell ${highlightIndices.includes(index) ? 'highlight' : ''}" data-index="${index}">${val}</div>`;
             });
             vectorHtml += `</div></div>`;
             return vectorHtml;
        }

        // --- Helper: Render Alphabet ---
        function renderAlphabet(alphabetStr, highlightIdx = -1, outputIdx = -1) {
             if (!alphabetStr) return '';
             let alphaHtml = `<div class="viz-alphabet-container"><h4>Alphabet:</h4><div class="viz-alphabet">`;
             for(let i = 0; i < alphabetStr.length; i++) {
                 let classes = 'viz-alphabet-char';
                 if (i === highlightIdx) classes += ' highlight-input';
                 if (i === outputIdx) classes += ' highlight-output';
                 alphaHtml += `<div class="${classes}" data-index="${i}">${alphabetStr[i]}</div>`;
             }
             alphaHtml += `<div class="viz-alphabet-marker" id="alphabet-marker"></div>`;
             alphaHtml += `</div></div>`;
             return alphaHtml;
        }

        // --- Main Animation Step Renderer ---
        function renderAnimationStep(stepIndex) {
            if (stepIndex < 0 || stepIndex >= animationSteps.length || !animStepStage) return;

            currentStepIndex = stepIndex;
            const step = animationSteps[stepIndex];

            // Update Header/Description/Nav
            if (animStepTitle) animStepTitle.textContent = step.step_title;
            if (animStepDescription) animStepDescription.innerHTML = step.description;
            if (animStepCounter) animStepCounter.textContent = `Step ${stepIndex + 1} / ${animationSteps.length}`;
            if (animPrevBtn) animPrevBtn.disabled = (stepIndex === 0);
            if (animNextBtn) animNextBtn.disabled = (stepIndex === animationSteps.length - 1);

            animStepStage.innerHTML = '';
            // Clear all previous animations
            anime.remove('.viz-matrix-cell, .viz-vector-cell, .viz-alphabet-marker, .calc-step, #caesar-output, #new-digraph, #hill-output, .final-summary > *');

            // --- [FIX 1] Explicit check for Final Summary Step ---
            // This now receives the step from the Python backend
            if (step.step_title === "Final Result") {
                 animStepStage.innerHTML = `
                    <div class="final-summary">
                        <h4>Original Text:</h4>
                        <div class="viz-text-block">${step.data.original || ''}</div>
                        ${step.data.prepared ? `<h4>Prepared Text:</h4><div class="viz-text-block">${step.data.prepared}</div>` : ''}
                        <i data-lucide="arrow-down"></i>
                        <h4>Final Encrypted Text:</h4>
                        <div class="viz-text-block final-output">${step.data.final || ''}</div>
                    </div>`;
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    // Animate the final summary
                     anime({ 
                         targets: '.final-summary > *', 
                         opacity: [0, 1], 
                         translateY: [-20, 0], 
                         delay: anime.stagger(100, {start: 100}), 
                         easing: 'easeOutExpo' 
                     });
                 return; // IMPORTANT: Stop rendering here
            }

            // --- Algorithm-Specific Rendering & Animation ---

            // Common Text Blocks (for context)
            if (step.data.original && currentStepIndex > 0) animStepStage.innerHTML += `<h4 class="dim" style="opacity: 0.5;">Original: ${step.data.original}</h4>`;
            if (step.data.prepared && currentStepIndex > 1) animStepStage.innerHTML += `<h4 class="dim" style="opacity: 0.5;">Prepared: ${step.data.prepared}</h4>`;

            // --- [FIX 2] CAESAR ---
            if (activeAlgorithm === 'caesar') {
                if (step.data.alphabet) {
                    animStepStage.innerHTML += renderAlphabet(step.data.alphabet, step.data.idx, step.data.new_idx);
                }
                
                if (step.data.char) { // Check if it's a processing step
                    let outputHtml = `
                        <div class="caesar-step-container" style="opacity: 0; transform: translateY(-10px);">
                            <span class="viz-text-block" id="caesar-input">${step.data.char}</span>`;
                    
                    if (step.data.new_char) { // It's a letter
                        outputHtml += `
                            <i data-lucide="arrow-right"></i>
                            <span class="viz-text-block highlight" id="caesar-output">${step.data.new_char}</span>`;
                    } else { // It's a skipped char
                         outputHtml += `
                            <i data-lucide="arrow-right"></i>
                            <span class="viz-text-block" id="caesar-output">${step.data.char}</span>`;
                    }
                    outputHtml += `</div>`;
                    animStepStage.innerHTML += outputHtml;

                    // Animate
                    const tl = anime.timeline({ easing: 'easeOutExpo', duration: 400 });
                    const marker = animStepStage.querySelector('#alphabet-marker');
                    
                    if (marker && step.data.idx !== undefined && step.data.new_idx !== undefined) {
                        const inputCharEl = animStepStage.querySelector(`.viz-alphabet-char[data-index="${step.data.idx}"]`);
                        const outputCharEl = animStepStage.querySelector(`.viz-alphabet-char[data-index="${step.data.new_idx}"]`);
                        
                        if(inputCharEl && outputCharEl) {
                            tl.add({
                                targets: marker,
                                translateX: inputCharEl.offsetLeft + (inputCharEl.offsetWidth / 2) - 6, // 6 is half marker width
                                opacity: [0, 1],
                                duration: 300
                            }).add({
                                targets: marker,
                                translateX: outputCharEl.offsetLeft + (outputCharEl.offsetWidth / 2) - 6,
                                easing: 'spring(1, 80, 10, 0)',
                                duration: 500
                            }, '+=200');
                        }
                    }
                    // Fade in the text block
                    tl.add({ targets: '.caesar-step-container', opacity: 1, translateY: 0 }, 0); // Start at same time

                } else if (step.data.text) { // First step
                     animStepStage.innerHTML += `<h4 class="dim">Original: ${step.data.text}</h4>`;
                     anime({ targets: '.viz-alphabet-container, .dim', opacity: [0, 1], translateY: [-20, 0], delay: anime.stagger(100) });
                }
            }

            // PLAYFAIR
            else if (activeAlgorithm === 'playfair') {
                 const matrixData = step.data.matrix || (stepIndex > 0 ? animationSteps.findLast(s=>s.data.matrix)?.data.matrix : null);
                 const highlightPos = [step.data.pos1, step.data.pos2].filter(p => p && p.length === 2);
                 const outputPos = [step.data.new_pos1, step.data.new_pos2].filter(p => p && p.length === 2);

                 if (matrixData) {
                    animStepStage.innerHTML += renderMatrix(matrixData, highlightPos, []); // Render matrix with input highlights
                 }
                 if (step.data.digraph) {
                    animStepStage.innerHTML += `<h4>Current Digraph: <span class="viz-text-block" id="current-digraph">${step.data.digraph}</span></h4>`;
                 }

                 if (step.data.new_digraph && step.data.rule && highlightPos.length === 2 && outputPos.length === 2) {
                     animStepStage.innerHTML += `<h4>Encrypted Digraph: <span class="viz-text-block highlight" style="opacity: 0;" id="new-digraph">${step.data.new_digraph}</span></h4>`;
                     animStepStage.innerHTML += `<pre class="viz-code">Rule Applied: ${step.data.rule}</pre>`;

                    const matrixEl = animStepStage.querySelector('.viz-matrix');
                    const outputElements = outputPos.map(pos => matrixEl.querySelector(`[data-row="${pos[0]}"][data-col="${pos[1]}"]`));

                    if (matrixEl && outputElements.every(Boolean)) {
                        const tl = anime.timeline({ easing: 'easeOutExpo', duration: 400 });

                        // 1. Animate Rule Highlighting (Row, Col, or Rect corners)
                        if (step.data.rule === 'Same Row' || step.data.rule === 'Same Column') {
                            const isRow = step.data.rule === 'Same Row';
                            const index = highlightPos[0][isRow ? 0 : 1]; // Get row index or col index
                            const targets = matrixEl.querySelectorAll(isRow ? `.cell-row-${index}` : `.cell-col-${index}`);
                            tl.add({ targets: Array.from(targets).filter(el => !el.classList.contains('highlight-input')), backgroundColor: ['var(--bg-secondary)','color-mix(in srgb, var(--accent-primary) 10%, transparent)'], duration: 300});
                        } else if (step.data.rule === 'Rectangle') {
                             const corner1El = matrixEl.querySelector(`[data-row="${highlightPos[0][0]}"][data-col="${highlightPos[1][1]}"]`);
                             const corner2El = matrixEl.querySelector(`[data-row="${highlightPos[1][0]}"][data-col="${highlightPos[0][1]}"]`);
                             if (corner1El && corner2El) {
                                tl.add({ targets: [corner1El, corner2El], backgroundColor: ['var(--bg-secondary)', 'color-mix(in srgb, var(--accent-primary) 15%, transparent)'], scale: [1, 1.05, 1], duration: 300 });
                             }
                        }

                        // 2. Animate Output Highlight Appearing
                        tl.add({ targets: outputElements, backgroundColor: ['var(--bg-secondary)','color-mix(in srgb, var(--success) 30%, transparent)'], scale: [1, 1.1], fontWeight: 'bold', delay: anime.stagger(2) }, "+=100");

                        // 3. Show encrypted digraph
                        tl.add({ targets: '#new-digraph', opacity: [0, 1], scale: [0.8, 1] }, "-=200");
                        tl.add({ targets: outputElements, scale: 1, duration: 200 }, "+=300");
                    }
                 } else if (matrixData || step.data.prepared) { // Initial steps
                      anime({ targets: animStepStage.querySelectorAll('.viz-matrix-container, .viz-text-block, h4.dim'), opacity: [0, 1], translateY: [-20, 0], duration: 500, delay: anime.stagger(100) });
                 }
            }


            // HILL
             else if (activeAlgorithm === 'hill') {
                 const matrixData = step.data.matrix || (stepIndex > 0 ? animationSteps.findLast(s=>s.data.matrix)?.data.matrix : null);

                 const equationContainer = document.createElement('div');
                 equationContainer.className = 'hill-equation';

                 // Render K, P, C vectors/matrices
                 if (matrixData) equationContainer.innerHTML += renderMatrix(matrixData);
                 if (step.data.vector) equationContainer.innerHTML += `<span>*</span>` + renderVector(step.data.vector, "P");
                 if (step.data.result_vector) {
                     equationContainer.innerHTML += `<span>=</span>` + renderVector(step.data.result_vector.map(() => '?'), "C"); // Start C with '?'
                 }
                 if (step.data.new_block) {
                     if (step.data.result_vector) equationContainer.innerHTML += `<span>→</span>`; // Only add arrow if C is present
                     equationContainer.innerHTML += `<h4><span class="viz-text-block highlight" id="hill-output" style="opacity:0;">${step.data.new_block}</span></h4>`;
                 }
                 animStepStage.appendChild(equationContainer);

                 // Display calculation steps & animate
                 if (step.data.calculation_steps) {
                     let calcHtml = '<h4>Calculation Steps (mod 26):</h4><pre class="viz-code">';
                     const relevantSteps = step.data.calculation_steps;
                     relevantSteps.forEach((calcStep, index) => {
                         calcHtml += `<span class="calc-step" id="calc-step-${index}" style="opacity: 0.5;">${calcStep}\n</span>`;
                     });
                     calcHtml += '</pre>';
                     animStepStage.innerHTML += calcHtml;

                     const keyMatrixEl = equationContainer.querySelector('.viz-matrix');
                     const pVectorEl = equationContainer.querySelector('#vector-p .viz-vector');
                     const cVectorEl = equationContainer.querySelector('#vector-c .viz-vector'); // Target C vector container
                     const calcStepsEls = animStepStage.querySelectorAll('.calc-step');
                     const outputBlockEl = document.getElementById('hill-output');

                     const tl = anime.timeline({ easing: 'easeOutExpo', duration: 400 });

                     // Initial fade-in, skip if it's just the matrix display step
                     if(step.data.vector){
                        tl.add({ targets: '.hill-equation > div, .hill-equation h4, .hill-equation span', opacity: [0, 1], scale: [0.9, 1], delay: anime.stagger(50) });
                     } else {
                         tl.add({ targets: '.hill-equation > div', opacity: [0, 1], scale: [0.9, 1] }); // Just fade in matrix
                     }


                     // Ensure C vector exists before animating calculations involving it
                     if (keyMatrixEl && pVectorEl && cVectorEl && calcStepsEls.length >= 4 && step.data.vector && step.data.result_vector) {
                         const size = step.data.vector.length;
                         const dotProductStepEl = calcStepsEls[0];
                         const rawResultStepEl = calcStepsEls[1];
                         const modResultStepEl = calcStepsEls[2];
                         const finalBlockStepEl = calcStepsEls[3];

                         // ... inside renderAnimationStep ...
// ... inside else if (activeAlgorithm === 'hill') ...

                         // Animate calculation row by row
                         tl.add({ targets: dotProductStepEl, opacity: [0.5, 1], color: 'var(--text-primary)' }, "+=50"); // FAST
                         for (let r = 0; r < size; r++) {
                             const rowCells = keyMatrixEl.querySelectorAll(`.cell-row-${r}`);
                             const pCells = pVectorEl.querySelectorAll('.viz-vector-cell');
                             const cCell = cVectorEl.querySelector(`[data-index="${r}"]`);

                             tl.add({ // Highlight K row and P vector
                                 targets: [Array.from(rowCells), Array.from(pCells)],
                                 backgroundColor: ['var(--bg-secondary)', 'var(--bg-input)','color-mix(in srgb, var(--accent-primary) 15%, transparent)'],
                                 duration: 150 // FAST
                             }, "+=50") // FAST
                             .add({ // Highlight relevant calculation line
                                 targets: dotProductStepEl,
                                 begin: () => { dotProductStepEl.innerHTML = dotProductStepEl.innerHTML.replace(new RegExp(`(Row ${r}:.*)`), '<span class="current">$1</span>'); },
                                 duration: 10
                             }, "-=0")
                             .add({ // Pulse C cell briefly (still showing '?')
                                 targets: cCell,
                                 scale: [1, 1.05, 1],
                                 backgroundColor: ['var(--bg-input)', 'color-mix(in srgb, var(--error) 15%, transparent)', 'var(--bg-input)'],
                                 duration: 150 // FAST
                             }, "+=50") // FAST
                             .add({ // Revert highlight on K row + calc line
                                 targets: rowCells,
                                 backgroundColor: 'var(--bg-secondary)', duration: 100, // FAST
                                 begin: () => { dotProductStepEl.innerHTML = dotProductStepEl.innerHTML.replace('<span class="current">', '').replace('</span>', ''); }
                             }, "-=50"); // FAST
                         }
                         // Revert P vector highlight fully
                         tl.add({ targets: pVectorEl.querySelectorAll('.viz-vector-cell'), backgroundColor: 'var(--bg-input)', duration: 100 }, "-=50"); // FAST

                         // Animate showing raw vector result
                         tl.add({ targets: rawResultStepEl, opacity: [0.5, 1], color: 'var(--text-primary)'}, "+=50"); // FAST

                         // Animate modulo step & Update C Vector content AND highlight
                         tl.add({
                                targets: modResultStepEl,
                                opacity: [0.5, 1], color: 'var(--text-primary)',
                                begin: () => { // FIXED: Update C vector content right HERE
                                     step.data.result_vector.forEach((val, index) => {
                                         const cell = animStepStage.querySelector(`#vector-c .viz-vector-cell[data-index="${index}"]`);
                                         if(cell) cell.textContent = val; // Set the actual number
                                     });
                                     // Now animate highlight ON the updated C vector
                                      anime({
                                         targets: '#vector-c .viz-vector-cell', // Correct selector
                                         color: ['var(--text-primary)', 'var(--accent-primary)'],
                                         scale: [1, 1.1],
                                         fontWeight: 'bold',
                                         backgroundColor: ['var(--bg-input)', 'color-mix(in srgb, var(--success) 15%, transparent)'],
                                         // Your stagger change is here, which is fine
                                         delay: anime.stagger(2) 
                                     });
                                }
                           }, "+=50"); // FAST

                         // Show final block text and animate
                         tl.add({ targets: finalBlockStepEl, opacity: [0.5, 1], color: 'var(--text-primary)' }, "+=300")
                           .add({ targets: outputBlockEl, scale: [0.8, 1], opacity: [0, 1] }, "-=200");
                     
                     } else if (matrixData && step.data.vector && !step.data.result_vector) {
                         // Handle initial steps that only show K and P
                         anime({ targets: '.hill-equation > div, .hill-equation span', opacity: [0,1], scale:[0.9,1], delay: anime.stagger(100)});
                     } else if (matrixData && !step.data.vector){
                          // Just show the matrix if it's the only element
                          anime({ targets: '.hill-equation > div', opacity: [0,1], scale:[0.9,1] });
                     }
                 }
            }

             if (typeof lucide !== 'undefined') lucide.createIcons();
        }


        // --- Add Nav Button Listeners ---
        if (animNextBtn) { animNextBtn.addEventListener('click', () => { renderAnimationStep(currentStepIndex + 1); }); }
        if (animPrevBtn) { animPrevBtn.addEventListener('click', () => { renderAnimationStep(currentStepIndex - 1); }); }

    } else { console.warn('Animated visualization form not found.'); }

});

