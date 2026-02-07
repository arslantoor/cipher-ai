# Agent Lifecycle Pattern

## Overview

All agents in the multi-agent event-driven system follow a standardized lifecycle pattern. This ensures consistent behavior, auditability, and system reliability.

## Lifecycle Stages

### 1. INIT (Initialization)

**Purpose**: Initialize internal state, connect to required services, and subscribe to events relevant to the agent's role.

**What happens**:
- Agent registers itself in the agent registry
- Connects to required services (database, event bus, external APIs)
- Initializes internal state (caches, configuration, models)
- Subscribes to relevant event types
- Starts health monitoring (heartbeat)

**Implementation**:
```typescript
async start(): Promise<void> {
    // INIT phase
    this.registerAgent();
    this.setupSubscriptions();
    this.startHeartbeat();
    await this.onStart(); // Hook for subclass initialization
}
```

**Rules**:
- Must be idempotent (can be called multiple times safely)
- Must not start processing events until fully initialized
- Must log initialization status

### 2. LISTEN (Event Listening)

**Purpose**: Continuously listen for incoming events, messages, or notifications. Only act on events relevant to the agent's responsibilities.

**What happens**:
- Agent subscribes to specific event types via EventBus
- Event handlers are registered with appropriate priorities
- Agent remains idle until relevant events arrive
- Events are queued and processed asynchronously

**Implementation**:
```typescript
protected setupSubscriptions(): void {
    // Subscribe to relevant event types
    this.subscribe(EventType.TRANSACTION_INGESTED, this.handleEvent.bind(this), 10);
}
```

**Rules**:
- Only subscribe to events within agent's responsibilities
- Use priority to control processing order
- Never block the event loop
- Handle events asynchronously

### 3. ANALYZE (Processing)

**Purpose**: Process incoming events using deterministic or AI-based logic. Perform pattern recognition, anomaly detection, or data enrichment as required.

**What happens**:
- Event handler receives event
- Validates event structure and idempotency
- Performs analysis (deterministic scoring, AI inference, data enrichment)
- Generates insights, scores, or enriched data
- Logs all analysis steps for audit

**Implementation**:
```typescript
private async handleEvent(event: TransactionIngestedEvent): Promise<void> {
    // ANALYZE phase
    const result = await this.analyzeTransaction(event.payload);
    // EMIT phase follows...
}
```

**Rules**:
- **Never predict trading outcomes or make trading decisions**
- All analysis must be deterministic where possible
- AI is only used for explanation, summarization, content transformation
- All analysis steps must be logged
- Respect idempotency (same event → same result)

### 4. EMIT (Output Generation)

**Purpose**: Generate outputs based on analysis. Emit events, reports, or notifications to other agents or external systems.

**What happens**:
- Agent generates structured output (events, reports, alerts)
- Outputs are validated before emission
- Events are published to EventBus
- Reports/data are persisted to database
- Audit logs are created

**Implementation**:
```typescript
// EMIT phase
const outputEvent = EventFactory.createFraudDetected({
    // ... payload
}, this.agentId, event.correlation_id);

await this.publish(outputEvent);
```

**Rules**:
- All outputs must be auditable, logged, and traceable
- Use correlation_id to link related events
- Never expose sensitive data in logs or outputs
- Validate outputs before emission
- Follow event schema standards

### 5. TERMINATE / IDLE

**Purpose**: Clean up temporary state if needed, remain ready for new events. Never stop unless explicitly told to shut down.

**What happens**:
- Agent remains in LISTEN state after processing
- Temporary state is cleaned up after each event
- Agent stays active until explicit shutdown
- On shutdown: unsubscribes, stops heartbeat, cleans up resources

**Implementation**:
```typescript
async stop(): Promise<void> {
    // TERMINATE phase
    this.isRunning = false;
    this.stopHeartbeat();
    this.unregisterAgent();
    this.eventBus.unsubscribe(this.agentId);
    await this.onStop(); // Hook for subclass cleanup
}
```

**Rules**:
- Agents run continuously (never auto-terminate)
- Clean up temporary state after each event
- Maintain persistent state in database only
- Only stop on explicit shutdown command

## Agent Responsibilities

### Core Rules

1. **Scope**: Each agent may only act within its responsibilities
   - Fraud Detection Agent: Only processes fraud-related events
   - Orchestrator Agent: Only routes events
   - Report Generation Agent: Only generates reports
   - Supervisor Agent: Only validates reports

2. **No Trading Decisions**: Agents must never predict trading outcomes or make trading decisions
   - No buy/sell signals
   - No price forecasts
   - No trade recommendations
   - Only analysis, explanation, and reporting

3. **Auditability**: All outputs must be auditable, logged, and traceable
   - Every action logged via AuditService
   - Events include correlation_id for tracing
   - Database records for all persistent data
   - Timestamps on all operations

4. **Event-Based Communication**: Communication between agents must follow event-based messaging
   - No direct function calls between agents
   - All communication via EventBus
   - Events follow shared schema
   - Events are versioned and validated

5. **Security**: Respect system security: never expose sensitive data in logs or outputs
   - Redact PII before logging
   - Mask sensitive fields in events
   - Use secure storage for credentials
   - Follow data retention policies

## State Management

### Stateless Agents

Agents are designed to be stateless:
- No in-memory state between events
- All state persisted in database
- Event processing is idempotent
- Can be horizontally scaled

### State Storage

Persistent state is stored in:
- `agent_registry`: Agent status and health
- `event_store`: All events for replay
- `event_processing_log`: Idempotency tracking
- Agent-specific tables (fraud_detections, reports, etc.)

## Error Handling

### Retry Logic

- Events are retried on failure (max 3 attempts)
- Exponential backoff between retries
- Failed events are logged for manual review

### Failure Modes

1. **Transient Failures**: Retry automatically
2. **Validation Failures**: Log and skip (invalid event)
3. **System Failures**: Log, alert, and continue with other events
4. **Agent Crashes**: Agent manager restarts agent

## Monitoring

### Health Checks

- Heartbeat every 30 seconds
- Agent status in `agent_registry`
- Event processing metrics
- Error rate tracking

### Observability

- All actions logged via AuditService
- Event correlation via correlation_id
- Performance metrics (processing time, queue depth)
- Error tracking and alerting

## Example: Complete Lifecycle

```typescript
// 1. INIT
await agent.start();
// → Registers in DB
// → Subscribes to EventType.TRANSACTION_INGESTED
// → Starts heartbeat

// 2. LISTEN
// Agent waits for events...

// 3. ANALYZE (when event arrives)
handleTransactionIngested(event) {
    // Validate event
    // Check idempotency
    // Run fraud scoring (deterministic)
    // Generate explanation (AI)
}

// 4. EMIT
// Publish FraudDetected event
// Persist fraud_detection record
// Log action

// 5. IDLE
// Return to LISTEN state
// Ready for next event
```

## Best Practices

1. **Idempotency**: Always check if event already processed
2. **Validation**: Validate all inputs and outputs
3. **Logging**: Log all significant actions
4. **Error Handling**: Gracefully handle errors, don't crash
5. **Performance**: Process events asynchronously, don't block
6. **Security**: Redact sensitive data, validate inputs
7. **Testing**: Test each lifecycle stage independently
