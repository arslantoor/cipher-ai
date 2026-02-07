# Supervisor Agent

## Overview

The Supervisor Agent validates report quality and flags anomalies to reduce false confidence and increase trust in the autonomous system. It uses AI for validation only, never rewriting or modifying report content.

## Features

✅ **AI for Validation Only**: AI assesses quality, never modifies content  
✅ **Structured Feedback**: All feedback provided in structured format  
✅ **Completeness Checks**: Validates all required sections present  
✅ **Consistency Validation**: Checks score-severity alignment  
✅ **Anomaly Detection**: Flags weak justifications and missing timelines  
✅ **Cannot Change Reports**: Original report content is immutable  

## Architecture

```
ReportGenerated Event
    ↓
Supervisor Agent
    ↓
Deterministic Checks (no AI)
    ↓
AI Validation (quality assessment only)
    ↓
Calculate Validation Score
    ↓
Emit ReportApproved OR ReportNeedsReview
```

## Subscribed Events

- `REPORT_GENERATED`: Primary responsibility - validate reports
- `SUPERVISOR_REVIEW_REQUESTED`: Legacy investigation reviews
- `INVESTIGATION_CREATED`: Monitor for anomalies

## Validation Checks

### Deterministic Checks (No AI)

1. **Completeness**:
   - Executive summary present and > 50 chars
   - Fraud explanation present and > 100 chars
   - Timeline narrative present and > 50 chars
   - Risk justification present and > 50 chars

2. **Consistency**:
   - Structured data matches report metadata
   - Risk score matches severity classification
   - Timeline events present in structured data

3. **Section Presence**:
   - All required sections identified
   - Missing sections flagged

### AI Validation (Quality Assessment)

1. **Justification Strength**:
   - Weak: Insufficient explanation
   - Adequate: Basic explanation present
   - Strong: Clear, logical explanation

2. **Anomaly Detection**:
   - Contradictions in narrative
   - Gaps in explanation
   - Unclear cause-effect relationships

3. **Quality Feedback**:
   - Overall assessment
   - Specific issues identified
   - Recommendations (not modifications)

## Validation Score

**Calculation** (0-100):
- Base: 100
- Missing section: -15 each
- Consistency issue: -20
- Score-severity mismatch: -15
- High severity issue: -10 each
- Medium severity issue: -5 each
- Low severity issue: -2 each
- Weak justification: -15

**Thresholds**:
- **Passed**: Score >= 70 AND no high-severity issues
- **Needs Review**: Score < 70 OR high-severity issues present

## Emitted Events

### ReportApproved Event

```typescript
EventType.REPORT_APPROVED
{
  report_id: string;
  investigation_id: string;
  validation_score: number; // 0-100
  validation_notes: string;
  approved_at: string;
}
```

**Emitted when**:
- Validation score >= 70
- No high-severity issues
- All required sections present
- Consistency checks pass

### ReportNeedsReview Event

```typescript
EventType.REPORT_NEEDS_REVIEW
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
  flagged_at: string;
}
```

**Emitted when**:
- Validation score < 70
- High-severity issues detected
- Missing critical sections
- Consistency issues found

## Issue Types

### Completeness
- Missing required sections
- Sections too short
- Incomplete narratives

### Consistency
- Score-severity mismatch
- Structured data mismatch
- Metadata inconsistencies

### Missing Section
- Executive summary missing
- Fraud explanation missing
- Timeline missing
- Risk justification missing

### Weak Justification
- Insufficient explanation
- Unclear logic
- Missing cause-effect links

### Anomaly
- Contradictions
- Unusual patterns
- Quality concerns

## AI Validation Prompt

```
You are a quality assurance supervisor validating a fraud detection report.

CRITICAL CONSTRAINTS:
- You are VALIDATING only, NOT rewriting
- Provide structured feedback in JSON format
- Identify issues but do NOT modify content
- Assess justification strength
- Flag weak explanations

[Report content and context provided]

INSTRUCTION: Return JSON with issues, feedback, and justification_strength.

Focus on:
1. Is the justification clear and logical?
2. Are there any anomalies or contradictions?
3. Is the explanation sufficient for the severity level?
4. Are there gaps in the narrative?

Do NOT rewrite or modify the report. Only validate and provide feedback.
```

## Database Schema

### report_validations Table

```sql
CREATE TABLE report_validations (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  passed INTEGER NOT NULL CHECK(passed IN (0, 1)),
  validation_score INTEGER NOT NULL CHECK(validation_score >= 0 AND validation_score <= 100),
  issues TEXT NOT NULL,  -- JSON array
  feedback TEXT NOT NULL,
  structured_feedback TEXT NOT NULL,  -- JSON object
  validated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id)
);
```

## Structured Feedback

```typescript
{
  completeness_check: boolean;
  consistency_check: boolean;
  sections_present: string[];
  sections_missing: string[];
  justification_strength: 'weak' | 'adequate' | 'strong';
  timeline_present: boolean;
  score_severity_alignment: boolean;
}
```

## Usage Example

### Automatic Validation

When `ReportGenerated` event is emitted:

```typescript
// Report Generation Agent emits ReportGenerated
const reportEvent: ReportGeneratedEvent = {
  event_type: EventType.REPORT_GENERATED,
  payload: {
    report_id: 'rep-123',
    investigation_id: 'inv-456',
    // ...
  },
};

await eventBus.publish(reportEvent);

// Supervisor Agent automatically:
// 1. Fetches report from database
// 2. Runs deterministic checks
// 3. Runs AI validation
// 4. Calculates validation score
// 5. Emits ReportApproved or ReportNeedsReview
```

### Retrieve Validation Results

```typescript
const validation = db.prepare(`
  SELECT * FROM report_validations
  WHERE report_id = ?
  ORDER BY validated_at DESC
  LIMIT 1
`).get('rep-123');

const issues = JSON.parse(validation.issues);
const feedback = JSON.parse(validation.structured_feedback);
```

## Validation Flow

```
1. Receive ReportGenerated event
2. Fetch report from database
3. Run deterministic checks:
   - Check section completeness
   - Verify consistency
   - Validate score-severity alignment
4. Run AI validation:
   - Assess justification strength
   - Detect anomalies
   - Generate feedback
5. Calculate validation score
6. Store validation result
7. Emit ReportApproved OR ReportNeedsReview
```

## Goals

### Reduce False Confidence
- Flag reports with weak justifications
- Identify missing critical information
- Catch inconsistencies before publication

### Increase Trust in Autonomy
- Transparent validation process
- Structured feedback for improvement
- Clear pass/fail criteria

## AI Usage Rules

### ✅ AI IS USED FOR:
- Quality assessment
- Justification strength evaluation
- Anomaly detection
- Feedback generation

### ❌ AI NEVER:
- Rewrites report content
- Modifies scores or facts
- Changes structured data
- Alters original narrative

## Error Handling

- **AI Unavailable**: Falls back to deterministic checks only
- **Timeout**: 20-second timeout, graceful degradation
- **Parse Errors**: Fallback to text-based feedback
- **Database Errors**: Logged, event still emitted

## Production Considerations

1. **Validation History**: All validations stored for audit
2. **Feedback Loop**: Use validation results to improve report generation
3. **Monitoring**: Track validation scores, pass rates
4. **Thresholds**: Adjust validation thresholds based on business needs
5. **Performance**: AI validation is async, doesn't block report generation

## Testing

```typescript
// Test validation with complete report
const context: ReportValidationContext = {
  report_id: 'rep-123',
  executive_summary: 'Complete summary...',
  fraud_explanation: 'Complete explanation...',
  timeline_narrative: 'Complete timeline...',
  risk_justification: 'Complete justification...',
  // ...
};

const result = await validator.validateReport(context);
// Should pass if all sections present and consistent

// Test validation with missing section
const incompleteContext = {
  ...context,
  executive_summary: '', // Missing
};
// Should fail with missing_section issue
```
