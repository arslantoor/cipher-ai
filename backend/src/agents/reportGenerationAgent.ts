// Investigation / Report Generator Agent
// Agent Role: INVESTIGATION / REPORT GENERATOR
// Purpose: Generate human-readable investigation narratives and actionable summaries for detected fraud events
// See AGENT_LIFECYCLE.md for lifecycle documentation
import { BaseAgent, AgentLifecycleStage } from './baseAgent';
import {
    EventType,
    FraudAlertCreatedEvent,
    ReportGeneratedEvent,
    ReportFailedEvent,
    SystemEvent,
} from '../events/types';
import { ReportGenerator, ReportContext, GeneratedReport } from '../services/reportGenerator';
import { InvestigationService } from '../services/investigation';
import { BaselineAnalyzer } from '../services/baseline';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export class ReportGenerationAgent extends BaseAgent {
    private reportGenerator: ReportGenerator;
    private baselineAnalyzer: BaselineAnalyzer;
    private processedAlertIds: Set<string> = new Set(); // Archive for duplicate prevention

    constructor(agentId?: string) {
        super('investigation_report_generator', agentId);
        this.reportGenerator = new ReportGenerator();
        this.baselineAnalyzer = new BaselineAnalyzer();
    }

    /**
     * INIT: Subscribe to FRAUD_ALERT events from Fraud Detector Agent
     * Initialize AI model (Google Gemini) for narrative generation
     */
    protected async onStart(): Promise<void> {
        // AI model is initialized in ReportGenerator constructor
        // Load processed alert IDs from database to avoid duplicates
        await this.loadProcessedAlerts();
        
        this.logAction('AI_MODEL_INITIALIZED', {
            model: 'Google Gemini',
        });
    }

    /**
     * LISTEN: Receive fraud alerts with all associated metadata and anomaly scores
     */
    protected setupSubscriptions(): void {
        // Subscribe to FRAUD_ALERT_CREATED events from Fraud Detector Agent
        this.subscribe(
            EventType.FRAUD_ALERT_CREATED,
            this.handleFraudAlert.bind(this),
            5
        );
    }

    /**
     * ANALYZE: Validate alert data, correlate with history, generate investigation summary
     */
    private async handleFraudAlert(event: FraudAlertCreatedEvent): Promise<void> {
        const startTime = Date.now();
        const { alert_id, user_id, alert_type, severity, score, timestamp } = event.payload;
        const metadata = event.metadata || {};
        const transaction_id = metadata.transaction_id;
        const signals = metadata.signals || {};

        try {
            // TERMINATE/IDLE: Archive processed alert IDs to avoid duplicates
            if (this.processedAlertIds.has(alert_id)) {
                this.logAction('ALERT_ALREADY_PROCESSED', {
                    alert_id,
                    user_id,
                });
                return; // Already processed, idempotent
            }

            this.logAction('INVESTIGATION_STARTED', {
                alert_id,
                user_id,
                severity,
                score,
            });

            // ANALYZE: Validate the alert data for completeness and correctness
            const validationResult = this.validateAlertData(event);
            if (!validationResult.valid) {
                throw new Error(`Alert validation failed: ${validationResult.errors.join(', ')}`);
            }

            // ANALYZE: Correlate with historical user behavior and prior alerts
            const correlationData = await this.correlateWithHistory(user_id, alert_id, transaction_id);

            // Fetch fraud data and context
            const reportContext = await this.fetchReportContext(
                transaction_id,
                alert_id, // Use alert_id as fraud_detection_id
                undefined,
                correlationData
            );

            if (!reportContext) {
                throw new Error('Unable to fetch report context');
            }

            // Override with event data
            reportContext.severity = this.mapSeverity(severity);
            reportContext.risk_score = score;
            reportContext.transaction_id = transaction_id;
            reportContext.fraud_detection_id = alert_id;
            reportContext.user_id = user_id;

            // ANALYZE: Apply AI model to generate professional, compliance-ready investigation summary
            // Determine report type based on severity
            const report_type = this.determineReportType(severity);
            
            // Generate report using AI (language only, no scoring)
            const report = await this.reportGenerator.generateInvestigationReport(reportContext, report_type);

            // Store report in database
            this.storeInvestigationReport(report, {
                alert_id,
                transaction_id,
                user_id,
                severity,
                score,
            });

            // Mark alert as processed
            this.processedAlertIds.add(alert_id);
            this.archiveProcessedAlert(alert_id, report.report_id);

            const generationTime = Date.now() - startTime;

            // EMIT: Output detailed investigation report
            const investigationId = `INV-${alert_id}`;
            
            const reportEvent: ReportGeneratedEvent = {
                event_id: uuidv4(),
                event_type: EventType.REPORT_GENERATED,
                timestamp: new Date().toISOString(),
                source_agent: this.agentId,
                correlation_id: event.event_id,
                payload: {
                    investigation_id: investigationId,
                    report_id: report.report_id,
                    report_type,
                    narrative: report.investigation_narrative, // 180-220 words
                    generated_at: report.generated_at,
                    generation_time_ms: generationTime,
                },
                metadata: {
                    report_data: {
                        markdown: report.markdown_content,
                        structured: report.structured_data,
                    },
                },
            };

            await this.publish(reportEvent);

            this.logAction('INVESTIGATION_REPORT_GENERATED', {
                report_id: report.report_id,
                alert_id,
                investigation_id: investigationId,
                report_type,
                generation_time_ms: generationTime,
                severity,
            });
        } catch (error: any) {
            const retryCount = (event.metadata?.retry_count || 0) + 1;

            const failEvent: ReportFailedEvent = {
                event_id: uuidv4(),
                event_type: EventType.REPORT_FAILED,
                timestamp: new Date().toISOString(),
                source_agent: this.agentId,
                correlation_id: event.event_id,
                payload: {
                    investigation_id: `INV-${alert_id}` || 'unknown',
                    error: error.message,
                    retry_count: retryCount,
                },
            };

            await this.publish(failEvent);

            this.logAction('INVESTIGATION_FAILED', {
                alert_id,
                user_id,
                error: error.message,
                retry_count: retryCount,
            });

            // Re-throw if max retries exceeded
            if (retryCount >= 3) {
                throw error;
            }
        }
    }

    /**
     * Validate alert data for completeness and correctness
     */
    private validateAlertData(event: FraudAlertCreatedEvent): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const { alert_id, user_id, severity, score } = event.payload;

        if (!alert_id) errors.push('Missing alert_id');
        if (!user_id) errors.push('Missing user_id');
        if (!severity) errors.push('Missing severity');
        if (score === undefined || score < 0 || score > 100) {
            errors.push('Invalid score (must be 0-100)');
        }
        if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
            errors.push(`Invalid severity: ${severity}`);
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Correlate with historical user behavior and prior alerts
     */
    private async correlateWithHistory(
        userId: string,
        alertId: string,
        transactionId?: string
    ): Promise<{
        prior_alerts: number;
        user_activity_summary: any;
        similar_patterns: string[];
    }> {
        // Count prior alerts for this user
        const priorAlerts = db.prepare(`
            SELECT COUNT(*) as count
            FROM fraud_detections
            WHERE user_id = ? AND id != ?
        `).get(userId, alertId) as { count: number };

        // Get user activity summary
        const userActivity = InvestigationService.getUserActivity(userId);

        // Find similar patterns (alerts with similar severity/score)
        const similarPatterns = db.prepare(`
            SELECT id, severity, risk_score
            FROM fraud_detections
            WHERE user_id = ? AND id != ?
            ORDER BY detected_at DESC
            LIMIT 5
        `).all(userId, alertId) as Array<{ id: string; severity: string; risk_score: number }>;

        return {
            prior_alerts: priorAlerts.count || 0,
            user_activity_summary: userActivity ? {
                account_age_days: userActivity.account_age_days,
                transaction_count: userActivity.transaction_history?.length || 0,
            } : null,
            similar_patterns: similarPatterns.map(p => `${p.severity}-${p.risk_score}`),
        };
    }

    /**
     * Map severity from alert format to report format
     */
    private mapSeverity(severity: string): 'MEDIUM' | 'HIGH' | 'CRITICAL' {
        const mapping: Record<string, 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
            low: 'MEDIUM',
            medium: 'MEDIUM',
            high: 'HIGH',
            critical: 'CRITICAL',
        };
        return mapping[severity.toLowerCase()] || 'MEDIUM';
    }

    /**
     * Determine report type based on severity
     */
    private determineReportType(severity: string): 'internal' | 'compliance' | 'full' {
        if (severity === 'critical' || severity === 'high') {
            return 'full';
        } else if (severity === 'medium') {
            return 'compliance';
        }
        return 'internal';
    }

    /**
     * Load processed alert IDs from database
     */
    private async loadProcessedAlerts(): Promise<void> {
        const processed = db.prepare(`
            SELECT DISTINCT fraud_detection_id as alert_id
            FROM reports
            WHERE fraud_detection_id IS NOT NULL
        `).all() as Array<{ alert_id: string }>;

        processed.forEach(row => {
            this.processedAlertIds.add(row.alert_id);
        });
    }

    /**
     * Archive processed alert ID
     */
    private archiveProcessedAlert(alertId: string, reportId: string): void {
        // Already stored in reports table with fraud_detection_id
        // This is just for in-memory tracking
        this.processedAlertIds.add(alertId);
    }

    /**
     * Fetch report context from database
     */
    private async fetchReportContext(
        transactionId?: string,
        fraudDetectionId?: string,
        investigationId?: string,
        correlationData?: any
    ): Promise<ReportContext | null> {
        // Try fraud detection first
        if (fraudDetectionId) {
            const fraudDetection = db.prepare(`
                SELECT * FROM fraud_detections
                WHERE id = ?
            `).get(fraudDetectionId) as any;

            if (fraudDetection) {
                const signals = JSON.parse(fraudDetection.signals);
                const config = JSON.parse(fraudDetection.config_used);

                // Get transaction data if available
                let transactionData: any = {};
                if (transactionId) {
                    // In production, fetch from transactions table
                    transactionData = { transaction_id: transactionId };
                }

                // Get user activity for baseline
                const userActivity = InvestigationService.getUserActivity(fraudDetection.user_id);
                const baseline = userActivity ? this.calculateBaseline(userActivity) : undefined;

                // Build timeline
                const timeline = this.buildTimeline(fraudDetection, signals);

                return {
                    user_id: fraudDetection.user_id,
                    fraud_detection_id: fraudDetectionId,
                    severity: fraudDetection.severity as 'MEDIUM' | 'HIGH' | 'CRITICAL',
                    risk_score: fraudDetection.risk_score,
                    fraud_signals: signals,
                    transaction_data: transactionData,
                    timeline,
                    baseline,
                    correlation_data: correlationData,
                };
            }
        }

        // Try investigation
        if (investigationId) {
            const investigation = InvestigationService.getInvestigationById(investigationId);

            if (investigation) {
                return {
                    user_id: investigation.alert.user_id,
                    investigation_id: investigationId,
                    severity: investigation.severity.toUpperCase() as 'MEDIUM' | 'HIGH' | 'CRITICAL',
                    risk_score: investigation.confidence_signals.final_score,
                    fraud_signals: {
                        amount_deviation: {},
                        velocity_anomaly: {},
                        geographic_inconsistency: {},
                        rule_flags: { triggered: investigation.confidence_signals.triggered_deviations },
                    },
                    timeline: investigation.timeline.map(e => ({
                        timestamp: e.timestamp,
                        event: e.event,
                        details: e.details,
                    })),
                };
            }
        }

        return null;
    }

    /**
     * Calculate baseline from user activity
     */
    private calculateBaseline(userActivity: any): ReportContext['baseline'] {
        const baseline = this.baselineAnalyzer.calculateBaseline(userActivity);
        return {
            avg_transaction_amount: baseline.avg_transaction_amount,
            typical_transaction_hours: baseline.typical_transaction_hours,
            common_locations: baseline.common_locations,
        };
    }

    /**
     * Build timeline from fraud detection
     */
    private buildTimeline(fraudDetection: any, signals: any): ReportContext['timeline'] {
        const timeline: ReportContext['timeline'] = [];

        timeline.push({
            timestamp: fraudDetection.detected_at,
            event: 'Fraud detection triggered',
            details: `Risk score: ${fraudDetection.risk_score}, Severity: ${fraudDetection.severity}`,
        });

        if (signals.amount_deviation?.detected) {
            timeline.push({
                timestamp: fraudDetection.detected_at,
                event: 'Amount deviation detected',
                details: signals.amount_deviation.explanation,
            });
        }

        if (signals.velocity_anomaly?.detected) {
            timeline.push({
                timestamp: fraudDetection.detected_at,
                event: 'Velocity anomaly detected',
                details: signals.velocity_anomaly.explanation,
            });
        }

        if (signals.geographic_inconsistency?.detected) {
            timeline.push({
                timestamp: fraudDetection.detected_at,
                event: 'Geographic inconsistency detected',
                details: signals.geographic_inconsistency.explanation,
            });
        }

        if (signals.rule_flags?.triggered?.length > 0) {
            timeline.push({
                timestamp: fraudDetection.detected_at,
                event: 'Rule flags triggered',
                details: signals.rule_flags.explanation,
            });
        }

        return timeline;
    }

    /**
     * Store investigation report in database
     */
    private storeInvestigationReport(
        report: GeneratedReport,
        alertData: {
            alert_id: string;
            transaction_id?: string;
            user_id: string;
            severity: string;
            score: number;
        }
    ): void {
        const stmt = db.prepare(`
            INSERT INTO reports (
                id, transaction_id, fraud_detection_id, investigation_id,
                report_type, severity, risk_score,
                executive_summary, fraud_explanation, timeline_narrative,
                risk_justification, markdown_content, structured_data,
                generated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            report.report_id,
            alertData.transaction_id || null,
            alertData.alert_id || null, // fraud_detection_id
            null, // investigation_id (created later)
            report.report_type,
            alertData.severity.toUpperCase(),
            alertData.score,
            report.executive_summary,
            report.fraud_explanation,
            report.timeline,
            report.risk_justification,
            report.markdown_content,
            JSON.stringify(report.structured_data),
            report.generated_at
        );
    }
}