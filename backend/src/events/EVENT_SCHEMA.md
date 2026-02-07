# Event Schema Documentation

## Overview

All events in the system follow a shared, versioned schema that ensures type safety, replay capability, and interoperability between agents.

## Base Event Schema

Every event must include these base fields:

```typescript
{
  event_id: string;           // UUID, unique identifier
  event_type: string;          // Event type identifier
  version: string;            // Schema version (semver, e.g., "1.0.0")
  timestamp: string;          // ISO 8601 timestamp
  source_agent?: string;      // Agent that generated the event
  correlation_id?: string;    // For event tracing/correlation
  payload: object;            // Event-specific data
  metadata?: object;           // Additional metadata
}
```

## Schema Version

Current version: **1.0.0**

Version format: `MAJOR.MINOR.PATCH` (semver)
- **MAJOR**: Breaking changes to base schema
- **MINOR**: New event types or optional fields
- **PATCH**: Bug fixes, documentation updates

## Defined Events

### 1. TransactionIngested

**Type**: `transaction.ingested`

**Payload**:
```typescript
{
  transaction_id: string;
  user_id: string;
  amount: number;
  timestamp: string; // ISO 8601
  transaction_data: {
    location?: {
      city: string;
      country: string;
      lat: number;
      lng: number;
    };
    device_fingerprint?: string;
    ip_address?: string;
    [key: string]: any;
  };
}
```

**Example**:
```json
{
  "event_id": "evt-123",
  "event_type": "transaction.ingested",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "source_agent": "api",
  "payload": {
    "transaction_id": "txn-456",
    "user_id": "user-789",
    "amount": 1000,
    "timestamp": "2024-01-15T10:30:00Z",
    "transaction_data": {
      "location": {
        "city": "New York",
        "country": "USA",
        "lat": 40.7128,
        "lng": -74.0060
      }
    }
  }
}
```

### 2. FraudDetected

**Type**: `fraud.detected`

**Payload**:
```typescript
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
  detected_at: string; // ISO 8601
}
```

### 3. ReportRequested

**Type**: `report.requested`

**Payload**:
```typescript
{
  transaction_id?: string;
  fraud_detection_id?: string;
  investigation_id?: string;
  report_type: 'internal' | 'compliance' | 'full';
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_score: number; // 0-100
  regulatory_impact: 'low' | 'medium' | 'high';
  requested_at: string; // ISO 8601
}
```

### 4. ReportGenerated

**Type**: `report.generated`

**Payload**:
```typescript
{
  investigation_id: string;
  report_id: string;
  report_type: string;
  narrative?: string;
  generated_at: string; // ISO 8601
  generation_time_ms: number;
}
```

**Metadata** (optional):
```typescript
{
  report_data?: {
    markdown?: string;
    structured?: object;
  };
}
```

### 5. EscalationTriggered

**Type**: `orchestrator.escalation_triggered`

**Payload**:
```typescript
{
  transaction_id?: string;
  fraud_detection_id?: string;
  investigation_id?: string;
  severity: 'CRITICAL';
  risk_score: number; // 0-100
  escalation_reason: string;
  escalation_level: 'senior_analyst' | 'compliance_team' | 'executive';
  regulatory_impact: 'high';
  triggered_at: string; // ISO 8601
}
```

### 6. ReportApproved

**Type**: `report.approved`

**Payload**:
```typescript
{
  report_id: string;
  investigation_id: string;
  validation_score: number; // 0-100
  validation_notes: string;
  approved_at: string; // ISO 8601
}
```

### 7. ReportNeedsReview

**Type**: `report.needs_review`

**Payload**:
```typescript
{
  report_id: string;
  investigation_id: string;
  validation_score: number; // 0-100
  issues: Array<{
    type: 'completeness' | 'consistency' | 'missing_section' | 'weak_justification' | 'anomaly';
    severity: 'low' | 'medium' | 'high';
    description: string;
    section?: string;
  }>;
  feedback: string;
  requires_regeneration: boolean;
  flagged_at: string; // ISO 8601
}
```

## Type Safety

### TypeScript Types

```typescript
import { 
  TransactionIngestedEvent,
  FraudDetectedEvent,
  ReportRequestedEvent,
  // ... etc
  SystemEvent 
} from './events/schema';
```

### Event Factory

Use factory functions to create type-safe events:

```typescript
import { EventFactory } from './events/schema';

const event = EventFactory.createTransactionIngested({
  transaction_id: 'txn-123',
  user_id: 'user-456',
  amount: 1000,
  timestamp: new Date().toISOString(),
  transaction_data: {},
}, 'fraud_detection_agent');
```

## Validation

### Automatic Validation

Events are automatically validated when published:

```typescript
const validation = EventValidator.validate(event);
if (!validation.valid) {
  // Handle errors
  console.error(validation.errors);
}
```

### Validation Middleware

Wrap event handlers with validation:

```typescript
import { withValidation } from './events/middleware';

const handler = withValidation(async (event: FraudDetectedEvent) => {
  // Handler code
  // Event is guaranteed to be valid
});
```

## Serialization

### Serialize for Storage/Replay

```typescript
const json = EventValidator.serialize(event);
// Store in database, queue, etc.
```

### Deserialize with Validation

```typescript
const event = EventValidator.deserialize(json);
// Event is validated and typed
```

## Replay Safety

Events are replay-safe if they have:
1. Unique `event_id`
2. Valid `timestamp`
3. Complete `payload`

Check replay safety:

```typescript
if (EventValidator.isReplaySafe(event)) {
  // Safe to replay
}
```

## Version Compatibility

### Current Version
- **1.0.0**: Initial schema

### Version Checking

```typescript
import { withVersionCheck } from './events/middleware';

const handler = withVersionCheck(
  myHandler,
  ['1.0.0', '1.1.0'] // Supported versions
);
```

### Migration Strategy

When schema version changes:
1. Support multiple versions during transition
2. Migrate events on deserialization
3. Store events with original version
4. Replay uses original version

## JSON Schema

Full JSON Schema definitions available in `jsonSchema.ts`:

```typescript
import { getEventSchema } from './events/jsonSchema';

const schema = getEventSchema('fraud.detected');
// Use with JSON Schema validators
```

## Best Practices

1. **Always use EventFactory**: Ensures correct structure
2. **Validate on publish**: EventBus validates automatically
3. **Use correlation_id**: For event tracing
4. **Set source_agent**: For audit trails
5. **Version events**: Include version field
6. **Replay-safe**: Ensure events can be replayed

## Error Codes

Validation errors include codes:

- `MISSING_EVENT_ID`: event_id is missing
- `MISSING_EVENT_TYPE`: event_type is missing
- `MISSING_VERSION`: version is missing
- `MISSING_TIMESTAMP`: timestamp is missing
- `MISSING_PAYLOAD`: payload is missing
- `INVALID_EVENT_TYPE`: Unknown event type
- `INVALID_TIMESTAMP`: Invalid ISO 8601 format
- `INVALID_RANGE`: Value out of allowed range
- `INVALID_VALUE`: Value not in allowed enum
- `MISSING_FIELD`: Required field missing
- `INVALID_TYPE`: Wrong data type

## Example: Complete Event Flow

```typescript
// 1. Create event using factory
const event = EventFactory.createFraudDetected({
  transaction_id: 'txn-123',
  user_id: 'user-456',
  fraud_detection_id: 'fraud-789',
  risk_score: 75,
  severity: 'HIGH',
  signals: { ... },
  explanation: '...',
  detected_at: new Date().toISOString(),
}, 'fraud_detection_agent');

// 2. Validate (automatic in EventBus)
const validation = EventValidator.validate(event);
console.log(validation.valid); // true

// 3. Serialize for storage
const json = EventValidator.serialize(event);

// 4. Publish (validates automatically)
await eventBus.publish(event);

// 5. Deserialize later (with validation)
const replayed = EventValidator.deserialize(json);
```
