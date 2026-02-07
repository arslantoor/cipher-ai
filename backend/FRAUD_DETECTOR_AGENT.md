# Fraud Detection Agent

## Agent Role: FRAUD DETECTOR

**Purpose**: Detect anomalies and potential fraud events in real time from trading platform notifications.

## Lifecycle Responsibilities

### 1. INIT: Initialize and Connect

**Responsibilities**:
- Connect to trading platform event streams and system event bus
- Initialize baseline behavior models for accounts and transactions
- Register agent in agent registry
- Start health monitoring (heartbeat)

**Implementation**:
- `onStart()` hook initializes baseline models for existing accounts
- Loads transaction history from `fraud_detections` and `event_store`
- Builds baseline models using `BaselineAnalyzer`
- Stores baseline models in memory for fast access

### 2. LISTEN: Continuous Event Monitoring

**Responsibilities**:
- Continuously receive all trading events (deposits, withdrawals, trades)
- Ignore unrelated system messages
- Only process events relevant to fraud detection

**Implementation**:
- Subscribes to `EventType.TRANSACTION_INGESTED` events
- High priority (10) to ensure timely processing
- Can be extended to subscribe to additional trading event types:
  - `EventType.DEPOSIT_RECEIVED`
  - `EventType.WITHDRAWAL_RECEIVED`
  - `EventType.TRADE_EXECUTED`

### 3. ANALYZE: Deterministic Fraud Detection

**Responsibilities**:
- Apply deterministic scoring to detect abnormal behavior
- Flag deviations in:
  - Transaction amounts (vs historical baseline)
  - Transaction frequency (velocity anomalies)
  - Geographic location (location inconsistency)
  - Device fingerprints (device changes)
- Attach metadata:
  - Account ID (`user_id`)
  - Event timestamp
  - Anomaly score (`risk_score` 0-100)
  - Severity level (LOW, MEDIUM, HIGH, CRITICAL)

**Implementation**:
- Uses `FraudScoringEngine` for deterministic scoring (NO AI)
- Checks idempotency (same transaction → same result)
- Updates baseline models after each transaction
- Persists fraud detection results to `fraud_detections` table

**Scoring Signals**:
1. **Amount Deviation**: Compares transaction amount to historical average
2. **Velocity Anomaly**: Detects unusual transaction frequency
3. **Geographic Inconsistency**: Flags new countries/cities or large distances
4. **Rule-Based Flags**: Applies configurable rules (new account, after hours, etc.)

### 4. EMIT: Fraud Alert Generation

**Responsibilities**:
- Publish `FRAUD_ALERT_CREATED` events with relevant data
- Target: Investigation Agent (or downstream agents)
- Never execute or block trades

**Implementation**:
- Emits `EventType.FRAUD_ALERT_CREATED` events
- Includes:
  - Alert ID (fraud_detection_id)
  - User ID
  - Alert type: `fraud_anomaly`
  - Severity: `low`, `medium`, `high`, `critical`
  - Risk score (0-100)
  - Timestamp
  - Metadata: transaction_id, signals (amount_deviation, velocity_anomaly, etc.)

**Event Structure**:
```typescript
{
  event_type: 'fraud.alert_created',
  payload: {
    alert_id: string,
    user_id: string,
    alert_type: 'fraud_anomaly',
    severity: 'low' | 'medium' | 'high' | 'critical',
    score: number, // 0-100
    timestamp: string
  },
  metadata: {
    transaction_id: string,
    signals: {
      amount_deviation: number,
      velocity_anomaly: number,
      geographic_inconsistency: number,
      rule_flags: string[]
    }
  }
}
```

### 5. TERMINATE / IDLE: Continuous Operation

**Responsibilities**:
- Maintain baseline models for continuous detection
- Never halt detection loop unless explicitly instructed
- Clean up resources only on explicit shutdown

**Implementation**:
- Baseline models are updated after each transaction
- Models stored in memory for performance
- Agent remains in LISTEN state after processing
- Only stops on explicit `stop()` call

## Constraints

### 1. No Narrative Generation
- **Rule**: Do not generate narrative or investigation summaries
- **Implementation**: Agent only emits structured alerts with metadata
- **Rationale**: Narrative generation is the responsibility of Report Generation Agent

### 2. No Trade Execution or Blocking
- **Rule**: Never execute or block trades
- **Implementation**: Agent only emits alerts; no trade actions
- **Rationale**: Agent is detection-only; enforcement is handled by other systems

### 3. Deterministic Scoring Only
- **Rule**: All fraud detection must be deterministic and explainable
- **Implementation**: Uses `FraudScoringEngine` with configurable thresholds
- **Rationale**: Ensures auditability and compliance

## Baseline Model Management

### Initialization (INIT)
- Loads existing transaction history from database
- Builds baseline models for all accounts with transaction history
- Stores models in memory for fast access

### Maintenance (IDLE)
- Updates baseline models after each transaction
- Recalculates:
  - Average transaction amount
  - Average transactions per day
  - Typical transaction hours
  - Common locations
  - Device consistency
  - Account maturity

### Storage
- Baseline models stored in memory (`Map<string, Baseline>`)
- Transaction history loaded from:
  - `fraud_detections` table
  - `event_store` table (for transaction events)

## Configuration

### Fraud Detection Thresholds
- Amount deviation thresholds (5x, 10x baseline)
- Velocity thresholds (transactions per window)
- Geographic thresholds (new country/city scores)
- Rule-based flags (configurable per rule)

### Runtime Updates
- Configuration can be updated via `updateConfiguration()`
- Changes apply to subsequent transactions
- All configuration changes are logged

## Event Flow

```
1. Trading Platform → TransactionIngested Event
2. Fraud Detection Agent (LISTEN) → Receives event
3. Fraud Detection Agent (ANALYZE) → Computes fraud signals
4. Fraud Detection Agent (EMIT) → Publishes FRAUD_ALERT_CREATED
5. Investigation Agent → Receives alert for investigation
```

## Database Schema

### fraud_detections
- `id`: Fraud detection ID
- `transaction_id`: Transaction ID (unique)
- `user_id`: User account ID
- `risk_score`: 0-100
- `severity`: LOW, MEDIUM, HIGH, CRITICAL
- `signals`: JSON (amount_deviation, velocity_anomaly, etc.)
- `explanation`: Deterministic explanation
- `config_used`: Configuration snapshot
- `detected_at`: Detection timestamp
- `processed_at`: Processing timestamp

## Monitoring

### Health Checks
- Heartbeat every 30 seconds
- Status tracked in `agent_registry`
- All actions logged via `AuditService`

### Metrics
- Transactions processed
- Fraud alerts generated
- Baseline models maintained
- Processing time per transaction
- Error rate

## Error Handling

### Idempotency
- Checks if transaction already processed
- Same transaction → same result
- Prevents duplicate processing

### Error Recovery
- Errors logged but don't stop agent
- Failed transactions logged for manual review
- Agent continues processing other events

## Example Usage

```typescript
// Agent is started by AgentManager
const fraudAgent = new FraudDetectionAgent();
await fraudAgent.start();

// Agent automatically:
// 1. Initializes baseline models
// 2. Subscribes to TransactionIngested events
// 3. Processes events as they arrive
// 4. Emits FRAUD_ALERT_CREATED events

// Update configuration at runtime
fraudAgent.updateConfiguration({
    amount_deviation_5x_threshold: 6.0,
    velocity_threshold_transactions: 12,
});

// Get baseline model for account
const baseline = fraudAgent.getBaselineModel('user-123');
```

## Integration Points

### Input Events
- `TransactionIngested`: Primary input event

### Output Events
- `FraudAlertCreated`: Emitted when fraud/anomaly detected

### Downstream Agents
- **Investigation Agent**: Receives fraud alerts for investigation
- **Orchestrator Agent**: Routes alerts based on severity
- **Report Generation Agent**: Generates reports from alerts (not narratives)

## Compliance

- All actions audited via `AuditService`
- Deterministic scoring ensures explainability
- No AI used for scoring (only for explanations in other agents)
- All events include correlation IDs for tracing
- Baseline models maintain account behavior history
