# Backend - CipherScan AI

Enterprise fraud investigation and trading intelligence backend built with Node.js, TypeScript, and Express.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Google Gemini API key (for AI narratives)

### Installation

```bash
npm install
```

### Environment Setup

Copy `env.template` to `.env` and configure:

```bash
cp env.template .env
```

Required environment variables:

```env
# Google Gemini API (Required for AI narratives)
GEMINI_API_KEY=your_gemini_api_key_here

# JWT Secrets (Required for authentication)
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Encryption Key (Required for data encryption)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_PATH=./data/cipherai.db

# WhatsApp Integration (Optional)
WHATSAPP_API_KEY=your_whatsapp_api_key
WHATSAPP_API_URL=https://api.whatsapp.com/v1/messages
WHATSAPP_NOTIFICATIONS_ENABLED=false

# Data Source (Optional)
DATA_SOURCE_BASE_URL=https://demo.deriv.com
```

### Database Setup

```bash
# Seed database with default users
npm run seed
```

Default accounts:
- **Admin**: `admin@cipherai.com` / `Admin123!`
- **Senior Analyst**: `senior@cipherai.com` / `Senior123!`
- **Analyst**: `analyst@cipherai.com` / `Analyst123!`

### Run Development Server

```bash
npm run dev
```

Server runs on `http://localhost:3001`

## 📁 Project Structure

```
backend/
├── src/
│   ├── agents/              # Autonomous agents (fraud detection, reporting, etc.)
│   ├── config/              # Database and threshold configuration
│   ├── events/               # Event bus and orchestration
│   ├── middleware/           # Authentication middleware
│   ├── services/            # Business logic services
│   │   ├── auth.ts          # Authentication & user management
│   │   ├── audit.ts         # Audit logging
│   │   ├── baseline.ts      # User behavior baseline analysis
│   │   ├── deviation.ts     # Anomaly detection
│   │   ├── severity.ts      # Severity classification engine
│   │   ├── narrative.ts     # AI narrative generation
│   │   ├── investigation.ts # Investigation CRUD operations
│   │   ├── orchestrator.ts # Autonomous trading intelligence
│   │   ├── tradingInsight.ts # Trading insights service
│   │   ├── tradingPatternDetector.ts # Trading pattern detection
│   │   └── whatsappService.ts # WhatsApp notifications
│   ├── types/               # TypeScript type definitions
│   ├── server.ts            # Express application
│   └── seed.ts             # Database seeder
├── data/                    # SQLite database files
└── package.json
```

## 🔑 Key Features

### Fraud Investigation

- **Baseline Analysis**: Calculates normal user behavior patterns
- **Deviation Detection**: Identifies anomalies with risk multipliers
- **Severity Classification**: Deterministic scoring (0-400 scale)
- **AI Narratives**: Google Gemini-powered investigation summaries
- **Audit Trail**: Complete compliance logging

### Trading Intelligence

- **Autonomous Analysis**: Real-time trading pattern detection
- **Behavioral Pressure Scoring**: Detects emotional/impulsive trading
- **Pattern Recognition**: Identifies repeating bad trading patterns
- **Historical Learning**: Uses trader's own data to warn about mistakes
- **WhatsApp Notifications**: Proactive behavioral nudges

### Security

- **JWT Authentication**: Access & refresh tokens
- **Role-Based Access Control**: Admin, Senior Analyst, Analyst roles
- **AES-256 Encryption**: PII encryption at rest
- **Rate Limiting**: Protection against abuse
- **Audit Logging**: Complete action tracking

## 📡 API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/me` - Get current user

### Fraud Investigation

- `POST /api/alerts` - Create fraud alert
- `POST /api/user-activity` - Store user activity data
- `POST /api/investigate` - Run investigation
- `GET /api/investigations` - Get investigations
- `PATCH /api/investigations/:id/status` - Update investigation status
- `POST /api/investigations/:id/actions` - Log investigation action
- `GET /api/statistics` - Get investigation statistics

### Trading Intelligence

- `POST /api/autonomous/run` - Run autonomous trading analysis
- `GET /api/insights` - Get trading insights
- `GET /api/insights/:id` - Get insight by ID
- `GET /api/trading-alerts` - Get trading pattern alerts for Investigation Queue
- `POST /api/insights/:id/publish` - Publish social content

### Admin (Admin Only)

- `GET /api/admin/users` - Get all users
- `PATCH /api/admin/users/:id/role` - Update user role
- `POST /api/admin/users/:id/deactivate` - Deactivate user
- `POST /api/admin/users/:id/activate` - Activate user
- `GET /api/admin/audit-logs` - Get audit logs
- `GET /api/admin/audit-summary` - Get audit summary

## 🧠 Services Overview

### Investigation Services

- **BaselineAnalyzer**: Calculates user behavior baselines
- **DeviationDetector**: Detects anomalies from baseline
- **SeverityEngine**: Classifies alert severity (LOW/MEDIUM/HIGH/CRITICAL)
- **NarrativeGenerator**: Generates AI-powered investigation narratives

### Trading Services

- **AutonomousOrchestrator**: Main orchestrator for trading analysis
- **TradingInsightService**: CRUD operations for trading insights
- **TradingPatternDetector**: Detects repeating bad trading patterns
- **MarketContextEngine**: Analyzes market conditions
- **SocialContentGenerator**: Generates social media content

### Security Services

- **AuthService**: User authentication and management
- **EncryptionService**: AES-256 encryption for sensitive data
- **AuditService**: Compliance logging

## 🔐 Security Features

- **JWT Tokens**: 15-minute access tokens, 7-day refresh tokens
- **Password Hashing**: Bcrypt with 12 rounds
- **Data Encryption**: AES-256 for PII at rest
- **Rate Limiting**: 100 req/15min general, 5 req/15min auth
- **Account Lockout**: 5 failed attempts = 30-minute lockout
- **CORS**: Configurable origin restrictions
- **Helmet**: Security headers

## 🧪 Testing

```bash
# Run backend API tests
node test-backend.js

# Expected output:
# ✅ Health: operational
# ✅ Login successful
# ✅ Current user: System Administrator
# ✅ Statistics: Retrieved
# ✅ Investigation created (CRITICAL severity)
```

## 📦 Database

SQLite database with WAL mode enabled for better concurrency.

**Tables:**
- `users` - User accounts and roles
- `alerts` - Fraud alerts
- `user_activities` - User behavior baselines
- `investigations` - Investigation records
- `investigation_actions` - Action logs
- `audit_logs` - Complete audit trail
- `trading_insights` - Trading intelligence data
- `social_content` - Generated social media content

## 🚀 Deployment

### Production Checklist

- [ ] Change all default passwords
- [ ] Update JWT secrets (use strong random strings)
- [ ] Update encryption key (32 characters)
- [ ] Set `NODE_ENV=production`
- [ ] Configure HTTPS (use reverse proxy)
- [ ] Set up database backups
- [ ] Configure monitoring/logging
- [ ] Review rate limits
- [ ] Update CORS for production domain

### Deployment Options

- **Railway**: Easy deployment with automatic HTTPS
- **Render**: Free tier available
- **Fly.io**: Global edge deployment
- **AWS EC2**: Full control
- **Docker**: Containerized deployment

## 📚 Documentation

- **EVENT_ORCHESTRATOR.md** - Event-driven architecture
- **WHATSAPP_SETUP.md** - WhatsApp integration guide
- **FRAUD_DETECTION_AGENT.md** - Fraud detection agent docs
- **INVESTIGATION_REPORT_AGENT.md** - Report generation docs

## 🔧 Development

### Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript
npm run seed         # Seed database
npm test             # Run tests (if configured)
```

### TypeScript

TypeScript configuration in `tsconfig.json`. Strict mode enabled for type safety.

## 🤝 Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Follow existing code style

## 📄 License

MIT License
