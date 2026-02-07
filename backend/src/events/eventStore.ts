// Event Store - Persists events for replay and idempotency
import { db } from '../config/database';
import { SystemEvent, EventType } from './types';
import { v4 as uuidv4 } from 'uuid';

export class EventStore {
    /**
     * Store event for replay/idempotency
     */
    async storeEvent(event: SystemEvent): Promise<void> {
        const stmt = db.prepare(`
            INSERT INTO event_store (
                id, event_type, event_data, source_agent, correlation_id,
                metadata, created_at, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            event.event_id,
            event.event_type,
            JSON.stringify(event),
            event.source_agent || null,
            event.correlation_id || null,
            JSON.stringify(event.metadata || {}),
            event.timestamp,
            'pending'
        );
    }

    /**
     * Get event by ID
     */
    async getEvent(eventId: string): Promise<SystemEvent | null> {
        const row = db.prepare('SELECT * FROM event_store WHERE id = ?').get(eventId) as any;
        
        if (!row) return null;

        return JSON.parse(row.event_data);
    }

    /**
     * Get events by type and time range
     */
    async getEvents(
        eventType: EventType,
        fromTimestamp?: string,
        toTimestamp?: string
    ): Promise<SystemEvent[]> {
        let query = 'SELECT * FROM event_store WHERE event_type = ?';
        const params: any[] = [eventType];

        if (fromTimestamp) {
            query += ' AND created_at >= ?';
            params.push(fromTimestamp);
        }

        if (toTimestamp) {
            query += ' AND created_at <= ?';
            params.push(toTimestamp);
        }

        query += ' ORDER BY created_at ASC';

        const rows = db.prepare(query).all(...params) as any[];
        return rows.map(row => JSON.parse(row.event_data));
    }

    /**
     * Check if event was processed by agent (idempotency)
     */
    async isEventProcessed(eventId: string, agentId: string): Promise<boolean> {
        const row = db.prepare(`
            SELECT 1 FROM event_processing_log
            WHERE event_id = ? AND agent_id = ?
            LIMIT 1
        `).get(eventId, agentId) as any;

        return !!row;
    }

    /**
     * Mark event as processed by agent
     */
    async markEventProcessed(eventId: string, agentId: string): Promise<void> {
        // Check if already logged
        const existing = db.prepare(`
            SELECT 1 FROM event_processing_log
            WHERE event_id = ? AND agent_id = ?
        `).get(eventId, agentId) as any;

        if (existing) {
            return; // Already processed
        }

        const stmt = db.prepare(`
            INSERT INTO event_processing_log (id, event_id, agent_id, processed_at)
            VALUES (?, ?, ?, ?)
        `);

        stmt.run(
            uuidv4(),
            eventId,
            agentId,
            new Date().toISOString()
        );

        // Update event status
        db.prepare(`
            UPDATE event_store
            SET status = 'completed'
            WHERE id = ?
        `).run(eventId);
    }

    /**
     * Get processing history for an event
     */
    async getProcessingHistory(eventId: string): Promise<any[]> {
        return db.prepare(`
            SELECT * FROM event_processing_log
            WHERE event_id = ?
            ORDER BY processed_at ASC
        `).all(eventId) as any[];
    }

    /**
     * Get failed events for retry
     */
    async getFailedEvents(limit: number = 100): Promise<SystemEvent[]> {
        const rows = db.prepare(`
            SELECT * FROM event_store
            WHERE status = 'failed'
            ORDER BY created_at ASC
            LIMIT ?
        `).all(limit) as any[];

        return rows.map(row => JSON.parse(row.event_data));
    }
}