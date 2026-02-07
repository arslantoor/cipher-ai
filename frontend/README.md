# Frontend - CipherScan AI

Premium noir fintech interface for fraud investigation and trading intelligence, built with React, TypeScript, and Vite.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Backend server running (see `../backend/README.md`)

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file (optional, defaults work for local development):

```env
VITE_API_URL=http://localhost:3001
```

### Run Development Server

```bash
npm run dev
```

Frontend runs on `http://localhost:3000`

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── AlertQueue.tsx   # Investigation queue sidebar
│   │   ├── InvestigationView.tsx # Main investigation display
│   │   ├── InsightView.tsx   # Trading insight display
│   │   ├── AutonomousInsights.tsx # Trading insights list
│   │   ├── CreateAlertModal.tsx # Alert creation form
│   │   ├── Timeline.tsx     # Event timeline
│   │   ├── ActionPanel.tsx  # Action buttons
│   │   ├── NetworkPanel.tsx # Network analysis
│   │   ├── SeverityBadge.tsx # Severity indicator
│   │   ├── PressureGauge.tsx # Behavioral pressure gauge
│   │   ├── ContentStudio.tsx # Social content generator
│   │   └── WhatsAppSettings.tsx # WhatsApp configuration
│   ├── pages/
│   │   └── Login.tsx        # Authentication page
│   ├── context/
│   │   └── AuthContext.tsx # Authentication state management
│   ├── services/
│   │   └── api.ts          # API client configuration
│   ├── styles/
│   │   └── noir.css       # Design system styles
│   ├── types/
│   │   └── index.ts       # TypeScript type definitions
│   ├── App.tsx            # Main application component
│   └── main.tsx           # Application entry point
├── public/                # Static assets
└── package.json
```

## 🎨 Features

### Fraud Investigation Interface

- **Alert Queue**: Side panel showing all alerts
- **Investigation View**: Detailed investigation analysis
  - AI-generated narrative
  - Pattern recognition chips
  - Risk score and deviation multiplier
  - Investigation timeline
  - Network analysis panel
  - Action execution panel
- **Create Alert Modal**: Manual alert creation form
  - Supports fraud alerts
  - Supports trading pattern alerts

### Trading Intelligence Interface

- **Autonomous Insights**: List of trading insights
- **Insight View**: Detailed trading analysis
  - Market context explanation
  - Behavioral pressure score
  - Pattern detection
  - Historical pattern matching
  - Social content generation
- **Investigation Queue Integration**: Trading alerts appear in queue
  - Bad trading pattern detection
  - Personalized warnings based on trader history

### Design System

- **Noir Theme**: Dark fintech aesthetic
- **Brand Gradient**: Cyan (#00f2fe) to Purple (#7000ff)
- **Glassmorphism**: Modern UI effects
- **Responsive**: Works on all screen sizes
- **Animations**: Smooth transitions and micro-interactions

## 🎯 Key Components

### AlertQueue

Displays alerts in a scrollable sidebar. Fetches from:
- `/api/trading-alerts` for trading pattern alerts
- Falls back to sample data if API unavailable

**Features:**
- Alert type badges
- Timestamp display
- Triggered rules count
- Click to investigate

### InvestigationView

Main investigation display showing:
- AI Intelligence Narrative
- Pattern Recognition (chips)
- Execution Protocol (action buttons)
- Investigation Timeline
- Network Panel

### InsightView

Trading insight display showing:
- Market Context
- Behavioral Pressure Score
- Pattern Detection
- Historical Patterns
- Social Content Generation

### CreateAlertModal

Modal form for creating alerts:
- **Fraud Alerts**: User ID, amount, location, rules
- **Trading Alerts**: User ID, instrument, pressure level, pressure score, rules

## 🔐 Authentication

- JWT token-based authentication
- Automatic token refresh
- Role-based UI (Admin, Senior Analyst, Analyst)
- Session management
- Protected routes

## 🎨 Design System

### Colors

- **Background**: Deep blacks (#050507, #0d0d10)
- **Primary Gradient**: Cyan to Purple
- **Text**: White (#ffffff) with muted variants
- **Severity Colors**:
  - Low: Cyan (#00f2fe)
  - Medium: Yellow (#e9c46a)
  - High: Orange (#ff9f43)
  - Critical: Red (#ff3b3b)

### Typography

- **Headings**: Outfit (Google Fonts)
- **Body**: System font stack
- **Code/Data**: JetBrains Mono

### Components

- Glassmorphism cards
- Gradient text effects
- Smooth transitions
- Hover animations
- Loading states

## 📡 API Integration

All API calls go through `src/services/api.ts`:

```typescript
import api from './services/api';

// GET request
const insights = await api.get('/insights');

// POST request
await api.post('/alerts', alertData);
```

**Base URL**: Configured via `VITE_API_URL` or defaults to `http://localhost:3001`

**Authentication**: Tokens stored in httpOnly cookies, automatically included in requests

## 🚀 Build & Deploy

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

Output in `dist/` directory

### Preview Production Build

```bash
npm run preview
```

### Deployment Options

- **Vercel**: Zero-config deployment
- **Netlify**: Drag & drop deployment
- **Cloudflare Pages**: Fast global CDN
- **GitHub Pages**: Free hosting
- **AWS S3 + CloudFront**: Enterprise hosting

## 🧪 Testing

Manual testing checklist:

1. ✅ Login with different roles
2. ✅ Create fraud alert
3. ✅ Create trading pattern alert
4. ✅ View investigation
5. ✅ View trading insight
6. ✅ Execute actions
7. ✅ Check responsive design
8. ✅ Test error states

## 🔧 Development

### Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run linter (if configured)
```

### TypeScript

Strict TypeScript enabled. Types defined in `src/types/index.ts`.

### Styling

- CSS in `src/styles/noir.css`
- CSS variables for theming
- No CSS-in-JS (pure CSS)

## 📱 Responsive Design

- **Desktop**: Full layout with sidebar
- **Tablet**: Responsive grid adjustments
- **Mobile**: Stacked layout, collapsible sidebar

## 🎯 Key Features

### Investigation Queue

- Real-time alert updates
- Trading pattern alerts
- Fraud alerts
- Severity indicators
- Quick investigation access

### Trading Insights

- Autonomous analysis display
- Behavioral pressure visualization
- Pattern recognition
- Historical pattern matching
- Social content generation

### User Experience

- Smooth animations
- Loading states
- Error handling
- Toast notifications (if implemented)
- Keyboard navigation

## 🐛 Troubleshooting

### API Connection Issues

- Check backend is running on port 3001
- Verify `VITE_API_URL` in `.env`
- Check CORS configuration in backend

### Authentication Issues

- Clear cookies and re-login
- Check JWT token expiry
- Verify backend auth endpoints

### Build Issues

- Clear `node_modules` and reinstall
- Check Node.js version (18+)
- Verify TypeScript configuration

## 📚 Documentation

- **Main README**: `../README.md`
- **Backend README**: `../backend/README.md`
- **Component Docs**: See component files for JSDoc comments

## 🤝 Contributing

1. Follow React best practices
2. Use TypeScript for type safety
3. Maintain design system consistency
4. Add comments for complex logic
5. Test responsive design

## 📄 License

MIT License
