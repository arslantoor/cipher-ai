// Event Orchestrator - Safe and reliable event-driven communication between agents
// Purpose: Ensure safe and reliable event-driven communication between agents
// Responsibilities:
// - Receive and dispatch events to relevant agents based on event type
// - Guarantee event ordering and delivery
// - Log all events for auditing purposes
// - Ensure no sensitive PII is transmitted without encryption
// - Handle errors gracefully and retry failed event delivery
// Constraints:
// - Do not modify agent internal logic
// - Do not generate outputs except logging and routing
import { SystemEvent, EventType, EventHandler, EventSubscription } from './types';
import { SystemEvent as SchemaSystemEvent } from './schema';
import { EventValidator } from './validation';
import { EventStore } from './eventStore';
import { AuditService } from '../services/audit';
import { EncryptionService } from '../services/encryption';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';

interface EventQueueItem {
    event: SystemEvent;
    sequence: number;
    timestamp: string;
    retryCount: number;
}

interface PIIField {
    path: string[];
    encrypt: boolean;
    redact: boolean;
}

export class EventOrchestrator {
    private subscriptions: Map<EventType, EventSubscription[]> = new Map();
    private eventStore: EventStore;
    private processingEvents: Set<string> = new Set();
    private eventQueue: EventQueueItem[] = [];
    private sequenceCounter: number = 0;
    private isProcessing: boolean = false;
    private maxRetries = 3;
    private retryDelay = 1000; // ms
    private maxQueueSize = 10000;

    // PII fields that must be encrypted/redacted
    private piiFields: PIIField[] = [
        { path: ['payload', 'user_id'], encrypt: true, redact: false },
        { path: ['payload', 'transaction_data', 'ip_address'], encrypt: true, redact: true },
        { path: ['payload', 'transaction_data', 'device_fingerprint'], encrypt: true, redact: true },
        { path: ['payload', 'email'], encrypt: true, redact: true },
        { path: ['payload', 'phone'], encrypt: true, redact: true },
        { path: ['metadata', 'user_id'], encrypt: true, redact: false },
        { path: ['metadata', 'ip_address'], encrypt: true, redact: true },
    ];

    constructor(eventStore: EventStore) {
        this.eventStore = eventStore;
        // Start queue processor
        this.startQueueProcessor();
    }

    /**
     * Subscribe to event types
     */
    subscribe(subscription: EventSubscription): void {
        const eventTypes = Array.isArray(subscription.event_type)
            ? subscription.event_type
            : [subscription.event_type];

        eventTypes.forEach(eventType => {
            if (!this.subscriptions.has(eventType)) {
                this.subscriptions.set(eventType, []);
            }
            const handlers = this.subscriptions.get(eventType)!;
            handlers.push(subscription);
            // Sort by priority (higher priority first)
            handlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        });

        this.logRouting('SUBSCRIBE', {
            agent_id: subscription.agent_id,
            event_types: eventTypes,
            priority: subscription.priority || 0,
        });
    }

    /**
     * Unsubscribe an agent from events
     */
    unsubscribe(agentId: string, eventType?: EventType): void {
        if (eventType) {
            const handlers = this.subscriptions.get(eventType);
            if (handlers) {
                const filtered = handlers.filter(sub => sub.agent_id !== agentId);
                this.subscriptions.set(eventType, filtered);
            }
        } else {
            // Unsubscribe from all events
            this.subscriptions.forEach((handlers, type) => {
                const filtered = handlers.filter(sub => sub.agent_id !== agentId);
                this.subscriptions.set(type, filtered);
            });
        }

        this.logRouting('UNSUBSCRIBE', {
            agent_id: agentId,
            event_type: eventType || 'all',
        });
    }

    /**
     * Publish an event with ordering and delivery guarantees
     */
    async publish(event: SystemEvent | SchemaSystemEvent): Promise<void> {
        // Normalize event FIRST to ensure all required fields are present (including version)
        const normalizedEvent = this.normalizeEvent(event);
        
        // Validate event schema AFTER normalization
        const validation = EventValidator.validate(normalizedEvent);
        if (!validation.valid) {
            const errorMsg = `Invalid event schema: ${validation.errors.map(e => e.message).join(', ')}`;
            console.error(`[EventOrchestrator] ${errorMsg}`, validation.errors);
            
            AuditService.log({
                action: 'EVENT_VALIDATION_FAILED',
                resource_type: 'event',
                resource_id: (normalizedEvent as any).event_id || 'unknown',
                details: JSON.stringify({ errors: validation.errors, warnings: validation.warnings }),
            });
            
            throw new Error(errorMsg);
        }

        // Log warnings if any
        if (validation.warnings.length > 0) {
            console.warn(`[EventOrchestrator] Event validation warnings:`, validation.warnings);
        }

        // Encrypt PII before transmission
        const securedEvent = this.encryptPII(normalizedEvent as SystemEvent);

        // Store event for replay/idempotency (with encrypted PII)
        await this.eventStore.storeEvent(securedEvent);

        // Audit log (with redacted PII)
        const redactedEvent = this.redactPIIForLogging(securedEvent);
        AuditService.log({
            action: 'EVENT_PUBLISHED',
            resource_type: 'event',
            resource_id: securedEvent.event_id,
            details: JSON.stringify({
                event_type: securedEvent.event_type,
                version: (securedEvent as any).version || 'unknown',
                source_agent: securedEvent.source_agent,
                correlation_id: securedEvent.correlation_id,
                payload_summary: this.getPayloadSummary(redactedEvent),
            }),
        });

        // Add to ordered queue for processing
        this.enqueueEvent(securedEvent);

        this.logRouting('PUBLISH', {
            event_id: securedEvent.event_id,
            event_type: securedEvent.event_type,
            queue_size: this.eventQueue.length,
        });
    }

    /**
     * Enqueue event with sequence number for ordering
     */
    private enqueueEvent(event: SystemEvent): void {
        if (this.eventQueue.length >= this.maxQueueSize) {
            console.error(`[EventOrchestrator] Queue full, dropping event ${event.event_id}`);
            AuditService.log({
                action: 'EVENT_QUEUE_FULL',
                resource_type: 'event',
                resource_id: event.event_id,
                details: JSON.stringify({ queue_size: this.eventQueue.length }),
            });
            return;
        }

        this.sequenceCounter++;
        this.eventQueue.push({
            event,
            sequence: this.sequenceCounter,
            timestamp: new Date().toISOString(),
            retryCount: 0,
        });
    }

    /**
     * Start queue processor for ordered event delivery
     */
    private startQueueProcessor(): void {
        setInterval(async () => {
            if (this.isProcessing || this.eventQueue.length === 0) {
                return;
            }

            this.isProcessing = true;
            try {
                // Process events in order (FIFO)
                while (this.eventQueue.length > 0) {
                    const queueItem = this.eventQueue.shift()!;
                    await this.processEventWithRetry(queueItem);
                }
            } finally {
                this.isProcessing = false;
            }
        }, 100); // Check queue every 100ms
    }

    /**
     * Process event with retry logic and delivery guarantee
     */
    private async processEventWithRetry(queueItem: EventQueueItem): Promise<void> {
        const { event, sequence, retryCount } = queueItem;
        const handlers = this.subscriptions.get(event.event_type) || [];

        if (handlers.length === 0) {
            console.warn(`[EventOrchestrator] No handlers for event type: ${event.event_type}`);
            this.logRouting('NO_HANDLERS', {
                event_id: event.event_id,
                event_type: event.event_type,
            });
            return;
        }

        // Process with each handler (sequential for ordering guarantee)
        for (const subscription of handlers) {
            const processingKey = `${event.event_id}:${subscription.agent_id}`;

            // Check idempotency
            if (this.processingEvents.has(processingKey)) {
                console.warn(`[EventOrchestrator] Event ${event.event_id} already being processed by ${subscription.agent_id}`);
                continue;
            }

            // Check if already processed
            const processed = await this.eventStore.isEventProcessed(event.event_id, subscription.agent_id);
            if (processed) {
                console.log(`[EventOrchestrator] Event ${event.event_id} already processed by ${subscription.agent_id}`);
                continue;
            }

            this.processingEvents.add(processingKey);

            try {
                // Decrypt PII for agent (agents need decrypted data)
                const decryptedEvent = this.decryptPII(event);

                // Deliver event to agent handler
                await this.deliverEvent(decryptedEvent, subscription, sequence);

                // Mark as processed
                await this.eventStore.markEventProcessed(event.event_id, subscription.agent_id);

                this.logRouting('EVENT_DELIVERED', {
                    event_id: event.event_id,
                    agent_id: subscription.agent_id,
                    sequence,
                    retry_count: retryCount,
                });

                this.processingEvents.delete(processingKey);
            } catch (error: any) {
                this.processingEvents.delete(processingKey);

                // Retry logic
                if (retryCount < this.maxRetries) {
                    const newRetryCount = retryCount + 1;
                    console.warn(
                        `[EventOrchestrator] Handler failed for ${subscription.agent_id}, retry ${newRetryCount}/${this.maxRetries}`
                    );

                    // Re-queue with incremented retry count
                    this.eventQueue.push({
                        ...queueItem,
                        retryCount: newRetryCount,
                    });

                    // Exponential backoff
                    await this.delay(this.retryDelay * newRetryCount);
                } else {
                    // Max retries exceeded - log and continue
                    AuditService.log({
                        action: 'EVENT_DELIVERY_FAILED',
                        resource_type: 'event',
                        resource_id: event.event_id,
                        details: JSON.stringify({
                            agent_id: subscription.agent_id,
                            error: error.message,
                            retry_count: retryCount,
                            sequence,
                        }),
                    });

                    this.logRouting('DELIVERY_FAILED', {
                        event_id: event.event_id,
                        agent_id: subscription.agent_id,
                        error: error.message,
                        retry_count: retryCount,
                    });
                }
            }
        }
    }

    /**
     * Deliver event to agent handler
     */
    private async deliverEvent(
        event: SystemEvent,
        subscription: EventSubscription,
        sequence: number
    ): Promise<void> {
        // Wrap handler to ensure no agent logic modification
        const wrappedHandler = async (e: SystemEvent) => {
            // Log delivery
            AuditService.log({
                action: 'EVENT_DELIVERED_TO_AGENT',
                resource_type: 'event',
                resource_id: e.event_id,
                details: JSON.stringify({
                    agent_id: subscription.agent_id,
                    event_type: e.event_type,
                    sequence,
                }),
            });

            // Call original handler (no modification)
            await subscription.handler(e);
        };

        await wrappedHandler(event);
    }

    /**
     * Encrypt PII in event payload
     */
    private encryptPII(event: SystemEvent): SystemEvent {
        const encrypted = JSON.parse(JSON.stringify(event)); // Deep clone

        for (const piiField of this.piiFields) {
            const value = this.getNestedValue(encrypted, piiField.path);
            if (value && typeof value === 'string' && value.length > 0) {
                if (piiField.encrypt) {
                    const encryptedValue = EncryptionService.encrypt(value);
                    this.setNestedValue(encrypted, piiField.path, encryptedValue);
                }
            }
        }

        return encrypted;
    }

    /**
     * Decrypt PII in event payload for agent consumption
     */
    private decryptPII(event: SystemEvent): SystemEvent {
        const decrypted = JSON.parse(JSON.stringify(event)); // Deep clone

        for (const piiField of this.piiFields) {
            if (piiField.encrypt) {
                const value = this.getNestedValue(decrypted, piiField.path);
                if (value && typeof value === 'string' && value.startsWith('U2FsdGVkX1')) {
                    // Looks like encrypted data
                    try {
                        const decryptedValue = EncryptionService.decrypt(value);
                        this.setNestedValue(decrypted, piiField.path, decryptedValue);
                    } catch (error) {
                        // If decryption fails, keep encrypted value
                        console.warn(`[EventOrchestrator] Failed to decrypt PII at ${piiField.path.join('.')}`);
                    }
                }
            }
        }

        return decrypted;
    }

    /**
     * Redact PII for logging (never log sensitive data)
     */
    private redactPIIForLogging(event: SystemEvent): SystemEvent {
        const redacted = JSON.parse(JSON.stringify(event)); // Deep clone

        for (const piiField of this.piiFields) {
            if (piiField.redact) {
                const value = this.getNestedValue(redacted, piiField.path);
                if (value) {
                    this.setNestedValue(redacted, piiField.path, '[REDACTED]');
                }
            }
        }

        return redacted;
    }

    /**
     * Get nested value from object
     */
    private getNestedValue(obj: any, path: string[]): any {
        let current = obj;
        for (const key of path) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return undefined;
            }
        }
        return current;
    }

    /**
     * Set nested value in object
     */
    private setNestedValue(obj: any, path: string[], value: any): void {
        let current = obj;
        for (let i = 0; i < path.length - 1; i++) {
            const key = path[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        current[path[path.length - 1]] = value;
    }

    /**
     * Get payload summary for logging (no PII)
     */
    private getPayloadSummary(event: SystemEvent): any {
        const summary: any = {};
        const payload = (event as any).payload || {};

        // Include non-sensitive fields only
        if (payload.transaction_id) summary.transaction_id = payload.transaction_id;
        if (payload.alert_id) summary.alert_id = payload.alert_id;
        if (payload.report_id) summary.report_id = payload.report_id;
        if (payload.severity) summary.severity = payload.severity;
        if (payload.risk_score !== undefined) summary.risk_score = payload.risk_score;
        if (payload.amount !== undefined) summary.amount = '[REDACTED]'; // Amount is sensitive

        return summary;
    }

    /**
     * Normalize event to ensure all base fields are present
     */
    private normalizeEvent(event: SystemEvent | SchemaSystemEvent): SystemEvent | SchemaSystemEvent {
        // Ensure version is set
        if (!(event as any).version) {
            (event as any).version = '1.0.0';
        }

        // Ensure timestamp is set
        if (!event.timestamp) {
            event.timestamp = new Date().toISOString();
        }

        // Ensure event_id is set
        if (!event.event_id) {
            event.event_id = uuidv4();
        }

        return event;
    }

    /**
     * Log routing decisions
     */
    private logRouting(action: string, details: Record<string, any>): void {
        // Store in routing_logs table
        const logId = uuidv4();
        db.prepare(`
            INSERT INTO routing_logs (
                id, event_id, event_type, matched_rules, actions_taken, context
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            logId,
            details.event_id || 'N/A',
            details.event_type || 'N/A',
            JSON.stringify({ action }),
            JSON.stringify(details),
            JSON.stringify({ timestamp: new Date().toISOString() })
        );
    }

    /**
     * Get event by ID (for replay)
     */
    async getEvent(eventId: string): Promise<SystemEvent | null> {
        return await this.eventStore.getEvent(eventId);
    }

    /**
     * Replay events (for recovery/reprocessing)
     */
    async replayEvents(
        eventType: EventType,
        fromTimestamp?: string,
        toTimestamp?: string
    ): Promise<void> {
        const events = await this.eventStore.getEvents(eventType, fromTimestamp, toTimestamp);
        
        console.log(`[EventOrchestrator] Replaying ${events.length} events of type ${eventType}`);
        
        for (const event of events) {
            // Decrypt PII before replay
            const decryptedEvent = this.decryptPII(event);
            // Normalize event to ensure version and other required fields are present
            const normalizedEvent = this.normalizeEvent(decryptedEvent);
            this.enqueueEvent(normalizedEvent as SystemEvent);
        }
    }

    /**
     * Get subscription count for monitoring
     */
    getSubscriptionCount(eventType: EventType): number {
        return this.subscriptions.get(eventType)?.length || 0;
    }

    /**
     * Get all subscriptions (for monitoring)
     */
    getAllSubscriptions(): Map<EventType, EventSubscription[]> {
        return new Map(this.subscriptions);
    }

    /**
     * Get queue statistics
     */
    getQueueStats(): { size: number; processing: boolean; sequence: number } {
        return {
            size: this.eventQueue.length,
            processing: this.isProcessing,
            sequence: this.sequenceCounter,
        };
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
