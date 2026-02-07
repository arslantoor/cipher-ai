# Report Generation Agent

## Overview

The Report Generation Agent generates structured fraud detection reports using AI for language generation only. All scores, facts, and data remain deterministic and unmodified by AI.

## Features

✅ **AI for Language Only**: AI generates narrative text, never modifies scores/facts  
✅ **Structured Input**: All context provided as structured JSON  
✅ **Deterministic Output**: Report format is consistent and predictable  
✅ **Sensitive Data Redaction**: Automatically redacts PII and sensitive fields  
✅ **Retry & Timeout**: Robust error handling with retries and timeouts  
✅ **Multiple Report Types**: Internal, compliance, and full reports  

## Architecture

```
ReportRequested Event
    ↓
Report Generation Agent
    ↓
Fetch Fraud Data & Context
    ↓
Redact Sensitive Fields
    ↓
Generate Structured Data (Deterministic)
    ↓
Generate Narrative Sections (AI - Language Only)
    ↓
Build Markdown Report
    ↓
Store in Database
    ↓
Emit ReportGenerated Event
```

## Subscribed Events

- `REPORT_REQUESTED`: Triggers report generation

## Report Structure

### Markdown Sections

1. **Executive Summary** (100-150 words)
   - What fraud signals were detected
   - Why transaction was flagged
   - Risk level and severity

2. **Fraud Explanation** (200-250 words)
   - What signals were triggered and why
   - Comparison to historical baseline
   - Logical connection between signals and risk

3. **Timeline of Events** (150-200 words)
   - Chronological sequence
   - How events relate to fraud detection
   - Key decision points

4. **Risk Justification** (150-200 words)
   - Why risk score was assigned
   - How severity was determined
   - Relationship between signals and assessment

### Structured Data (JSON)

```json
{
  "severity": "HIGH",
  "risk_score": 75,
  "signals": {
    "amount_deviation": { ... },
    "velocity_anomaly": { ... },
    "geographic_inconsistency": { ... },
    "rule_flags": { ... }
  },
  "timeline_events": [
    { "timestamp": "...", "event": "..." }
  ]
}
```

## AI Usage Rules

### ✅ AI IS USED FOR:
- Generating narrative text (executive summary, explanations)
- Professional language transformation
- Cause → effect → justification structure
- Compliance-friendly wording

### ❌ AI NEVER:
- Modifies risk scores
- Changes severity classifications
- Alters fraud signals
- Modifies structured data
- Speculates or makes assumptions

## Prompt Templates

### Executive Summary Prompt

```
You are a fraud investigation analyst writing an executive summary.

CRITICAL CONSTRAINTS:
- Use neutral, investigator tone
- No speculation or assumptions
- State facts only
- Clear cause → effect → justification structure
- 100-150 words maximum

CONTEXT (JSON):
{ structured context }

INSTRUCTION: Write a concise executive summary explaining:
1. What fraud signals were detected
2. Why this transaction was flagged
3. The risk level and severity classification

Do NOT modify scores or facts. Only explain what happened in professional language.
```

### Fraud Explanation Prompt

```
You are a fraud investigation analyst explaining fraud detection findings.

CRITICAL CONSTRAINTS:
- Neutral, investigator tone
- No speculation
- Explain cause → effect → justification
- Reference specific signals and thresholds
- 200-250 words

FRAUD SIGNALS DETECTED:
{ signal details }

BASELINE COMPARISON:
{ baseline data }

INSTRUCTION: Explain:
1. What fraud signals were triggered and why
2. How current activity compares to historical baseline
3. The logical connection between signals and risk assessment

Do NOT modify scores. Only explain the detection logic in clear, professional language.
```

## Error Handling

### Retry Logic
- Max retries: 3
- Exponential backoff: 1s, 2s, 3s
- Fallback narrative if all retries fail

### Timeout Handling
- Default timeout: 30 seconds
- Promise.race() to enforce timeout
- Graceful degradation to fallback

### Fallback Narrative
```
[FALLBACK] AI generation unavailable. Report generated using deterministic data only. 
Please review structured data section for details.
```

## Sensitive Data Redaction

Automatically redacts:

- **User IDs**: Last 4 chars only (`***1234`)
- **IP Addresses**: `[REDACTED]`
- **Device Fingerprints**: `[REDACTED]`
- **PII Fields**: Removed from context

## Database Schema

### reports Table

```sql
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  transaction_id TEXT,
  fraud_detection_id TEXT,
  investigation_id TEXT,
  report_type TEXT NOT NULL CHECK(report_type IN ('internal', 'compliance', 'full')),
  severity TEXT NOT NULL CHECK(severity IN ('MEDIUM', 'HIGH', 'CRITICAL')),
  risk_score INTEGER NOT NULL CHECK(risk_score >= 0 AND risk_score <= 100),
  executive_summary TEXT NOT NULL,
  fraud_explanation TEXT NOT NULL,
  timeline_narrative TEXT NOT NULL,
  risk_justification TEXT NOT NULL,
  markdown_content TEXT NOT NULL,
  structured_data TEXT NOT NULL,
  generated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Report Types

### Internal Report
- Executive summary
- Fraud explanation
- Timeline
- Risk justification
- Structured data

### Compliance Report
- All internal sections
- Enhanced regulatory language
- Compliance-specific formatting
- Audit trail emphasis

### Full Report
- All compliance sections
- Extended analysis
- Additional context
- Complete documentation

## Event Flow

### Input Event
```typescript
EventType.REPORT_REQUESTED
{
  transaction_id?: string;
  fraud_detection_id?: string;
  investigation_id?: string;
  report_type: 'internal' | 'compliance' | 'full';
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_score: number;
  regulatory_impact: 'low' | 'medium' | 'high';
  requested_at: string;
}
```

### Output Event
```typescript
EventType.REPORT_GENERATED
{
  investigation_id: string;
  report_id: string;
  report_type: string;
  narrative?: string;
  generated_at: string;
  generation_time_ms: number;
}
metadata: {
  report_data: {
    markdown: string;
    structured: object;
  };
}
```

## Usage Example

### Automatic Generation

When `ReportRequested` event is emitted:

```typescript
// Orchestrator emits ReportRequested
const reportEvent: ReportRequestedEvent = {
  event_type: EventType.REPORT_REQUESTED,
  payload: {
    fraud_detection_id: 'fraud-123',
    report_type: 'compliance',
    severity: 'HIGH',
    risk_score: 75,
    // ...
  },
};

await eventBus.publish(reportEvent);

// Report Generation Agent automatically:
// 1. Fetches fraud detection data
// 2. Generates report sections
// 3. Stores in database
// 4. Emits ReportGenerated event
```

### Retrieve Report

```typescript
const report = db.prepare(`
  SELECT * FROM reports
  WHERE fraud_detection_id = ?
`).get('fraud-123');

const structured = JSON.parse(report.structured_data);
const markdown = report.markdown_content;
```

## Prompt Engineering Principles

1. **Structured Input**: Always provide context as JSON
2. **Clear Constraints**: Explicitly state what AI can/cannot do
3. **Tone Guidance**: Specify neutral, investigator tone
4. **Length Limits**: Enforce word counts
5. **No Speculation**: Explicitly forbid assumptions
6. **Cause-Effect**: Require clear logical flow

## Quality Assurance

### Deterministic Checks
- Structured data is always generated deterministically
- Scores and facts never modified by AI
- Report format is consistent

### Language Quality
- Professional, neutral tone
- Compliance-friendly language
- Clear cause → effect → justification
- No speculation or assumptions

## Production Considerations

1. **API Rate Limits**: Implement rate limiting for Gemini API
2. **Caching**: Cache reports for same fraud detection
3. **Versioning**: Track report template versions
4. **Monitoring**: Track generation times, success rates
5. **Cost Optimization**: Use appropriate model (flash for speed, pro for quality)

## Testing

```typescript
// Test report generation
const context: ReportContext = {
  user_id: 'user-123',
  severity: 'HIGH',
  risk_score: 75,
  fraud_signals: { ... },
  // ...
};

const report = await reportGenerator.generateReport(context, 'compliance');

// Verify:
// - Structured data is deterministic
// - Markdown is well-formed
// - No scores modified
// - Sensitive data redacted
```

## Compliance

- **Audit Trail**: All reports stored with full context
- **Data Retention**: Reports retained per compliance policy
- **Access Control**: Reports accessible only to authorized users
- **Redaction**: PII automatically redacted
- **Explainability**: All scores and classifications are explainable
