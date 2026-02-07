# Investigation Queue Module - Explanation & Trading Insights Integration

## Current Architecture

### Frontend Components

1. **AlertQueue Component** (`frontend/src/components/AlertQueue.tsx`)
   - Side panel showing list of alerts
   - Displays: alert_id, user_id, alert_type, timestamp, triggered_rules
   - Currently shows hardcoded fraud alerts (UNUSUAL_TRANSACTION_AMOUNT, SUSPICIOUS_LOGIN_LOCATION, etc.)

2. **InvestigationView Component** (`frontend/src/components/InvestigationView.tsx`)
   - Main investigation panel showing:
     - AI Intelligence Narrative
     - Pattern Recognition
     - Execution Protocol (actions)
     - Investigation Timeline
     - Network Panel

### Backend Flow

1. **Alert Creation** (`/api/alerts`)
   - Creates alert in database
   - Emits FRAUD_ALERT_CREATED event

2. **Investigation Process** (`/api/investigate`)
   - Uses `DeviationDetector` to find deviations from baseline
   - Uses `SeverityEngine` to classify severity
   - Uses `NarrativeGenerator` to create investigation narrative
   - Returns `Investigation` object with patterns and recommendations

3. **Current Pattern Detection** (Fraud-focused)
   - Amount deviations (transaction size vs baseline)
   - Temporal deviations (unusual hours)
   - Location deviations (new locations)
   - Device deviations (new devices)

## Trading Insights System

### Current Trading Analysis (`AutonomousOrchestrator`)

The system already analyzes trading behavior and detects:
- **Trade frequency spikes**: Unusual number of trades in short time
- **Position size deviations**: Trades larger than normal
- **Loss clustering**: Multiple losses in sequence
- **Unusual hours**: Trading at atypical times
- **Short intervals**: Rapid-fire trading

These are stored as `TradingInsight` objects with:
- `pressure_level`: STABLE, ELEVATED, HIGH_PRESSURE
- `behaviour_context.pressure_score`: 0-100 score
- `deterministic_score`: Risk score
- `narrative`: AI-generated explanation

## Integration Plan: Trading Pattern Warnings

### Goal
Transform Investigation Queue to warn traders about bad trading choices based on their own historical patterns, not fraud detection.

### Changes Required

1. **New Alert Type**: `BAD_TRADING_PATTERN`
   - Triggered when trader exhibits patterns that historically led to losses
   - Uses trader's own account data to detect repeating mistakes

2. **Trading Pattern Detector**
   - Analyzes trader's historical trades
   - Identifies patterns that correlate with losses
   - Compares current behavior to past mistakes

3. **Alert Generation from Trading Insights**
   - Convert high-pressure insights into alerts
   - Link to trader's historical bad patterns
   - Show what pattern they're repeating

4. **Investigation Flow for Trading**
   - Instead of fraud deviations, analyze trading pattern deviations
   - Show: "You're making the same mistake you made on [date]"
   - Provide personalized warnings based on their history

## Implementation Details

### Pattern Detection Logic

```typescript
// Detect if trader is repeating a bad pattern
1. Get trader's historical trades
2. Identify trades that resulted in losses
3. Extract patterns from those losing trades:
   - Market conditions (volatility, trend direction)
   - Trading behavior (position size, frequency, timing)
   - Sequence of actions
4. Compare current trade/behavior to historical losing patterns
5. If match found → Create BAD_TRADING_PATTERN alert
```

### Alert Structure for Trading

```typescript
{
  alert_id: string,
  user_id: string (trader_id),
  alert_type: "BAD_TRADING_PATTERN",
  timestamp: string,
  triggered_rules: [
    "loss_clustering_detected",
    "position_size_spike",
    "repeating_volatile_market_mistake"
  ],
  raw_data: {
    current_trade: Trade,
    matched_pattern: {
      pattern_id: string,
      historical_losses: Trade[],
      similarity_score: number,
      warning_message: string
    }
  }
}
```

### Investigation Narrative for Trading

Instead of fraud narrative, show:
- "You're exhibiting the same pattern that led to losses on [dates]"
- "In similar market conditions, you've historically struggled"
- "Your current behavior matches patterns with X% loss rate"
- Personalized coaching based on their specific mistakes
