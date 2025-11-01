/* ---
   SSAD Authentication Page Logic
   --- */
document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    const API_URL = 'http://127.0.0.1:8000'; // Your local backend URL

    // --- Element Selection ---
    const authCard = document.getElementById('auth-card');
    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login');

    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    
    const signupForm = document.getElementById('signup-form');
    const signupBtn = document.getElementById('signup-btn');
    const signupPasswordInput = document.getElementById('signup-password');

    const generatePassBtn = document.getElementById('generate-pass-btn');
    const passwordTypeSelect = document.getElementById('password-type');
    
    const themeToggle = document.getElementById('theme-toggle');
    const notificationContainer = document.getElementById('notification-container');

    // --- [NOUVEAU] Sélection des boutons Show/Hide Password ---
    const passwordToggleButtons = document.querySelectorAll('.password-toggle-btn');


    // --- Utility Functions ---

    /**
     * Shows a success or error notification.
     * @param {string} message - The message to display.
     * @param {string} type - 'success' or 'error'.
     */
    function showNotification(message, type = 'error') {
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.textContent = message;
        
        notificationContainer.appendChild(notif);
        
        // Remove after animation
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
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    // --- Check for existing login ---
    // If already logged in, redirect to dashboard
    if (localStorage.getItem('ssad_token')) {
        window.location.href = 'dashboard.html';
    }

    // --- Theme Toggle Logic ---
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    // Load saved theme
    const savedTheme = localStorage.getItem('ssad_theme') || 'dark'; // Default to dark
    applyTheme(savedTheme);

    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        const newTheme = isDark ? 'dark' : 'light';
        localStorage.setItem('ssad_theme', newTheme);
        applyTheme(newTheme);
        // Re-initialize icons after theme change
        lucide.createIcons();
    });

    // --- FIXED: Initial Icon Load ---
    // This runs *after* the DOM is ready and initializes all icons.
    lucide.createIcons();


    // --- [NOUVEAU] Logique pour Show/Hide Password ---
    passwordToggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetInputId = button.dataset.target;
            const targetInput = document.getElementById(targetInputId);
            
            if (!targetInput) return;

            const isPassword = targetInput.type === 'password';
            
            // Basculer le type de l'input
            targetInput.type = isPassword ? 'text' : 'password';
            
            // Basculer la classe du bouton (pour changer l'icône via CSS)
            button.classList.toggle('is-showing', isPassword);
        });
    });


    // --- Auth Card Flip Logic ---
    showSignupBtn.addEventListener('click', () => {
        authCard.classList.add('is-flipped');
    });

    showLoginBtn.addEventListener('click', () => {
        authCard.classList.remove('is-flipped');
    });

    // --- Login Form Logic ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setButtonLoading(loginBtn, true);

        const username = loginForm.username.value;
        const password = loginForm.password.value;

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Login failed. Please check your credentials.');
            }

            // --- Login Success ---
            localStorage.setItem('ssad_token', data.access_token);
            localStorage.setItem('ssad_username', username); // Store username for display
            
            // Redirect to dashboard
            window.location.href = 'dashboard.html';

        } catch (error) {
            showNotification(error.message, 'error');
            setButtonLoading(loginBtn, false);
        }
    });

    // --- Signup Form Logic ---
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setButtonLoading(signupBtn, true);

        const username = signupForm.username.value;
        const password = signupForm.password.value;

        try {
            const response = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Signup failed. Please try again.');
            }

            // --- Signup Success ---
            showNotification('Account created successfully! Please log in.', 'success');
            signupForm.reset();
            
            // Flip back to login and pre-fill username
            authCard.classList.remove('is-flipped');
            loginForm.username.value = username;
            loginForm.password.focus();
        
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setButtonLoading(signupBtn, false);
        }
    });

    // --- Password Generation Logic ---
    generatePassBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        setButtonLoading(generatePassBtn, true);

        const passwordType = passwordTypeSelect.value;

        try {
            const response = await fetch(`${API_URL}/passwords-and-attacks/generate-password?password_type=${passwordType}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Failed to generate password.');
            }
            
            // --- Generation Success ---
            signupPasswordInput.value = data.generated_password;
            showNotification('New password generated!', 'success');

        } catch (error)
{
            showNotification(error.message, 'error');
        } finally {
            setButtonLoading(generatePassBtn, false);
        }
    });

});