# 🤖 Autonomous Mode Guide

## What is Autonomous Mode?

**Autonomous Mode** is a background service that automatically generates trading insights based on simulated market events. This demonstrates how the system would work in production, where it would:

1. **Monitor market data in real-time** (from trading platforms, market data feeds)
2. **Detect trading activity automatically** (when traders execute trades)
3. **Generate insights automatically** (without manual API calls)
4. **Run continuously in the background** (like a real autonomous system)

---

## 🚀 How to Enable Autonomous Mode

### Option 1: Auto-Start on Server Launch

Add to `backend/.env`:

```bash
AUTONOMOUS_DEMO_ENABLED=true
AUTONOMOUS_DEMO_INTERVAL=2  # Generate insights every 2 minutes
```

Then restart the backend. It will automatically start generating insights.

### Option 2: Start via API

```bash
# 1. Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@cipherai.com", "password": "Admin123!"}'

# 2. Start autonomous mode (replace YOUR_TOKEN)
curl -X POST http://localhost:3001/api/autonomous/demo/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"interval_minutes": 2}'
```

### Option 3: Check Status

```bash
curl -X GET http://localhost:3001/api/autonomous/demo/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Option 4: Stop Autonomous Mode

```bash
curl -X POST http://localhost:3001/api/autonomous/demo/stop \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎯 How It Works

### Simulated Market Events

The autonomous service simulates:

1. **Multiple Traders**: TRADER-001, TRADER-002, TRADER-003
2. **Multiple Instruments**: EURUSD, GBPUSD, BTCUSD, XAUUSD, USDJPY
3. **Different Scenarios**:
   - **Normal Trading**: 2 trades, small movements (0.5-2%)
   - **High Pressure**: 4-6 trades quickly, larger positions, losses
   - **Market Spike**: 1 trade, large movement (5-9%)
   - **Volatile Period**: 3-5 trades, high volatility

### Automatic Generation

Every N minutes (default: 2), the service:

1. **Selects random trader and instrument**
2. **Generates realistic trades** based on scenario
3. **Creates market data** (price movements, volatility, news)
4. **Runs full analysis** (baseline, deviations, pressure, narrative)
5. **Stores insight** in database
6. **Generates social content** automatically
7. **Sends WhatsApp nudge** if high pressure detected

### What Gets Generated

Each insight includes:

- ✅ **Market Analysis**: Movement type, magnitude, timeframe
- ✅ **Behavioral Analysis**: Pressure score, patterns, deviations
- ✅ **AI Narrative**: Personalized "market did X, you tend to Y" format
- ✅ **Social Content**: LinkedIn, X, Thread posts (all personas)
- ✅ **Proactive Nudges**: WhatsApp notifications for high pressure

---

## 📊 Example Output

### Backend Logs

```
[AutonomousDemo] Starting autonomous insight generation (every 2 minutes)
[AutonomousDemo] Generating insight for TRADER-001 on EURUSD (normal)
[AutonomousOrchestrator] Running autonomous analysis...
[NarrativeGenerator] Generating trading narrative...
[TradingInsightService] Storing insight...
[SocialContentGenerator] Generating social content...
[AutonomousDemo] ✅ Insight generated successfully
```

### Frontend

- Insights appear automatically in the "Trading Insights" tab
- No manual refresh needed (auto-refreshes every 30s)
- Each insight shows:
  - Instrument and timestamp
  - Pressure level badge
  - Market movement summary
  - AI narrative preview

---

## 🔧 Configuration

### Environment Variables

```bash
# Enable autonomous mode on startup
AUTONOMOUS_DEMO_ENABLED=true

# Interval between insights (minutes)
AUTONOMOUS_DEMO_INTERVAL=2

# For production, you'd connect to real market data:
# MARKET_DATA_API_KEY=your_key
# TRADING_PLATFORM_WEBHOOK_URL=your_webhook
```

### API Parameters

```json
{
  "interval_minutes": 2  // How often to generate insights (1-60)
}
```

---

## 🎭 Demo Scenarios

The service randomly generates different scenarios:

### Scenario 1: Normal Trading
- **Trades**: 2 trades, spaced apart
- **Market**: 0.5-2% movement
- **Pressure**: STABLE
- **Use Case**: Demonstrates baseline behavior

### Scenario 2: High Pressure
- **Trades**: 4-6 trades in quick succession
- **Market**: 2-4% movement
- **Pressure**: HIGH_PRESSURE
- **Use Case**: Shows behavioral coaching (nudges, break suggestions)

### Scenario 3: Market Spike
- **Trades**: 1 trade
- **Market**: 5-9% sudden movement
- **Pressure**: ELEVATED
- **Use Case**: Demonstrates market analysis capabilities

### Scenario 4: Volatile Period
- **Trades**: 3-5 trades
- **Market**: 3-6% movement, high volatility
- **Pressure**: ELEVATED to HIGH
- **Use Case**: Shows volatility regime detection

---

## 🔄 Production vs Demo

### Demo Mode (Current)
- ✅ Simulates market events
- ✅ Generates random trades
- ✅ Creates insights automatically
- ✅ Perfect for testing and demos

### Production Mode (Future)
- 🔄 Connects to real market data feeds
- 🔄 Receives actual trade events from trading platform
- 🔄 Monitors real-time price movements
- 🔄 Generates insights when real trades occur

**The analysis engine is the same** - only the data source changes!

---

## ✅ Verification

### Check if Running

```bash
# Via API
curl http://localhost:3001/api/autonomous/demo/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# In backend logs
# Look for: "[AutonomousDemo] Starting autonomous insight generation"
```

### Check Generated Insights

```bash
# Count insights
curl http://localhost:3001/api/insights \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '. | length'

# View in frontend
# Open http://localhost:3000 → Trading Insights tab
```

### Database Check

```sql
SELECT COUNT(*) FROM trading_insights;
SELECT * FROM trading_insights ORDER BY created_at DESC LIMIT 5;
```

---

## 🎯 Use Cases

### For Hackathon Demo

1. **Start autonomous mode** before demo
2. **Let it run** and generate 5-10 insights
3. **Show frontend** with insights appearing automatically
4. **Explain**: "This runs autonomously in the background, analyzing market events and trader behavior"

### For Testing

1. **Start with 1-minute interval** for quick testing
2. **Generate multiple scenarios** to test different pressure levels
3. **Verify** all features work (narratives, social content, nudges)

### For Development

1. **Use 5-minute interval** to avoid too many insights
2. **Monitor logs** to see processing
3. **Test edge cases** by modifying scenarios

---

## 🐛 Troubleshooting

### Insights Not Generating

**Check:**
1. Backend logs for errors
2. `AUTONOMOUS_DEMO_ENABLED` is set correctly
3. Service is actually running (check status endpoint)
4. Database is accessible

### Too Many Insights

**Solution:**
- Increase interval: `{"interval_minutes": 5}`
- Stop service when not needed
- Clear old insights from database

### Service Won't Start

**Check:**
1. Admin role required (only admins can start/stop)
2. Backend is running
3. No errors in logs
4. Database is initialized

---

## 🎉 Benefits

✅ **Truly Autonomous**: No manual API calls needed
✅ **Realistic Demo**: Simulates real-world operation
✅ **Continuous Operation**: Runs in background
✅ **Multiple Scenarios**: Tests different market conditions
✅ **Complete Pipeline**: Generates insights, narratives, social content
✅ **Production-Ready**: Same engine as production, just different data source

---

**This is how the system would work in production - continuously monitoring markets and generating insights automatically!** 🚀
