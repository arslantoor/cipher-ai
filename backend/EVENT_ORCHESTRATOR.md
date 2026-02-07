# Event Orchestrator

## Purpose

Ensure safe and reliable event-driven communication between agents.

## Responsibilities

### 1. Receive and Dispatch Events

- Receive events from publishing agents
- Dispatch events to relevant agents based on event type
- Route events to subscribed handlers in priority order
- Maintain subscription registry

### 2. Guarantee Event Ordering and Delivery

- **FIFO Queue**: Events processed in first-in-first-out order
- **Sequence Numbers**: Each event assigned sequential number for ordering
- **Sequential Processing**: Events processed one at a time per agent (no parallel processing)
- **Delivery Guarantee**: Events are retried until successfully delivered or max retries exceeded

### 3. Log All Events for Auditing

- All events logged to `audit_logs` table
- Routing decisions logged to `routing_logs` table
- Event delivery status tracked
- PII redacted in logs (never log sensitive data)

### 4. Ensure No Sensitive PII Transmitted Without Encryption

- **Automatic Encryption**: PII fields encrypted before storage and transmission
- **Field-Level Encryption**: Specific fields encrypted (user_id, ip_address, device_fingerprint, etc.)
- **Automatic Decryption**: PII decrypted for agent consumption
- **Redaction for Logging**: PII redacted in audit logs

### 5. Handle Errors Gracefully and Retry Failed Event Delivery

- **Retry Logic**: Automatic retry with exponential backoff (max 3 attempts)
- **Error Logging**: All failures logged for investigation
- **Graceful Degradation**: System continues processing other events on failure
- **Dead Letter Queue**: Failed events logged for manual review

## Constraints

### 1. Do Not Modify Agent Internal Logic

- **Wrapper Pattern**: Events wrapped in delivery wrapper, but original handler called unchanged
- **No Logic Injection**: No modification to agent business logic
- **Transparent Delivery**: Agents receive events as-is (with decrypted PII)

### 2. Do Not Generate Outputs Except Logging and Routing

- **No Business Logic**: Orchestrator only handles routing and delivery
- **No Data Transformation**: Events passed through unchanged (except PII encryption/decryption)
- **Logging Only**: All outputs are audit logs and routing logs

## Architecture

### Event Flow

```
1. Agent publishes event
   ↓
2. EventOrchestrator.publish()
   - Validate event schema
   - Encrypt PII
   - Store in event_store
   - Add to ordered queue
   ↓
3. Queue Processor (runs every 100ms)
   - Process events in FIFO order
   - Assign sequence numbers
   - Deliver to subscribed agents
   ↓
4. Event Delivery
   - Decrypt PII for agent
   - Call agent handler
   - Mark as processed
   - Log delivery
```

### PII Encryption Flow

```
1. Event Published
   ↓
2. Encrypt PII Fields
   - user_id → encrypted
   - ip_address → encrypted
   - device_fingerprint → encrypted
   ↓
3. Store in Event Store (encrypted)
   ↓
4. Queue for Delivery
   ↓
5. Decrypt PII for Agent
   - Agents receive decrypted data
   ↓
6. Agent Processes Event
   ↓
7. Log Delivery (PII redacted)
```

## PII Fields

### Encrypted Fields

- `payload.user_id` - Encrypted, not redacted in logs
- `payload.transaction_data.ip_address` - Encrypted and redacted
- `payload.transaction_data.device_fingerprint` - Encrypted and redacted
- `payload.email` - Encrypted and redacted
- `payload.phone` - Encrypted and redacted
- `metadata.user_id` - Encrypted, not redacted
- `metadata.ip_address` - Encrypted and redacted

### Encryption Method

- **Algorithm**: AES-256 (via CryptoJS)
- **Key**: `ENCRYPTION_KEY` environment variable
- **Format**: Encrypted strings prefixed with `U2FsdGVkX1`

## Event Ordering

### Sequence Numbers

- Each event assigned sequential number on enqueue
- Events processed in sequence order
- Sequence numbers logged for audit trail

### Queue Processing

- **FIFO Queue**: Events processed first-in-first-out
- **Sequential Delivery**: Events delivered to agents in order
- **No Parallel Processing**: One event at a time per agent (ordering guarantee)

### Ordering Guarantees

- **Per-Agent Ordering**: Each agent receives events in order
- **Cross-Agent Ordering**: Events processed in global sequence
- **Replay Ordering**: Replayed events maintain original order

## Delivery Guarantees

### At-Least-Once Delivery

- Events retried until successfully delivered
- Idempotency checks prevent duplicate processing
- Max retries: 3 attempts with exponential backoff

### Retry Logic

```typescript
Retry 1: Immediate
Retry 2: 1 second delay
Retry 3: 2 seconds delay
Max Retries: 3
```

### Error Handling

- **Transient Errors**: Retried automatically
- **Permanent Errors**: Logged and skipped (system continues)
- **Handler Failures**: Logged, event marked as failed

## Audit Logging

### Event Published

```json
{
  "action": "EVENT_PUBLISHED",
  "resource_type": "event",
  "resource_id": "event-id",
  "details": {
    "event_type": "fraud.alert_created",
    "version": "1.0.0",
    "source_agent": "fraud_detection",
    "correlation_id": "correlation-id",
    "payload_summary": {
      "transaction_id": "txn-123",
      "severity": "high",
      "risk_score": 75
    }
  }
}
```

### Event Delivered

```json
{
  "action": "EVENT_DELIVERED_TO_AGENT",
  "resource_type": "event",
  "resource_id": "event-id",
  "details": {
    "agent_id": "investigation_report_generator",
    "event_type": "fraud.alert_created",
    "sequence": 12345
  }
}
```

### Routing Logs

Stored in `routing_logs` table:
- Event ID
- Event Type
- Matched Rules
- Actions Taken
- Context (timestamp, sequence, etc.)

## Queue Management

### Queue Size

- **Max Size**: 10,000 events
- **Overflow**: Events dropped if queue full (logged)
- **Monitoring**: Queue size tracked and logged

### Queue Statistics

```typescript
{
  size: number,        // Current queue size
  processing: boolean, // Is queue processor running
  sequence: number     // Last sequence number
}
```

## Error Scenarios

### 1. Queue Full

- Event dropped
- Error logged
- System continues processing

### 2. Handler Failure

- Event retried (max 3 times)
- Failure logged after max retries
- System continues with other events

### 3. Decryption Failure

- Encrypted value kept as-is
- Warning logged
- Event still delivered (agent handles)

### 4. Validation Failure

- Event rejected
- Error logged
- Event not queued

## Monitoring

### Metrics

- Queue size
- Processing rate
- Delivery success rate
- Retry count
- PII encryption/decryption operations

### Health Checks

- Queue processor running
- Event store accessible
- Encryption service available

## Configuration

### Environment Variables

- `ENCRYPTION_KEY`: AES encryption key (required)
- `MAX_QUEUE_SIZE`: Maximum queue size (default: 10000)
- `MAX_RETRIES`: Maximum retry attempts (default: 3)
- `RETRY_DELAY`: Base retry delay in ms (default: 1000)

### PII Field Configuration

PII fields configured in `piiFields` array:
```typescript
{
  path: ['payload', 'user_id'],
  encrypt: true,
  redact: false
}
```

## Integration

### EventBus Compatibility

EventBus delegates to EventOrchestrator:
- Same interface
- Backward compatible
- Enhanced features transparent

### Agent Integration

Agents use EventBus as before:
- No changes required
- Automatic PII encryption/decryption
- Transparent ordering and delivery

## Best Practices

1. **PII Handling**: Always encrypt sensitive data before transmission
2. **Error Handling**: Log all failures for investigation
3. **Ordering**: Rely on sequence numbers for ordering guarantees
4. **Retry Logic**: Use exponential backoff for retries
5. **Monitoring**: Track queue size and processing rate
6. **Audit Trail**: All events logged for compliance

## Example Usage

```typescript
// EventBus automatically uses EventOrchestrator
const eventBus = getEventBus();

// Publish event (PII automatically encrypted)
await eventBus.publish({
  event_id: 'evt-123',
  event_type: EventType.FRAUD_ALERT_CREATED,
  payload: {
    user_id: 'user-456', // Automatically encrypted
    ip_address: '1.2.3.4', // Automatically encrypted
    // ...
  }
});

// Get queue statistics
const stats = eventBus.getQueueStats();
console.log(`Queue size: ${stats.size}, Processing: ${stats.processing}`);
```

## Security

### Encryption

- All PII encrypted at rest (event_store)
- PII encrypted in transit (queue)
- PII decrypted only for agent consumption

### Redaction

- PII redacted in audit logs
- PII redacted in routing logs
- Never log sensitive data in plaintext

### Access Control

- Events accessible only to subscribed agents
- Idempotency prevents duplicate processing
- Audit trail for all access

## Compliance

- **GDPR**: PII encrypted and redacted
- **Audit Trail**: All events logged
- **Data Retention**: Events stored in event_store
- **Access Logging**: All deliveries logged
