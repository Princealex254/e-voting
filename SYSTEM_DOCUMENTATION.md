# Prince Alex Digital E-voting System - Technical Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Database Schema](#database-schema)
5. [Authentication Flow](#authentication-flow)
6. [User Workflows](#user-workflows)
7. [API Integration](#api-integration)
8. [Security Features](#security-features)
9. [Deployment Guide](#deployment-guide)
10. [Troubleshooting](#troubleshooting)

## System Overview

The Prince Alex Digital E-voting system is a comprehensive, web-based voting platform built with vanilla HTML, CSS, and JavaScript, integrated with Firebase for backend services. The system provides secure, transparent, and accessible voting for organizations, unions, and communities.

### Key Features
- **Multi-Organization Support**: Each organization has isolated voting environments
- **Real-time Updates**: Live voting results and status updates
- **Mobile-First Design**: Responsive interface for all devices
- **Audit Trail**: Complete logging of all system activities
- **Admin Dashboard**: Comprehensive management interface
- **Voter Management**: Registration, verification, and authentication
- **Poll Management**: Create, manage, and monitor voting polls

## Architecture

### Frontend Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Client-Side Application                  │
├─────────────────────────────────────────────────────────────┤
│  HTML Files (Self-contained)                               │
│  ├── index.html (Landing Page)                             │
│  ├── voter_register.html (Voter Registration)              │
│  ├── login.html (Authentication)                           │
│  ├── dashboard_voter.html (Voter Interface)                │
│  ├── dashboard_admin.html (Admin Interface)                │
│  ├── poll_view.html (Poll Voting)                          │
│  ├── results.html (Results Display)                        │
│  ├── audit_log.html (Audit Trail)                          │
│  └── README.html (Documentation)                           │
├─────────────────────────────────────────────────────────────┤
│  Firebase SDK Integration                                  │
│  ├── Authentication (Firebase Auth)                        │
│  ├── Database (Cloud Firestore)                            │
│  └── Email Service (Trigger Email Extension)               │
└─────────────────────────────────────────────────────────────┘
```

### Backend Services
```
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Services                        │
├─────────────────────────────────────────────────────────────┤
│  Firebase Authentication                                   │
│  ├── Email/Password Authentication                         │
│  ├── User Session Management                               │
│  └── Security Rules                                        │
├─────────────────────────────────────────────────────────────┤
│  Cloud Firestore Database                                  │
│  ├── Collections: voters, polls, votes, organizations      │
│  ├── Real-time Listeners                                   │
│  ├── Security Rules                                        │
│  └── Indexes for Queries                                   │
├─────────────────────────────────────────────────────────────┤
│  Firebase Extensions                                        │
│  ├── Trigger Email (Brevo Integration)                     │
│  └── Email Templates                                       │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

### Core Application Files

#### 1. `index.html` - Landing Page
**Purpose**: Main entry point and marketing page
**Key Features**:
- Hero section with call-to-action buttons
- Features overview
- Contact form integration
- Responsive design

**Key Functions**:
- `handleContactForm()`: Processes contact form submissions
- `checkUserTypeAndRedirect()`: Redirects authenticated users
- Firebase integration for contact message storage

#### 2. `voter_register.html` - Voter Registration
**Purpose**: Multi-step voter registration process
**Key Features**:
- Organization code validation
- Personal information collection
- Email verification with OTP
- Progress indicator

**Registration Flow**:
1. **Step 1**: Organization code validation
2. **Step 2**: Personal information collection
3. **Step 3**: Email verification (OTP)
4. **Step 4**: Account creation confirmation

**Key Functions**:
- `validateOrgCode()`: Validates organization codes
- `sendOTP()`: Generates and sends verification codes
- `verifyOTP()`: Verifies OTP codes
- `completeRegistration()`: Finalizes voter account creation

#### 3. `login.html` - Authentication
**Purpose**: Voter and admin login interface
**Key Features**:
- Dual login system (voter/admin)
- OTP-based voter authentication
- Email/password admin authentication
- Session management

**Key Functions**:
- `handleVoterLogin()`: Processes voter login requests
- `handleAdminLogin()`: Processes admin login requests
- `sendOTP()`: Sends login verification codes
- `verifyOTP()`: Verifies login codes

#### 4. `dashboard_voter.html` - Voter Dashboard
**Purpose**: Voter interface for viewing and participating in polls
**Key Features**:
- Active polls display
- Voting interface
- Session management with timeout
- Real-time updates

**Key Functions**:
- `checkAuth()`: Validates voter session
- `loadData()`: Loads polls and votes data
- `startRealTimeUpdates()`: Sets up real-time listeners
- `setupSessionManagement()`: Manages session timeouts

#### 5. `dashboard_admin.html` - Admin Dashboard
**Purpose**: Comprehensive admin management interface
**Key Features**:
- Poll management (create, edit, activate, close, reopen)
- Voter management (add, edit, delete)
- Organization management
- Results monitoring
- Audit log viewing
- Contact message management
- Full-screen voting display

**Key Sections**:
- **Overview**: Statistics and recent activity
- **Manage Polls**: Poll CRUD operations with organization filtering
- **Manage Voters**: Voter CRUD operations with organization filtering
- **Manage Organizations**: Organization management
- **View Results**: Poll results with organization filtering
- **Audit Logs**: System activity logs
- **Contact Messages**: Contact form submissions
- **Full Screen Display**: Live voting visualization

#### 6. `poll_view.html` - Poll Voting Interface
**Purpose**: Individual poll voting interface
**Key Features**:
- Poll details display
- Voting form
- Vote confirmation
- Email confirmation
- Results prevention after voting

**Key Functions**:
- `loadPoll()`: Loads poll data
- `submitVote()`: Processes vote submission
- `sendVoteConfirmationEmail()`: Sends vote confirmation
- `getVoteReceipt()`: Generates vote receipt hash

#### 7. `results.html` - Results Display
**Purpose**: Public results viewing
**Key Features**:
- Live results display
- Chart visualization
- Mobile responsive design

#### 8. `audit_log.html` - Audit Trail
**Purpose**: System activity logging
**Key Features**:
- Chronological activity log
- Export functionality
- Filtering capabilities

### Utility Files

#### `setup_firebase.html` - Database Initialization
**Purpose**: Initial Firebase setup and admin user creation
**Key Features**:
- Admin user creation
- Sample organization setup
- Database initialization

#### `README.html` - Public Documentation
**Purpose**: User-facing documentation and marketing
**Key Features**:
- System overview
- Feature descriptions
- Contact information
- Demo information

## Database Schema

### Firestore Collections

#### 1. `voters` Collection
```javascript
{
  id: "voter_id",
  name: "John Doe",
  email: "john@example.com",
  identity: "12345678",
  phone: "+254712345678",
  organizationId: "org_id",
  organizationName: "Organization Name",
  photo: "base64_image_data",
  status: "active", // active, inactive
  verified: true,
  createdAt: Timestamp,
  createdBy: "admin_id",
  lastLogin: Timestamp
}
```

#### 2. `polls` Collection
```javascript
{
  id: "poll_id",
  title: "Election Title",
  description: "Poll description",
  type: "single", // single, multi, ranked
  options: ["Option 1", "Option 2", "Option 3"],
  maxSelections: 1,
  startAt: Timestamp,
  endAt: Timestamp,
  eligibility: { type: "open" },
  anonymous: true,
  organizationId: "org_id",
  createdBy: "admin_id",
  createdAt: Timestamp,
  status: "draft", // draft, active, closed
  updatedAt: Timestamp,
  updatedBy: "admin_id"
}
```

#### 3. `votes` Collection
```javascript
{
  id: "vote_id",
  pollId: "poll_id",
  voterId: "voter_id",
  choices: ["Option 1"], // Array of selected options
  receiptHash: "sha256_hash",
  timestamp: Timestamp,
  anonymous: true
}
```

#### 4. `organizations` Collection
```javascript
{
  id: "org_id",
  name: "Organization Name",
  description: "Organization description",
  code: "ORG123", // Unique organization code
  status: "active",
  createdAt: Timestamp,
  createdBy: "admin_id"
}
```

#### 5. `auditLogs` Collection
```javascript
{
  id: "log_id",
  action: "voter_created", // Action performed
  details: "Voter created: John Doe",
  timestamp: Timestamp,
  userId: "user_id",
  userEmail: "user@example.com"
}
```

#### 6. `otp_verification` Collection
```javascript
{
  id: "email_address", // Document ID is email
  otp: "hashed_otp",
  expiresAt: Timestamp,
  used: false,
  createdAt: Timestamp
}
```

#### 7. `mail` Collection
```javascript
{
  to: "recipient@example.com",
  subject: "Email Subject",
  text: "Plain text content",
  html: "<html>HTML content</html>",
  timestamp: Timestamp
}
```

#### 8. `contactMessages` Collection
```javascript
{
  id: "message_id",
  name: "Sender Name",
  email: "sender@example.com",
  phone: "+254712345678",
  organization: "Organization Name",
  subject: "Message Subject",
  message: "Message content",
  read: false,
  createdAt: Timestamp
}
```

## Authentication Flow

### Voter Authentication
1. **Registration Process**:
   - Organization code validation
   - Personal information collection
   - Email verification via OTP
   - Account creation in Firestore

2. **Login Process**:
   - Email/Identity number input
   - OTP generation and email sending
   - OTP verification
   - Session creation in localStorage

3. **Session Management**:
   - 24-hour session expiry
   - Activity-based timeout (2 hours)
   - Automatic logout on inactivity

### Admin Authentication
1. **Login Process**:
   - Email/password authentication via Firebase Auth
   - Admin record creation in Firestore (if first login)
   - Session management via Firebase Auth

2. **Access Control**:
   - Any authenticated Firebase user can access admin dashboard
   - No separate admin collection validation

## User Workflows

### Voter Workflow
1. **Registration**:
   - Visit landing page
   - Click "Get Started"
   - Enter organization code
   - Fill personal information
   - Verify email with OTP
   - Account created successfully

2. **Voting**:
   - Login with email/identity
   - Verify with OTP
   - View active polls
   - Select poll to vote
   - Cast vote
   - Receive confirmation email

3. **Session Management**:
   - Automatic session timeout
   - Warning before logout
   - Re-authentication required

### Admin Workflow
1. **Dashboard Access**:
   - Login with email/password
   - Access admin dashboard
   - View system overview

2. **Poll Management**:
   - Create new polls
   - Set poll parameters
   - Activate/close polls
   - Monitor results

3. **Voter Management**:
   - Add new voters
   - Edit voter information
   - Manage voter status
   - Filter by organization

4. **Organization Management**:
   - Create organizations
   - Generate organization codes
   - Manage organization details

## API Integration

### Firebase Authentication
```javascript
// Sign in with email and password
await signInWithEmailAndPassword(auth, email, password);

// Sign out
await signOut(auth);

// Auth state listener
onAuthStateChanged(auth, (user) => {
  // Handle auth state changes
});
```

### Firestore Operations
```javascript
// Add document
await addDoc(collection(db, 'collectionName'), data);

// Update document
await updateDoc(doc(db, 'collectionName', docId), data);

// Get documents
const snapshot = await getDocs(collection(db, 'collectionName'));

// Real-time listener
onSnapshot(collection(db, 'collectionName'), (snapshot) => {
  // Handle real-time updates
});
```

### Email Integration
```javascript
// Send OTP email
await addDoc(collection(db, 'mail'), {
  to: email,
  subject: 'Your Verification Code',
  html: emailTemplate
});
```

## Security Features

### Data Security
1. **Firestore Security Rules**:
   - Read/write permissions based on authentication
   - Organization-based data isolation
   - Input validation and sanitization

2. **Client-Side Security**:
   - Input validation
   - XSS prevention
   - CSRF protection considerations

3. **Vote Security**:
   - SHA256 vote receipt hashing
   - Anonymous voting support
   - Duplicate vote prevention
   - Tamper-proof vote storage

### Authentication Security
1. **OTP System**:
   - 6-digit numeric codes
   - 5-minute expiration
   - Single-use codes
   - Rate limiting considerations

2. **Session Security**:
   - Secure session management
   - Automatic timeout
   - Activity monitoring

### Audit Trail
1. **Comprehensive Logging**:
   - All user actions logged
   - Timestamp tracking
   - User identification
   - Action details

2. **Export Capabilities**:
   - CSV export for audit logs
   - Results export
   - Data backup options

## Deployment Guide

### Prerequisites
1. **Firebase Project Setup**:
   - Create Firebase project
   - Enable Authentication
   - Set up Firestore database
   - Install Trigger Email extension

2. **Firebase Configuration**:
   - Update Firebase config in all HTML files
   - Set up security rules
   - Configure email templates

### Deployment Steps
1. **File Upload**:
   - Upload all HTML files to web server
   - Ensure proper file permissions
   - Configure web server for SPA routing

2. **Firebase Setup**:
   - Deploy Firestore security rules
   - Configure authentication providers
   - Set up email templates

3. **Testing**:
   - Test all user workflows
   - Verify email functionality
   - Check mobile responsiveness
   - Validate security rules

### Environment Configuration
```javascript
// Firebase configuration
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## Troubleshooting

### Common Issues

#### 1. Voter Registration Issues
**Problem**: OTP not received
**Solutions**:
- Check email spam folder
- Verify Firebase email configuration
- Check Trigger Email extension status
- Verify email address format

#### 2. Login Issues
**Problem**: Cannot login after registration
**Solutions**:
- Check voter status in admin dashboard
- Verify email/identity number format
- Check OTP expiration
- Clear browser cache

#### 3. Poll Display Issues
**Problem**: Polls not showing for voters
**Solutions**:
- Check poll status (must be 'active')
- Verify organization assignment
- Check poll date range
- Verify voter organization membership

#### 4. Admin Dashboard Issues
**Problem**: Cannot access admin features
**Solutions**:
- Verify Firebase authentication
- Check admin user creation
- Verify Firestore permissions
- Check browser console for errors

### Debugging Tools
1. **Browser Console**: Check for JavaScript errors
2. **Firebase Console**: Monitor database and authentication
3. **Network Tab**: Check API calls and responses
4. **Firestore Rules**: Verify security rule configuration

### Performance Optimization
1. **Database Indexes**: Create composite indexes for queries
2. **Caching**: Implement client-side caching for frequently accessed data
3. **Pagination**: Add pagination for large datasets
4. **Image Optimization**: Compress voter photos

## Maintenance

### Regular Tasks
1. **Database Cleanup**: Remove expired OTPs and old audit logs
2. **Security Updates**: Keep Firebase SDK updated
3. **Backup**: Regular database backups
4. **Monitoring**: Monitor system performance and errors

### Updates and Enhancements
1. **Feature Additions**: Add new voting types or features
2. **UI Improvements**: Enhance user interface based on feedback
3. **Security Enhancements**: Implement additional security measures
4. **Performance Optimization**: Improve system performance

## Support and Contact

For technical support or questions about the Prince Alex Digital E-voting system:

- **Phone**: +254 717 384 875
- **Email**: senerwaalex@gmail.com
- **Website**: https://www.princealex.pro
- **Response Time**: Within 24 hours

---

*This documentation covers the complete technical implementation of the Prince Alex Digital E-voting system. For additional support or customization requests, please contact the development team.*

