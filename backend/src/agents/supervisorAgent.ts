// Supervisor Agent - Validates report quality and flags anomalies
import { BaseAgent } from './baseAgent';
import {
    EventType,
    ReportGeneratedEvent,
    ReportApprovedEvent,
    ReportNeedsReviewEvent,
    SupervisorReviewRequestedEvent,
    SupervisorQAPassedEvent,
    SupervisorQAFailedEvent,
    InvestigationCreatedEvent,
    SystemEvent,
} from '../events/types';
import { ReportValidator, ReportValidationContext } from '../services/reportValidator';
import { InvestigationService } from '../services/investigation';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export class SupervisorAgent extends BaseAgent {
    private reportValidator: ReportValidator;

    constructor(agentId?: string) {
        super('supervisor', agentId);
        this.reportValidator = new ReportValidator();
    }

    protected setupSubscriptions(): void {
        // Subscribe to report generated events (primary responsibility)
        this.subscribe(
            EventType.REPORT_GENERATED,
            this.handleReportGenerated.bind(this),
            8 // High priority
        );

        // Subscribe to review requests (legacy)
        this.subscribe(
            EventType.SUPERVISOR_REVIEW_REQUESTED,
            this.handleReviewRequest.bind(this),
            5
        );

        // Monitor investigations for quality checks
        this.subscribe(
            EventType.INVESTIGATION_CREATED,
            this.handleInvestigationCreated.bind(this),
            3
        );
    }

    /**
     * Handle report generated event - validate report quality
     */
    private async handleReportGenerated(event: ReportGeneratedEvent): Promise<void> {
        try {
            const { report_id, investigation_id, report_type } = event.payload;

            this.logAction('REPORT_VALIDATION_STARTED', {
                report_id,
                investigation_id,
                report_type,
            });

            // Fetch report from database
            const report = this.getReport(report_id);
            if (!report) {
                throw new Error(`Report ${report_id} not found`);
            }

            // Build validation context
            const validationContext: ReportValidationContext = {
                report_id: report.id,
                report_type: report.report_type as 'internal' | 'compliance' | 'full',
                severity: report.severity as 'MEDIUM' | 'HIGH' | 'CRITICAL',
                risk_score: report.risk_score,
                executive_summary: report.executive_summary,
                fraud_explanation: report.fraud_explanation,
                timeline_narrative: report.timeline_narrative,
                risk_justification: report.risk_justification,
                structured_data: JSON.parse(report.structured_data),
                markdown_content: report.markdown_content,
            };

            // Validate report quality
            const validationResult = await this.reportValidator.validateReport(validationContext);

            // Store validation result
            this.storeValidationResult(report_id, validationResult);

            // Emit appropriate event based on validation
            if (validationResult.passed) {
                await this.emitReportApproved(event, report_id, investigation_id, validationResult);
            } else {
                await this.emitReportNeedsReview(event, report_id, investigation_id, validationResult);
            }

            this.logAction('REPORT_VALIDATION_COMPLETED', {
                report_id,
                passed: validationResult.passed,
                validation_score: validationResult.validation_score,
                issues_count: validationResult.issues.length,
            });
        } catch (error: any) {
            this.logAction('REPORT_VALIDATION_ERROR', {
                report_id: event.payload.report_id,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Emit ReportApproved event
     */
    private async emitReportApproved(
        sourceEvent: ReportGeneratedEvent,
        reportId: string,
        investigationId: string,
        validationResult: any
    ): Promise<void> {
        const approvedEvent: ReportApprovedEvent = {
            event_id: uuidv4(),
            event_type: EventType.REPORT_APPROVED,
            timestamp: new Date().toISOString(),
            source_agent: this.agentId,
            correlation_id: sourceEvent.event_id,
            payload: {
                report_id: reportId,
                investigation_id: investigationId,
                validation_score: validationResult.validation_score,
                validation_notes: validationResult.feedback,
                approved_at: new Date().toISOString(),
            },
        };

        await this.publish(approvedEvent);

        this.logAction('REPORT_APPROVED', {
            report_id: reportId,
            validation_score: validationResult.validation_score,
        });
    }

    /**
     * Emit ReportNeedsReview event
     */
    private async emitReportNeedsReview(
        sourceEvent: ReportGeneratedEvent,
        reportId: string,
        investigationId: string,
        validationResult: any
    ): Promise<void> {
        const reviewEvent: ReportNeedsReviewEvent = {
            event_id: uuidv4(),
            event_type: EventType.REPORT_NEEDS_REVIEW,
            timestamp: new Date().toISOString(),
            source_agent: this.agentId,
            correlation_id: sourceEvent.event_id,
            payload: {
                report_id: reportId,
                investigation_id: investigationId,
                validation_score: validationResult.validation_score,
                issues: validationResult.issues,
                feedback: validationResult.feedback,
                requires_regeneration: validationResult.requires_regeneration,
                flagged_at: new Date().toISOString(),
            },
        };

        await this.publish(reviewEvent);

        this.logAction('REPORT_NEEDS_REVIEW', {
            report_id: reportId,
            validation_score: validationResult.validation_score,
            issues_count: validationResult.issues.length,
            requires_regeneration: validationResult.requires_regeneration,
        });
    }

    /**
     * Get report from database
     */
    private getReport(reportId: string): any | null {
        const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId) as any;
        return row || null;
    }

    /**
     * Store validation result
     */
    private storeValidationResult(reportId: string, validationResult: any): void {
        const stmt = db.prepare(`
            INSERT INTO report_validations (
                id, report_id, passed, validation_score, issues,
                feedback, structured_feedback, validated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            uuidv4(),
            reportId,
            validationResult.passed ? 1 : 0,
            validationResult.validation_score,
            JSON.stringify(validationResult.issues),
            validationResult.feedback,
            JSON.stringify(validationResult.structured_feedback),
            new Date().toISOString()
        );
    }

    /**
     * Handle review request (legacy - for investigations)
     */
    private async handleReviewRequest(
        event: SupervisorReviewRequestedEvent
    ): Promise<void> {
        try {
            const { investigation_id, severity, review_reason } = event.payload;

            this.logAction('REVIEW_STARTED', {
                investigation_id,
                severity,
                review_reason,
            });

            const investigation = InvestigationService.getInvestigationById(investigation_id);
            if (!investigation) {
                throw new Error(`Investigation ${investigation_id} not found`);
            }

            const qaResult = await this.runQAChecks(investigation);

            if (qaResult.passed) {
                const passEvent: SupervisorQAPassedEvent = {
                    event_id: uuidv4(),
                    event_type: EventType.SUPERVISOR_QA_PASSED,
                    timestamp: new Date().toISOString(),
                    source_agent: this.agentId,
                    correlation_id: event.event_id,
                    payload: {
                        investigation_id,
                        review_notes: qaResult.notes,
                    },
                };

                await this.publish(passEvent);

                this.logAction('QA_PASSED', {
                    investigation_id,
                    notes: qaResult.notes,
                });
            } else {
                const failEvent: SupervisorQAFailedEvent = {
                    event_id: uuidv4(),
                    event_type: EventType.SUPERVISOR_QA_FAILED,
                    timestamp: new Date().toISOString(),
                    source_agent: this.agentId,
                    correlation_id: event.event_id,
                    payload: {
                        investigation_id,
                        failure_reason: qaResult.failureReason,
                        corrective_action: qaResult.correctiveAction,
                    },
                };

                await this.publish(failEvent);

                this.logAction('QA_FAILED', {
                    investigation_id,
                    failure_reason: qaResult.failureReason,
                    corrective_action: qaResult.correctiveAction,
                });
            }
        } catch (error: any) {
            this.logAction('REVIEW_ERROR', {
                investigation_id: event.payload.investigation_id,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Handle investigation created (monitoring)
     */
    private async handleInvestigationCreated(
        event: InvestigationCreatedEvent
    ): Promise<void> {
        const { investigation_id, severity, score } = event.payload;

        // Check for score-severity mismatches
        if (severity === 'critical' && score < 300) {
            this.logAction('ANOMALY_DETECTED', {
                investigation_id,
                anomaly: 'Critical severity with low score',
                score,
                severity,
            });
        }

        if (severity === 'low' && score > 100) {
            this.logAction('ANOMALY_DETECTED', {
                investigation_id,
                anomaly: 'Low severity with high score',
                score,
                severity,
            });
        }
    }

    /**
     * Run QA checks on investigation (legacy)
     */
    private async runQAChecks(investigation: any): Promise<{
        passed: boolean;
        notes?: string;
        failureReason?: string;
        correctiveAction?: string;
    }> {
        const checks: string[] = [];
        const failures: string[] = [];

        const score = investigation.confidence_signals.final_score;
        const severity = investigation.severity;
        const expectedSeverity = this.getSeverityFromScore(score);

        if (severity !== expectedSeverity) {
            failures.push(`Severity mismatch: expected ${expectedSeverity}, got ${severity} for score ${score}`);
        } else {
            checks.push('✓ Score-severity alignment correct');
        }

        if ((severity === 'high' || severity === 'critical') && !investigation.narrative) {
            failures.push('Missing narrative for high-severity investigation');
        } else {
            checks.push('✓ Narrative present when required');
        }

        if (!investigation.timeline || investigation.timeline.length === 0) {
            failures.push('Missing timeline events');
        } else {
            checks.push(`✓ Timeline has ${investigation.timeline.length} events`);
        }

        if (!investigation.confidence_signals.triggered_deviations) {
            failures.push('Missing deviation information');
        } else {
            checks.push(`✓ Deviations documented: ${investigation.confidence_signals.triggered_deviations.length}`);
        }

        if (failures.length > 0) {
            return {
                passed: false,
                failureReason: failures.join('; '),
                correctiveAction: 'Review investigation data and regenerate if needed',
                notes: checks.join('\n'),
            };
        }

        return {
            passed: true,
            notes: `QA checks passed:\n${checks.join('\n')}`,
        };
    }

    /**
     * Get expected severity from score
     */
    private getSeverityFromScore(score: number): string {
        if (score >= 300) return 'critical';
        if (score >= 200) return 'high';
        if (score >= 100) return 'medium';
        return 'low';
    }
}