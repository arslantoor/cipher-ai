// Event type definitions for the event-driven system

export enum EventType {
    // Transaction events
    TRANSACTION_RECEIVED = 'transaction.received',
    TRANSACTION_INGESTED = 'transaction.ingested',
    TRANSACTION_PROCESSED = 'transaction.processed',
    
    // Fraud detection events
    FRAUD_SCORE_CALCULATED = 'fraud.score_calculated',
    FRAUD_ALERT_CREATED = 'fraud.alert_created',
    FRAUD_DETECTED = 'fraud.detected',
    
    // Investigation events
    INVESTIGATION_CREATED = 'investigation.created',
    INVESTIGATION_UPDATED = 'investigation.updated',
    INVESTIGATION_COMPLETED = 'investigation.completed',
    
    // Report generation events
    REPORT_GENERATION_REQUESTED = 'report.generation_requested',
    REPORT_REQUESTED = 'report.requested',
    REPORT_GENERATED = 'report.generated',
    REPORT_FAILED = 'report.failed',
    REPORT_APPROVED = 'report.approved',
    REPORT_NEEDS_REVIEW = 'report.needs_review',
    
    // Orchestration events
    EVENT_ROUTED = 'orchestrator.event_routed',
    EVENT_QUEUED = 'orchestrator.event_queued',
    ESCALATION_TRIGGERED = 'orchestrator.escalation_triggered',
    
    // Supervisor events
    SUPERVISOR_REVIEW_REQUESTED = 'supervisor.review_requested',
    SUPERVISOR_QA_PASSED = 'supervisor.qa_passed',
    SUPERVISOR_QA_FAILED = 'supervisor.qa_failed',
    
    // System events
    AGENT_STARTED = 'system.agent_started',
    AGENT_STOPPED = 'system.agent_stopped',
    AGENT_HEALTH_CHECK = 'system.agent_health_check',
}

export enum EventStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    RETRYING = 'retrying',
}

export interface BaseEvent {
    event_id: string;
    event_type: EventType;
    timestamp: string;
    source_agent?: string;
    correlation_id?: string;
    metadata?: Record<string, any>;
}

// Transaction Events
export interface TransactionReceivedEvent extends BaseEvent {
    event_type: EventType.TRANSACTION_RECEIVED;
    payload: {
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
    };
}

export interface TransactionIngestedEvent extends BaseEvent {
    event_type: EventType.TRANSACTION_INGESTED;
    payload: {
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
    };
}

export interface TransactionProcessedEvent extends BaseEvent {
    event_type: EventType.TRANSACTION_PROCESSED;
    payload: {
        transaction_id: string;
        user_id: string;
        processing_time_ms: number;
    };
}

// Fraud Detection Events
export interface FraudScoreCalculatedEvent extends BaseEvent {
    event_type: EventType.FRAUD_SCORE_CALCULATED;
    payload: {
        transaction_id: string;
        user_id: string;
        alert_id: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        score: number;
        baseline_score: number;
        deviation_multiplier: number;
        triggered_deviations: string[];
        justification: Record<string, any>;
    };
}

export interface FraudAlertCreatedEvent extends BaseEvent {
    event_type: EventType.FRAUD_ALERT_CREATED;
    payload: {
        alert_id: string;
        user_id: string;
        alert_type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        score: number;
        timestamp: string;
    };
}

export interface FraudDetectedEvent extends BaseEvent {
    event_type: EventType.FRAUD_DETECTED;
    payload: {
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
    };
}

// Investigation Events
export interface InvestigationCreatedEvent extends BaseEvent {
    event_type: EventType.INVESTIGATION_CREATED;
    payload: {
        investigation_id: string;
        alert_id: string;
        user_id: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        score: number;
    };
}

export interface InvestigationUpdatedEvent extends BaseEvent {
    event_type: EventType.INVESTIGATION_UPDATED;
    payload: {
        investigation_id: string;
        status: 'new' | 'in_progress' | 'resolved' | 'escalated' | 'closed';
        updated_by?: string;
    };
}

export interface InvestigationCompletedEvent extends BaseEvent {
    event_type: EventType.INVESTIGATION_COMPLETED;
    payload: {
        investigation_id: string;
        alert_id: string;
        final_status: string;
        resolution_time_ms: number;
    };
}

// Report Generation Events
export interface ReportGenerationRequestedEvent extends BaseEvent {
    event_type: EventType.REPORT_GENERATION_REQUESTED;
    payload: {
        investigation_id: string;
        alert_id: string;
        report_type: 'narrative' | 'compliance' | 'full';
    };
}

export interface ReportRequestedEvent extends BaseEvent {
    event_type: EventType.REPORT_REQUESTED;
    payload: {
        transaction_id?: string;
        fraud_detection_id?: string;
        investigation_id?: string;
        report_type: 'internal' | 'compliance' | 'full';
        severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
        risk_score: number;
        regulatory_impact: 'low' | 'medium' | 'high';
        requested_at: string;
    };
}

export interface EscalationTriggeredEvent extends BaseEvent {
    event_type: EventType.ESCALATION_TRIGGERED;
    payload: {
        transaction_id?: string;
        fraud_detection_id?: string;
        investigation_id?: string;
        severity: 'CRITICAL';
        risk_score: number;
        escalation_reason: string;
        escalation_level: 'senior_analyst' | 'compliance_team' | 'executive';
        regulatory_impact: 'high';
        triggered_at: string;
    };
}

export interface ReportGeneratedEvent extends BaseEvent {
    event_type: EventType.REPORT_GENERATED;
    payload: {
        investigation_id: string;
        report_id: string;
        report_type: string;
        narrative?: string;
        generated_at: string;
        generation_time_ms: number;
    };
    metadata?: {
        report_data?: {
            markdown?: string;
            structured?: any;
        };
    };
}

export interface ReportFailedEvent extends BaseEvent {
    event_type: EventType.REPORT_FAILED;
    payload: {
        investigation_id: string;
        error: string;
        retry_count: number;
    };
}

export interface ReportApprovedEvent extends BaseEvent {
    event_type: EventType.REPORT_APPROVED;
    payload: {
        report_id: string;
        investigation_id: string;
        validation_score: number; // 0-100
        validation_notes: string;
        approved_at: string;
    };
}

export interface ReportNeedsReviewEvent extends BaseEvent {
    event_type: EventType.REPORT_NEEDS_REVIEW;
    payload: {
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
    };
}

// Orchestration Events
export interface EventRoutedEvent extends BaseEvent {
    event_type: EventType.EVENT_ROUTED;
    payload: {
        source_event_id: string;
        target_agent: string;
        routing_reason: string;
    };
}

// Supervisor Events
export interface SupervisorReviewRequestedEvent extends BaseEvent {
    event_type: EventType.SUPERVISOR_REVIEW_REQUESTED;
    payload: {
        investigation_id: string;
        review_reason: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
    };
}

export interface SupervisorQAPassedEvent extends BaseEvent {
    event_type: EventType.SUPERVISOR_QA_PASSED;
    payload: {
        investigation_id: string;
        review_notes: string;
    };
}

export interface SupervisorQAFailedEvent extends BaseEvent {
    event_type: EventType.SUPERVISOR_QA_FAILED;
    payload: {
        investigation_id: string;
        failure_reason: string;
        corrective_action: string;
    };
}

// System Events
export interface AgentStartedEvent extends BaseEvent {
    event_type: EventType.AGENT_STARTED;
    payload: {
        agent_id: string;
        agent_type: string;
        started_at: string;
    };
}

export interface AgentHealthCheckEvent extends BaseEvent {
    event_type: EventType.AGENT_HEALTH_CHECK;
    payload: {
        agent_id: string;
        status: 'healthy' | 'degraded' | 'unhealthy';
        metrics: Record<string, any>;
    };
}

// Union type for all events
export type SystemEvent =
    | TransactionReceivedEvent
    | TransactionIngestedEvent
    | TransactionProcessedEvent
    | FraudScoreCalculatedEvent
    | FraudAlertCreatedEvent
    | FraudDetectedEvent
    | InvestigationCreatedEvent
    | InvestigationUpdatedEvent
    | InvestigationCompletedEvent
    | ReportGenerationRequestedEvent
    | ReportRequestedEvent
    | ReportGeneratedEvent
    | ReportFailedEvent
    | ReportApprovedEvent
    | ReportNeedsReviewEvent
    | EventRoutedEvent
    | EscalationTriggeredEvent
    | SupervisorReviewRequestedEvent
    | SupervisorQAPassedEvent
    | SupervisorQAFailedEvent
    | AgentStartedEvent
    | AgentHealthCheckEvent;

// Event handler type
export type EventHandler<T extends SystemEvent = SystemEvent> = (event: T) => Promise<void> | void;

// Event subscription
export interface EventSubscription {
    event_type: EventType | EventType[];
    handler: EventHandler;
    agent_id: string;
    priority?: number;
}