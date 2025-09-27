// Cloud Functions for Firebase - OTP Generation
// Deploy this to your Firebase project to handle OTP requests

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const bcrypt = require('bcrypt');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// Trigger when a new OTP request is created
exports.generateOtp = functions.firestore
  .document('otpRequests/{requestId}')
  .onCreate(async (snap, context) => {
    try {
      const data = snap.data();
      const email = data.email;
      const orgId = data.orgId;
      const voterName = data.voterName || 'User';
      const type = data.type || 'login_verification';
      
      console.log(`Generating OTP for ${email} (${type})`);

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Hash the OTP for secure storage
      const otpHash = await bcrypt.hash(otp, 10);
      
      // Calculate expiration time (5 minutes from now)
      const expiresAt = Date.now() + (5 * 60 * 1000);

      // Save OTP verification record
      await db.collection('otp_verification').doc(context.params.requestId).set({
        email,
        orgId,
        otpHash,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
        used: false,
        type
      });

      // Create email document for Trigger Email extension
      const emailSubject = type === 'registration_verification' 
        ? 'Your Registration Code - Prince Alex Digital E-Voting 📧'
        : 'Your Login Code - Prince Alex Digital E-Voting 🔐';

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${type === 'registration_verification' ? 'Registration Code' : 'Login Code'} - Prince Alex Digital</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; }
                .header { background: linear-gradient(135deg, #0b6efd 0%, #10b981 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                .code-box { background: #f1f5f9; border: 2px dashed #0b6efd; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
                .code { font-size: 32px; font-weight: bold; color: #0b6efd; letter-spacing: 5px; font-family: 'Courier New', monospace; }
                .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
                .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">Prince Alex Digital</div>
                    <h1>${type === 'registration_verification' ? 'Registration Verification' : 'E-Voting Login Code'}</h1>
                </div>
                <div class="content">
                    <h2>Hello ${voterName}!</h2>
                    <p>${type === 'registration_verification' 
                        ? `Thank you for registering with Prince Alex Digital E-Voting System.`
                        : `You requested a login verification code for your Prince Alex Digital E-Voting account.`}</p>
                    
                    <div class="code-box">
                        <p style="margin: 0 0 10px 0; color: #6b7280;">Your verification code is:</p>
                        <div class="code">${otp}</div>
                    </div>
                    
                    <div class="warning">
                        <strong>⚠️ Important:</strong> This code will expire in 5 minutes for security reasons. If you didn't request this code, please ignore this email.
                    </div>
                    
                    <p>${type === 'registration_verification' 
                        ? 'Enter this code in the registration form to complete your account setup.'
                        : 'Enter this code in the login form to access your voting dashboard.'}</p>
                    
                    <p>If you have any questions or need assistance, please contact your organization administrator.</p>
                    
                    <div class="footer">
                        <p>Thank you for using Prince Alex Digital E-Voting System</p>
                        <p>This is an automated message. Please do not reply to this email.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
      `;

      // Send email via Trigger Email extension
      await db.collection('mail').add({
        to: email,
        message: {
          subject: emailSubject,
          text: `Hello ${voterName},\n\nYour verification code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nThank you for using Prince Alex Digital E-Voting System.`,
          html: emailHtml
        }
      });

      // Update the OTP request status
      await snap.ref.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`OTP sent successfully to ${email}`);
      
    } catch (error) {
      console.error('Error generating OTP:', error);
      
      // Update the OTP request status to failed
      await snap.ref.update({
        status: 'failed',
        error: error.message,
        failedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      throw error;
    }
  });

// Cloud Function to verify OTP
exports.verifyOtp = functions.https.onCall(async (data, context) => {
  try {
    const { email, otp, requestId } = data;
    
    if (!email || !otp) {
      throw new functions.https.HttpsError('invalid-argument', 'Email and OTP are required');
    }

    // Find the OTP verification record
    let otpQuery = db.collection('otp_verification')
      .where('email', '==', email)
      .where('used', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1);

    if (requestId) {
      // If requestId is provided, get specific record
      const otpDoc = await db.collection('otp_verification').doc(requestId).get();
      if (!otpDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'OTP verification record not found');
      }
      
      const otpData = otpDoc.data();
      
      // Check if OTP has expired
      if (Date.now() > otpData.expiresAt) {
        throw new functions.https.HttpsError('deadline-exceeded', 'OTP has expired');
      }
      
      // Verify OTP
      const isValid = await bcrypt.compare(otp, otpData.otpHash);
      if (!isValid) {
        throw new functions.https.HttpsError('permission-denied', 'Invalid OTP');
      }
      
      // Mark as used
      await otpDoc.ref.update({
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { success: true, message: 'OTP verified successfully' };
    } else {
      // Get the most recent OTP for the email
      const otpSnapshot = await otpQuery.get();
      
      if (otpSnapshot.empty) {
        throw new functions.https.HttpsError('not-found', 'No valid OTP found for this email');
      }
      
      const otpDoc = otpSnapshot.docs[0];
      const otpData = otpDoc.data();
      
      // Check if OTP has expired
      if (Date.now() > otpData.expiresAt) {
        throw new functions.https.HttpsError('deadline-exceeded', 'OTP has expired');
      }
      
      // Verify OTP
      const isValid = await bcrypt.compare(otp, otpData.otpHash);
      if (!isValid) {
        throw new functions.https.HttpsError('permission-denied', 'Invalid OTP');
      }
      
      // Mark as used
      await otpDoc.ref.update({
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { success: true, message: 'OTP verified successfully' };
    }
    
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
});

// Clean up expired OTPs (run every hour)
exports.cleanupExpiredOtps = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  try {
    const now = Date.now();
    const expiredOtps = await db.collection('otp_verification')
      .where('expiresAt', '<', now)
      .get();
    
    const batch = db.batch();
    expiredOtps.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`Cleaned up ${expiredOtps.size} expired OTPs`);
    
  } catch (error) {
    console.error('Error cleaning up expired OTPs:', error);
  }
});
