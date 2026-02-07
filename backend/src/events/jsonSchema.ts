// JSON Schema definitions for event validation
// Can be used for runtime validation, API documentation, or external tooling
import { EventType } from './types';

export const EventSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    definitions: {
        BaseEvent: {
            type: 'object',
            required: ['event_id', 'event_type', 'version', 'timestamp', 'payload'],
            properties: {
                event_id: {
                    type: 'string',
                    format: 'uuid',
                    description: 'Unique event identifier',
                },
                event_type: {
                    type: 'string',
                    enum: [
                        'transaction.ingested',
                        'fraud.detected',
                        'report.requested',
                        'report.generated',
                        'orchestrator.escalation_triggered',
                        'report.approved',
                        'report.needs_review',
                    ],
                    description: 'Event type identifier',
                },
                version: {
                    type: 'string',
                    pattern: '^\\d+\\.\\d+\\.\\d+$',
                    description: 'Event schema version (semver)',
                },
                timestamp: {
                    type: 'string',
                    format: 'date-time',
                    description: 'ISO 8601 timestamp',
                },
                source_agent: {
                    type: 'string',
                    description: 'Agent that generated the event',
                },
                correlation_id: {
                    type: 'string',
                    description: 'Correlation ID for event tracing',
                },
                payload: {
                    type: 'object',
                    description: 'Event-specific payload',
                },
                metadata: {
                    type: 'object',
                    description: 'Additional metadata',
                },
            },
        },
        TransactionIngested: {
            allOf: [
                { $ref: '#/definitions/BaseEvent' },
                {
                    type: 'object',
                    properties: {
                        event_type: { const: 'transaction.ingested' },
                        payload: {
                            type: 'object',
                            required: ['transaction_id', 'user_id', 'amount', 'timestamp', 'transaction_data'],
                            properties: {
                                transaction_id: { type: 'string' },
                                user_id: { type: 'string' },
                                amount: { type: 'number' },
                                timestamp: { type: 'string', format: 'date-time' },
                                transaction_data: {
                                    type: 'object',
                                    properties: {
                                        location: {
                                            type: 'object',
                                            properties: {
                                                city: { type: 'string' },
                                                country: { type: 'string' },
                                                lat: { type: 'number' },
                                                lng: { type: 'number' },
                                            },
                                        },
                                        device_fingerprint: { type: 'string' },
                                        ip_address: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        },
        FraudDetected: {
            allOf: [
                { $ref: '#/definitions/BaseEvent' },
                {
                    type: 'object',
                    properties: {
                        event_type: { const: 'fraud.detected' },
                        payload: {
                            type: 'object',
                            required: [
                                'transaction_id',
                                'user_id',
                                'fraud_detection_id',
                                'risk_score',
                                'severity',
                                'signals',
                                'explanation',
                                'detected_at',
                            ],
                            properties: {
                                transaction_id: { type: 'string' },
                                user_id: { type: 'string' },
                                fraud_detection_id: { type: 'string' },
                                risk_score: { type: 'number', minimum: 0, maximum: 100 },
                                severity: { enum: ['MEDIUM', 'HIGH', 'CRITICAL'] },
                                signals: {
                                    type: 'object',
                                    properties: {
                                        amount_deviation: { type: 'number' },
                                        velocity_anomaly: { type: 'number' },
                                        geographic_inconsistency: { type: 'number' },
                                        rule_flags: {
                                            type: 'array',
                                            items: { type: 'string' },
                                        },
                                    },
                                },
                                explanation: { type: 'string' },
                                detected_at: { type: 'string', format: 'date-time' },
                            },
                        },
                    },
                },
            ],
        },
        ReportRequested: {
            allOf: [
                { $ref: '#/definitions/BaseEvent' },
                {
                    type: 'object',
                    properties: {
                        event_type: { const: 'report.requested' },
                        payload: {
                            type: 'object',
                            required: ['report_type', 'severity', 'risk_score', 'regulatory_impact', 'requested_at'],
                            properties: {
                                transaction_id: { type: 'string' },
                                fraud_detection_id: { type: 'string' },
                                investigation_id: { type: 'string' },
                                report_type: { enum: ['internal', 'compliance', 'full'] },
                                severity: { enum: ['MEDIUM', 'HIGH', 'CRITICAL'] },
                                risk_score: { type: 'number', minimum: 0, maximum: 100 },
                                regulatory_impact: { enum: ['low', 'medium', 'high'] },
                                requested_at: { type: 'string', format: 'date-time' },
                            },
                        },
                    },
                },
            ],
        },
        ReportGenerated: {
            allOf: [
                { $ref: '#/definitions/BaseEvent' },
                {
                    type: 'object',
                    properties: {
                        event_type: { const: 'report.generated' },
                        payload: {
                            type: 'object',
                            required: ['investigation_id', 'report_id', 'report_type', 'generated_at', 'generation_time_ms'],
                            properties: {
                                investigation_id: { type: 'string' },
                                report_id: { type: 'string' },
                                report_type: { type: 'string' },
                                narrative: { type: 'string' },
                                generated_at: { type: 'string', format: 'date-time' },
                                generation_time_ms: { type: 'number' },
                            },
                        },
                        metadata: {
                            type: 'object',
                            properties: {
                                report_data: {
                                    type: 'object',
                                    properties: {
                                        markdown: { type: 'string' },
                                        structured: { type: 'object' },
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        },
        EscalationTriggered: {
            allOf: [
                { $ref: '#/definitions/BaseEvent' },
                {
                    type: 'object',
                    properties: {
                        event_type: { const: 'orchestrator.escalation_triggered' },
                        payload: {
                            type: 'object',
                            required: [
                                'severity',
                                'risk_score',
                                'escalation_reason',
                                'escalation_level',
                                'regulatory_impact',
                                'triggered_at',
                            ],
                            properties: {
                                transaction_id: { type: 'string' },
                                fraud_detection_id: { type: 'string' },
                                investigation_id: { type: 'string' },
                                severity: { const: 'CRITICAL' },
                                risk_score: { type: 'number', minimum: 0, maximum: 100 },
                                escalation_reason: { type: 'string' },
                                escalation_level: { enum: ['senior_analyst', 'compliance_team', 'executive'] },
                                regulatory_impact: { const: 'high' },
                                triggered_at: { type: 'string', format: 'date-time' },
                            },
                        },
                    },
                },
            ],
        },
        ReportApproved: {
            allOf: [
                { $ref: '#/definitions/BaseEvent' },
                {
                    type: 'object',
                    properties: {
                        event_type: { const: 'report.approved' },
                        payload: {
                            type: 'object',
                            required: ['report_id', 'investigation_id', 'validation_score', 'validation_notes', 'approved_at'],
                            properties: {
                                report_id: { type: 'string' },
                                investigation_id: { type: 'string' },
                                validation_score: { type: 'number', minimum: 0, maximum: 100 },
                                validation_notes: { type: 'string' },
                                approved_at: { type: 'string', format: 'date-time' },
                            },
                        },
                    },
                },
            ],
        },
        ReportNeedsReview: {
            allOf: [
                { $ref: '#/definitions/BaseEvent' },
                {
                    type: 'object',
                    properties: {
                        event_type: { const: 'report.needs_review' },
                        payload: {
                            type: 'object',
                            required: [
                                'report_id',
                                'investigation_id',
                                'validation_score',
                                'issues',
                                'feedback',
                                'requires_regeneration',
                                'flagged_at',
                            ],
                            properties: {
                                report_id: { type: 'string' },
                                investigation_id: { type: 'string' },
                                validation_score: { type: 'number', minimum: 0, maximum: 100 },
                                issues: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        required: ['type', 'severity', 'description'],
                                        properties: {
                                            type: {
                                                enum: ['completeness', 'consistency', 'missing_section', 'weak_justification', 'anomaly'],
                                            },
                                            severity: { enum: ['low', 'medium', 'high'] },
                                            description: { type: 'string' },
                                            section: { type: 'string' },
                                        },
                                    },
                                },
                                feedback: { type: 'string' },
                                requires_regeneration: { type: 'boolean' },
                                flagged_at: { type: 'string', format: 'date-time' },
                            },
                        },
                    },
                },
            ],
        },
    },
};

/**
 * Get JSON schema for specific event type
 */
export function getEventSchema(eventType: string): any {
    const schemaMap: Record<string, string> = {
        'transaction.ingested': 'TransactionIngested',
        'fraud.detected': 'FraudDetected',
        'report.requested': 'ReportRequested',
        'report.generated': 'ReportGenerated',
        'orchestrator.escalation_triggered': 'EscalationTriggered',
        'report.approved': 'ReportApproved',
        'report.needs_review': 'ReportNeedsReview',
    };

    const schemaName = schemaMap[eventType];
    if (!schemaName) {
        throw new Error(`Unknown event type: ${eventType}`);
    }

    return {
        $schema: 'http://json-schema.org/draft-07/schema#',
        ...EventSchema.definitions[schemaName],
    };
}