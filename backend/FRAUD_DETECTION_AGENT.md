# Fraud Detection Agent

## Overview

The Fraud Detection Agent is a fully autonomous, deterministic fraud detection system that processes transactions and emits fraud alerts based on configurable rules and thresholds.

## Features

✅ **Deterministic Scoring**: No AI/LLM usage - fully explainable logic  
✅ **Configurable Thresholds**: All detection rules can be adjusted at runtime  
✅ **Idempotent Processing**: Same transaction → same result (database-backed)  
✅ **Event-Driven**: Subscribes to `TransactionIngested` events  
✅ **Selective Emission**: Only emits `FraudDetected` events for severity >= MEDIUM  

## Architecture

```
TransactionIngested Event
    ↓
Fraud Detection Agent
    ↓
Fraud Scoring Engine (Deterministic)
    ↓
Persist to Database
    ↓
Emit FraudDetected Event (if severity >= MEDIUM)
```

## Fraud Signals

The agent computes four types of fraud signals:

### 1. Amount Deviation
- Compares transaction amount vs historical baseline
- Thresholds: 5x (moderate), 10x (extreme)
- Score weight: 30 points

### 2. Velocity Anomaly
- Detects rapid transaction bursts
- Default: >10 transactions in 24-hour window
- Score weight: 25 points

### 3. Geographic Inconsistency
- New country: 20 points
- New city: 10 points
- Score weight: 15 points

### 4. Rule-Based Flags
- `new_account`: Account < 30 days old
- `after_hours`: Transaction outside typical hours
- `weekend_transaction`: Weekend activity
- `high_value`: Amount > 5x baseline
- `vpn_detected`: Suspicious IP patterns

## Risk Score & Severity

**Risk Score**: 0-100 (composite of all signals)

**Severity Mapping**:
- **LOW**: 0-30
- **MEDIUM**: 31-60
- **HIGH**: 61-85
- **CRITICAL**: 86-100

## Event Flow

### Input Event
```typescript
EventType.TRANSACTION_INGESTED
{
  transaction_id: string;
  user_id: string;
  amount: number;
  timestamp: string;
  transaction_data: {
    location?: { city, country, lat, lng };
    device_fingerprint?: string;
    ip_address?: string;
  };
}
```

### Output Event (only if severity >= MEDIUM)
```typescript
EventType.FRAUD_DETECTED
{
  transaction_id: string;
  user_id: string;
  fraud_detection_id: string;
  risk_score: number; // 0-100
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  signals: {
    amount_deviation: number;
    velocity_anomaly: number;
    geographic_inconsistency: number;
    rule_flags: string[];
  };
  explanation: string;
  detected_at: string;
}
```

## Database Schema

### fraud_detections Table
```sql
CREATE TABLE fraud_detections (
  id TEXT PRIMARY KEY,
  transaction_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  risk_score INTEGER NOT NULL CHECK(risk_score >= 0 AND risk_score <= 100),
  severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  signals TEXT NOT NULL, -- JSON
  explanation TEXT NOT NULL,
  config_used TEXT NOT NULL, -- JSON
  detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Configuration

All thresholds are configurable via `FraudDetectionConfig`:

```typescript
{
  // Amount deviation
  amount_deviation_5x_threshold: 5.0,
  amount_deviation_10x_threshold: 10.0,
  amount_deviation_score_weight: 30,

  // Velocity
  velocity_window_hours: 24,
  velocity_threshold_transactions: 10,
  velocity_score_weight: 25,

  // Geographic
  geographic_new_country_score: 20,
  geographic_new_city_score: 10,
  geographic_score_weight: 15,

  // Rule flags
  rule_flags: {
    new_account: 10,
    after_hours: 5,
    weekend_transaction: 5,
    high_value: 15,
    suspicious_ip: 20,
    vpn_detected: 15,
  },

  // Severity thresholds
  severity_low_max: 30,
  severity_medium_max: 60,
  severity_high_max: 85,
  severity_critical_max: 100,
}
```

## Idempotency

The agent ensures idempotent processing:

1. **Check Database**: Before processing, checks if `transaction_id` already exists in `fraud_detections`
2. **Skip if Exists**: If found, logs and returns (no duplicate processing)
3. **Same Input → Same Output**: Deterministic scoring guarantees identical results

## Usage Example

### Emit TransactionIngested Event

```typescript
const event: TransactionIngestedEvent = {
  event_id: uuidv4(),
  event_type: EventType.TRANSACTION_INGESTED,
  timestamp: new Date().toISOString(),
  payload: {
    transaction_id: 'txn-123',
    user_id: 'user-456',
    amount: 5000,
    timestamp: new Date().toISOString(),
    transaction_data: {
      location: {
        city: 'New York',
        country: 'USA',
        lat: 40.7128,
        lng: -74.0060,
      },
      ip_address: '192.168.1.1',
    },
  },
};

await eventBus.publish(event);
```

### Listen for FraudDetected Events

```typescript
eventBus.subscribe({
  event_type: EventType.FRAUD_DETECTED,
  handler: async (event: FraudDetectedEvent) => {
    console.log(`Fraud detected: ${event.payload.transaction_id}`);
    console.log(`Risk Score: ${event.payload.risk_score}`);
    console.log(`Severity: ${event.payload.severity}`);
    console.log(`Explanation: ${event.payload.explanation}`);
  },
  agent_id: 'my-agent',
});
```

## Audit Logging

All agent actions are logged:

- `FRAUD_DETECTION_STARTED`: Processing begins
- `FRAUD_DETECTION_COMPLETED`: Processing finished
- `FRAUD_DETECTED_EVENT_EMITTED`: Event published
- `FRAUD_DETECTION_LOW_SEVERITY`: Below threshold, no event
- `TRANSACTION_ALREADY_PROCESSED`: Idempotency check
- `FRAUD_DETECTION_ERROR`: Processing error

## Runtime Configuration Update

```typescript
const agent = agentManager.getAgent('fraud_detection') as FraudDetectionAgent;

// Update configuration
agent.updateConfiguration({
  amount_deviation_score_weight: 35, // Increase weight
  velocity_threshold_transactions: 15, // Adjust threshold
});

// Get current configuration
const config = agent.getConfiguration();
```

## Explainability

Every fraud detection includes a detailed explanation:

```
Risk Score: 65/100 (Severity: HIGH) | 
Amount: Amount 8.50x baseline (5000 vs 588.24) - extreme deviation | 
Velocity: 15 transactions in 24h window (threshold: 10) - velocity anomaly | 
Geography: New country detected: USA (previous: UK, France) | 
Rules: Rule flags triggered: high_value, after_hours
```

## Production Considerations

1. **Baseline Data**: Ensure user activity history is available
2. **Configuration Management**: Store config in database for persistence
3. **Monitoring**: Track detection rates, false positives
4. **Performance**: Database indexes on `transaction_id`, `user_id`, `severity`
5. **Scaling**: Agent is stateless, can run multiple instances

## Testing

```typescript
// Test idempotency
await agent.handleTransactionIngested(event1);
await agent.handleTransactionIngested(event1); // Should skip

// Test severity threshold
const lowSeverityResult = await scoringEngine.computeFraudSignals(...);
// Should NOT emit event if severity === 'LOW'

const highSeverityResult = await scoringEngine.computeFraudSignals(...);
// SHOULD emit event if severity >= 'MEDIUM'
```
