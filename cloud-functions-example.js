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
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f7fc; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fc; padding: 20px 0;">
                <tr>
                    <td align="center">
                        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #0b6efd 0%, #10b981 100%); padding: 35px 30px; text-align: center; border-radius: 16px 16px 0 0;">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td align="center" style="padding-bottom: 12px;">
                                                <span style="display: inline-block; width: 56px; height: 56px; background: rgba(255,255,255,0.2); border-radius: 12px; line-height: 56px; font-size: 28px; font-weight: bold; color: #ffffff;">PAD</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td align="center">
                                                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Prince Alex Digital</h1>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td align="center">
                                                <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 15px;">E-Voting System</p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <!-- Body -->
                            <tr>
                                <td style="background: #ffffff; padding: 40px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td>
                                                <h2 style="margin: 0 0 6px; color: #0f172a; font-size: 22px; font-weight: 700;">Hello ${voterName}!</h2>
                                                <p style="margin: 0 0 20px; color: #6b7280; font-size: 15px; line-height: 1.6;">${type === 'registration_verification' 
                                                    ? 'Thank you for registering with Prince Alex Digital E-Voting System.'
                                                    : 'You requested a login verification code for your Prince Alex Digital E-Voting account.'}</p>
                                            </td>
                                        </tr>
                                        <!-- OTP Code Box -->
                                        <tr>
                                            <td style="background: #f0f5ff; border: 2px dashed #0b6efd; border-radius: 12px; padding: 28px 20px; text-align: center;">
                                                <p style="margin: 0 0 12px; color: #6b7280; font-size: 14px; font-weight: 500;">Your verification code is:</p>
                                                <div style="font-size: 36px; font-weight: 800; color: #0b6efd; letter-spacing: 8px; font-family: 'Courier New', 'Consolas', monospace; background: #ffffff; display: inline-block; padding: 12px 28px; border-radius: 8px; border: 1px solid #dbeafe;">${otp}</div>
                                            </td>
                                        </tr>
                                        <!-- Warning -->
                                        <tr>
                                            <td style="background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px 20px; margin-top: 20px;">
                                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                                    <tr>
                                                        <td width="24" valign="top" style="font-size: 18px; line-height: 1.4;">⚠️</td>
                                                        <td>
                                                            <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;"><strong>Important:</strong> This code will expire in <strong>5 minutes</strong> for security reasons. If you didn't request this code, please ignore this email.</p>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <!-- Instructions -->
                                        <tr>
                                            <td style="padding-top: 20px;">
                                                <p style="margin: 0 0 6px; color: #374151; font-size: 14px; line-height: 1.6;">${type === 'registration_verification' 
                                                    ? 'Enter this code in the registration form to complete your account setup.'
                                                    : 'Enter this code in the login form to access your voting dashboard.'}</p>
                                            </td>
                                        </tr>
                                        <!-- Divider -->
                                        <tr>
                                            <td style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
                                                <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">If you have any questions or need assistance, please contact your organization administrator.</p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="background: #0f172a; padding: 24px 30px; text-align: center; border-radius: 0 0 16px 16px; border-left: 1px solid #1e293b; border-right: 1px solid #1e293b;">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td align="center" style="padding-bottom: 12px;">
                                                <a href="https://www.princealex.pro" style="color: #0b6efd; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 10px;">Visit Website</a>
                                                <span style="color: #374151; font-size: 13px;">|</span>
                                                <a href="mailto:senerwaalex@gmail.com" style="color: #0b6efd; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 10px;">Contact Support</a>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td align="center">
                                                <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">&copy; 2025 Prince Alex Digital. All rights reserved.</p>
                                                <p style="margin: 4px 0 0; color: #64748b; font-size: 11px; line-height: 1.5;">This is an automated message. Please do not reply directly to this email.</p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
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
