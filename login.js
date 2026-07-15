// Prince Alex Digital E-Voting - Login Page Logic

let generatedOTP = '';
let otpTimer = null;
let otpTimeLeft = 300; // 5 minutes
let otpCreatedAt = null;
let loginMethod = 'otp'; // 'otp' or 'password'

document.addEventListener('DOMContentLoaded', function() {
    // No radio setup needed — styled buttons used instead
});

function selectLoginMethod(method, btn) {
    loginMethod = method;
    document.querySelectorAll('.pad-method-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const passwordGroup = document.getElementById('passwordGroup');
    const loginBtn = document.getElementById('voterLoginText');
    if (method === 'password') {
        passwordGroup.style.display = 'block';
        loginBtn.textContent = 'Login';
    } else {
        passwordGroup.style.display = 'none';
        loginBtn.textContent = 'Send OTP';
    }
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling;
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = '🙈';
    } else {
        input.type = 'password';
        icon.textContent = '👁️';
    }
}

async function handleVoterLogin() {
    const identifier = document.getElementById('voterId').value.trim();
    // loginMethod is set by the styled button clicks via selectLoginMethod()
    if (!identifier) {
        showError('voterIdError', 'Please enter your email address or identity number');
        return;
    }
    if (loginMethod === 'otp') {
        sendOTP(identifier);
    } else {
        const password = document.getElementById('password').value;
        if (!password) {
            showError('passwordError', 'Please enter your password');
            return;
        }
        try {
            const button = document.querySelector('#voterLoginBtn');
            const buttonText = document.querySelector('#voterLoginText');
            const loading = document.querySelector('#voterLoginLoading');
            const errorDiv = document.querySelector('#voterLoginError');
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
            button.disabled = true;
            buttonText.style.display = 'none';
            loading.style.display = 'inline-flex';

            const isEmail = identifier.includes('@');
            let votersSnapshot = isEmail
                ? await window.getDocs(window.query(window.collection(window.firebaseDB, 'voters'), window.where('email', '==', identifier)))
                : await window.getDocs(window.query(window.collection(window.firebaseDB, 'voters'), window.where('identity', '==', identifier)));

            if (votersSnapshot.empty) {
                const fieldType = isEmail ? 'email address' : 'identity number';
                errorDiv.textContent = `No voter account found with this ${fieldType}. Please register first or check your details.`;
                errorDiv.style.display = 'block';
                button.disabled = false;
                buttonText.style.display = 'inline-block';
                loading.style.display = 'none';
                return;
            }
            const voterData = votersSnapshot.docs[0].data();
            await window.signInWithEmailAndPassword(window.firebaseAuth, voterData.email, password);
            showSuccess('voterLoginSuccess', 'Login successful! Redirecting to your dashboard...');
            await loginVoterWithFirebase(voterData.email, password, false);
            button.disabled = false;
            buttonText.style.display = 'inline-block';
        } catch (error) {
            console.error('Login error:', error);
            const button = document.querySelector('#voterLoginBtn');
            const buttonText = document.querySelector('#voterLoginText');
            const loading = document.querySelector('#voterLoginLoading');
            const errorDiv = document.querySelector('#voterLoginError');
            button.disabled = false;
            buttonText.style.display = 'inline-block';
            loading.style.display = 'none';
            let msg = 'Login failed. Please check your credentials.';
            if (error.code === 'auth/user-not-found') msg = 'No account found with this email. Please register first.';
            else if (error.code === 'auth/wrong-password') msg = 'Incorrect password. Please try again.';
            else if (error.code === 'auth/invalid-email') msg = 'Invalid email address.';
            else if (error.code === 'auth/too-many-requests') msg = 'Too many failed attempts. Please try again later.';
            else if (error.code === 'auth/network-request-failed') msg = 'Network error. Please check your internet connection.';
            else if (error.code === 'auth/invalid-credential') msg = 'Invalid credentials. Please check your details.';
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
        }
    }
}

async function sendEmailWithWorker(payload) {
    try {
        const response = await fetch(PAD_CONFIG.emailWorker, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (response.ok) {
            console.log("Email sent successfully via worker! Message ID:", data.messageId);
            return { success: true, data };
        } else {
            console.error("Failed to send email via worker:", data.error, data.details);
            return { success: false, error: data.error || 'Unknown error' };
        }
    } catch (error) {
        console.error("Network or parsing error when sending email:", error);
        return { success: false, error: 'Network error' };
    }
}

function generateOtp() {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return (array[0] % 900000 + 100000).toString();
}

async function hashOTP(otp) {
    const encoder = new TextEncoder();
    const data = encoder.encode(otp);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendOTP(identifier) {
    const button = document.querySelector('#voterLoginBtn');
    const buttonText = document.querySelector('#voterLoginText');
    const loading = document.querySelector('#voterLoginLoading');
    const errorDiv = document.querySelector('#voterLoginError');
    const otpErrorDiv = document.querySelector('#otpVerifyError');

    try {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
        if (otpErrorDiv) { otpErrorDiv.style.display = 'none'; otpErrorDiv.textContent = ''; }

        button.disabled = true;
        buttonText.style.display = 'none';
        loading.style.display = 'inline-flex';

        const isEmail = identifier.includes('@');
        let votersSnapshot = isEmail
            ? await window.getDocs(window.query(window.collection(window.firebaseDB, 'voters'), window.where('email', '==', identifier)))
            : await window.getDocs(window.query(window.collection(window.firebaseDB, 'voters'), window.where('identity', '==', identifier)));

        if (votersSnapshot.empty) {
            button.disabled = false; buttonText.style.display = 'inline-block'; loading.style.display = 'none';
            const fieldType = isEmail ? 'email address' : 'identity number';
            const msg = `We could not find an account with this ${fieldType}. Please check for typos or register a new account.`;
            if (errorDiv) { errorDiv.textContent = msg; errorDiv.style.display = 'block'; }
            return;
        }

        const voterDoc = votersSnapshot.docs[0];
        const voterData = voterDoc.data();

        if (!voterData.email) {
            button.disabled = false; buttonText.style.display = 'inline-block'; loading.style.display = 'none';
            const msg = 'Account is missing an email address. Please contact support.';
            if (errorDiv) { errorDiv.textContent = msg; errorDiv.style.display = 'block'; }
            return;
        }

        if (voterData.status !== 'active') {
            button.disabled = false; buttonText.style.display = 'inline-block'; loading.style.display = 'none';
            const msg = 'Your account is not active. Please contact your administrator.';
            if (errorDiv) { errorDiv.textContent = msg; errorDiv.style.display = 'block'; }
            return;
        }

        // Rate limiting
        const otpQuery = window.query(window.collection(window.firebaseDB, 'otp_verification'),
            window.where('email', '==', voterData.email), window.orderBy('createdAt', 'desc'), window.limit(1));
        const otpSnapshot = await window.getDocs(otpQuery);
        const otpDoc = otpSnapshot.empty ? null : otpSnapshot.docs[0];
        let sendCount = 0, lastSentAt = 0;

        if (otpDoc) {
            const data = otpDoc.data();
            lastSentAt = data.lastSentAt?.toMillis ? data.lastSentAt.toMillis() : (data.lastSentAt || 0);
            sendCount = data.sendCount || 0;
            const now = Date.now();

            if (now - lastSentAt < PAD_CONFIG.resendCooldownMs) {
                const remaining = Math.ceil((PAD_CONFIG.resendCooldownMs - (now - lastSentAt)) / 1000);
                button.disabled = false; buttonText.style.display = 'inline-block'; loading.style.display = 'none';
                const msg = `Please wait ${remaining} seconds before requesting a new code.`;
                if (errorDiv) { errorDiv.textContent = msg; errorDiv.style.display = 'block'; }
                return;
            }

            if (now - lastSentAt > PAD_CONFIG.otpWindowMs) {
                sendCount = 0;
            } else if (sendCount >= PAD_CONFIG.maxOtpPerWindow) {
                button.disabled = false; buttonText.style.display = 'inline-block'; loading.style.display = 'none';
                if (errorDiv) { errorDiv.textContent = 'Too many requests. Please try again in 15 minutes.'; errorDiv.style.display = 'block'; }
                return;
            }
        }

        const otp = generateOtp();
        const otpHash = await hashOTP(otp);
        const expiresAt = Date.now() + PAD_CONFIG.otpExpiryMs;

        await window.addDoc(window.collection(window.firebaseDB, 'otp_verification'), {
            email: voterData.email, otpHash, attempts: 0, maxAttempts: PAD_CONFIG.maxOtpAttempts,
            expiresAt, used: false, voterId: voterDoc.id, voterName: voterData.name,
            orgId: voterData.organizationId, type: 'login_verification',
            createdAt: window.serverTimestamp(), lastSentAt: window.serverTimestamp(),
            sendCount: sendCount + 1
        });

        const emailPayload = {
            toEmail: voterData.email, toName: voterData.name,
            subject: "Your Login Code - Prince Alex Digital E-voting system 🔐",
            htmlContent: buildLoginEmailHtml(voterData.name, otp),
            textContent: `Hello ${voterData.name},\n\nYour login verification code is: ${otp}\n\nThis code will expire in 5 minutes for security reasons.\n\nEnter this code in the login form to access your voting dashboard.\n\nIf you didn't request this code, please ignore this email.\n\nThank you for using Prince Alex Digital E-Voting System.\n\n---\nPrince Alex Digital | https://www.princealex.pro`
        };

        const emailResult = await sendEmailWithWorker(emailPayload);
        if (!emailResult.success) throw new Error('Failed to send OTP email.');

        button.disabled = false; buttonText.style.display = 'inline-block'; loading.style.display = 'none';

        const successMsg = `✅ Login OTP sent to ${voterData.email}! Check your email and enter the 6-digit code below.`;
        hideSuccess('voterLoginSuccess');
        hideError('voterLoginError');
        startOTPTimer();
        showOTPForm(identifier, successMsg);

    } catch (error) {
        console.error('Error sending OTP email:', error);
        button.disabled = false; buttonText.style.display = 'inline-block'; loading.style.display = 'none';
        let errorMessage = 'Error sending verification code. Please try again.';
        if (error.code === 'permission-denied') errorMessage = 'Permission denied. Please check your Firebase configuration.';
        else if (error.code === 'unavailable') errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
        else if (error.code === 'unauthenticated') errorMessage = 'Authentication failed. Please refresh the page and try again.';
        else if (error.message && error.message.includes('network')) errorMessage = 'Network error. Please check your internet connection and try again.';
        if (errorDiv) { errorDiv.textContent = errorMessage; errorDiv.style.display = 'block'; }
    }
}

function showOTPForm(identifier, initialSuccessMessage = '') {
    const form = document.getElementById('voterLoginForm');
    form.innerHTML = `
        <div class="pad-form-group">
            <label class="pad-label" for="otpCode">Enter Verification Code</label>
            <input type="text" id="otpCode" name="otpCode" class="pad-input" placeholder="Enter 6-digit code" maxlength="6">
            <div class="pad-error-message" id="otpError"></div>
            <div class="pad-otp-timer" id="otpTimerDisplay">Code expires in 5:00</div>
        </div>
        <button type="button" class="pad-btn pad-btn-primary" id="verifyBtn" onclick="verifyOTP('${identifier}')">
            Verify & Login
        </button>
        <div class="pad-error-message" id="otpVerifyError" style="display: none;"></div>
        <div class="pad-success-message" id="otpVerifySuccess" style="position: relative; padding-right: 2.5rem; display: ${initialSuccessMessage ? 'block' : 'none'};">
            ${initialSuccessMessage}
            <span onclick="this.parentElement.style.display='none'" style="position: absolute; top: 50%; right: 1rem; transform: translateY(-50%); cursor: pointer; font-size: 1.5rem; font-weight: bold; line-height: 1;">&times;</span>
        </div>
        <div class="pad-text-center pad-mt-2">
            <button type="button" class="pad-link" onclick="resendOTP('${identifier}')" id="resendBtn">Resend Code</button>
        </div>
    `;
    if (initialSuccessMessage) {
        setTimeout(() => {
            const el = document.getElementById('otpVerifySuccess');
            if (el) el.style.display = 'none';
        }, 10000);
    }
}

async function verifyOTP(identifier) {
    const enteredOTP = document.getElementById('otpCode').value.trim();
    const verifyBtn = document.getElementById('verifyBtn');
    let isSuccess = false;

    if (!enteredOTP) { showError('otpVerifyError', 'Please enter the verification code'); return; }
    if (!/^\d{6}$/.test(enteredOTP)) { showError('otpVerifyError', 'Please enter a valid 6-digit code'); return; }

    if (verifyBtn) { verifyBtn.disabled = true; verifyBtn.innerHTML = '<span class="pad-spinner"></span> Verifying...'; }
    hideError('otpVerifyError');

    try {
        const isEmail = identifier.includes('@');
        let votersSnapshot = isEmail
            ? await window.getDocs(window.query(window.collection(window.firebaseDB, 'voters'), window.where('email', '==', identifier)))
            : await window.getDocs(window.query(window.collection(window.firebaseDB, 'voters'), window.where('identity', '==', identifier)));

        if (votersSnapshot.empty) {
            showError('otpVerifyError', `No voter found with this ${isEmail ? 'email address' : 'identity number'}`);
            return;
        }

        const voterData = votersSnapshot.docs[0].data();
        const otpQuery = window.query(window.collection(window.firebaseDB, 'otp_verification'),
            window.where('email', '==', voterData.email), window.orderBy('createdAt', 'desc'), window.limit(1));
        const otpSnapshot = await window.getDocs(otpQuery);

        if (otpSnapshot.empty) { showError('otpVerifyError', 'No verification code found. Please request a new one.'); return; }

        const otpDocSnapshot = otpSnapshot.docs[0];
        const otpData = otpDocSnapshot.data();
        const otpDocRef = window.doc(window.firebaseDB, 'otp_verification', otpDocSnapshot.id);

        let expiryTime = otpData.expiresAt?.toMillis ? otpData.expiresAt.toMillis() : otpData.expiresAt;
        if (Date.now() > expiryTime) { showError('otpVerifyError', 'Verification code has expired. Please request a new one.'); return; }
        if (otpData.used) { showError('otpVerifyError', 'Verification code has already been used. Please request a new one.'); return; }
        if ((otpData.attempts || 0) >= (otpData.maxAttempts || 5)) { showError('otpVerifyError', 'Too many failed attempts. Please request a new one.'); return; }

        const inputHash = await hashOTP(enteredOTP);
        if (inputHash !== otpData.otpHash) {
            await window.updateDoc(otpDocRef, { attempts: (otpData.attempts || 0) + 1 });
            showError('otpVerifyError', 'Invalid verification code. Please try again.');
            return;
        }

        await window.updateDoc(otpDocRef, { used: true, usedAt: window.serverTimestamp() });
        isSuccess = true;
        showSuccess('otpVerifySuccess', 'Verification successful! Logging in and redirecting...');
        await loginVoterWithFirebase(voterData.email, null);

    } catch (error) {
        console.error('Error verifying OTP:', error);
        showError('otpVerifyError', 'Error verifying code. Please try again.');
    } finally {
        if (verifyBtn && !isSuccess) { verifyBtn.disabled = false; verifyBtn.innerHTML = 'Verify & Login'; }
    }
}

function resendOTP(identifier) {
    hideError('otpVerifyError');
    hideSuccess('otpVerifySuccess');
    sendOTP(identifier);
}

function startOTPTimer() {
    otpTimeLeft = 300;
    updateOTPTimer();
    otpTimer = setInterval(() => {
        otpTimeLeft--;
        updateOTPTimer();
        if (otpTimeLeft <= 0) {
            clearInterval(otpTimer);
            showAlert('OTP expired. Please request a new code.', 'error');
        }
    }, 1000);
}

function updateOTPTimer() {
    const minutes = Math.floor(otpTimeLeft / 60);
    const seconds = otpTimeLeft % 60;
    const el = document.getElementById('otpTimerDisplay');
    if (el) {
        el.textContent = `Code expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
        if (otpTimeLeft < 60) el.classList.add('error');
        else if (otpTimeLeft < 120) el.classList.add('warning');
    }
}

async function loginVoterWithFirebase(email, password, doAuth = true) {
    try {
        const votersSnapshot = await window.getDocs(window.query(window.collection(window.firebaseDB, 'voters'), window.where('email', '==', email)));
        if (votersSnapshot.empty) throw new Error('Voter data not found');

        const voterDoc = votersSnapshot.docs[0];
        const voterData = voterDoc.data();
        const voterId = voterDoc.id;

        await window.updateDoc(window.doc(window.firebaseDB, 'voters', voterId), { lastLogin: window.serverTimestamp() });

        // For OTP flow: generate a temporary UID and write it to Firestore FIRST,
        // so that onAuthStateChanged finds the voter record when signInAnonymously triggers it.
        // This avoids a race condition where onAuthStateChanged signs the user out
        // before we've linked the anonymous UID to the voter document.
        const tempUid = 'anon_' + voterId + '_' + Date.now();
        await window.updateDoc(window.doc(window.firebaseDB, 'voters', voterId), { firebaseUid: tempUid });

        if (password && doAuth) {
            await window.signInWithEmailAndPassword(window.firebaseAuth, email, password);
        } else {
            const userCredential = await window.signInAnonymously(window.firebaseAuth);
            // Update the firebaseUid with the actual anonymous UID from Firebase
            await window.updateDoc(window.doc(window.firebaseDB, 'voters', voterId), { firebaseUid: userCredential.user.uid });
        }

        hideError('otpVerifyError');
        setTimeout(() => { window.location.href = 'dashboard_voter.html'; }, 1500);

    } catch (error) {
        console.error('Error in loginVoterWithFirebase:', error);
        let msg = 'Login failed. Please try again.';
        if (error.code === 'auth/admin-restricted-operation') {
            msg = 'Login system is not configured correctly. Please contact support.';
            console.error('Firebase Anonymous Sign-In is not enabled in the Firebase console.');
        } else if (error.message) msg = error.message;
        showError('otpVerifyError', msg);
    }
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) { el.textContent = message; el.style.display = 'block'; }
}
function hideError(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = 'none';
}
function showSuccess(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) { el.textContent = message; el.style.display = 'block'; }
}
function hideSuccess(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = 'none';
}
function showAlert(message, type) {
    const el = document.getElementById('alertMessage');
    el.textContent = message;
    el.className = `pad-alert ${type} show`;
    setTimeout(() => { el.classList.remove('show'); }, 5000);
}