// Event Bus - In-memory pub/sub system (can be swapped for Redis/SQS)
// Uses EventOrchestrator for safe and reliable communication
import { SystemEvent, EventType, EventHandler, EventSubscription } from './types';
import { SystemEvent as SchemaSystemEvent } from './schema';
import { EventOrchestrator } from './eventOrchestrator';
import { EventStore } from './eventStore';

export class EventBus {
    private orchestrator: EventOrchestrator;

    constructor(eventStore: EventStore) {
        // Use EventOrchestrator for safe and reliable communication
        this.orchestrator = new EventOrchestrator(eventStore);
    }

    /**
     * Subscribe to event types
     */
    subscribe(subscription: EventSubscription): void {
        this.orchestrator.subscribe(subscription);
    }

    /**
     * Unsubscribe an agent from events
     */
    unsubscribe(agentId: string, eventType?: EventType): void {
        this.orchestrator.unsubscribe(agentId, eventType);
    }

    /**
     * Publish an event with ordering and delivery guarantees
     */
    async publish(event: SystemEvent | SchemaSystemEvent): Promise<void> {
        // Delegate to orchestrator for safe and reliable communication
        await this.orchestrator.publish(event);
    }


    /**
     * Get event by ID (for replay)
     */
    async getEvent(eventId: string): Promise<SystemEvent | null> {
        return await this.orchestrator.getEvent(eventId);
    }

    /**
     * Replay events (for recovery/reprocessing)
     */
    async replayEvents(
        eventType: EventType,
        fromTimestamp?: string,
        toTimestamp?: string
    ): Promise<void> {
        return await this.orchestrator.replayEvents(eventType, fromTimestamp, toTimestamp);
    }

    /**
     * Get subscription count for monitoring
     */
    getSubscriptionCount(eventType: EventType): number {
        return this.orchestrator.getSubscriptionCount(eventType);
    }

    /**
     * Get all subscriptions (for monitoring)
     */
    getAllSubscriptions(): Map<EventType, EventSubscription[]> {
        return this.orchestrator.getAllSubscriptions();
    }

    /**
     * Get queue statistics
     */
    getQueueStats() {
        return this.orchestrator.getQueueStats();
    }
}

// Singleton instance
let eventBusInstance: EventBus | null = null;

export function getEventBus(): EventBus {
    if (!eventBusInstance) {
        // Import here to avoid circular dependency
        const { EventStore } = require('./eventStore');
        const eventStore = new EventStore();
        eventBusInstance = new EventBus(eventStore);
    }
    return eventBusInstance;
}