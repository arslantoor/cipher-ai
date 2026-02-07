#!/bin/bash

# Quick test script for Trading Insights module
# This will create sample insights that you can view in the frontend

BASE_URL="http://localhost:3001"

echo "🧪 Testing Trading Insights Module"
echo "===================================="
echo ""

# Step 1: Login
echo "Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cipherai.com",
    "password": "Admin123!"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed! Check if backend is running on port 3001"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful!"
echo ""

# Step 2: Create first insight (Normal trading)
echo "Step 2: Creating insight #1 (Normal Trading Pattern)..."
INSIGHT1=$(curl -s -X POST $BASE_URL/api/autonomous/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "trader_id": "TRADER-001",
    "trades": [
      {
        "trade_id": "t1",
        "trader_id": "TRADER-001",
        "instrument": "EURUSD",
        "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "position_size": 1000,
        "pnl": 50
      },
      {
        "trade_id": "t2",
        "trader_id": "TRADER-001",
        "instrument": "EURUSD",
        "timestamp": "'$(date -u -d "1 hour ago" +"%Y-%m-%dT%H:%M:%SZ")'",
        "position_size": 1200,
        "pnl": 30
      }
    ],
    "market_data": {
      "instrument": "EURUSD",
      "percentChange": 1.2,
      "volatility": 0.010,
      "ohlc": {
        "open": 1.1000,
        "high": 1.1025,
        "low": 1.0995,
        "close": 1.1015
      },
      "newsCatalysts": ["ECB policy update"]
    }
  }')

if echo "$INSIGHT1" | grep -q "success"; then
  echo "✅ Insight #1 created successfully!"
else
  echo "❌ Failed to create insight #1"
  echo "Response: $INSIGHT1"
fi
echo ""

# Step 3: Create second insight (High pressure)
echo "Step 3: Creating insight #2 (High Pressure Trading)..."
INSIGHT2=$(curl -s -X POST $BASE_URL/api/autonomous/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "trader_id": "TRADER-002",
    "trades": [
      {
        "trade_id": "h1",
        "trader_id": "TRADER-002",
        "instrument": "BTCUSD",
        "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "position_size": 5000,
        "pnl": 200
      },
      {
        "trade_id": "h2",
        "trader_id": "TRADER-002",
        "instrument": "BTCUSD",
        "timestamp": "'$(date -u -d "10 minutes ago" +"%Y-%m-%dT%H:%M:%SZ")'",
        "position_size": 8000,
        "pnl": -150
      },
      {
        "trade_id": "h3",
        "trader_id": "TRADER-002",
        "instrument": "BTCUSD",
        "timestamp": "'$(date -u -d "20 minutes ago" +"%Y-%m-%dT%H:%M:%SZ")'",
        "position_size": 10000,
        "pnl": 300
      },
      {
        "trade_id": "h4",
        "trader_id": "TRADER-002",
        "instrument": "BTCUSD",
        "timestamp": "'$(date -u -d "30 minutes ago" +"%Y-%m-%dT%H:%M:%SZ")'",
        "position_size": 12000,
        "pnl": -200
      }
    ],
    "market_data": {
      "instrument": "BTCUSD",
      "percentChange": 5.5,
      "volatility": 0.025,
      "ohlc": {
        "open": 42000,
        "high": 44200,
        "low": 41800,
        "close": 44000
      },
      "newsCatalysts": ["Bitcoin ETF approval", "Market volatility"]
    }
  }')

if echo "$INSIGHT2" | grep -q "success"; then
  echo "✅ Insight #2 created successfully!"
else
  echo "❌ Failed to create insight #2"
  echo "Response: $INSIGHT2"
fi
echo ""

# Step 4: Create third insight (Market spike)
echo "Step 4: Creating insight #3 (Market Spike)..."
INSIGHT3=$(curl -s -X POST $BASE_URL/api/autonomous/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "trader_id": "TRADER-003",
    "trades": [
      {
        "trade_id": "s1",
        "trader_id": "TRADER-003",
        "instrument": "XAUUSD",
        "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "position_size": 3000,
        "pnl": 150
      }
    ],
    "market_data": {
      "instrument": "XAUUSD",
      "percentChange": 8.2,
      "volatility": 0.035,
      "ohlc": {
        "open": 2000,
        "high": 2170,
        "low": 1995,
        "close": 2165
      },
      "newsCatalysts": ["Geopolitical tensions", "Fed rate decision"]
    }
  }')

if echo "$INSIGHT3" | grep -q "success"; then
  echo "✅ Insight #3 created successfully!"
else
  echo "❌ Failed to create insight #3"
  echo "Response: $INSIGHT3"
fi
echo ""

# Step 5: Verify insights were created
echo "Step 5: Verifying insights..."
INSIGHTS_COUNT=$(curl -s -X GET "$BASE_URL/api/insights?limit=10" \
  -H "Authorization: Bearer $TOKEN" | grep -o '"insight_id"' | wc -l)

echo "📊 Found $INSIGHTS_COUNT insights in database"
echo ""

# Summary
echo "===================================="
echo "✅ Test Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Login with: admin@cipherai.com / Admin123!"
echo "3. Click on 'Trading Insights' tab (top navigation)"
echo "4. You should see the insights in the left sidebar"
echo "5. Click any insight to view details"
echo ""
echo "💡 Tips:"
echo "- If you don't see insights, check browser console for errors"
echo "- Make sure frontend is running on port 3000"
echo "- Make sure backend is running on port 3001"
echo "- Check backend logs for any processing errors"
echo ""
