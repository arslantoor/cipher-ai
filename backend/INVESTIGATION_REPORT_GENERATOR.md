# Investigation / Report Generator Agent

## Agent Role: INVESTIGATION / REPORT GENERATOR

**Purpose**: Generate human-readable investigation narratives and actionable summaries for detected fraud events.

## Lifecycle Responsibilities

### 1. INIT: Initialize and Subscribe

**Responsibilities**:
- Subscribe to `FRAUD_ALERT_CREATED` events from Fraud Detector Agent
- Initialize AI model (Google Gemini) for narrative generation
- Load processed alert IDs from database to avoid duplicates

**Implementation**:
- `onStart()` hook initializes AI model (handled by `ReportGenerator` constructor)
- Loads processed alert IDs from `reports` table
- Maintains in-memory set of processed alerts for fast lookup

### 2. LISTEN: Receive Fraud Alerts

**Responsibilities**:
- Receive fraud alerts with all associated metadata and anomaly scores
- Only process `FRAUD_ALERT_CREATED` events
- Ignore unrelated system messages

**Implementation**:
- Subscribes to `EventType.FRAUD_ALERT_CREATED` events
- Priority: 5 (standard priority)
- Events include:
  - Alert ID
  - User ID
  - Severity (low, medium, high, critical)
  - Risk score (0-100)
  - Metadata: transaction_id, signals (amount_deviation, velocity_anomaly, etc.)

### 3. ANALYZE: Process and Generate

**Responsibilities**:
- Validate the alert data for completeness and correctness
- Correlate with historical user behavior and prior alerts
- Apply AI model to generate professional, compliance-ready investigation summary

**Implementation**:

#### Validation
- Checks for required fields: `alert_id`, `user_id`, `severity`, `score`
- Validates severity enum: `low`, `medium`, `high`, `critical`
- Validates score range: 0-100
- Throws error if validation fails

#### Correlation
- Counts prior alerts for the user
- Retrieves user activity summary (account age, transaction count)
- Finds similar patterns (alerts with similar severity/score)
- Includes correlation data in report context

#### AI Generation
- Uses Google Gemini for narrative generation
- Generates 180-220 word investigation narrative
- Ensures compliance-ready, professional language
- Neutral, investigator tone
- No speculation, only facts

### 4. EMIT: Output Investigation Report

**Responsibilities**:
- Output detailed investigation report including:
  - Detected anomaly
  - Severity classification
  - Timeline of events
  - AI-generated narrative (180-220 words)
  - Recommended next steps (for audit trail)

**Implementation**:
- Generates structured investigation report
- Stores report in `reports` table
- Emits `REPORT_GENERATED` event
- Report includes:
  - Executive Summary
  - Detected Anomaly section
  - Severity Classification
  - Timeline of Events
  - Investigation Narrative (180-220 words, AI-generated)
  - Fraud Explanation
  - Recommended Next Steps (for audit trail)
  - Structured Data (JSON)

**Report Structure**:
```markdown
# Investigation Report

## Executive Summary
[AI-generated summary]

## Detected Anomaly
- Amount Deviation: [explanation]
- Velocity Anomaly: [explanation]
- Geographic Inconsistency: [explanation]
- Rule Flags: [list]

## Severity Classification
Severity: [MEDIUM/HIGH/CRITICAL]
Risk Score: [0-100]

## Timeline of Events
[Chronological event list]

## Investigation Narrative
[180-220 words, AI-generated, professional, compliance-ready]

## Fraud Explanation
[Detailed explanation of fraud signals]

## Recommended Next Steps
1. [Action for audit trail]
2. [Action for audit trail]
...

## Structured Data
[JSON format]
```

### 5. TERMINATE / IDLE: Maintain Readiness

**Responsibilities**:
- Maintain readiness for next alerts
- Archive processed alert IDs to avoid duplicates
- Never halt processing loop unless explicitly instructed

**Implementation**:
- Maintains in-memory set of processed alert IDs
- Archives processed alerts in database (`reports` table)
- Returns to LISTEN state after processing
- Only stops on explicit `stop()` call

## Constraints

### 1. Summary Generation Only
- **Rule**: Must only generate summaries; do not flag or block accounts
- **Implementation**: Agent only generates reports, never takes action
- **Rationale**: Agent is reporting-only; enforcement handled by other systems

### 2. Human-Readable and Auditable
- **Rule**: Ensure all narratives are human-readable and auditable
- **Implementation**: 
  - AI generates professional, clear language
  - All reports stored in database
  - All actions logged via `AuditService`
  - Reports include structured data for programmatic access

### 3. No Trading Decisions
- **Rule**: Do not make trading decisions
- **Implementation**: Agent only generates reports, never modifies accounts or trades
- **Rationale**: Agent is investigation/reporting-only

## Report Generation Process

### 1. Alert Validation
```typescript
validateAlertData(event) {
    // Check required fields
    // Validate severity enum
    // Validate score range
    // Return validation result
}
```

### 2. Historical Correlation
```typescript
correlateWithHistory(userId, alertId) {
    // Count prior alerts
    // Get user activity summary
    // Find similar patterns
    // Return correlation data
}
```

### 3. Context Building
```typescript
fetchReportContext(transactionId, fraudDetectionId) {
    // Load fraud detection data
    // Build timeline
    // Calculate baseline
    // Include correlation data
    // Return report context
}
```

### 4. AI Narrative Generation
```typescript
generateInvestigationNarrative(context) {
    // Build prompt with context
    // Call Gemini API
    // Ensure 180-220 words
    // Return narrative
}
```

### 5. Report Assembly
```typescript
buildMarkdownReport(data) {
    // Combine all sections
    // Format as markdown
    // Include structured data
    // Return complete report
}
```

## AI Usage Rules

### Language Generation Only
- AI is ONLY used for language generation
- AI never modifies scores or facts
- Input context is structured JSON
- Output format is deterministic

### Prompt Guidelines
- Neutral, investigator tone
- No speculation
- Clear cause → effect → justification
- Compliance-friendly language
- Professional terminology

### Word Count Control
- Investigation narrative: 180-220 words
- Automatic expansion if too short
- Automatic compression if too long
- Retry logic with word count validation

## Database Schema

### reports
- `id`: Report ID
- `transaction_id`: Transaction ID (optional)
- `fraud_detection_id`: Alert/Fraud Detection ID
- `investigation_id`: Investigation ID (optional)
- `report_type`: internal, compliance, or full
- `severity`: MEDIUM, HIGH, CRITICAL
- `risk_score`: 0-100
- `executive_summary`: AI-generated summary
- `fraud_explanation`: Detailed explanation
- `timeline_narrative`: Timeline text
- `risk_justification`: Risk assessment
- `markdown_content`: Complete markdown report
- `structured_data`: JSON structured data
- `generated_at`: Generation timestamp

## Event Flow

```
1. Fraud Detector Agent → FRAUD_ALERT_CREATED Event
2. Investigation / Report Generator Agent (LISTEN) → Receives alert
3. Investigation / Report Generator Agent (ANALYZE) → Validates, correlates, generates
4. Investigation / Report Generator Agent (EMIT) → Publishes REPORT_GENERATED
5. Supervisor Agent / Other Agents → Receive report for review
```

## Error Handling

### Validation Failures
- Invalid alert data → Log error, skip processing
- Missing required fields → Throw error, emit REPORT_FAILED event

### AI Generation Failures
- API timeout → Retry with exponential backoff (max 3 attempts)
- API error → Use fallback narrative
- Word count issues → Adjust and retry

### Idempotency
- Checks if alert already processed
- Skips duplicate processing
- Maintains archive of processed alerts

## Monitoring

### Health Checks
- Heartbeat every 30 seconds
- Status tracked in `agent_registry`
- All actions logged via `AuditService`

### Metrics
- Reports generated
- Processing time per report
- AI generation time
- Validation failures
- Correlation data accuracy

## Example Usage

```typescript
// Agent is started by AgentManager
const reportAgent = new ReportGenerationAgent();
await reportAgent.start();

// Agent automatically:
// 1. Subscribes to FRAUD_ALERT_CREATED events
// 2. Validates alerts
// 3. Correlates with history
// 4. Generates investigation reports
// 5. Emits REPORT_GENERATED events

// Get processed alerts count
const processedCount = reportAgent.processedAlertIds.size;
```

## Integration Points

### Input Events
- `FRAUD_ALERT_CREATED`: Primary input event from Fraud Detector Agent

### Output Events
- `REPORT_GENERATED`: Emitted when investigation report is complete
- `REPORT_FAILED`: Emitted if report generation fails

### Downstream Agents
- **Supervisor Agent**: Receives reports for quality validation
- **Orchestrator Agent**: Routes reports based on severity
- **External Systems**: Can consume reports via API

## Compliance

- All reports are human-readable and auditable
- All actions logged via `AuditService`
- Reports include recommended next steps for audit trail
- No account flagging or blocking (summary generation only)
- AI usage is transparent and explainable
- All narratives are compliance-ready

## Best Practices

1. **Validation**: Always validate alert data before processing
2. **Correlation**: Use historical data to enrich reports
3. **Word Count**: Ensure narratives are within 180-220 words
4. **Error Handling**: Gracefully handle AI failures with fallbacks
5. **Idempotency**: Check for duplicates before processing
6. **Audit Trail**: Include recommended next steps in all reports
7. **No Actions**: Never flag or block accounts, only generate summaries
