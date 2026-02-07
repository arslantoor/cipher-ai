# Investigation Report Agent

## Agent Role: InvestigationReportAgent

**Purpose**: Autonomously process fraud alerts, generate investigation narratives, and notify stakeholders via configured WhatsApp numbers. Fully autonomous - no human involvement required once alerts are received.

## Objectives

1. **Analyze incoming alert data**
   - Extract alert metadata (user ID, amount, location, device, timestamp)
   - Retrieve deviation analysis (amount, location, temporal, device)
   - Get severity score and baseline behavioral data

2. **Generate investigation narrative (180-220 words)**
   - Professional, compliance-ready narrative
   - Includes: alert context, severity classification, key patterns, deviations, anomalies
   - Actionable insights and recommendations
   - AI-generated using Google Gemini

3. **Store narrative in database**
   - Persist to `investigation_narratives` table
   - Link to alert ID and user ID
   - Include severity and risk score

4. **Retrieve WhatsApp numbers**
   - Get all configured WhatsApp numbers from system configuration
   - Stored in `system_settings` table as JSON array

5. **Format message for WhatsApp**
   - Concise, readable format (max 400 characters)
   - Include alert ID, severity, risk score
   - Truncate narrative to fit character limit
   - Brand-safe and secure

6. **Send WhatsApp notifications**
   - Send to all configured numbers
   - Retry on failure (max 3 attempts)
   - Log all delivery attempts

7. **Log delivery status**
   - Store delivery records in `whatsapp_notifications` table
   - Track success/failure for each number
   - Audit trail for compliance

8. **Handle failures gracefully**
   - Retry failed deliveries
   - Continue processing other numbers on failure
   - Log all errors for investigation

## Constraints

### 1. No Trading Interference
- **Rule**: Do not block trading platforms or interfere with trade execution
- **Implementation**: Agent only generates reports and sends notifications
- **Rationale**: Agent is notification-only, no trading actions

### 2. Secure and Brand-Safe Messages
- **Rule**: Messages must be secure, brand-safe, and auditable
- **Implementation**: 
  - PII encrypted/redacted in messages
  - Professional language only
  - All messages logged for audit

### 3. AI Analysis Only
- **Rule**: AI must only analyze and report; never provide trade recommendations
- **Implementation**: AI generates investigation narratives only
- **Rationale**: Compliance with financial regulations

### 4. PII Encryption
- **Rule**: Ensure all sensitive data (PII) is encrypted when stored or transmitted
- **Implementation**: 
  - User IDs masked in logs
  - Phone numbers masked in database
  - PII encrypted via EventOrchestrator

### 5. Compliance
- **Rule**: Follow compliance and regulatory rules for financial communications
- **Implementation**: 
  - Professional language
  - No trading advice
  - Complete audit trail

## Lifecycle Responsibilities

### 1. INIT: Initialize Services

- Subscribe to `FRAUD_ALERT_CREATED` events
- Initialize AI model (Google Gemini) via `ReportGenerator`
- Initialize WhatsApp service
- Load processed alert IDs from database
- Verify WhatsApp configuration

### 2. LISTEN: Receive Fraud Alerts

- Subscribe to `EventType.FRAUD_ALERT_CREATED`
- Receive alerts with metadata and anomaly scores
- Only process fraud alert events

### 3. ANALYZE: Process and Generate

- Analyze alert data:
  - Extract fraud detection data
  - Get user activity and baseline
  - Analyze deviations (amount, location, temporal, device)
- Generate investigation narrative:
  - Build report context
  - Use AI to generate 180-220 word narrative
  - Include severity, patterns, deviations, recommendations

### 4. EMIT: Store and Notify

- Store narrative in database
- Retrieve WhatsApp numbers from configuration
- Format message for WhatsApp (max 400 chars)
- Send to all configured numbers
- Log delivery status

### 5. IDLE: Maintain Readiness

- Archive processed alert IDs
- Maintain readiness for next alerts
- Never halt processing loop

## Input Data

### Alert Metadata
- Alert ID
- User ID
- Amount
- Location (city, country, lat, lng)
- Device fingerprint
- Timestamp

### Deviation Analysis
- Amount deviation (vs baseline)
- Location inconsistency
- Temporal anomalies (velocity)
- Device changes

### Severity Score
- Risk score (0-100)
- Severity level (LOW, MEDIUM, HIGH, CRITICAL)

### Baseline Data
- Average transaction amount
- Typical transaction hours
- Common locations
- Device consistency

### System Configuration
- WhatsApp notification numbers (JSON array)
- Stored in `system_settings` table

## Output Format

### JSON Summary
```json
{
  "alertId": "alert-123",
  "status": "processed",
  "narrativeId": "narrative-456",
  "whatsappDelivery": [
    {
      "number": "+1234567890",
      "success": true,
      "messageId": "msg-789",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "number": "+0987654321",
      "success": false,
      "error": "Invalid phone number format"
    }
  ]
}
```

### Database Records

#### investigation_narratives
- `id`: Narrative ID
- `alert_id`: Alert ID
- `user_id`: User ID
- `narrative`: Full narrative (180-220 words)
- `severity`: LOW, MEDIUM, HIGH, CRITICAL
- `risk_score`: 0-100
- `created_at`: Timestamp

#### whatsapp_notifications
- `id`: Notification ID
- `alert_id`: Alert ID
- `phone_number`: Masked phone number
- `success`: 0 or 1
- `error_message`: Error if failed
- `message_id`: WhatsApp message ID
- `sent_at`: Timestamp

## WhatsApp Message Format

### Structure
```
🚨 Fraud Alert [emoji]

Alert: [alert-id]...
Severity: [SEVERITY]
Risk Score: [score]/100

[narrative - truncated to fit 400 chars]

View full report in system.
```

### Character Limit
- Maximum: 400 characters
- Narrative truncated if needed
- Ends at sentence boundary when possible
- Includes alert metadata and narrative summary

### Emojis by Severity
- LOW: 🟢
- MEDIUM: 🟡
- HIGH: 🟠
- CRITICAL: 🔴

## Configuration

### WhatsApp Numbers

Stored in `system_settings` table:
- Key: `whatsapp_notification_numbers`
- Value: JSON array of phone numbers
- Example: `["+1234567890", "+0987654321"]`

### Setting WhatsApp Numbers

```typescript
import { ConfigService } from './services/configService';

// Set WhatsApp numbers
ConfigService.setWhatsAppNumbers([
    '+1234567890',
    '+0987654321'
], 'admin-user-id');

// Get WhatsApp numbers
const numbers = ConfigService.getWhatsAppNumbers();
```

### Environment Variables

- `WHATSAPP_API_KEY`: WhatsApp API key (optional for development)
- `WHATSAPP_API_URL`: WhatsApp API endpoint (default: https://api.whatsapp.com/v1/messages)

## WhatsApp Service Integration

### Supported Providers

The WhatsApp service can integrate with:
1. **Twilio WhatsApp API**
2. **WhatsApp Business API (Meta)**
3. **Other WhatsApp Business providers**

### Implementation

Update `whatsappService.ts` `callWhatsAppAPI()` method with your provider's API:

```typescript
private async callWhatsAppAPI(message: WhatsAppMessage): Promise<{ messageId: string }> {
    // Implement your WhatsApp provider API call
    const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            to: message.to,
            text: message.message,
        }),
    });
    // ...
}
```

## Error Handling

### Retry Logic
- Max retries: 3 attempts
- Exponential backoff: 1s, 2s, 3s
- Per-number retry (one failure doesn't block others)

### Failure Scenarios

1. **Invalid Phone Number**
   - Validation fails
   - Error logged
   - Continue with other numbers

2. **WhatsApp API Failure**
   - Retry with backoff
   - Log failure after max retries
   - Continue with other numbers

3. **Narrative Generation Failure**
   - Use fallback narrative
   - Log error
   - Continue processing

4. **Database Failure**
   - Log error
   - Retry storage
   - Continue with notifications

## Security

### PII Protection
- User IDs masked in logs
- Phone numbers masked in database
- PII encrypted via EventOrchestrator
- No sensitive data in WhatsApp messages

### Message Security
- Brand-safe language
- No trading advice
- Compliance-ready content
- Audit trail for all messages

## Monitoring

### Metrics
- Alerts processed
- Narratives generated
- WhatsApp messages sent
- Delivery success rate
- Error rate

### Health Checks
- WhatsApp service availability
- Configuration loaded
- Processed alerts count

## Example Flow

```
1. Fraud Alert Created Event
   ↓
2. InvestigationReportAgent receives alert
   ↓
3. Analyze alert data
   - Get fraud detection
   - Get user activity
   - Analyze deviations
   ↓
4. Generate investigation narrative (AI)
   - 180-220 words
   - Professional, compliance-ready
   ↓
5. Store narrative in database
   ↓
6. Get WhatsApp numbers from config
   ↓
7. Format message (max 400 chars)
   ↓
8. Send to all numbers
   - Retry on failure
   - Log each delivery
   ↓
9. Return JSON summary
```

## Integration Points

### Input Events
- `FRAUD_ALERT_CREATED`: Primary input event

### Output
- Database records (narratives, notifications)
- JSON summary (for API if needed)
- Audit logs

### Services Used
- `ReportGenerator`: AI narrative generation
- `WhatsAppService`: Message delivery
- `ConfigService`: Configuration retrieval
- `InvestigationService`: User activity data
- `BaselineAnalyzer`: Baseline calculation

## Best Practices

1. **Idempotency**: Check for duplicate processing
2. **Error Handling**: Retry failed deliveries
3. **PII Protection**: Always mask/encrypt sensitive data
4. **Message Formatting**: Keep within 400 char limit
5. **Compliance**: Use professional, brand-safe language
6. **Audit Trail**: Log all actions for compliance
7. **Configuration**: Store WhatsApp numbers in system_settings

## Compliance

- **GDPR**: PII encrypted and masked
- **Financial Regulations**: No trading advice
- **Audit Trail**: All actions logged
- **Data Retention**: Narratives and notifications stored
- **Secure Communication**: Encrypted PII, masked phone numbers
