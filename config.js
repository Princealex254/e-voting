// Prince Alex Digital E-Voting - Configuration
// Shared configuration loaded by all pages

const PAD_CONFIG = {
    firebase: {
        apiKey: "AIzaSyDGErPBeQ1Fdx9EHPXOHepoEoOx7P2f57o",
        authDomain: "princealextravel.firebaseapp.com",
        projectId: "princealextravel",
        storageBucket: "princealextravel.firebasestorage.app",
        messagingSenderId: "947577729462",
        appId: "1:947577729462:web:dd4b4c7cb4a984c5e3d117"
    },
    emailWorker: "https://payroll.princealexdigital.workers.dev/",
    otpExpiryMs: 5 * 60 * 1000, // 5 minutes
    maxOtpAttempts: 3,
    resendCooldownMs: 60000, // 60 seconds
    maxOtpPerWindow: 3,
    otpWindowMs: 15 * 60 * 1000 // 15 minutes
};