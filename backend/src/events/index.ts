// Event system exports
// Export schema types (new versioned schema)
export {
    BaseEventSchema,
    TransactionIngestedPayload,
    FraudDetectedPayload,
    ReportRequestedPayload,
    ReportGeneratedPayload,
    EscalationTriggeredPayload,
    ReportApprovedPayload,
    ReportNeedsReviewPayload,
    TransactionIngestedEvent,
    FraudDetectedEvent,
    ReportRequestedEvent,
    ReportGeneratedEvent,
    EscalationTriggeredEvent,
    ReportApprovedEvent,
    ReportNeedsReviewEvent,
    SystemEvent as SchemaSystemEvent,
    EventFactory,
    EVENT_SCHEMA_VERSION,
} from './schema';

// Export validation and middleware
export * from './validation';
export * from './middleware';
export * from './jsonSchema';

// Export event bus and store
export * from './eventBus';
export * from './eventStore';

// Export legacy types (for backward compatibility)
export * from './types';