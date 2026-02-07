# 🚀 Quick Test Guide: Trading Insights Module

## Problem: No insights showing in Trading Insights tab

This guide will help you quickly generate test insights and verify they appear in the frontend.

---

## ✅ Quick Solution (3 Steps)

### Step 1: Run the Test Script

```bash
cd /home/arslan/Documents/hackathon/CipherAi/Cipher.AI
./test-trading-insights.sh
```

This script will:
- Login to the backend
- Create 3 sample insights (normal, high pressure, market spike)
- Verify they were created

**Expected Output:**
```
✅ Login successful!
✅ Insight #1 created successfully!
✅ Insight #2 created successfully!
✅ Insight #3 created successfully!
📊 Found 3 insights in database
```

### Step 2: Check Frontend

1. Open `http://localhost:3000` in your browser
2. Login with: `admin@cipherai.com` / `Admin123!`
3. **Click "Trading Insights" tab** (top navigation, NOT "Alerts")
4. You should see insights in the left sidebar

### Step 3: Verify

- ✅ Insights appear in the list
- ✅ Click an insight to see details
- ✅ Pressure levels are displayed
- ✅ AI narratives are shown

---

## 🔧 Manual Testing (If Script Doesn't Work)

### 1. Get JWT Token

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cipherai.com",
    "password": "Admin123!"
  }'
```

Copy the `accessToken` from the response.

### 2. Create an Insight

Replace `YOUR_TOKEN` with the token from step 1:

```bash
curl -X POST http://localhost:3001/api/autonomous/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "trader_id": "TRADER-TEST",
    "trades": [
      {
        "trade_id": "test-1",
        "trader_id": "TRADER-TEST",
        "instrument": "EURUSD",
        "timestamp": "2024-01-15T10:00:00Z",
        "position_size": 1000,
        "pnl": 50
      },
      {
        "trade_id": "test-2",
        "trader_id": "TRADER-TEST",
        "instrument": "EURUSD",
        "timestamp": "2024-01-15T11:00:00Z",
        "position_size": 1500,
        "pnl": -30
      }
    ],
    "market_data": {
      "instrument": "EURUSD",
      "percentChange": 2.5,
      "volatility": 0.015,
      "ohlc": {
        "open": 1.1000,
        "high": 1.1025,
        "low": 1.0995,
        "close": 1.1015
      }
    }
  }'
```

### 3. Verify Insights Were Created

```bash
curl -X GET http://localhost:3001/api/insights \
  -H "Authorization: Bearer YOUR_TOKEN"
```

You should see a JSON array with insights.

---

## 🐛 Troubleshooting

### No Insights Appearing in Frontend

**Check:**

1. **Backend is running**
   ```bash
   # Check if backend is running
   curl http://localhost:3001/api/health
   ```

2. **Frontend is on correct tab**
   - Must be on "Trading Insights" tab, NOT "Alerts"
   - Check top navigation

3. **Browser console**
   - Open DevTools (F12)
   - Check Console tab for errors
   - Check Network tab for failed API calls

4. **Backend logs**
   - Check terminal where backend is running
   - Look for errors or processing messages

5. **API endpoint**
   - Frontend should call: `GET /api/insights`
   - Verify this endpoint works with curl

### Backend Errors

**Common Issues:**

1. **Database not initialized**
   ```bash
   # Check if database exists
   ls backend/data/cipherai.db
   ```

2. **Missing environment variables**
   - Check `backend/.env` file
   - `GEMINI_API_KEY` is optional (will use fallback narratives)

3. **Port conflicts**
   - Backend should be on port 3001
   - Frontend should be on port 3000

### Frontend Not Loading Insights

**Check:**

1. **API call is being made**
   - Open DevTools → Network tab
   - Look for `/api/insights` request
   - Check if it returns 200 status

2. **Authentication**
   - Make sure you're logged in
   - Token might be expired (try logging out and back in)

3. **Component state**
   - Check React DevTools
   - Verify `insights` state is populated

---

## 📊 Verify Database Directly

If you want to check the database directly:

```bash
cd backend/data
sqlite3 cipherai.db

# Count insights
SELECT COUNT(*) FROM trading_insights;

# View recent insights
SELECT id, trader_id, instrument, pressure_level, created_at 
FROM trading_insights 
ORDER BY created_at DESC 
LIMIT 5;

# Exit
.quit
```

---

## 🎯 Expected Behavior

After running the test script, you should see:

1. **In Backend Logs:**
   - `[AutonomousOrchestrator]` processing messages
   - `[NarrativeGenerator]` generating narratives
   - `[TradingInsightService]` storing insights

2. **In Frontend:**
   - Insights list in left sidebar
   - Each insight shows:
     - Instrument (EURUSD, BTCUSD, XAUUSD)
     - Pressure level badge (Stable/Elevated/High)
     - Market movement summary
     - Timestamp

3. **When Clicking an Insight:**
   - Full AI-generated narrative
   - Market context details
   - Behavioral pressure breakdown
   - Baseline comparison

---

## ✅ Success Checklist

- [ ] Test script runs without errors
- [ ] Backend returns success for insight creation
- [ ] Insights appear in frontend Trading Insights tab
- [ ] Can click insights to view details
- [ ] AI narratives are displayed
- [ ] Pressure levels are shown correctly

---

## 🚀 Next Steps

Once you can see insights:

1. **Test different scenarios:**
   - High pressure trading (many trades quickly)
   - Stable trading (few trades, spaced out)
   - Market spikes (large price movements)

2. **Test social content:**
   - Click an insight
   - Look for "Content Studio" or social content options
   - Generate LinkedIn/X posts

3. **Test daily summaries:**
   - Create multiple insights
   - Call `/api/insights/summary/daily` endpoint

---

**If you're still having issues, check the detailed guide: `AUTONOMOUS_INSIGHTS_TESTING.md`**
