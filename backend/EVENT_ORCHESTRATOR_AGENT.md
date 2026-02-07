# Event Orchestrator Agent

## Overview

The Event Orchestrator Agent is a rule-engine-based routing system that processes fraud-related events and routes them to downstream agents based on configurable rules. It uses a declarative rule engine approach instead of hard-coded if/else statements.

## Features

✅ **Rule-Engine Based**: Declarative rules, not hard-coded logic  
✅ **Configurable**: All routing rules can be modified at runtime  
✅ **No AI Usage**: Pure decision logic  
✅ **Comprehensive Logging**: Every routing decision is logged  
✅ **Workflow Enforcement**: Enforces business policies via rules  

## Architecture

```
Fraud-Related Events
    ↓
Event Orchestrator Agent
    ↓
Routing Rule Engine (evaluates rules)
    ↓
Execute Actions (emit events)
    ↓
ReportRequested / EscalationTriggered Events
```

## Subscribed Events

The orchestrator subscribes to all fraud-related events:

- `FRAUD_DETECTED`
- `FRAUD_ALERT_CREATED`
- `FRAUD_SCORE_CALCULATED`

## Routing Rules

### Default Rules

#### 1. Medium Severity → Internal Report
- **Condition**: `severity === 'MEDIUM'`
- **Action**: Emit `ReportRequested` with `report_type: 'internal'`
- **Priority**: 30

#### 2. High Severity → Compliance Report
- **Condition**: `severity === 'HIGH'`
- **Action**: Emit `ReportRequested` with `report_type: 'compliance'`
- **Priority**: 40

#### 3. Critical Severity → Full Report + Escalation
- **Condition**: `severity === 'CRITICAL'`
- **Action**: 
  - Emit `ReportRequested` with `report_type: 'full'`
  - Emit `EscalationTriggered` with `escalation_level: 'senior_analyst'`
- **Priority**: 50

#### 4. High Regulatory Impact → Compliance Report
- **Condition**: `regulatory_impact === 'high'`
- **Action**: Emit `ReportRequested` with `report_type: 'compliance'`
- **Priority**: 35

#### 5. Critical + High Regulatory Impact → Executive Escalation
- **Condition**: `severity === 'CRITICAL' && regulatory_impact === 'high'`
- **Action**: Emit `EscalationTriggered` with `escalation_level: 'executive'`
- **Priority**: 60

#### 6. High Risk + Low Confidence → Review Escalation
- **Condition**: `risk_score >= 70 && confidence_score < 0.7`
- **Action**: Emit `EscalationTriggered` with `escalation_level: 'senior_analyst'`
- **Priority**: 25

## Routing Context

The orchestrator extracts context from events:

```typescript
{
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL',
  risk_score: number, // 0-100
  confidence_score?: number, // 0-1
  regulatory_impact?: 'low' | 'medium' | 'high',
  transaction_id?: string,
  fraud_detection_id?: string,
  investigation_id?: string,
  user_id?: string,
}
```

## Emitted Events

### ReportRequested Event

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

**Emitted when**:
- MEDIUM severity → `report_type: 'internal'`
- HIGH severity → `report_type: 'compliance'`
- CRITICAL severity → `report_type: 'full'`
- High regulatory impact → `report_type: 'compliance'`

### EscalationTriggered Event

```typescript
EventType.ESCALATION_TRIGGERED
{
  transaction_id?: string;
  fraud_detection_id?: string;
  investigation_id?: string;
  severity: 'CRITICAL';
  risk_score: number;
  escalation_reason: string;
  escalation_level: 'senior_analyst' | 'compliance_team' | 'executive';
  regulatory_impact: 'high';
  triggered_at: string;
}
```

**Emitted when**:
- CRITICAL severity → `escalation_level: 'senior_analyst'`
- CRITICAL + high regulatory impact → `escalation_level: 'executive'`
- High risk + low confidence → `escalation_level: 'senior_analyst'`

## Rule Engine

### Rule Structure

```typescript
{
  id: string;                    // Unique rule identifier
  name: string;                  // Human-readable name
  description: string;           // What the rule does
  condition: (context) => boolean; // When rule matches
  actions: RoutingAction[];      // What to do when matched
  priority: number;              // Higher = evaluated first
  enabled: boolean;              // Can be toggled
}
```

### Action Types

1. **emit_report**: Emit `ReportRequested` event
2. **emit_escalation**: Emit `EscalationTriggered` event
3. **log**: Log action (for debugging)

## Database Schema

### routing_logs Table

```sql
CREATE TABLE routing_logs (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  matched_rules TEXT NOT NULL,  -- JSON array
  actions_taken TEXT NOT NULL,   -- JSON array
  context TEXT NOT NULL,         -- JSON object
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Usage Examples

### Add Custom Rule

```typescript
const orchestrator = agentManager.getAgent('orchestrator') as OrchestratorAgent;

orchestrator.addRoutingRule({
  id: 'custom-weekend-rule',
  name: 'Weekend High Value Escalation',
  description: 'Escalate high-value transactions on weekends',
  priority: 45,
  enabled: true,
  condition: (ctx) => {
    const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
    return isWeekend && ctx.risk_score >= 80;
  },
  actions: [
    {
      type: 'emit_escalation',
      config: {
        escalation_level: 'compliance_team',
        escalation_reason: 'High-value weekend transaction',
      },
    },
  ],
});
```

### Disable Rule

```typescript
orchestrator.setRuleEnabled('medium-severity-internal-report', false);
```

### Get All Rules

```typescript
const rules = orchestrator.getRoutingRules();
console.log(rules.map(r => ({ id: r.id, name: r.name, enabled: r.enabled })));
```

## Regulatory Impact Calculation

The orchestrator automatically calculates regulatory impact:

- **High**: `severity === 'CRITICAL'` OR `risk_score >= 85`
- **Medium**: `severity === 'HIGH'` OR `risk_score >= 60`
- **Low**: Otherwise

## Logging

All routing decisions are logged:

1. **Audit Log**: Via `AuditService.log()`
   - `ROUTING_DECISIONS`: Summary of matched/unmatched rules
   - `REPORT_REQUESTED`: When report is requested
   - `ESCALATION_TRIGGERED`: When escalation occurs
   - `ROUTING_RULE_ADDED`: When rule is added
   - `ROUTING_RULE_UPDATED`: When rule is enabled/disabled

2. **Database Log**: Stored in `routing_logs` table
   - Full context
   - Matched rules
   - Actions taken

3. **Event Log**: `EventRoutedEvent` published for each routing action

## Workflow Policies

The orchestrator enforces these policies:

1. **Severity-Based Routing**:
   - MEDIUM → Internal report only
   - HIGH → Compliance report
   - CRITICAL → Full report + escalation

2. **Regulatory Compliance**:
   - High regulatory impact → Compliance report
   - Critical + high impact → Executive escalation

3. **Confidence Thresholds**:
   - High risk + low confidence → Additional review

## Testing

```typescript
// Test MEDIUM severity routing
const mediumEvent: FraudDetectedEvent = {
  // ... event with severity: 'MEDIUM'
};
// Should emit ReportRequested with report_type: 'internal'
// Should NOT emit EscalationTriggered

// Test CRITICAL severity routing
const criticalEvent: FraudDetectedEvent = {
  // ... event with severity: 'CRITICAL'
};
// Should emit ReportRequested with report_type: 'full'
// Should emit EscalationTriggered with escalation_level: 'senior_analyst'
```

## Production Considerations

1. **Rule Management**: Store rules in database for persistence
2. **Rule Versioning**: Track rule changes over time
3. **Performance**: Rules evaluated in priority order (highest first)
4. **Monitoring**: Track rule match rates, action execution
5. **A/B Testing**: Enable/disable rules for testing

## Rule Evaluation Flow

```
1. Extract context from event
2. Calculate regulatory impact
3. Evaluate rules in priority order (highest first)
4. Collect actions from matched rules
5. Execute actions (emit events)
6. Log all decisions
```

## Advantages of Rule Engine

- **Maintainability**: Rules are declarative, easy to understand
- **Flexibility**: Add/modify rules without code changes
- **Testability**: Each rule can be tested independently
- **Auditability**: All rules and decisions are logged
- **Scalability**: Rules can be stored in database, loaded at runtime
