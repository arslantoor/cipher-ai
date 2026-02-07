# Trading Insights Integration with Investigation Queue - Implementation Summary

## Overview

The Investigation Queue module has been successfully synced with Trading Insights to warn traders about bad trading choices based on their own historical patterns, rather than fraud detection.

## Changes Implemented

### 1. New Alert Type
- **Added**: `BAD_TRADING_PATTERN` to `AlertType` enum
  - Frontend: `frontend/src/types/index.ts`
  - Backend: `backend/src/types/index.ts`

### 2. Trading Pattern Detector Service
- **Created**: `backend/src/services/tradingPatternDetector.ts`
  - Analyzes trader's historical insights
  - Identifies patterns that correlate with losses
  - Matches current behavior to historical losing patterns
  - Generates personalized warning messages

**Key Features**:
- Pattern identification from historical high-pressure insights
- Loss rate calculation per pattern
- Pattern matching based on:
  - Market conditions (instrument, movement type, volatility)
  - Behavioral signals (pressure level, frequency spike, loss clustering)
- Warning message generation

### 3. New API Endpoint
- **Created**: `GET /api/trading-alerts`
  - Converts trading insights to alerts for Investigation Queue
  - Filters insights by pressure level (elevated/high_pressure)
  - Detects bad patterns using `TradingPatternDetector`
  - Returns alerts in format compatible with Investigation Queue

**Query Parameters**:
- `limit`: Number of alerts to return (default: 50)
- `min_pressure`: Minimum pressure level ('elevated' or 'high_pressure')

**Response Format**:
```json
{
  "alert": {
    "alert_id": "TRADE-{insight_id}",
    "user_id": "{trader_id}",
    "alert_type": "bad_trading_pattern" | "suspicious_trading",
    "timestamp": "...",
    "triggered_rules": ["trade_frequency_spike", "loss_clustering", ...],
    "raw_data": {
      "insight_id": "...",
      "instrument": "...",
      "pressure_level": "...",
      "matched_pattern": {...},
      "warning_message": "..."
    }
  },
  "userActivity": {...}
}
```

### 4. Updated AlertQueue Component
- **Modified**: `frontend/src/components/AlertQueue.tsx`
  - Now fetches from `/api/trading-alerts` instead of hardcoded fraud alerts
  - Falls back to sample data if API fails
  - Displays trading pattern alerts in the side panel

### 5. Enhanced Investigation Flow
- **Modified**: `backend/src/server.ts` - `/api/investigate` endpoint
  - Detects if alert is a trading pattern alert
  - Uses trading-specific analysis for trading alerts:
    - Extracts deviations from behavioral pressure factors
    - Maps pressure level to severity
    - Uses trading-specific narrative generation
  - Falls back to standard fraud investigation for non-trading alerts

### 6. Trading Pattern Narrative Generator
- **Added**: `generateTradingPatternNarrative()` method to `NarrativeGenerator`
  - Generates personalized warnings based on trader's own data
  - Connects current behavior to historical losses
  - Uses supportive, educational language
  - Includes matched pattern information and loss rates

**Narrative Focus**:
- Pattern recognition (what pattern is repeating)
- Historical connection (when this happened before)
- Gentle warning (not judgmental)
- Reflection suggestion (pause and review)

## How It Works

### Flow Diagram

```
1. Trading Insights Generated
   ↓
2. High-Pressure Insights Detected
   ↓
3. TradingPatternDetector Analyzes Historical Patterns
   ↓
4. Pattern Match Found? → Create BAD_TRADING_PATTERN Alert
   ↓
5. Alert Appears in Investigation Queue
   ↓
6. Analyst/Trader Selects Alert
   ↓
7. Investigation Uses Trading-Specific Analysis
   ↓
8. Narrative Shows: "You're repeating a pattern that led to X% losses"
```

### Pattern Detection Logic

1. **Historical Analysis**:
   - Get last 50 insights for trader
   - Identify high-pressure insights (potential losses)
   - Group by pattern key: `{instrument}_{market_type}_{pressure}_{frequency}_{loss_cluster}`

2. **Pattern Matching**:
   - Compare current insight to historical patterns
   - Check market conditions match
   - Check behavioral signals match
   - Calculate similarity score

3. **Alert Generation**:
   - If pattern matches with >50% loss rate → `BAD_TRADING_PATTERN`
   - Otherwise → `SUSPICIOUS_TRADING`
   - Include matched pattern data in `raw_data`

### Investigation Process for Trading Alerts

When a trading alert is investigated:

1. **Extract Insight Data**: Get full `TradingInsight` from `insight_id`
2. **Analyze Behavioral Factors**:
   - Trade frequency spike
   - Position size deviation
   - Loss clustering
   - Unusual hours
   - Short intervals
3. **Generate Narrative**: 
   - Explain detected pattern
   - Show historical loss rate
   - Connect to trader's own history
   - Suggest reflection

## Example Alert

```json
{
  "alert": {
    "alert_id": "TRADE-abc123",
    "user_id": "trader_001",
    "alert_type": "bad_trading_pattern",
    "timestamp": "2024-01-20T10:30:00Z",
    "triggered_rules": [
      "trade_frequency_spike",
      "loss_clustering",
      "repeating_bad_pattern"
    ],
    "raw_data": {
      "insight_id": "insight_abc123",
      "instrument": "EURUSD",
      "pressure_level": "high_pressure",
      "pressure_score": 78,
      "matched_pattern": {
        "pattern_id": "pattern_EURUSD_volatility_regime_change_high_pressure_high_high",
        "description": "Pattern: high trade frequency, loss clustering in EURUSD",
        "historical_losses": 8,
        "loss_rate": 0.75
      },
      "warning_message": "You're repeating a pattern that led to losses 75% of the time..."
    }
  }
}
```

## Benefits

1. **Personalized Warnings**: Uses trader's own account data
2. **Pattern Recognition**: Learns from trader's mistakes
3. **Proactive Coaching**: Warns before losses accumulate
4. **Educational**: Helps traders understand their patterns
5. **Non-Judgmental**: Supportive language, not criticism

## Next Steps (Optional Enhancements)

1. **Real-time Pattern Detection**: Auto-create alerts when patterns are detected
2. **Pattern Learning**: Improve pattern matching with ML
3. **Historical Trade Data**: Integrate actual trade PnL data for more accurate loss rates
4. **Pattern Categories**: Group patterns by type (overtrading, revenge trading, etc.)
5. **Success Stories**: Track when warnings prevented losses

## Testing

To test the integration:

1. Generate some trading insights with high pressure:
   ```bash
   POST /api/autonomous/run
   # With trades showing high frequency, loss clustering, etc.
   ```

2. Fetch trading alerts:
   ```bash
   GET /api/trading-alerts?min_pressure=elevated&limit=10
   ```

3. Investigate an alert:
   ```bash
   POST /api/investigate
   # With trading alert from step 2
   ```

4. Check Investigation Queue in frontend - should show trading pattern alerts
