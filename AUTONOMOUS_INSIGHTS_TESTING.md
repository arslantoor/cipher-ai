# 🧪 Testing Autonomous Insights Module

This guide shows you how to test the Autonomous Insights feature that analyzes trading behavior and market patterns.

## 🎯 What is Autonomous Insights?

Autonomous Insights analyzes:
- **Trading Behavior**: Detects patterns, pressure levels, deviations
- **Market Context**: Price movements, volatility, market events
- **AI Narratives**: Educational explanations of trading patterns

## 🚀 Quick Start Testing

### Method 1: Via API (Recommended for Testing)

#### Step 1: Get JWT Token

```bash
# Login to get token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cipherai.com",
    "password": "Admin123!"
  }'
```

Save the `accessToken` from the response.

#### Step 2: Generate Trading Insight

```bash
# Replace YOUR_JWT_TOKEN with token from Step 1
TOKEN="YOUR_JWT_TOKEN"

curl -X POST http://localhost:3001/api/autonomous/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "trader_id": "TRADER-001",
    "trades": [
      {
        "trade_id": "trade-1",
        "trader_id": "TRADER-001",
        "instrument": "EURUSD",
        "timestamp": "2024-01-15T10:00:00Z",
        "position_size": 1000,
        "pnl": 50
      },
      {
        "trade_id": "trade-2",
        "trader_id": "TRADER-001",
        "instrument": "EURUSD",
        "timestamp": "2024-01-15T11:00:00Z",
        "position_size": 1500,
        "pnl": -30
      },
      {
        "trade_id": "trade-3",
        "trader_id": "TRADER-001",
        "instrument": "EURUSD",
        "timestamp": "2024-01-15T12:00:00Z",
        "position_size": 2000,
        "pnl": 100
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
      },
      "newsCatalysts": ["ECB announcement", "Inflation data"]
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "insight": {
    "insight_id": "...",
    "trader_id": "TRADER-001",
    "instrument": "EURUSD",
    "pressure_level": "ELEVATED",
    "deterministic_score": 75.5,
    "narrative": "Market analysis for EURUSD...",
    "created_at": "2024-01-15T12:00:00Z"
  }
}
```

#### Step 3: View Insights in Frontend

1. Open `http://localhost:3000`
2. Login with `admin@cipherai.com` / `Admin123!`
3. **Switch to "Trading" view** (top navigation)
4. You should see the insight in the left sidebar
5. Click on it to view details

---

### Method 2: Multiple Test Scenarios

#### Test Case 1: High Pressure Trading

```bash
curl -X POST http://localhost:3001/api/autonomous/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "trader_id": "TRADER-HIGH-001",
    "trades": [
      {
        "trade_id": "t1",
        "trader_id": "TRADER-HIGH-001",
        "instrument": "BTCUSD",
        "timestamp": "2024-01-15T09:00:00Z",
        "position_size": 5000,
        "pnl": 200
      },
      {
        "trade_id": "t2",
        "trader_id": "TRADER-HIGH-001",
        "instrument": "BTCUSD",
        "timestamp": "2024-01-15T09:15:00Z",
        "position_size": 8000,
        "pnl": -150
      },
      {
        "trade_id": "t3",
        "trader_id": "TRADER-HIGH-001",
        "instrument": "BTCUSD",
        "timestamp": "2024-01-15T09:30:00Z",
        "position_size": 10000,
        "pnl": 300
      },
      {
        "trade_id": "t4",
        "trader_id": "TRADER-HIGH-001",
        "instrument": "BTCUSD",
        "timestamp": "2024-01-15T09:45:00Z",
        "position_size": 12000,
        "pnl": -200
      }
    ],
    "market_data": {
      "instrument": "BTCUSD",
      "percentChange": 5.2,
      "volatility": 0.025,
      "ohlc": {
        "open": 42000,
        "high": 44200,
        "low": 41800,
        "close": 44000
      },
      "newsCatalysts": ["Bitcoin ETF approval", "Market volatility"]
    }
  }'
```

**Expected:** High pressure level, elevated behavioral score

#### Test Case 2: Stable Trading Pattern

```bash
curl -X POST http://localhost:3001/api/autonomous/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "trader_id": "TRADER-STABLE-001",
    "trades": [
      {
        "trade_id": "s1",
        "trader_id": "TRADER-STABLE-001",
        "instrument": "GBPUSD",
        "timestamp": "2024-01-15T10:00:00Z",
        "position_size": 2000,
        "pnl": 25
      },
      {
        "trade_id": "s2",
        "trader_id": "TRADER-STABLE-001",
        "instrument": "GBPUSD",
        "timestamp": "2024-01-15T14:00:00Z",
        "position_size": 2000,
        "pnl": 30
      }
    ],
    "market_data": {
      "instrument": "GBPUSD",
      "percentChange": 0.5,
      "volatility": 0.008,
      "ohlc": {
        "open": 1.2700,
        "high": 1.2750,
        "low": 1.2690,
        "close": 1.2720
      }
    }
  }'
```

**Expected:** Stable pressure level, normal behavioral patterns

#### Test Case 3: Sudden Market Spike

```bash
curl -X POST http://localhost:3001/api/autonomous/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "trader_id": "TRADER-SPIKE-001",
    "trades": [
      {
        "trade_id": "sp1",
        "trader_id": "TRADER-SPIKE-001",
        "instrument": "XAUUSD",
        "timestamp": "2024-01-15T11:00:00Z",
        "position_size": 3000,
        "pnl": 150
      }
    ],
    "market_data": {
      "instrument": "XAUUSD",
      "percentChange": 8.5,
      "volatility": 0.035,
      "ohlc": {
        "open": 2000,
        "high": 2170,
        "low": 1995,
        "close": 2165
      },
      "newsCatalysts": ["Geopolitical tensions", "Fed rate decision"]
    }
  }'
```

**Expected:** High volatility detection, market context analysis

---

## 📊 View Insights via API

### Get All Insights

```bash
curl -X GET http://localhost:3001/api/insights \
  -H "Authorization: Bearer $TOKEN"
```

### Get Specific Insight

```bash
curl -X GET http://localhost:3001/api/insights/INSIGHT_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Filter Insights

```bash
# By trader
curl -X GET "http://localhost:3001/api/insights?trader_id=TRADER-001&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# By instrument
curl -X GET "http://localhost:3001/api/insights?instrument=EURUSD" \
  -H "Authorization: Bearer $TOKEN"

# By pressure level
curl -X GET "http://localhost:3001/api/insights?pressure_level=HIGH" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🖥️ Frontend Testing

### Step 1: Generate Insights via API

Use the curl commands above to create 3-5 insights with different scenarios.

### Step 2: View in Frontend

1. Open `http://localhost:3000`
2. Login: `admin@cipherai.com` / `Admin123!`
3. **Click "Trading" tab** in top navigation (not "Alerts")
4. Left sidebar shows list of insights
5. Click any insight to view details

### Step 3: Verify Display

Each insight card shows:
- ✅ **Instrument** (e.g., EURUSD, BTCUSD)
- ✅ **Pressure Level Badge** (Stable/Elevated/High)
- ✅ **Market Movement Summary**
- ✅ **Narrative Preview**
- ✅ **Pressure Gauge** (visual indicator)
- ✅ **Timestamp** (relative time)

### Step 4: View Insight Details

Click an insight to see:
- Full AI-generated narrative
- Market context analysis
- Behavioral pressure breakdown
- Baseline comparison
- Deviation analysis
- Pressure score visualization

---

## 🎯 Test Scenarios Summary

| Scenario | Trades | Market Change | Expected Pressure |
|----------|--------|---------------|-------------------|
| High Frequency | 4+ trades in 1 hour | 5%+ | HIGH |
| Normal Trading | 2-3 trades, spaced | 0.5-2% | STABLE |
| Market Spike | 1 trade, large move | 8%+ | ELEVATED |
| Volatile Period | Multiple trades, losses | High volatility | HIGH |

---

## ✅ Verification Checklist

After generating insights, verify:

- [ ] Insight created successfully (API returns success)
- [ ] Insight appears in frontend "Trading" view
- [ ] Pressure level is displayed correctly
- [ ] Market movement summary shows
- [ ] AI narrative is generated
- [ ] Pressure gauge displays
- [ ] Insight details view works
- [ ] Auto-refresh works (updates every 30s)
- [ ] Multiple insights can be viewed
- [ ] Filtering works (if implemented)

---

## 🔍 What to Look For

### In Backend Logs:
- `[AutonomousOrchestrator]` processing messages
- `[NarrativeGenerator]` generating trading narrative
- `[TradingInsightService]` storing insight
- No errors in processing

### In Frontend:
- Insights list populates
- Cards show correct data
- Pressure badges color-coded
- Narratives are readable
- Details view loads correctly

### In Database:
```sql
-- Check insights were stored
SELECT * FROM trading_insights ORDER BY created_at DESC LIMIT 5;
```

---

## 🐛 Troubleshooting

### No Insights Appearing

**Check:**
1. Backend is running
2. API call succeeded (check response)
3. Frontend is on "Trading" view (not "Alerts")
4. Browser console for errors
5. Backend logs for processing errors

### Narrative Not Generated

**Check:**
- `GEMINI_API_KEY` is set in `.env`
- Backend logs show Gemini API calls
- Check for API quota/rate limits

### Pressure Level Always Same

**Try:**
- Different trade frequencies
- Different position sizes
- Different market volatility
- More trades in sequence

---

## 📝 Sample Test Script

Save this as `test-insights.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3001"

echo "Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cipherai.com",
    "password": "Admin123!"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  exit 1
fi

echo "✅ Login successful!"

echo ""
echo "Step 2: Creating trading insight..."
curl -X POST $BASE_URL/api/autonomous/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "trader_id": "TRADER-TEST-001",
    "trades": [
      {
        "trade_id": "test-1",
        "trader_id": "TRADER-TEST-001",
        "instrument": "EURUSD",
        "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "position_size": 1000,
        "pnl": 50
      },
      {
        "trade_id": "test-2",
        "trader_id": "TRADER-TEST-001",
        "instrument": "EURUSD",
        "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
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

echo ""
echo "✅ Insight created! Check frontend Trading view."
```

Make it executable:
```bash
chmod +x test-insights.sh
./test-insights.sh
```

---

## 🎉 Success!

If you see insights in the frontend "Trading" view, the module is working correctly!

**Next Steps:**
- Generate multiple insights with different scenarios
- Test different instruments (EURUSD, BTCUSD, XAUUSD, etc.)
- Verify pressure levels vary based on trading patterns
- Check AI narratives are educational and informative
