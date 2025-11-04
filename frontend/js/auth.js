/* ---
   SSAD Authentication Page Logic
   [MODIFIED FOR CLIENT-SIDE HASHING]
   --- */

// --- Global state for CAPTCHA and Timer ---
let captchaToken = null;
let lockoutInterval = null;

// --- CAPTCHA callback functions ---
function onCaptchaSuccess(token) {
    console.log("CAPTCHA solved!");
    captchaToken = token;
    const loginBtn = document.getElementById('login-btn');
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

// --- [NEW] SHA-256 Hashing Function ---
/**
 * Hashes a string using SHA-256.
 * @param {string} message - The plaintext string to hash.
 * @returns {Promise<string>} The SHA-256 hash as a hex string.
 */
async function sha256(message) {
    try {
        // This is the standard, secure way
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } catch (error) {
        console.error("crypto.subtle.digest failed (are you on HTTP?). Error:", error);
        // Fallback for non-secure contexts (like http://)
        // This is a simple, non-secure hash function for demo purposes if crypto.subtle fails
        showNotification("Warning: Secure hashing (crypto.subtle) failed. Using insecure fallback. (This is expected on HTTP)", "error");
        
        let hash = 0, i, chr;
        if (message.length === 0) return hash.toString();
        for (i = 0; i < message.length; i++) {
            chr = message.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        // This is NOT a real SHA256, but it proves hashing happened
        return `fallback_hash_${hash.toString()}_${message.length}`;
    }
}


document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    // !!! SET THIS TO http://127.0.0.1:8000 FOR LOCAL TESTING !!!
    // !!! SET THIS TO https://security-app-ssad.fly.dev FOR DEPLOYMENT !!!
    const API_URL = 'http://127.0.0.1:8000'; 
    // const API_URL = 'https://security-app-ssad.fly.dev';


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
            // Re-enable button ONLY if CAPTCHA is solved AND no lockout
            if (button && button.id === 'login-btn') {
                if (captchaToken && !lockoutInterval) {
                    button.disabled = false;
                }
            } else if (button) {
                 button.disabled = false;
            }
        }
    }

    // --- Lockout Timer Logic ---
    function checkPersistentLockout() {
        const lockoutUntil = localStorage.getItem('ssad_lockoutUntil');
        if (!lockoutUntil) return;

        const lockoutEndTime = parseInt(lockoutUntil);
        const now = Date.now();
        let secondsRemaining = Math.ceil((lockoutEndTime - now) / 1000);

        if (secondsRemaining > 0) {
            loginBtn.disabled = true;
            lockoutTimerDisplay.style.display = 'block';
            
            if (lockoutInterval) clearInterval(lockoutInterval);

            lockoutInterval = setInterval(() => {
                secondsRemaining--; // Decrement first
                if (secondsRemaining <= 0) {
                    clearInterval(lockoutInterval);
                    lockoutInterval = null;
                    lockoutTimerDisplay.style.display = 'none';
                    localStorage.removeItem('ssad_lockoutUntil');
                    if (captchaToken) {
                        loginBtn.disabled = false;
                    }
                } else {
                    lockoutTimerDisplay.textContent = `Too many attempts. Please wait ${secondsRemaining} seconds.`;
                }
            }, 1000);
            // Set initial text immediately
            lockoutTimerDisplay.textContent = `Too many attempts. Please wait ${secondsRemaining} seconds.`;

        } else {
            localStorage.removeItem('ssad_lockoutUntil');
        }
    }

    if (localStorage.getItem('ssad_token')) {
        window.location.href = 'dashboard.html';
    }
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

    // --- Login Form Logic [MODIFIED FOR HASHING] ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setButtonLoading(loginBtn, true);

        const username = loginForm.username.value;
        const plainPassword = loginForm.password.value;

        let hashedPassword;
        try {
            // --- [NEW] HASH THE PASSWORD on the client-side ---
            hashedPassword = await sha256(plainPassword);
            // --- [END NEW] ---
        } catch (error) {
            showNotification("Client-side hashing failed. Cannot log in.", "error");
            setButtonLoading(loginBtn, false);
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password: hashedPassword, // Send the HASH, not the plaintext
                    captcha_token: captchaToken
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) {
                    const waitMatch = data.detail.match(/(\d+)/);
                    if (waitMatch) {
                        const waitSeconds = parseInt(waitMatch[1]);
                        const lockoutEndTime = Date.now() + (waitSeconds * 1000);
                        localStorage.setItem('ssad_lockoutUntil', lockoutEndTime);
                        checkPersistentLockout();
                    }
                }
                // Check for 401 specifically
                if (response.status === 401) {
                     throw new Error("Incorrect username or password.");
                }
                throw new Error(data.detail || 'Login failed.');
            }

            // --- Login Success ---
            localStorage.setItem('ssad_token', data.access_token);
            localStorage.setItem('ssad_username', username);
            localStorage.removeItem('ssad_lockoutUntil');
            
            window.location.href = 'dashboard.html';

        } catch (error) {
            showNotification(error.message, 'error');
            // Do not setButtonLoading(false) here, it's handled in finally
        } finally {
            // This runs whether the try or catch block finished
            setButtonLoading(loginBtn, false); // Re-enables button if needed
            if (typeof grecaptcha !== 'undefined') {
                grecaptcha.reset();
            }
            captchaToken = null;
            loginBtn.disabled = true; // Always re-disable after attempt
        }
    });

    // --- Signup Form Logic [MODIFIED] ---
    // We send the PLAINTEXT password for signup,
    // and the *backend* hashes it for storage.
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setButtonLoading(signupBtn, true);

        const username = signupForm.username.value;
        const password = signupForm.password.value; // Send plaintext

        try {
            const response = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // The backend will hash this plaintext password
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

