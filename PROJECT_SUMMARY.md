# CipherScan AI - Complete Project Summary

## 📋 Project Overview

**CipherScan AI** is an enterprise-grade fraud investigation platform that combines deterministic fraud scoring with AI-powered investigation narratives. It helps fraud analysts make faster, more accurate decisions by providing transparent, auditable fraud detection with human-readable AI-generated summaries.

### Core Concept

The platform solves the critical problem of fraud detection in financial services by:
- **Deterministic Scoring**: Math-based, transparent fraud scoring (not a black box)
- **AI Narratives**: Google Gemini generates professional, compliance-ready investigation summaries
- **Enterprise Security**: Production-ready with encryption, audit logging, and RBAC
- **Beautiful UX**: Premium noir fintech design for intuitive workflow

### Business Value

- **Problem**: Fraud costs businesses $5.4 trillion annually
- **Solution**: Reduces investigation time from hours to seconds
- **Market**: Global fraud detection market: $63.5B by 2030
- **Target**: Mid-size fintech companies (100-1000 employees)

---

## 🏗️ Architecture

### Technology Stack

**Backend:**
- Node.js + Express + TypeScript
- SQLite (better-sqlite3) with WAL mode
- Google Gemini 2.5 Flash (AI narrative generation)
- JWT authentication (access + refresh tokens)
- AES-256 encryption for PII data
- Bcrypt password hashing

**Frontend:**
- React 18 + TypeScript
- Vite build tool
- Axios for API calls
- Context API for state management
- Custom CSS design system (noir theme)

### System Architecture

```
User → Frontend (React) → API (Express) → JWT Auth → RBAC Middleware 
  → Service Layer → Database (SQLite, Encrypted) → Audit Log
```

### Investigation Pipeline

```
Alert Created → Baseline Analysis → Deviation Detection 
  → Severity Classification → AI Narrative Generation → Investigation Record
```

---

## 📁 Project Structure

### Backend Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts          # SQLite initialization, schema, WAL mode
│   │   └── thresholds.ts        # Severity thresholds and action rules
│   ├── middleware/
│   │   └── auth.ts              # JWT authentication & authorization middleware
│   ├── services/
│   │   ├── auth.ts              # User management, login, registration, password changes
│   │   ├── audit.ts             # Complete audit logging for compliance
│   │   ├── encryption.ts        # AES-256 encryption/decryption for PII
│   │   ├── investigation.ts     # Investigation CRUD operations
│   │   ├── baseline.ts          # User behavior baseline analysis
│   │   ├── deviation.ts          # Anomaly detection (amount, location, device, temporal)
│   │   ├── severity.ts          # Deterministic severity classification engine
│   │   └── narrative.ts         # Google Gemini AI integration for narratives
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   ├── server.ts                # Express app, routes, middleware setup
│   └── seed.ts                  # Database seeding with default users
├── data/
│   └── cipherai.db              # SQLite database (gitignored)
├── .env                         # Environment variables (gitignored)
├── package.json
└── tsconfig.json
```

### Frontend Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── AlertQueue.tsx       # Alert list sidebar with sample alerts
│   │   ├── InvestigationView.tsx # Main investigation display with AI narrative
│   │   ├── Timeline.tsx         # Event timeline visualization
│   │   ├── ActionPanel.tsx      # Action buttons based on severity
│   │   ├── NetworkPanel.tsx     # Network analysis (related accounts)
│   │   ├── SeverityBadge.tsx    # Severity level indicator (LOW/MEDIUM/HIGH/CRITICAL)
│   │   └── CreateAlertModal.tsx # Modal for creating new alerts
│   ├── pages/
│   │   └── Login.tsx            # Authentication page
│   ├── context/
│   │   └── AuthContext.tsx      # Authentication state management
│   ├── services/
│   │   └── api.ts               # Axios client with token interceptors
│   ├── styles/
│   │   └── noir.css             # Noir fintech design system
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   ├── App.tsx                   # Main application component
│   └── main.tsx                  # React entry point
├── public/
│   └── data/
│       └── sample-alerts.json   # Demo alert data
├── package.json
└── vite.config.ts
```

---

## 🔧 Component Responsibilities

### Backend Components

#### **config/database.ts**
- **Purpose**: Database initialization and schema management
- **Responsibilities**:
  - Creates SQLite database with WAL mode for concurrency
  - Defines all table schemas (users, investigations, alerts, audit_logs, etc.)
  - Creates indexes for performance optimization
  - Handles database connection

#### **config/thresholds.ts**
- **Purpose**: Fraud detection configuration
- **Responsibilities**:
  - Defines severity thresholds (LOW: 0-100, MEDIUM: 100-200, HIGH: 200-300, CRITICAL: 300+)
  - Maps severity levels to allowed actions
  - Configures deviation multipliers

#### **middleware/auth.ts**
- **Purpose**: Authentication and authorization
- **Responsibilities**:
  - Validates JWT access tokens
  - Extracts user information from tokens
  - Enforces role-based access control (admin, senior_analyst, analyst)
  - Protects routes requiring authentication

#### **services/auth.ts**
- **Purpose**: User authentication and management
- **Responsibilities**:
  - User registration (admin only)
  - Login with email/password
  - JWT token generation (access + refresh)
  - Token refresh mechanism
  - Password change functionality
  - Account lockout after failed attempts
  - User role management
  - User activation/deactivation

#### **services/encryption.ts**
- **Purpose**: Data protection
- **Responsibilities**:
  - AES-256 encryption for sensitive data (PII)
  - Decryption for data retrieval
  - Data masking for display (emails, user IDs)
  - One-way hashing for identifiers

#### **services/audit.ts**
- **Purpose**: Compliance and audit logging
- **Responsibilities**:
  - Logs every action in the system
  - Tracks user activities with timestamps
  - Records IP addresses and user agents
  - Provides audit log filtering and search
  - Generates audit summaries for compliance

#### **services/baseline.ts**
- **Purpose**: User behavior baseline calculation
- **Responsibilities**:
  - Analyzes 90 days of user history
  - Calculates average transaction amounts
  - Identifies typical transaction hours
  - Determines common login locations
  - Measures device consistency
  - Tracks account maturity

#### **services/deviation.ts**
- **Purpose**: Anomaly detection
- **Responsibilities**:
  - Compares current alert against baseline
  - Detects amount deviations (5x-10x multipliers)
  - Identifies location deviations (new cities/countries)
  - Flags device deviations (new devices)
  - Detects temporal deviations (unusual times)
  - Calculates deviation multipliers

#### **services/severity.ts**
- **Purpose**: Fraud severity classification
- **Responsibilities**:
  - Calculates base score from alert type
  - Applies deviation multipliers
  - Computes final severity score (0-400 scale)
  - Classifies into LOW/MEDIUM/HIGH/CRITICAL
  - Provides justification for classification

#### **services/narrative.ts**
- **Purpose**: AI-powered investigation narratives
- **Responsibilities**:
  - Integrates with Google Gemini 2.5 Flash API
  - Generates professional investigation summaries
  - Creates compliance-ready narratives (180-220 words)
  - Explains severity classification in human-readable format
  - Handles API errors with fallback narratives
  - Supports multiple model fallbacks

#### **services/investigation.ts**
- **Purpose**: Investigation data management
- **Responsibilities**:
  - Creates and stores alerts (encrypted)
  - Stores user activity data (encrypted)
  - Creates investigation records
  - Retrieves investigations with filtering
  - Updates investigation status
  - Logs investigation actions
  - Provides statistics

#### **server.ts**
- **Purpose**: Express application and API routes
- **Responsibilities**:
  - Sets up Express server with security middleware
  - Configures CORS, Helmet, rate limiting
  - Defines all API endpoints
  - Handles request/response flow
  - Orchestrates investigation pipeline
  - Error handling and logging

### Frontend Components

#### **App.tsx**
- **Purpose**: Main application container
- **Responsibilities**:
  - Manages application state (selected alert, investigation)
  - Handles authentication state
  - Renders sidebar navigation
  - Displays alert queue and investigation view
  - Coordinates between components
  - Manages modal visibility

#### **context/AuthContext.tsx**
- **Purpose**: Global authentication state
- **Responsibilities**:
  - Manages user session
  - Handles login/logout
  - Stores JWT tokens in localStorage
  - Provides authentication state to components
  - Handles token refresh

#### **pages/Login.tsx**
- **Purpose**: User authentication interface
- **Responsibilities**:
  - Displays login form
  - Handles email/password input
  - Validates credentials
  - Calls authentication API
  - Shows error messages
  - Redirects on successful login

#### **components/AlertQueue.tsx**
- **Purpose**: Alert list display
- **Responsibilities**:
  - Fetches and displays alerts
  - Shows alert metadata (ID, type, timestamp, rules)
  - Handles alert selection
  - Highlights selected alert
  - Loads sample data for demo

#### **components/InvestigationView.tsx**
- **Purpose**: Main investigation display
- **Responsibilities**:
  - Displays investigation results
  - Shows AI-generated narrative
  - Renders severity badge
  - Displays risk score and deviation multiplier
  - Shows pattern recognition chips
  - Integrates Timeline, NetworkPanel, ActionPanel
  - Handles loading states

#### **components/Timeline.tsx**
- **Purpose**: Event timeline visualization
- **Responsibilities**:
  - Displays chronological events
  - Shows alert triggers
  - Displays deviation detections
  - Visual timeline with timestamps
  - Color-coded by event type

#### **components/ActionPanel.tsx**
- **Purpose**: Action execution interface
- **Responsibilities**:
  - Displays allowed actions based on severity
  - Shows checkboxes for action selection
  - Handles action execution
  - Sends actions to backend API
  - Disables panel when no actions available

#### **components/NetworkPanel.tsx**
- **Purpose**: Network analysis display
- **Responsibilities**:
  - Shows related accounts
  - Displays shared signals (devices, IPs)
  - Shows risk scores
  - Visualizes fraud ring connections

#### **components/SeverityBadge.tsx**
- **Purpose**: Severity level indicator
- **Responsibilities**:
  - Displays severity level (LOW/MEDIUM/HIGH/CRITICAL)
  - Color-coded badges
  - Visual severity indication
  - Pulse animation for CRITICAL

#### **components/CreateAlertModal.tsx**
- **Purpose**: Alert creation interface
- **Responsibilities**:
  - Modal form for creating alerts
  - Input fields (user ID, amount, location, etc.)
  - Alert type selection
  - Form validation
  - Submits alert to backend
  - Closes modal on success

#### **services/api.ts**
- **Purpose**: API client configuration
- **Responsibilities**:
  - Axios instance setup
  - Base URL configuration
  - Request interceptors (adds JWT token)
  - Response interceptors (handles token refresh)
  - Error handling
  - Automatic token refresh on 401

#### **styles/noir.css**
- **Purpose**: Design system
- **Responsibilities**:
  - Noir fintech theme
  - Cyan-to-purple brand gradient
  - Glassmorphism effects
  - Component styling
  - Responsive design
  - Animations and transitions

---

## 🔐 Security Features

### Authentication & Authorization
- JWT access tokens (15-minute expiry)
- Refresh tokens (7-day expiry)
- Role-based access control (Admin, Senior Analyst, Analyst)
- Account lockout after 5 failed attempts
- Session management with automatic expiry

### Data Protection
- AES-256 encryption for PII at rest
- Bcrypt password hashing (12 rounds)
- Encrypted transaction data, locations, device fingerprints
- Data masking for display

### Network Security
- Helmet.js security headers
- CORS configuration
- Rate limiting (100 req/15min general, 5 req/15min auth)
- Input validation and sanitization

### Compliance
- Complete audit trail (every action logged)
- Immutable logging with timestamps
- User action tracking
- Admin activity monitoring
- Exportable audit reports

---

## 🧠 Fraud Detection Engine

### 1. Baseline Analysis
- Calculates normal user behavior from 90 days of history
- Average transaction amount
- Typical login locations
- Device usage patterns
- Transaction velocity
- Account maturity

### 2. Deviation Detection
- Identifies anomalies with multipliers:
  - **Amount Deviation**: 5x-10x multiplier for unusual amounts
  - **Location Deviation**: 3x-7x for new/risky locations
  - **Device Deviation**: 2x-5x for new devices
  - **Temporal Deviation**: 2x-4x for unusual timing

### 3. Severity Classification
- Deterministic scoring (0-400 scale):
  - **LOW** (0-100): Routine monitoring
  - **MEDIUM** (100-200): Verification required
  - **HIGH** (200-300): Immediate review
  - **CRITICAL** (300+): Potential active fraud

### 4. AI Narrative Generation
- Google Gemini 2.5 Flash generates:
  - Professional investigation summaries
  - Contextual explanations
  - Actionable recommendations
  - Compliance-ready language

---

## 📊 Database Schema

### Tables

1. **users**: User accounts with roles and authentication
2. **investigations**: Investigation records with severity and status
3. **alerts**: Encrypted alert data
4. **user_activities**: Historical behavior data (encrypted)
5. **investigation_actions**: Actions taken on investigations
6. **audit_logs**: Complete audit trail for compliance
7. **sessions**: Refresh token management
8. **system_settings**: System configuration

### Key Features
- SQLite with WAL mode for concurrency
- Encrypted sensitive fields (AES-256)
- Indexed queries for performance
- Foreign key constraints
- Check constraints for data validation

---

## 🔄 User Workflow

### Analyst Workflow
1. **Login** → Dashboard with alert queue
2. **Select Alert** → Investigation starts automatically
3. **Review Investigation**:
   - Severity classification
   - AI narrative
   - Timeline of events
   - Pattern recognition
   - Network analysis
4. **Take Action** → Select from allowed actions, execute
5. **Update Status** → Mark as resolved/escalated/closed

### Admin Workflow
- User management (create, deactivate, change roles)
- View all investigations
- Access audit logs
- System configuration

---

## 🎨 Design System

### Brand Identity
- **Primary Gradient**: Cyan (#00f2fe) to Purple (#7000ff)
- **Background**: Deep blacks (#050507, #0d0d10)
- **Typography**: Outfit (headings), JetBrains Mono (data)
- **Effects**: Glassmorphism, smooth transitions, micro-animations

### Severity Colors
- **Low**: Cyan (#00f2fe)
- **Medium**: Yellow (#e9c46a)
- **High**: Orange (#ff9f43)
- **Critical**: Red (#ff3b3b) with pulse animation

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/me` - Get current user

### Investigations
- `POST /api/alerts` - Create alert
- `POST /api/user-activity` - Store user activity
- `POST /api/investigate` - Run investigation
- `GET /api/investigations` - Get investigations
- `PATCH /api/investigations/:id/status` - Update status
- `POST /api/investigations/:id/actions` - Log action
- `GET /api/statistics` - Get statistics

### Admin
- `GET /api/admin/users` - Get all users
- `PATCH /api/admin/users/:id/role` - Update role
- `POST /api/admin/users/:id/deactivate` - Deactivate user
- `POST /api/admin/users/:id/activate` - Activate user
- `GET /api/admin/audit-logs` - Get audit logs
- `GET /api/admin/audit-summary` - Get summary

---

## 🔑 Default Accounts

- **Admin**: `admin@cipherai.com` / `Admin123!`
- **Senior Analyst**: `senior@cipherai.com` / `Senior123!`
- **Analyst**: `analyst@cipherai.com` / `Analyst123!`

---

## 🚀 Environment Variables

### Required
- `PORT` - Backend server port (default: 3001)
- `NODE_ENV` - Environment mode (development/production)
- `FRONTEND_URL` - CORS origin (default: http://localhost:3000)
- `JWT_SECRET` - JWT access token secret
- `JWT_REFRESH_SECRET` - JWT refresh token secret
- `ENCRYPTION_KEY` - AES-256 encryption key (32 characters)
- `GEMINI_API_KEY` - Google Gemini API key
- `GEMINI_MODEL` - Gemini model name (default: gemini-2.5-flash)

---

## 📝 Key Features

### Fraud Detection
- Baseline behavior analysis
- Multi-dimensional deviation detection
- Deterministic severity scoring
- AI-powered investigation narratives

### Security
- Enterprise-grade encryption
- JWT authentication with refresh tokens
- Role-based access control
- Complete audit trail

### Scalability
- SQLite with WAL mode (no external dependencies)
- Indexed queries for performance
- Rate limiting to prevent abuse
- Efficient state management

---

## 🎯 Project Status

### Backend: 100% Complete ✅
- All API endpoints functional
- Security features enabled
- Database operational
- AI integration working
- Audit logging active

### Frontend: 100% Complete ✅
- All components built
- Authentication working
- Investigation view functional
- Alert queue displaying
- Design system implemented

---

## 💡 Unique Selling Points

1. **Deterministic + AI**: Transparent scoring + human-readable narratives
2. **Production-Ready**: Enterprise security, audit logging, RBAC
3. **Zero Setup**: SQLite database, runs anywhere
4. **Beautiful UX**: Premium noir fintech design
5. **Real Business Value**: Reduces investigation time from hours to seconds

---

This document provides a complete overview of the CipherScan AI project, its architecture, components, and functionality. All components work together to create a comprehensive fraud investigation platform that combines deterministic fraud detection with AI-powered insights.
