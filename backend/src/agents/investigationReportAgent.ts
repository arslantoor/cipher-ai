// Investigation Report Agent
// Agent Role: InvestigationReportAgent
// Purpose: Autonomously process fraud alerts, generate investigation narratives, and notify stakeholders via WhatsApp
// See AGENT_LIFECYCLE.md for lifecycle documentation
import { BaseAgent } from './baseAgent';
import {
    EventType,
    FraudAlertCreatedEvent,
    SystemEvent,
} from '../events/types';
import { ReportGenerator, ReportContext } from '../services/reportGenerator';
import { WhatsAppService, WhatsAppDeliveryResult } from '../services/whatsappService';
import { ConfigService } from '../services/configService';
import { InvestigationService } from '../services/investigation';
import { BaselineAnalyzer } from '../services/baseline';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface InvestigationReportResult {
    alertId: string;
    status: 'processed' | 'failed';
    narrativeId?: string;
    whatsappDelivery: WhatsAppDeliveryResult[];
    error?: string;
}

export class InvestigationReportAgent extends BaseAgent {
    private reportGenerator: ReportGenerator;
    private whatsappService: WhatsAppService;
    private baselineAnalyzer: BaselineAnalyzer;
    private processedAlertIds: Set<string> = new Set();

    constructor(agentId?: string) {
        super('investigation_report', agentId);
        this.reportGenerator = new ReportGenerator();
        this.whatsappService = new WhatsAppService();
        this.baselineAnalyzer = new BaselineAnalyzer();
    }

    /**
     * INIT: Subscribe to FRAUD_ALERT events
     * Initialize services
     */
    protected async onStart(): Promise<void> {
        // Load processed alert IDs from database
        await this.loadProcessedAlerts();

        // Verify WhatsApp configuration
        const whatsappNumbers = ConfigService.getWhatsAppNumbers();
        this.logAction('INITIALIZED', {
            whatsapp_numbers_configured: whatsappNumbers.length,
        });
    }

    /**
     * LISTEN: Receive fraud alerts
     */
    protected setupSubscriptions(): void {
        // Subscribe to FRAUD_ALERT_CREATED events
        this.subscribe(
            EventType.FRAUD_ALERT_CREATED,
            this.handleFraudAlert.bind(this),
            5
        );
    }

    /**
     * ANALYZE: Process fraud alert and generate investigation narrative
     */
    private async handleFraudAlert(event: FraudAlertCreatedEvent): Promise<void> {
        const { alert_id, user_id, alert_type, severity, score, timestamp } = event.payload;
        const metadata = event.metadata || {};
        const transaction_id = metadata.transaction_id;
        const signals = metadata.signals || {};

        try {
            // Idempotency check
            if (this.processedAlertIds.has(alert_id)) {
                this.logAction('ALERT_ALREADY_PROCESSED', { alert_id });
                return;
            }

            this.logAction('INVESTIGATION_STARTED', {
                alert_id,
                user_id: this.maskUserId(user_id),
                severity,
                score,
            });

            // ANALYZE: Analyze incoming alert data
            const alertData = await this.analyzeAlertData(alert_id, user_id, transaction_id, signals);

            // Generate investigation narrative (180-220 words)
            const narrative = await this.generateInvestigationNarrative(alertData, severity, score);

            // Store narrative in database
            const narrativeId = await this.storeInvestigationNarrative(
                alert_id,
                user_id,
                narrative,
                severity,
                score
            );

            // Check if WhatsApp notifications are enabled
            const whatsappEnabled = ConfigService.getConfig('whatsapp_notifications_enabled') !== 'false';
            
            let deliveryResults: WhatsAppDeliveryResult[] = [];

            if (whatsappEnabled) {
                // Retrieve WhatsApp numbers from configuration
                const whatsappNumbers = ConfigService.getWhatsAppNumbers();
                
                console.log(`[InvestigationReportAgent] WhatsApp enabled. Found ${whatsappNumbers.length} numbers:`, whatsappNumbers);

                if (whatsappNumbers.length > 0) {
                    // Format narrative for WhatsApp (max 400 characters)
                    const whatsappMessage = this.formatWhatsAppMessage(narrative, alert_id, severity, score);
                    
                    console.log(`[InvestigationReportAgent] Sending WhatsApp message to ${whatsappNumbers.length} number(s)`);
                    console.log(`[InvestigationReportAgent] Message preview: ${whatsappMessage.substring(0, 100)}...`);

                    // Send to all configured WhatsApp numbers
                    deliveryResults = await this.sendWhatsAppNotifications(
                        whatsappMessage,
                        whatsappNumbers,
                        alert_id
                    );
                    
                    console.log(`[InvestigationReportAgent] WhatsApp delivery results:`, deliveryResults.map(r => ({
                        number: r.number,
                        success: r.success,
                        error: r.error
                    })));
                } else {
                    console.warn(`[InvestigationReportAgent] No WhatsApp numbers configured for alert ${alert_id}`);
                    this.logAction('WHATSAPP_NO_NUMBERS_CONFIGURED', {
                        alert_id,
                    });
                }
            } else {
                console.log(`[InvestigationReportAgent] WhatsApp notifications disabled for alert ${alert_id}`);
                this.logAction('WHATSAPP_NOTIFICATIONS_DISABLED', {
                    alert_id,
                });
            }

            // Mark as processed
            this.processedAlertIds.add(alert_id);

            // Log completion
            this.logAction('INVESTIGATION_COMPLETED', {
                alert_id,
                narrative_id: narrativeId,
                whatsapp_sent: deliveryResults.filter(r => r.success).length,
                whatsapp_failed: deliveryResults.filter(r => !r.success).length,
            });

            // Return result (for API if needed)
            const result: InvestigationReportResult = {
                alertId: alert_id,
                status: 'processed',
                narrativeId,
                whatsappDelivery: deliveryResults,
            };

            // Emit event if needed (optional)
            // await this.publish(resultEvent);

        } catch (error: any) {
            console.error(`[InvestigationReportAgent] Error processing alert ${alert_id}:`, error);
            console.error(`[InvestigationReportAgent] Error stack:`, error.stack);
            
            this.logAction('INVESTIGATION_FAILED', {
                alert_id,
                error: error.message,
                stack: error.stack,
            });

            throw error;
        }
    }

    /**
     * Analyze alert data
     */
    private async analyzeAlertData(
        alertId: string,
        userId: string,
        transactionId?: string,
        signals?: any
    ): Promise<{
        user_id: string;
        transaction_id?: string;
        signals: any;
        baseline?: any;
        deviation_analysis: {
            amount?: any;
            location?: any;
            temporal?: any;
            device?: any;
        };
    }> {
        // Try to get fraud detection data first
        let fraudDetection = db.prepare(`
            SELECT * FROM fraud_detections
            WHERE id = ?
        `).get(alertId) as any;

        let parsedSignals: any = {};

        if (fraudDetection) {
            // Use fraud detection signals
            parsedSignals = JSON.parse(fraudDetection.signals || '{}');
        } else {
            // Fallback: Try to get alert data and use provided signals
            console.log(`[InvestigationReportAgent] No fraud detection found for alert ${alertId}, using alert data and event signals`);
            
            const alert = InvestigationService.getAlert(alertId);
            if (alert) {
                // Use signals from event metadata if provided
                if (signals && typeof signals === 'object') {
                    parsedSignals = signals;
                } else {
                    // Create minimal signals from alert data
                    parsedSignals = {
                        amount_deviation: alert.raw_data?.transaction_amount ? {
                            score: 50,
                            multiplier: 1.5,
                            detected: true
                        } : null,
                        geographic_inconsistency: alert.raw_data?.location ? {
                            score: 30,
                            multiplier: 1.2,
                            detected: true
                        } : null,
                        velocity_anomaly: {
                            score: 25,
                            multiplier: 1.1,
                            detected: false
                        },
                        rule_flags: {
                            triggered: alert.triggered_rules || [],
                            score: alert.triggered_rules?.length * 10 || 0
                        }
                    };
                }
            } else {
                // Last resort: use provided signals or create empty structure
                parsedSignals = signals || {
                    amount_deviation: null,
                    geographic_inconsistency: null,
                    velocity_anomaly: null,
                    rule_flags: { triggered: [], score: 0 }
                };
            }
        }

        // Get user activity for baseline
        const userActivity = InvestigationService.getUserActivity(userId);
        const baseline = userActivity ? this.baselineAnalyzer.calculateBaseline(userActivity) : undefined;

        // Analyze deviations
        const deviationAnalysis = {
            amount: parsedSignals.amount_deviation || null,
            location: parsedSignals.geographic_inconsistency || null,
            temporal: parsedSignals.velocity_anomaly || null,
            device: parsedSignals.rule_flags?.triggered?.includes('device_change') || null,
        };

        return {
            user_id: userId,
            transaction_id: transactionId,
            signals: parsedSignals,
            baseline,
            deviation_analysis: deviationAnalysis,
        };
    }

    /**
     * Generate investigation narrative (180-220 words)
     */
    private async generateInvestigationNarrative(
        alertData: any,
        severity: string,
        score: number
    ): Promise<string> {
        // Build report context
        const context: ReportContext = {
            user_id: alertData.user_id,
            fraud_detection_id: alertData.transaction_id || 'unknown',
            severity: this.mapSeverity(severity),
            risk_score: score,
            fraud_signals: alertData.signals || {},
            transaction_data: alertData.transaction_id ? {
                timestamp: new Date().toISOString(),
                amount: 0, // Will be redacted
            } : undefined,
            baseline: alertData.baseline ? {
                avg_transaction_amount: alertData.baseline.avg_transaction_amount,
                typical_transaction_hours: alertData.baseline.typical_transaction_hours,
                common_locations: alertData.baseline.common_locations,
            } : undefined,
        };

        // Generate narrative using ReportGenerator
        const report = await this.reportGenerator.generateInvestigationReport(context, 'full');
        
        return report.investigation_narrative || report.executive_summary;
    }

    /**
     * Store investigation narrative in database
     */
    private async storeInvestigationNarrative(
        alertId: string,
        userId: string,
        narrative: string,
        severity: string,
        score: number
    ): Promise<string> {
        const narrativeId = uuidv4();

        db.prepare(`
            INSERT INTO investigation_narratives (
                id, alert_id, user_id, narrative, severity, risk_score, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            narrativeId,
            alertId,
            userId,
            narrative,
            severity.toUpperCase(),
            score,
            new Date().toISOString()
        );

        return narrativeId;
    }

    /**
     * Format narrative for WhatsApp (max 400 characters)
     */
    private formatWhatsAppMessage(
        narrative: string,
        alertId: string,
        severity: string,
        score: number
    ): string {
        // Create concise message
        const severityEmoji = {
            low: '🟢',
            medium: '🟡',
            high: '🟠',
            critical: '🔴',
        }[severity.toLowerCase()] || '⚪';

        let message = `🚨 Fraud Alert ${severityEmoji}\n\n`;
        message += `Alert: ${alertId.substring(0, 8)}...\n`;
        message += `Severity: ${severity.toUpperCase()}\n`;
        message += `Risk Score: ${score}/100\n\n`;

        // Truncate narrative to fit 400 char limit
        const maxNarrativeLength = 400 - message.length - 50; // Leave buffer
        let narrativeText = narrative.substring(0, maxNarrativeLength);
        
        // Try to end at sentence boundary
        const lastPeriod = narrativeText.lastIndexOf('.');
        if (lastPeriod > maxNarrativeLength * 0.7) {
            narrativeText = narrativeText.substring(0, lastPeriod + 1);
        } else {
            narrativeText = narrativeText.trim() + '...';
        }

        message += narrativeText;
        message += `\n\nView full report in system.`;

        // Ensure total length <= 400
        if (message.length > 400) {
            message = message.substring(0, 397) + '...';
        }

        return message;
    }

    /**
     * Send WhatsApp notifications to all configured numbers
     */
    private async sendWhatsAppNotifications(
        message: string,
        numbers: string[],
        alertId: string
    ): Promise<WhatsAppDeliveryResult[]> {
        const results: WhatsAppDeliveryResult[] = [];

        for (const number of numbers) {
            try {
                const result = await this.whatsappService.sendMessage({
                    to: number,
                    message,
                });

                // Store delivery record
                await this.storeWhatsAppDelivery(alertId, number, result);

                results.push(result);
            } catch (error: any) {
                const failedResult: WhatsAppDeliveryResult = {
                    number,
                    success: false,
                    error: error.message,
                };
                results.push(failedResult);

                // Store failed delivery
                await this.storeWhatsAppDelivery(alertId, number, failedResult);
            }
        }

        return results;
    }

    /**
     * Store WhatsApp delivery record
     */
    private async storeWhatsAppDelivery(
        alertId: string,
        number: string,
        result: WhatsAppDeliveryResult
    ): Promise<void> {
        const deliveryId = uuidv4();

        db.prepare(`
            INSERT INTO whatsapp_notifications (
                id, alert_id, phone_number, success, error_message, message_id, sent_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            deliveryId,
            alertId,
            this.maskPhoneNumber(number), // Store masked number
            result.success ? 1 : 0,
            result.error || null,
            result.messageId || null,
            result.timestamp || new Date().toISOString()
        );
    }

    /**
     * Load processed alert IDs
     */
    private async loadProcessedAlerts(): Promise<void> {
        const processed = db.prepare(`
            SELECT DISTINCT alert_id
            FROM investigation_narratives
        `).all() as Array<{ alert_id: string }>;

        processed.forEach(row => {
            this.processedAlertIds.add(row.alert_id);
        });
    }

    /**
     * Map severity to report format
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
     * Mask user ID for logging
     */
    private maskUserId(userId: string): string {
        if (userId.length <= 4) return '***';
        return `***${userId.slice(-4)}`;
    }

    /**
     * Mask phone number
     */
    private maskPhoneNumber(phone: string): string {
        if (phone.length <= 4) return '***';
        return `${phone.substring(0, phone.length - 4)}****`;
    }
}
