// Prince Alex Digital E-Voting - Voter Registration Logic

let currentStep = 1;
let registrationData = {};
let organizationData = null;
let isVerifying = false;
let countdownTimer = null;
let resendCooldown = null;

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    checkOrganizationCode();
});

function checkOrganizationCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const orgCode = urlParams.get('org');
    if (orgCode) {
        document.getElementById('orgCode').value = orgCode;
        validateOrgCode();
    }
}

async function validateOrgCode() {
    const orgCode = document.getElementById('orgCode').value;
    if (!orgCode) { showError('orgCodeError', 'Please enter organization code'); return; }
    try {
        const orgQuery = window.query(window.collection(window.firebaseDB, 'organizations'), window.where('code', '==', orgCode));
        const orgSnapshot = await window.getDocs(orgQuery);
        if (!orgSnapshot.empty) {
            const orgDoc = orgSnapshot.docs[0];
            organizationData = { id: orgDoc.id, ...orgDoc.data() };
            showSuccess('orgCodeError', 'Organization code validated successfully!');
            document.getElementById('organizationName').textContent = organizationData.name;
            document.getElementById('organizationInfo').style.display = 'block';
            setTimeout(() => {
                document.getElementById('step1-content').style.display = 'none';
                document.getElementById('step2-content').style.display = 'block';
                document.getElementById('step1').classList.remove('active');
                document.getElementById('step2').classList.add('active');
                currentStep = 2;
            }, 1000);
        } else {
            showError('orgCodeError', 'Invalid organization code. Please check with your administrator.');
        }
    } catch (error) {
        console.error('Error validating organization code:', error);
        showError('orgCodeError', 'Error validating organization code. Please try again.');
    }
}

function setupEventListeners() {
    document.getElementById('photoUpload').addEventListener('click', function() {
        document.getElementById('photoInput').click();
    });
    document.getElementById('photoInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { showError('photoError', 'File size must be less than 2MB'); return; }
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('photoPreview').src = e.target.result;
                document.getElementById('photoPreview').style.display = 'block';
                document.getElementById('photoPlaceholder').style.display = 'none';
                document.getElementById('photoUpload').classList.add('has-photo');
                registrationData.photo = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
    document.getElementById('identity').addEventListener('blur', validateIdentity);
    document.getElementById('phone').addEventListener('blur', validatePhone);
    document.getElementById('email').addEventListener('blur', validateEmail);
}

function validateIdentity() {
    const identity = document.getElementById('identity').value;
    if (!identity) { showError('identityError', 'Identity number is required'); return false; }
    const voters = JSON.parse(localStorage.getItem('pad_voters') || '[]');
    if (voters.find(v => v.identity === identity)) { showError('identityError', 'This identity number is already registered'); return false; }
    showSuccess('identitySuccess', 'Identity number is available');
    hideError('identityError');
    return true;
}

function validatePhone() {
    const phone = document.getElementById('phone').value;
    if (!phone) { showError('phoneError', 'Phone number is required'); return false; }
    if (!/^\+?[1-9]\d{1,14}$/.test(phone)) { showError('phoneError', 'Please enter a valid phone number'); return false; }
    hideError('phoneError');
    return true;
}

function validateEmail() {
    const email = document.getElementById('email').value;
    if (!email) { showError('emailError', 'Email address is required'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('emailError', 'Please enter a valid email address'); return false; }
    hideError('emailError');
    return true;
}

async function nextStep() {
    if (currentStep !== 2) return;
    const fullName = document.getElementById('fullName').value;
    const identity = document.getElementById('identity').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    if (!fullName || !identity || !phone || !email) { showAlert('Please fill in all required fields', 'error'); return; }
    if (!validateIdentity() || !validatePhone() || !validateEmail()) { showAlert('Please fix the validation errors', 'error'); return; }
    try {
        showAlert('Checking for existing accounts...', 'info');
        const [emailQuery, identityQuery] = await Promise.all([
            window.getDocs(window.query(window.collection(window.firebaseDB, 'voters'), window.where('email', '==', email))),
            window.getDocs(window.query(window.collection(window.firebaseDB, 'voters'), window.where('identity', '==', identity)))
        ]);
        if (!emailQuery.empty) { showAlert('An account with this email already exists. Please use a different email or try logging in.', 'error'); return; }
        if (!identityQuery.empty) { showAlert('An account with this identity number already exists. Please use a different identity number or try logging in.', 'error'); return; }
        registrationData = { fullName, identity, phone, email, photo: registrationData.photo || null };
        const sent = await sendOTP();
        if (sent) showEmailVerificationModal();
    } catch (error) {
        console.error('Error checking existing accounts:', error);
        showAlert('Error checking existing accounts. Please try again.', 'error');
    }
}

function generateOtp() {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return (array[0] % 900000 + 100000).toString();
}

async function sendEmailWithWorker(payload) {
    try {
        const response = await fetch(PAD_CONFIG.emailWorker, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (response.ok) { console.log("Email sent successfully via worker! Message ID:", data.messageId); return { success: true, data }; }
        else { console.error("Failed to send email via worker:", data.error, data.details); return { success: false, error: data.error || 'Unknown error' }; }
    } catch (error) {
        console.error("Network or parsing error when sending email:", error);
        return { success: false, error: 'Network error' };
    }
}

async function hashOTP(otp) {
    const encoder = new TextEncoder();
    const data = encoder.encode(otp);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendOTP() {
    try {
        const votersQuery = window.query(window.collection(window.firebaseDB, 'voters'), window.where('email', '==', registrationData.email));
        const votersSnapshot = await window.getDocs(votersQuery);
        if (!votersSnapshot.empty) { showAlert('An account with this email already exists. Please use a different email or try logging in.', 'error'); return false; }

        const otpQuery = window.query(window.collection(window.firebaseDB, 'otp_verification'),
            window.where('email', '==', registrationData.email), window.orderBy('createdAt', 'desc'), window.limit(1));
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
                showAlert(`Please wait ${remaining} seconds before requesting a new code.`, 'error');
                return false;
            }
            if (now - lastSentAt > PAD_CONFIG.otpWindowMs) { sendCount = 0; }
            else if (sendCount >= PAD_CONFIG.maxOtpPerWindow) { showAlert('Too many requests. Please try again in 15 minutes.', 'error'); return false; }
        }

        const otp = generateOtp();
        const otpHash = await hashOTP(otp);
        const expiresAt = Date.now() + PAD_CONFIG.otpExpiryMs;

        await window.addDoc(window.collection(window.firebaseDB, 'otp_verification'), {
            email: registrationData.email, otpHash, attempts: 0, maxAttempts: 5,
            expiresAt, used: false, voterName: registrationData.fullName,
            orgId: organizationData.id, type: 'registration_verification',
            createdAt: window.serverTimestamp(), lastSentAt: window.serverTimestamp(),
            sendCount: sendCount + 1
        });

        const emailPayload = {
            toEmail: registrationData.email, toName: registrationData.fullName,
            subject: "Your Registration Code - Prince Alex Digital E-voting system 📧",
            htmlContent: buildRegistrationEmailHtml(registrationData.fullName, organizationData.name, otp),
            textContent: `Hello ${registrationData.fullName},\n\nThank you for registering with ${organizationData.name} on the Prince Alex Digital E-Voting System.\n\nYour registration verification code is: ${otp}\n\nThis code will expire in 5 minutes for security reasons.\n\nEnter this code in the registration form to activate your account.\n\nIf you didn't initiate this registration, please ignore this email.\n\nThank you for using Prince Alex Digital E-Voting System.\n\n---\nPrince Alex Digital | https://www.princealex.pro`
        };

        const emailResult = await sendEmailWithWorker(emailPayload);
        if (!emailResult.success) throw new Error('Failed to send OTP email.');

        showAlert('Verification code sent to your email!', 'success');
        return true;
    } catch (error) {
        console.error('Error sending OTP email:', error);
        showAlert('Error sending verification code. Please try again.', 'error');
        return false;
    }
}

function failVerification(message) {
    showError('otpError', message);
    document.getElementById('verifyBtn').disabled = false;
    document.getElementById('verifyBtn').innerHTML = 'Verify Code';
    isVerifying = false;
}

async function verifyOTP() {
    if (isVerifying) return;
    isVerifying = true;
    const otp = document.getElementById('otpCode').value.trim();
    const email = registrationData.email;
    const verifyBtn = document.getElementById('verifyBtn');
    if (!otp) { showError('otpError', 'Please enter the verification code'); isVerifying = false; return; }
    if (!/^\d{6}$/.test(otp)) { showError('otpError', 'Please enter a valid 6-digit code'); isVerifying = false; return; }
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span class="pad-spinner"></span> Verifying...';
    hideError('otpError');
    try {
        const otpQuery = window.query(window.collection(window.firebaseDB, 'otp_verification'),
            window.where('email', '==', email), window.orderBy('createdAt', 'desc'), window.limit(1));
        const otpSnapshot = await window.getDocs(otpQuery);
        if (otpSnapshot.empty) return failVerification("No OTP found. Please request again.");
        const otpDocSnapshot = otpSnapshot.docs[0];
        const otpData = otpDocSnapshot.data();
        const otpDocRef = window.doc(window.firebaseDB, 'otp_verification', otpDocSnapshot.id);
        let expiryTime = otpData.expiresAt?.toMillis ? otpData.expiresAt.toMillis() : otpData.expiresAt;
        if (Date.now() > expiryTime) return failVerification("OTP has expired. Please request a new one.");
        if (otpData.used) return failVerification("This code has already been used. Please request a new one.");
        if ((otpData.attempts || 0) >= (otpData.maxAttempts || 5)) return failVerification("Too many failed attempts. Please request a new one.");
        const inputHash = await hashOTP(otp);
        if (inputHash !== otpData.otpHash) {
            await window.updateDoc(otpDocRef, { attempts: (otpData.attempts || 0) + 1 });
            return failVerification("Invalid OTP. Please try again.");
        }
        await window.updateDoc(otpDocRef, { used: true });
        await completeRegistration();
    } catch (error) {
        console.error("Error verifying OTP:", error);
        showError('otpError', "An error occurred. Please try again.");
    } finally {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = 'Verify Code';
        isVerifying = false;
    }
}

function resendOTP() {
    sendOTP();
    document.getElementById('otpCode').value = '';
    hideError('otpError');
}

function showEmailVerificationModal() {
    document.getElementById('emailVerificationModal').classList.add('show');
    startCountdown();
}

function closeEmailVerificationModal() {
    document.getElementById('emailVerificationModal').classList.remove('show');
    clearCountdown();
}

function startCountdown() {
    let timeLeft = 300;
    const countdownEl = document.getElementById('countdown');
    const resendBtn = document.getElementById('resendBtn');
    countdownTimer = setInterval(() => {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        countdownEl.textContent = `Code expires in ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (timeLeft <= 60) countdownEl.className = 'pad-countdown warning';
        if (timeLeft <= 0) {
            countdownEl.textContent = 'Code has expired';
            countdownEl.className = 'pad-countdown expired';
            clearInterval(countdownTimer);
            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend Code';
        }
        timeLeft--;
    }, 1000);
    startResendCooldown();
}

function startResendCooldown() {
    let cooldown = 60;
    const resendBtn = document.getElementById('resendBtn');
    resendBtn.disabled = true;
    resendCooldown = setInterval(() => {
        resendBtn.textContent = `Resend Code (${cooldown}s)`;
        cooldown--;
        if (cooldown <= 0) { resendBtn.disabled = false; resendBtn.textContent = 'Resend Code'; clearInterval(resendCooldown); }
    }, 1000);
}

function clearCountdown() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (resendCooldown) { clearInterval(resendCooldown); resendCooldown = null; }
}

function updateProgress(step) {
    document.getElementById('progressFill').style.width = `${(step / 3) * 100}%`;
    const names = ['Step 1 of 3: Organization Code', 'Step 2 of 3: Personal Information', 'Step 3 of 3: Registration Complete'];
    document.getElementById('progressText').textContent = names[step - 1] || '';
}

async function validateOrgCodeOnBlur() {
    const orgCode = document.getElementById('orgCode').value.trim();
    const icon = document.getElementById('orgCodeIcon');
    const validateBtn = document.getElementById('validateBtn');
    if (!orgCode) { hideError('orgCodeError'); hideSuccess('orgCodeSuccess'); icon.className = 'pad-input-icon'; return; }
    icon.className = 'pad-input-icon loading';
    icon.innerHTML = '⟳';
    validateBtn.disabled = true;
    try {
        const orgQuery = window.query(window.collection(window.firebaseDB, 'organizations'), window.where('code', '==', orgCode));
        const orgSnapshot = await window.getDocs(orgQuery);
        if (!orgSnapshot.empty) {
            const orgDoc = orgSnapshot.docs[0];
            organizationData = { id: orgDoc.id, ...orgDoc.data() };
            icon.className = 'pad-input-icon success'; icon.innerHTML = '✓';
            showSuccess('orgCodeSuccess', 'Organization found!');
            hideError('orgCodeError');
            validateBtn.disabled = false; validateBtn.innerHTML = 'Continue';
        } else {
            icon.className = 'pad-input-icon error'; icon.innerHTML = '✗';
            showError('orgCodeError', 'Organization not found');
            hideSuccess('orgCodeSuccess');
            validateBtn.disabled = false; validateBtn.innerHTML = 'Validate Code';
        }
    } catch (error) {
        console.error('Error validating organization code:', error);
        icon.className = 'pad-input-icon error'; icon.innerHTML = '✗';
        showError('orgCodeError', 'Error validating code');
        hideSuccess('orgCodeSuccess');
        validateBtn.disabled = false; validateBtn.innerHTML = 'Validate Code';
    }
}

function validateEmailOnBlur() {
    const email = document.getElementById('email').value.trim();
    if (!email) { hideError('emailError'); hideSuccess('emailSuccess'); return; }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showSuccess('emailSuccess', 'Email format looks good'); hideError('emailError'); }
    else { showError('emailError', 'Please enter a valid email address'); hideSuccess('emailSuccess'); }
}

async function completeRegistration() {
    try {
        const voterId = 'voter_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const voterData = {
            name: registrationData.fullName, identity: registrationData.identity,
            phone: registrationData.phone, email: registrationData.email,
            photo: registrationData.photo || null, verified: true,
            organizationId: organizationData.id, organizationName: organizationData.name,
            createdAt: window.serverTimestamp(), lastLogin: null, status: 'active', voterId: voterId
        };
        await window.setDoc(window.doc(window.firebaseDB, 'voters', voterId), voterData);
        await window.addDoc(window.collection(window.firebaseDB, 'auditLogs'), {
            event: 'voter_registered',
            details: `Voter ${registrationData.fullName} registered for ${organizationData.name}`,
            voterId: voterId, organizationId: organizationData.id,
            timestamp: window.serverTimestamp(),
            metadata: { voterName: registrationData.fullName, organizationName: organizationData.name }
        });
        closeEmailVerificationModal();
        currentStep = 3;
        updateStepDisplay();
        document.getElementById('voterId').value = voterId;
        showAlert('Registration completed successfully!', 'success');
    } catch (error) {
        console.error('Registration error:', error);
        let msg = 'Registration failed. Please try again.';
        if (error.code === 'auth/email-already-in-use') msg = 'This email is already registered. Please use a different email or try logging in.';
        else if (error.code === 'auth/weak-password') msg = 'Password is too weak. Please use a stronger password.';
        else if (error.code === 'auth/invalid-email') msg = 'Invalid email address. Please check your email.';
        showAlert(msg, 'error');
    }
}

function goToLogin() { window.location.href = 'login.html'; }

function updateStepDisplay() {
    updateProgress(currentStep);
    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`step${i}`);
        const content = document.getElementById(`step${i}-content`);
        if (i < currentStep) { dot.classList.add('completed'); dot.classList.remove('active'); }
        else if (i === currentStep) { dot.classList.add('active'); dot.classList.remove('completed'); }
        else { dot.classList.remove('active', 'completed'); }
        if (i === currentStep) content.classList.add('active');
        else content.classList.remove('active');
    }
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message; el.style.display = 'block';
        let inputId = elementId === 'otpError' ? 'otpCode' : elementId.replace('Error', '');
        const input = document.getElementById(inputId);
        if (input) input.classList.add('error');
    }
}

function showSuccess(elementId, message) {
    const el = document.getElementById(elementId.replace('Error', 'Success'));
    if (el) { el.textContent = message; el.style.display = 'block'; el.style.color = 'var(--pad-success)'; }
}

function hideError(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = 'none';
    let inputId = elementId === 'otpError' ? 'otpCode' : elementId.replace('Error', '');
    const input = document.getElementById(inputId);
    if (input) input.classList.remove('error');
}

function hideSuccess(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = 'none';
}

function showAlert(message, type) {
    const el = document.getElementById('alertMessage');
    if (el) {
        el.textContent = message;
        el.className = `pad-alert ${type} show`;
        setTimeout(() => { el.classList.remove('show'); }, 5000);
    }
}