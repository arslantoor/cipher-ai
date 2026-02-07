// Event Validation Middleware - Validates event schema and structure
import { BaseEventSchema, SystemEvent, EVENT_SCHEMA_VERSION } from './schema';
import { EventType } from './types';

export interface ValidationError {
    field: string;
    message: string;
    code: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: string[];
}

export class EventValidator {
    /**
     * Validate event against schema
     */
    static validate(event: any): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: string[] = [];

        // Check base fields
        if (!event.event_id || typeof event.event_id !== 'string') {
            errors.push({
                field: 'event_id',
                message: 'Event ID is required and must be a string',
                code: 'MISSING_EVENT_ID',
            });
        }

        if (!event.event_type || typeof event.event_type !== 'string') {
            errors.push({
                field: 'event_type',
                message: 'Event type is required and must be a string',
                code: 'MISSING_EVENT_TYPE',
            });
        } else {
            // Validate event type is known
            const validTypes = Object.values(EventType);
            if (!validTypes.includes(event.event_type as EventType)) {
                errors.push({
                    field: 'event_type',
                    message: `Unknown event type: ${event.event_type}`,
                    code: 'INVALID_EVENT_TYPE',
                });
            }
        }

        if (!event.version || typeof event.version !== 'string') {
            errors.push({
                field: 'version',
                message: 'Version is required and must be a string',
                code: 'MISSING_VERSION',
            });
        } else {
            // Check version compatibility
            if (event.version !== EVENT_SCHEMA_VERSION) {
                warnings.push(`Event version ${event.version} differs from current ${EVENT_SCHEMA_VERSION}`);
            }
        }

        if (!event.timestamp || typeof event.timestamp !== 'string') {
            errors.push({
                field: 'timestamp',
                message: 'Timestamp is required and must be an ISO string',
                code: 'MISSING_TIMESTAMP',
            });
        } else {
            // Validate timestamp format
            if (isNaN(Date.parse(event.timestamp))) {
                errors.push({
                    field: 'timestamp',
                    message: 'Timestamp must be a valid ISO 8601 string',
                    code: 'INVALID_TIMESTAMP',
                });
            }
        }

        if (!event.payload || typeof event.payload !== 'object') {
            errors.push({
                field: 'payload',
                message: 'Payload is required and must be an object',
                code: 'MISSING_PAYLOAD',
            });
        }

        // Validate payload structure based on event type
        if (event.event_type && event.payload) {
            const payloadErrors = this.validatePayload(event.event_type, event.payload);
            errors.push(...payloadErrors);
        }

        // Validate optional fields
        if (event.source_agent && typeof event.source_agent !== 'string') {
            errors.push({
                field: 'source_agent',
                message: 'Source agent must be a string if provided',
                code: 'INVALID_SOURCE_AGENT',
            });
        }

        if (event.correlation_id && typeof event.correlation_id !== 'string') {
            errors.push({
                field: 'correlation_id',
                message: 'Correlation ID must be a string if provided',
                code: 'INVALID_CORRELATION_ID',
            });
        }

        if (event.metadata && typeof event.metadata !== 'object') {
            errors.push({
                field: 'metadata',
                message: 'Metadata must be an object if provided',
                code: 'INVALID_METADATA',
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validate payload structure for specific event type
     */
    private static validatePayload(eventType: string, payload: any): ValidationError[] {
        const errors: ValidationError[] = [];

        switch (eventType) {
            case EventType.TRANSACTION_INGESTED:
                errors.push(...this.validateTransactionIngestedPayload(payload));
                break;
            case EventType.FRAUD_DETECTED:
                errors.push(...this.validateFraudDetectedPayload(payload));
                break;
            case EventType.REPORT_REQUESTED:
                errors.push(...this.validateReportRequestedPayload(payload));
                break;
            case EventType.REPORT_GENERATED:
                errors.push(...this.validateReportGeneratedPayload(payload));
                break;
            case EventType.ESCALATION_TRIGGERED:
                errors.push(...this.validateEscalationTriggeredPayload(payload));
                break;
            case EventType.REPORT_APPROVED:
                errors.push(...this.validateReportApprovedPayload(payload));
                break;
            case EventType.REPORT_NEEDS_REVIEW:
                errors.push(...this.validateReportNeedsReviewPayload(payload));
                break;
            // Other event types may not have strict payload validation
            // They will still be validated for base schema compliance
            default:
                // No specific payload validation for unknown types
                break;
        }

        return errors;
    }

    private static validateTransactionIngestedPayload(payload: any): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!payload.transaction_id || typeof payload.transaction_id !== 'string') {
            errors.push({ field: 'payload.transaction_id', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (!payload.user_id || typeof payload.user_id !== 'string') {
            errors.push({ field: 'payload.user_id', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (payload.amount === undefined || typeof payload.amount !== 'number') {
            errors.push({ field: 'payload.amount', message: 'Required number', code: 'MISSING_FIELD' });
        }
        if (!payload.timestamp || typeof payload.timestamp !== 'string') {
            errors.push({ field: 'payload.timestamp', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (!payload.transaction_data || typeof payload.transaction_data !== 'object') {
            errors.push({ field: 'payload.transaction_data', message: 'Required object', code: 'MISSING_FIELD' });
        }

        return errors;
    }

    private static validateFraudDetectedPayload(payload: any): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!payload.transaction_id || typeof payload.transaction_id !== 'string') {
            errors.push({ field: 'payload.transaction_id', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (!payload.user_id || typeof payload.user_id !== 'string') {
            errors.push({ field: 'payload.user_id', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (!payload.fraud_detection_id || typeof payload.fraud_detection_id !== 'string') {
            errors.push({ field: 'payload.fraud_detection_id', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (payload.risk_score === undefined || typeof payload.risk_score !== 'number' || payload.risk_score < 0 || payload.risk_score > 100) {
            errors.push({ field: 'payload.risk_score', message: 'Must be number 0-100', code: 'INVALID_RANGE' });
        }
        if (!payload.severity || !['MEDIUM', 'HIGH', 'CRITICAL'].includes(payload.severity)) {
            errors.push({ field: 'payload.severity', message: 'Must be MEDIUM, HIGH, or CRITICAL', code: 'INVALID_VALUE' });
        }
        if (!payload.signals || typeof payload.signals !== 'object') {
            errors.push({ field: 'payload.signals', message: 'Required object', code: 'MISSING_FIELD' });
        }
        if (!payload.explanation || typeof payload.explanation !== 'string') {
            errors.push({ field: 'payload.explanation', message: 'Required', code: 'MISSING_FIELD' });
        }

        return errors;
    }

    private static validateReportRequestedPayload(payload: any): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!payload.report_type || !['internal', 'compliance', 'full'].includes(payload.report_type)) {
            errors.push({ field: 'payload.report_type', message: 'Must be internal, compliance, or full', code: 'INVALID_VALUE' });
        }
        if (!payload.severity || !['MEDIUM', 'HIGH', 'CRITICAL'].includes(payload.severity)) {
            errors.push({ field: 'payload.severity', message: 'Must be MEDIUM, HIGH, or CRITICAL', code: 'INVALID_VALUE' });
        }
        if (payload.risk_score === undefined || typeof payload.risk_score !== 'number') {
            errors.push({ field: 'payload.risk_score', message: 'Required number', code: 'MISSING_FIELD' });
        }
        if (!payload.regulatory_impact || !['low', 'medium', 'high'].includes(payload.regulatory_impact)) {
            errors.push({ field: 'payload.regulatory_impact', message: 'Must be low, medium, or high', code: 'INVALID_VALUE' });
        }

        return errors;
    }

    private static validateReportGeneratedPayload(payload: any): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!payload.investigation_id || typeof payload.investigation_id !== 'string') {
            errors.push({ field: 'payload.investigation_id', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (!payload.report_id || typeof payload.report_id !== 'string') {
            errors.push({ field: 'payload.report_id', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (!payload.report_type || typeof payload.report_type !== 'string') {
            errors.push({ field: 'payload.report_type', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (!payload.generated_at || typeof payload.generated_at !== 'string') {
            errors.push({ field: 'payload.generated_at', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (payload.generation_time_ms === undefined || typeof payload.generation_time_ms !== 'number') {
            errors.push({ field: 'payload.generation_time_ms', message: 'Required number', code: 'MISSING_FIELD' });
        }

        return errors;
    }

    private static validateEscalationTriggeredPayload(payload: any): ValidationError[] {
        const errors: ValidationError[] = [];

        if (payload.severity !== 'CRITICAL') {
            errors.push({ field: 'payload.severity', message: 'Must be CRITICAL', code: 'INVALID_VALUE' });
        }
        if (!payload.escalation_level || !['senior_analyst', 'compliance_team', 'executive'].includes(payload.escalation_level)) {
            errors.push({ field: 'payload.escalation_level', message: 'Must be senior_analyst, compliance_team, or executive', code: 'INVALID_VALUE' });
        }
        if (!payload.escalation_reason || typeof payload.escalation_reason !== 'string') {
            errors.push({ field: 'payload.escalation_reason', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (payload.regulatory_impact !== 'high') {
            errors.push({ field: 'payload.regulatory_impact', message: 'Must be high for escalation', code: 'INVALID_VALUE' });
        }

        return errors;
    }

    private static validateReportApprovedPayload(payload: any): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!payload.report_id || typeof payload.report_id !== 'string') {
            errors.push({ field: 'payload.report_id', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (!payload.investigation_id || typeof payload.investigation_id !== 'string') {
            errors.push({ field: 'payload.investigation_id', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (payload.validation_score === undefined || typeof payload.validation_score !== 'number' || payload.validation_score < 0 || payload.validation_score > 100) {
            errors.push({ field: 'payload.validation_score', message: 'Must be number 0-100', code: 'INVALID_RANGE' });
        }
        if (!payload.validation_notes || typeof payload.validation_notes !== 'string') {
            errors.push({ field: 'payload.validation_notes', message: 'Required', code: 'MISSING_FIELD' });
        }

        return errors;
    }

    private static validateReportNeedsReviewPayload(payload: any): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!payload.report_id || typeof payload.report_id !== 'string') {
            errors.push({ field: 'payload.report_id', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (!payload.investigation_id || typeof payload.investigation_id !== 'string') {
            errors.push({ field: 'payload.investigation_id', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (payload.validation_score === undefined || typeof payload.validation_score !== 'number') {
            errors.push({ field: 'payload.validation_score', message: 'Required number', code: 'MISSING_FIELD' });
        }
        if (!Array.isArray(payload.issues)) {
            errors.push({ field: 'payload.issues', message: 'Must be array', code: 'INVALID_TYPE' });
        }
        if (!payload.feedback || typeof payload.feedback !== 'string') {
            errors.push({ field: 'payload.feedback', message: 'Required', code: 'MISSING_FIELD' });
        }
        if (payload.requires_regeneration === undefined || typeof payload.requires_regeneration !== 'boolean') {
            errors.push({ field: 'payload.requires_regeneration', message: 'Required boolean', code: 'MISSING_FIELD' });
        }

        return errors;
    }

    /**
     * Serialize event to JSON (replay-safe)
     */
    static serialize(event: SystemEvent): string {
        return JSON.stringify(event, null, 2);
    }

    /**
     * Deserialize event from JSON
     */
    static deserialize(json: string): SystemEvent {
        const event = JSON.parse(json);
        const validation = this.validate(event);
        
        if (!validation.valid) {
            throw new Error(`Invalid event schema: ${validation.errors.map(e => e.message).join(', ')}`);
        }

        return event as SystemEvent;
    }

    /**
     * Check if event is replay-safe (idempotent)
     */
    static isReplaySafe(event: SystemEvent): boolean {
        // Events are replay-safe if they have:
        // 1. Unique event_id
        // 2. Valid timestamp
        // 3. Complete payload
        const validation = this.validate(event);
        return validation.valid && !!event.event_id && !!event.timestamp;
    }
}