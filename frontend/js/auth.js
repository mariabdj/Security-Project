/* ---
   SSAD Authentication Page Logic
   [MODIFIED FOR CAPTCHA AND RATE LIMITING]
   --- */

// --- [NEW] Global state for CAPTCHA and Timer ---
let captchaToken = null;
let lockoutInterval = null;

// --- [NEW] CAPTCHA callback functions ---
// These are called by the Google reCAPTCHA script
function onCaptchaSuccess(token) {
    console.log("CAPTCHA solved!");
    captchaToken = token;
    const loginBtn = document.getElementById('login-btn');
    // Only enable login if there is no active lockout
    if (!lockoutInterval) {
        loginBtn.disabled = false;
    }
}

function onCaptchaExpired() {
    console.log("CAPTCHA expired.");
    captchaToken = null;
    const loginBtn = document.getElementById('login-btn');
    loginBtn.disabled = true;
}


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

    const passwordToggleButtons = document.querySelectorAll('.password-toggle-btn');
    
    // [NEW] Lockout timer element
    const lockoutTimerDisplay = document.getElementById('lockout-timer');


    // --- Utility Functions ---

    function showNotification(message, type = 'error') {
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.textContent = message;
        
        notificationContainer.appendChild(notif);
        
        setTimeout(() => {
            notif.remove();
        }, 4000);
    }

    function setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            // Re-enable button ONLY if CAPTCHA is solved AND no lockout
            if (button.id === 'login-btn') {
                if (captchaToken && !lockoutInterval) {
                    button.disabled = false;
                }
            } else {
                 button.disabled = false;
            }
        }
    }

    // --- [NEW] Lockout Timer Logic ---
    function checkPersistentLockout() {
        const lockoutUntil = localStorage.getItem('ssad_lockoutUntil');
        if (!lockoutUntil) {
            return; // No lockout
        }

        const lockoutEndTime = parseInt(lockoutUntil);
        const now = Date.now();
        let secondsRemaining = Math.ceil((lockoutEndTime - now) / 1000);

        if (secondsRemaining > 0) {
            // Start the lockout
            loginBtn.disabled = true;
            lockoutTimerDisplay.style.display = 'block';
            
            // Clear any existing timer
            if (lockoutInterval) {
                clearInterval(lockoutInterval);
            }

            // Start a new interval
            lockoutInterval = setInterval(() => {
                if (secondsRemaining <= 0) {
                    clearInterval(lockoutInterval);
                    lockoutInterval = null;
                    lockoutTimerDisplay.style.display = 'none';
                    localStorage.removeItem('ssad_lockoutUntil');
                    // Enable login button ONLY if CAPTCHA is also solved
                    if (captchaToken) {
                        loginBtn.disabled = false;
                    }
                } else {
                    lockoutTimerDisplay.textContent = `Too many attempts. Please wait ${secondsRemaining} seconds.`;
                    secondsRemaining--;
                }
            }, 1000);

        } else {
            // Lockout has expired, clear it
            localStorage.removeItem('ssad_lockoutUntil');
        }
    }

    // --- Check for existing login ---
    if (localStorage.getItem('ssad_token')) {
        window.location.href = 'dashboard.html';
    }

    // --- Check for persistent lockout on page load ---
    checkPersistentLockout();


    // --- Theme Toggle Logic ---
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
    lucide.createIcons();

    // --- Show/Hide Password Logic ---
    passwordToggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetInputId = button.dataset.target;
            const targetInput = document.getElementById(targetInputId);
            if (!targetInput) return;
            const isPassword = targetInput.type === 'password';
            targetInput.type = isPassword ? 'text' : 'password';
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

    // --- Login Form Logic [MODIFIED] ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setButtonLoading(loginBtn, true);

        const username = loginForm.username.value;
        const password = loginForm.password.value;

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password,
                    captcha_token: captchaToken // Send the CAPTCHA token
                })
            });

            const data = await response.json();

            if (!response.ok) {
                // [MODIFIED] Handle custom lockout error
                if (response.status === 429) {
                    // Extract seconds from the error message
                    const waitMatch = data.detail.match(/(\d+)/);
                    if (waitMatch) {
                        const waitSeconds = parseInt(waitMatch[1]);
                        const lockoutEndTime = Date.now() + (waitSeconds * 1000);
                        localStorage.setItem('ssad_lockoutUntil', lockoutEndTime);
                        checkPersistentLockout(); // Start the timer
                    }
                }
                throw new Error(data.detail || 'Login failed.');
            }

            // --- Login Success ---
            localStorage.setItem('ssad_token', data.access_token);
            localStorage.setItem('ssad_username', username);
            localStorage.removeItem('ssad_lockoutUntil'); // Clear any old lockout
            
            window.location.href = 'dashboard.html';

        } catch (error) {
            showNotification(error.message, 'error');
            setButtonLoading(loginBtn, false);
        } finally {
            // [MODIFIED] Reset CAPTCHA on every attempt
            if (typeof grecaptcha !== 'undefined') {
                grecaptcha.reset();
            }
            captchaToken = null;
            loginBtn.disabled = true; // Always re-disable
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
            // Note: This does not need a token, so we use standard fetch
            const response = await fetch(`${API_URL}/passwords-and-attacks/generate-password?password_type=${passwordType}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Failed to generate password.');
            }
            
            signupPasswordInput.value = data.generated_password;
            showNotification('New password generated!', 'success');

        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setButtonLoading(generatePassBtn, false);
        }
    });

});
