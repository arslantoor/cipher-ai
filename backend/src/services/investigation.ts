import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { EncryptionService } from './encryption';
import { AuditService } from './audit';
import { Alert, UserActivity, Investigation, SeverityLevel } from '../types';

export class InvestigationService {
    /**
     * Create a new alert
     */
    static createAlert(alert: Alert, createdBy: string): string {
        const alertId = alert.alert_id || uuidv4();

        // Encrypt sensitive raw data
        const encryptedData = EncryptionService.encrypt(alert.raw_data);

        const stmt = db.prepare(`
      INSERT INTO alerts (id, user_id, alert_type, timestamp, triggered_rules, raw_data_encrypted)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            alertId,
            alert.user_id,
            alert.alert_type,
            alert.timestamp,
            JSON.stringify(alert.triggered_rules),
            encryptedData
        );

        AuditService.log({
            user_id: createdBy,
            action: 'ALERT_CREATED',
            resource_type: 'alert',
            resource_id: alertId,
            details: JSON.stringify({ alert_type: alert.alert_type, user_id: alert.user_id }),
        });

        return alertId;
    }

    /**
     * Get alert by ID
     */
    static getAlert(alertId: string): Alert | null {
        const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as any;

        if (!row) return null;

        return {
            alert_id: row.id,
            user_id: row.user_id,
            alert_type: row.alert_type,
            timestamp: row.timestamp,
            triggered_rules: JSON.parse(row.triggered_rules),
            raw_data: EncryptionService.decrypt(row.raw_data_encrypted),
        };
    }

    /**
     * Store user activity data
     */
    static storeUserActivity(userActivity: UserActivity, createdBy: string): string {
        const activityId = uuidv4();

        // Encrypt sensitive activity data
        const encryptedData = EncryptionService.encrypt({
            login_locations: userActivity.login_locations,
            device_fingerprints: userActivity.device_fingerprints,
            transaction_history: userActivity.transaction_history,
        });

        const stmt = db.prepare(`
      INSERT INTO user_activities (id, user_id, account_age_days, encrypted_data)
      VALUES (?, ?, ?, ?)
    `);

        stmt.run(
            activityId,
            userActivity.user_id,
            userActivity.account_age_days,
            encryptedData
        );

        AuditService.log({
            user_id: createdBy,
            action: 'USER_ACTIVITY_STORED',
            resource_type: 'user_activity',
            resource_id: activityId,
        });

        return activityId;
    }

    /**
     * Get user activity by user ID
     */
    static getUserActivity(userId: string): UserActivity | null {
        const row = db.prepare('SELECT * FROM user_activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId) as any;

        if (!row) return null;

        const decryptedData = EncryptionService.decrypt(row.encrypted_data);

        return {
            user_id: row.user_id,
            account_age_days: row.account_age_days,
            ...decryptedData,
        };
    }

    /**
     * Create investigation record
     */
    static createInvestigation(investigation: Investigation, analystId: string): string {
        const stmt = db.prepare(`
      INSERT INTO investigations (
        id, alert_id, user_id, analyst_id, severity, status, 
        narrative, confidence_score, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            investigation.investigation_id,
            investigation.alert.alert_id,
            investigation.alert.user_id,
            analystId,
            investigation.severity,
            'new',
            investigation.narrative,
            investigation.confidence_signals.final_score,
            investigation.generated_at
        );

        AuditService.log({
            user_id: analystId,
            action: 'INVESTIGATION_CREATED',
            resource_type: 'investigation',
            resource_id: investigation.investigation_id,
            details: JSON.stringify({
                severity: investigation.severity,
                alert_id: investigation.alert.alert_id
            }),
        });

        return investigation.investigation_id;
    }

    /**
     * Update investigation status
     */
    static updateInvestigationStatus(
        investigationId: string,
        status: 'new' | 'in_progress' | 'resolved' | 'escalated' | 'closed',
        analystId: string
    ): void {
        const updateData: any = { status };

        if (status === 'resolved' || status === 'closed') {
            updateData.resolved_at = new Date().toISOString();
        }

        const stmt = db.prepare(`
      UPDATE investigations 
      SET status = ?, updated_at = CURRENT_TIMESTAMP, resolved_at = ?
      WHERE id = ?
    `);

        stmt.run(status, updateData.resolved_at || null, investigationId);

        AuditService.log({
            user_id: analystId,
            action: 'INVESTIGATION_STATUS_UPDATED',
            resource_type: 'investigation',
            resource_id: investigationId,
            details: JSON.stringify({ new_status: status }),
        });
    }

    /**
     * Log investigation action
     */
    static logAction(
        investigationId: string,
        analystId: string,
        actionType: string,
        actionDetails?: string
    ): void {
        const stmt = db.prepare(`
      INSERT INTO investigation_actions (id, investigation_id, analyst_id, action_type, action_details)
      VALUES (?, ?, ?, ?, ?)
    `);

        stmt.run(uuidv4(), investigationId, analystId, actionType, actionDetails || null);

        AuditService.log({
            user_id: analystId,
            action: 'INVESTIGATION_ACTION',
            resource_type: 'investigation',
            resource_id: investigationId,
            details: JSON.stringify({ action_type: actionType }),
        });
    }

    /**
     * Get investigations for analyst
     */
    static getInvestigations(filters: {
        analyst_id?: string;
        status?: string;
        severity?: string;
        limit?: number;
    }): any[] {
        let query = 'SELECT * FROM investigations WHERE 1=1';
        const params: any[] = [];

        if (filters.analyst_id) {
            query += ' AND analyst_id = ?';
            params.push(filters.analyst_id);
        }

        if (filters.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }

        if (filters.severity) {
            query += ' AND severity = ?';
            params.push(filters.severity);
        }

        query += ' ORDER BY created_at DESC';

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }

        const stmt = db.prepare(query);
        return stmt.all(...params);
    }

    /**
     * Get investigation statistics
     */
    static getStatistics(analystId?: string): any {
        const baseQuery = analystId
            ? 'SELECT * FROM investigations WHERE analyst_id = ?'
            : 'SELECT * FROM investigations';

        const params = analystId ? [analystId] : [];

        const investigations = db.prepare(baseQuery).all(...params);

        const stats = {
            total: investigations.length,
            by_status: {} as Record<string, number>,
            by_severity: {} as Record<string, number>,
            avg_resolution_time: 0,
            pending: 0,
        };

        investigations.forEach((inv: any) => {
            stats.by_status[inv.status] = (stats.by_status[inv.status] || 0) + 1;
            stats.by_severity[inv.severity] = (stats.by_severity[inv.severity] || 0) + 1;

            if (inv.status === 'new' || inv.status === 'in_progress') {
                stats.pending++;
            }
        });

        return stats;
    }

    /**
     * Get investigation by ID
     */
    static getInvestigationById(investigationId: string): Investigation | null {
        const row = db.prepare('SELECT * FROM investigations WHERE id = ?').get(investigationId) as any;

        if (!row) return null;

        // Get alert
        const alert = this.getAlert(row.alert_id);
        if (!alert) return null;

        // Get user activity
        const userActivity = this.getUserActivity(row.user_id);
        if (!userActivity) return null;

        // Reconstruct investigation (simplified - in production, store full investigation JSON)
        return {
            investigation_id: row.id,
            alert,
            user_activity: userActivity,
            severity: row.severity as any,
            timeline: [],
            narrative: row.narrative || '',
            allowed_actions: [],
            confidence_signals: {
                base_score: 0,
                deviation_multiplier: 1,
                final_score: row.confidence_score || 0,
                thresholds_used: {},
                triggered_deviations: [],
            },
            audit_trail: {
                timestamp: row.created_at,
                alert_id: row.alert_id,
                user_id: row.user_id,
                severity_assigned: row.severity as any,
                thresholds_applied: {},
                final_score: row.confidence_score || 0,
                deviation_multiplier: 1,
            },
            generated_at: row.created_at,
            pattern_signature: [],
            detection_summary: '',
        };
    }

    /**
     * Update investigation narrative
     */
    static updateInvestigationNarrative(investigationId: string, narrative: string): void {
        db.prepare(`
            UPDATE investigations
            SET narrative = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(narrative, investigationId);

        AuditService.log({
            action: 'INVESTIGATION_NARRATIVE_UPDATED',
            resource_type: 'investigation',
            resource_id: investigationId,
            details: JSON.stringify({ narrative_length: narrative.length }),
        });
    }
}
