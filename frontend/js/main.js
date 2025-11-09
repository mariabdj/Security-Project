/* ---
   SSAD Main Dashboard Script (main.js)
   Loaded on all pages *except* the login page.
   --- */

// --- Global Configuration ---
const API_URL = 'http://127.0.0.1:8000';
const TOKEN = localStorage.getItem('ssad_token');
const CURRENT_USERNAME = localStorage.getItem('ssad_username');

// --- AUTHENTICATION CHECK ---
if (!TOKEN && window.location.pathname.endsWith('dashboard.html')) {
    window.location.href = 'index.html';
}


// --- Global Utility Functions ---

/**
 * [FIX] Centralized Logout Function
 * This function clears ALL session data from both storage locations.
 */
function logoutUser() {
    localStorage.clear();    // Clears token, username, theme
    sessionStorage.clear(); // Clears chat session keys
    window.location.href = 'index.html';
}

/**
 * Shows a success or error notification.
 * @param {string} message - The message to display.
 * @param {string} type - 'success' or 'error'.
 */
function showNotification(message, type = 'error') {
    const container = document.getElementById('notification-container');
    if (!container) return; 

    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = message;
    
    container.appendChild(notif);
    
    setTimeout(() => {
        notif.remove();
    }, 4000);
}

/**
 * Toggles loading state on a button.
 * @param {HTMLButtonElement} button - The button element.
 * @param {boolean} isLoading - The loading state.
 */
function setButtonLoading(button, isLoading) {
    if (!button) return; 
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

/**
 * A secure wrapper for the fetch() API.
 * Automatically adds the JWT token to the headers.
 * @param {string} endpointOrUrl - The API endpoint (e.g., "/users/search") or a full URL.
 * @param {object} options - Standard fetch options (method, body, etc.).
 * @returns {Promise<Response>} - The fetch response.
 */
async function secureFetch(endpointOrUrl, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        ...options.headers,
    };
    
    const isAbsolute = endpointOrUrl.startsWith('http://') || endpointOrUrl.startsWith('https://');
    const url = isAbsolute ? endpointOrUrl : `${API_URL}${endpointOrUrl}`;

    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // [FIX] Token is invalid or expired. Call the centralized logout function.
        showNotification('Session expired. Please log in again.', 'error');
        logoutUser();
        // Return a new response to stop the promise chain
        return new Response(JSON.stringify({detail: "Unauthorized"}), {
             status: 401, 
             headers: { 'Content-Type': 'application/json' }
        });
    }

    return response;
}


// --- Global Event Listeners (Run on every dashboard page) ---
document.addEventListener('DOMContentLoaded', () => {

    // --- Initialize Icons ---
    lucide.createIcons();

    // --- Theme Toggle Logic ---
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        function applyTheme(theme) {
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }

        const savedTheme = localStorage.getItem('ssad_theme') || 'dark';
        applyTheme(savedTheme);

        themeToggle.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            const newTheme = isDark ? 'dark' : 'light';
            localStorage.setItem('ssad_theme', newTheme);
            applyTheme(newTheme);
            lucide.createIcons();
        });
    }

    // --- Logout Button Logic ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            // [FIX] Call the centralized logout function.
            logoutUser();
        });
    }

    // --- Welcome Message ---
    const welcomeMsg = document.getElementById('welcome-message');
    if (welcomeMsg && CURRENT_USERNAME) {
        welcomeMsg.textContent = `Welcome, ${CURRENT_USERNAME}`;
    }

    // --- Global Modal Close Logic ---
    document.querySelectorAll('.modal-close').forEach(button => {
        const modalId = button.dataset.modalId;
        const modal = document.getElementById(modalId);
        if (modal) {
            button.addEventListener('click', () => {
                modal.classList.remove('visible');
            });
        }
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('visible');
            }
        });
    });

});