// Shared Event Schema - Versioned, strongly-typed, replay-safe
import { v4 as uuidv4 } from 'uuid';
import { EventType } from './types';

// Re-export EventType for convenience
export { EventType };

// Event schema version
export const EVENT_SCHEMA_VERSION = '1.0.0';

// Base event interface
export interface BaseEventSchema {
    event_id: string;
    event_type: string;
    version: string;
    timestamp: string;
    source_agent?: string;
    correlation_id?: string;
    payload: Record<string, any>;
    metadata?: Record<string, any>;
}

// Specific event payload types
export interface TransactionIngestedPayload {
    transaction_id: string;
    user_id: string;
    amount: number;
    timestamp: string;
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

export interface FraudDetectedPayload {
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
    detected_at: string;
}

export interface ReportRequestedPayload {
    transaction_id?: string;
    fraud_detection_id?: string;
    investigation_id?: string;
    report_type: 'internal' | 'compliance' | 'full';
    severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
    risk_score: number;
    regulatory_impact: 'low' | 'medium' | 'high';
    requested_at: string;
}

export interface ReportGeneratedPayload {
    investigation_id: string;
    report_id: string;
    report_type: string;
    narrative?: string;
    generated_at: string;
    generation_time_ms: number;
}

export interface EscalationTriggeredPayload {
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

export interface ReportApprovedPayload {
    report_id: string;
    investigation_id: string;
    validation_score: number; // 0-100
    validation_notes: string;
    approved_at: string;
}

export interface ReportNeedsReviewPayload {
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

// Typed event interfaces
export interface TransactionIngestedEvent extends BaseEventSchema {
    event_type: EventType.TRANSACTION_INGESTED;
    payload: TransactionIngestedPayload;
}

// Compatibility: Map to existing types
export type TransactionIngestedEventCompat = TransactionIngestedEvent;

export interface FraudDetectedEvent extends BaseEventSchema {
    event_type: EventType.FRAUD_DETECTED;
    payload: FraudDetectedPayload;
}

export interface ReportRequestedEvent extends BaseEventSchema {
    event_type: EventType.REPORT_REQUESTED;
    payload: ReportRequestedPayload;
}

export interface ReportGeneratedEvent extends BaseEventSchema {
    event_type: EventType.REPORT_GENERATED;
    payload: ReportGeneratedPayload;
    metadata?: {
        report_data?: {
            markdown?: string;
            structured?: any;
        };
    };
}

export interface EscalationTriggeredEvent extends BaseEventSchema {
    event_type: EventType.ESCALATION_TRIGGERED;
    payload: EscalationTriggeredPayload;
}

export interface ReportApprovedEvent extends BaseEventSchema {
    event_type: EventType.REPORT_APPROVED;
    payload: ReportApprovedPayload;
}

export interface ReportNeedsReviewEvent extends BaseEventSchema {
    event_type: EventType.REPORT_NEEDS_REVIEW;
    payload: ReportNeedsReviewPayload;
}

// Union type for all events
export type SystemEvent =
    | TransactionIngestedEvent
    | FraudDetectedEvent
    | ReportRequestedEvent
    | ReportGeneratedEvent
    | EscalationTriggeredEvent
    | ReportApprovedEvent
    | ReportNeedsReviewEvent;

// Event factory functions
export class EventFactory {
    /**
     * Create TransactionIngested event
     */
    static createTransactionIngested(
        payload: TransactionIngestedPayload,
        sourceAgent?: string,
        correlationId?: string
    ): TransactionIngestedEvent {
        return {
            event_id: uuidv4(),
            event_type: EventType.TRANSACTION_INGESTED,
            version: EVENT_SCHEMA_VERSION,
            timestamp: new Date().toISOString(),
            source_agent: sourceAgent,
            correlation_id: correlationId,
            payload,
        };
    }

    /**
     * Create FraudDetected event
     */
    static createFraudDetected(
        payload: FraudDetectedPayload,
        sourceAgent?: string,
        correlationId?: string
    ): FraudDetectedEvent {
        return {
            event_id: uuidv4(),
            event_type: EventType.FRAUD_DETECTED,
            version: EVENT_SCHEMA_VERSION,
            timestamp: new Date().toISOString(),
            source_agent: sourceAgent,
            correlation_id: correlationId,
            payload,
        };
    }

    /**
     * Create ReportRequested event
     */
    static createReportRequested(
        payload: ReportRequestedPayload,
        sourceAgent?: string,
        correlationId?: string
    ): ReportRequestedEvent {
        return {
            event_id: uuidv4(),
            event_type: EventType.REPORT_REQUESTED,
            version: EVENT_SCHEMA_VERSION,
            timestamp: new Date().toISOString(),
            source_agent: sourceAgent,
            correlation_id: correlationId,
            payload,
        };
    }

    /**
     * Create ReportGenerated event
     */
    static createReportGenerated(
        payload: ReportGeneratedPayload,
        metadata?: ReportGeneratedEvent['metadata'],
        sourceAgent?: string,
        correlationId?: string
    ): ReportGeneratedEvent {
        return {
            event_id: uuidv4(),
            event_type: EventType.REPORT_GENERATED,
            version: EVENT_SCHEMA_VERSION,
            timestamp: new Date().toISOString(),
            source_agent: sourceAgent,
            correlation_id: correlationId,
            payload,
            metadata,
        };
    }

    /**
     * Create EscalationTriggered event
     */
    static createEscalationTriggered(
        payload: EscalationTriggeredPayload,
        sourceAgent?: string,
        correlationId?: string
    ): EscalationTriggeredEvent {
        return {
            event_id: uuidv4(),
            event_type: EventType.ESCALATION_TRIGGERED,
            version: EVENT_SCHEMA_VERSION,
            timestamp: new Date().toISOString(),
            source_agent: sourceAgent,
            correlation_id: correlationId,
            payload,
        };
    }

    /**
     * Create ReportApproved event
     */
    static createReportApproved(
        payload: ReportApprovedPayload,
        sourceAgent?: string,
        correlationId?: string
    ): ReportApprovedEvent {
        return {
            event_id: uuidv4(),
            event_type: EventType.REPORT_APPROVED,
            version: EVENT_SCHEMA_VERSION,
            timestamp: new Date().toISOString(),
            source_agent: sourceAgent,
            correlation_id: correlationId,
            payload,
        };
    }

    /**
     * Create ReportNeedsReview event
     */
    static createReportNeedsReview(
        payload: ReportNeedsReviewPayload,
        sourceAgent?: string,
        correlationId?: string
    ): ReportNeedsReviewEvent {
        return {
            event_id: uuidv4(),
            event_type: EventType.REPORT_NEEDS_REVIEW,
            version: EVENT_SCHEMA_VERSION,
            timestamp: new Date().toISOString(),
            source_agent: sourceAgent,
            correlation_id: correlationId,
            payload,
        };
    }
}