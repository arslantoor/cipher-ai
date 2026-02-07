// Base Agent class - All agents extend this
// Follows lifecycle: INIT → LISTEN → ANALYZE → EMIT → IDLE/TERMINATE
// See AGENT_LIFECYCLE.md for detailed documentation
import { EventBus } from '../events/eventBus';
import { SystemEvent, EventType, EventHandler } from '../events/types';
import { db } from '../config/database';
import { AuditService } from '../services/audit';
import { v4 as uuidv4 } from 'uuid';

export enum AgentLifecycleStage {
    INIT = 'init',
    LISTEN = 'listen',
    ANALYZE = 'analyze',
    EMIT = 'emit',
    IDLE = 'idle',
    TERMINATE = 'terminate',
}

export abstract class BaseAgent {
    protected agentId: string;
    protected agentType: string;
    protected eventBus: EventBus;
    protected isRunning: boolean = false;
    protected currentStage: AgentLifecycleStage = AgentLifecycleStage.INIT;
    private heartbeatInterval?: NodeJS.Timeout;

    constructor(agentType: string, agentId?: string) {
        this.agentType = agentType;
        this.agentId = agentId || `${agentType}-${uuidv4()}`;
        // Lazy load to avoid circular dependency
        const { getEventBus } = require('../events/eventBus');
        this.eventBus = getEventBus();
    }

    /**
     * INIT: Initialize internal state, connect to services, subscribe to events
     * Lifecycle Stage 1
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            throw new Error(`Agent ${this.agentId} is already running`);
        }

        this.currentStage = AgentLifecycleStage.INIT;
        this.isRunning = true;

        // INIT phase: Register, subscribe, start monitoring
        this.registerAgent();
        this.setupSubscriptions(); // LISTEN phase begins here
        this.startHeartbeat();

        // Allow subclasses to perform additional initialization
        await this.onStart();

        this.currentStage = AgentLifecycleStage.LISTEN; // Ready to listen

        AuditService.log({
            action: 'AGENT_STARTED',
            resource_type: 'agent',
            resource_id: this.agentId,
            details: JSON.stringify({
                agent_type: this.agentType,
                lifecycle_stage: this.currentStage,
            }),
        });

        console.log(`[${this.agentType}] Agent ${this.agentId} started (stage: ${this.currentStage})`);
    }

    /**
     * TERMINATE: Clean up resources, unsubscribe, stop monitoring
     * Lifecycle Stage 5
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        this.currentStage = AgentLifecycleStage.TERMINATE;
        this.isRunning = false;

        // TERMINATE phase: Clean up
        this.stopHeartbeat();
        this.unregisterAgent();
        this.eventBus.unsubscribe(this.agentId);

        // Allow subclasses to perform additional cleanup
        await this.onStop();

        AuditService.log({
            action: 'AGENT_STOPPED',
            resource_type: 'agent',
            resource_id: this.agentId,
            details: JSON.stringify({
                agent_type: this.agentType,
                lifecycle_stage: this.currentStage,
            }),
        });

        console.log(`[${this.agentType}] Agent ${this.agentId} stopped`);
    }

    /**
     * Get agent ID
     */
    getId(): string {
        return this.agentId;
    }

    /**
     * Get agent type
     */
    getType(): string {
        return this.agentType;
    }

    /**
     * Check if agent is running
     */
    isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Get current lifecycle stage
     */
    getCurrentStage(): AgentLifecycleStage {
        return this.currentStage;
    }

    /**
     * Setup event subscriptions (implemented by subclasses)
     */
    protected abstract setupSubscriptions(): void;

    /**
     * Lifecycle hooks (can be overridden)
     */
    protected async onStart(): Promise<void> {
        // Override in subclasses
    }

    protected async onStop(): Promise<void> {
        // Override in subclasses
    }

    /**
     * LISTEN: Subscribe to event types relevant to agent's responsibilities
     * Lifecycle Stage 2 - Called during INIT
     * Agents only subscribe to events within their scope
     */
    protected subscribe(
        eventType: EventType | EventType[],
        handler: EventHandler,
        priority: number = 0
    ): void {
        // Wrap handler to track lifecycle stages
        const wrappedHandler = async (event: SystemEvent) => {
            // ANALYZE phase begins
            this.currentStage = AgentLifecycleStage.ANALYZE;
            
            try {
                // Call original handler
                await handler(event);
                
                // EMIT phase (if handler publishes events)
                this.currentStage = AgentLifecycleStage.EMIT;
                
                // Return to IDLE/LISTEN state
                this.currentStage = AgentLifecycleStage.LISTEN;
            } catch (error: any) {
                // Log error and return to LISTEN state
                this.logAction('ERROR', {
                    error: error.message,
                    event_id: event.event_id,
                    event_type: event.event_type,
                });
                this.currentStage = AgentLifecycleStage.LISTEN;
                throw error;
            }
        };

        this.eventBus.subscribe({
            event_type: eventType,
            handler: wrappedHandler,
            agent_id: this.agentId,
            priority,
        });
    }

    /**
     * EMIT: Publish events to other agents or external systems
     * Lifecycle Stage 4
     * All outputs must be auditable, logged, and traceable
     */
    protected async publish(event: SystemEvent): Promise<void> {
        // Ensure event has required fields
        event.source_agent = this.agentId;
        if (!event.event_id) {
            event.event_id = uuidv4();
        }
        if (!event.timestamp) {
            event.timestamp = new Date().toISOString();
        }

        // Log emission for audit trail
        this.logAction('EVENT_EMITTED', {
            event_id: event.event_id,
            event_type: event.event_type,
            correlation_id: event.correlation_id,
        });

        await this.eventBus.publish(event);
    }

    /**
     * Register agent in database
     */
    private registerAgent(): void {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO agent_registry (
                id, agent_id, agent_type, status, last_heartbeat, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            uuidv4(),
            this.agentId,
            this.agentType,
            'running',
            new Date().toISOString(),
            new Date().toISOString()
        );
    }

    /**
     * Unregister agent
     */
    private unregisterAgent(): void {
        db.prepare(`
            UPDATE agent_registry
            SET status = 'stopped', updated_at = ?
            WHERE agent_id = ?
        `).run(new Date().toISOString(), this.agentId);
    }

    /**
     * Start heartbeat for health monitoring
     */
    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            if (this.isRunning) {
                db.prepare(`
                    UPDATE agent_registry
                    SET last_heartbeat = ?, updated_at = ?
                    WHERE agent_id = ?
                `).run(new Date().toISOString(), new Date().toISOString(), this.agentId);
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * Stop heartbeat
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = undefined;
        }
    }

    /**
     * Log agent action
     */
    protected logAction(action: string, details?: Record<string, any>): void {
        AuditService.log({
            action: `AGENT_${action}`,
            resource_type: 'agent',
            resource_id: this.agentId,
            details: JSON.stringify({
                agent_type: this.agentType,
                ...details,
            }),
        });
    }
}