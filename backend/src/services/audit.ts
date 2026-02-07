import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogEntry {
    id: string;
    user_id?: string;
    action: string;
    resource_type?: string;
    resource_id?: string;
    details?: string;
    ip_address?: string;
    user_agent?: string;
    timestamp: string;
}

export class AuditService {
    /**
     * Log any action for compliance and security monitoring
     */
    static log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
        const stmt = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            uuidv4(),
            entry.user_id || null,
            entry.action,
            entry.resource_type || null,
            entry.resource_id || null,
            entry.details || null,
            entry.ip_address || null,
            entry.user_agent || null
        );
    }

    /**
     * Get audit logs with filtering
     */
    static getLogs(filters: {
        user_id?: string;
        action?: string;
        resource_type?: string;
        start_date?: string;
        end_date?: string;
        limit?: number;
    }): AuditLogEntry[] {
        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const params: any[] = [];

        if (filters.user_id) {
            query += ' AND user_id = ?';
            params.push(filters.user_id);
        }

        if (filters.action) {
            query += ' AND action = ?';
            params.push(filters.action);
        }

        if (filters.resource_type) {
            query += ' AND resource_type = ?';
            params.push(filters.resource_type);
        }

        if (filters.start_date) {
            query += ' AND timestamp >= ?';
            params.push(filters.start_date);
        }

        if (filters.end_date) {
            query += ' AND timestamp <= ?';
            params.push(filters.end_date);
        }

        query += ' ORDER BY timestamp DESC';

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }

        const stmt = db.prepare(query);
        return stmt.all(...params) as AuditLogEntry[];
    }

    /**
     * Get audit summary for admin dashboard
     */
    static getSummary(days: number = 7): any {
        const stmt = db.prepare(`
      SELECT 
        action,
        COUNT(*) as count,
        DATE(timestamp) as date
      FROM audit_logs
      WHERE timestamp >= datetime('now', '-' || ? || ' days')
      GROUP BY action, DATE(timestamp)
      ORDER BY date DESC, count DESC
    `);

        return stmt.all(days);
    }
}
