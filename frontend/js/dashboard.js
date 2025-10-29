/* ---
   SSAD Dashboard Hub Script (dashboard.js)
   --- */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Modal Triggers ---
    const openChatBtn = document.getElementById('open-chat-modal');
    const openVizBtn = document.getElementById('open-visualize-modal');
    const openAttacksBtn = document.getElementById('open-attacks-modal');
    const openStegoBtn = document.getElementById('open-stego-modal');

    // --- Modals ---
    const chatModal = document.getElementById('chat-modal');
    const vizModal = document.getElementById('visualize-modal');
    const attacksModal = document.getElementById('attacks-modal');
    const stegoModal = document.getElementById('stego-modal');

    // --- Event Listeners ---
    if (openChatBtn) {
        openChatBtn.addEventListener('click', () => {
            chatModal.classList.add('visible');
        });
    }

    if (openVizBtn) {
        openVizBtn.addEventListener('click', () => {
            vizModal.classList.add('visible');
        });
    }

    if (openAttacksBtn) {
        openAttacksBtn.addEventListener('click', () => {
            attacksModal.classList.add('visible');
        });
    }

    if (openStegoBtn) {
        openStegoBtn.addEventListener('click', () => {
            stegoModal.classList.add('visible');
        });
    }

    // --- Initialize Icons ---
    // (This is also in main.js, but good to have here
    //  in case of dynamic content loading later)
    lucide.createIcons();

});