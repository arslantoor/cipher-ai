// Fraud Detection Agent - Real-time anomaly and fraud detection from trading platform events
// Agent Role: FRAUD DETECTOR
// Purpose: Detect anomalies and potential fraud events in real time from trading platform notifications
// See AGENT_LIFECYCLE.md for lifecycle documentation
import { BaseAgent, AgentLifecycleStage } from './baseAgent';
import {
    EventType,
    TransactionIngestedEvent,
    FraudAlertCreatedEvent,
    SystemEvent,
} from '../events/types';
import { FraudScoringEngine, FraudDetectionResult } from '../services/fraudScoringEngine';
import { BaselineAnalyzer } from '../services/baseline';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export class FraudDetectionAgent extends BaseAgent {
    private scoringEngine: FraudScoringEngine;
    private baselineAnalyzer: BaselineAnalyzer;
    private baselineModels: Map<string, any> = new Map(); // account_id -> baseline

    constructor(agentId?: string) {
        super('fraud_detection', agentId);
        this.scoringEngine = new FraudScoringEngine();
        this.baselineAnalyzer = new BaselineAnalyzer();
    }

    /**
     * INIT: Connect to trading platform event streams and system event bus
     * Initialize baseline behavior models for accounts and transactions
     */
    protected async onStart(): Promise<void> {
        // Initialize baseline models for existing accounts
        await this.initializeBaselineModels();
        
        this.logAction('BASELINE_MODELS_INITIALIZED', {
            accounts_initialized: this.baselineModels.size,
        });
    }

    /**
     * LISTEN: Continuously receive all trading events (deposits, withdrawals, trades)
     * Ignore unrelated system messages
     */
    protected setupSubscriptions(): void {
        // Subscribe to all trading-related events
        this.subscribe(
            EventType.TRANSACTION_INGESTED,
            this.handleTransactionIngested.bind(this),
            10 // High priority
        );

        // Subscribe to other trading events if they exist
        // Note: Add more event types as trading platform events are defined
        // Example: EventType.DEPOSIT_RECEIVED, EventType.WITHDRAWAL_RECEIVED, EventType.TRADE_EXECUTED
    }

    /**
     * ANALYZE: Apply deterministic scoring to detect abnormal behavior
     * Flag deviations in transaction amounts, frequency, location, or device
     * Attach metadata: account ID, event timestamp, anomaly score
     */
    private async handleTransactionIngested(event: TransactionIngestedEvent): Promise<void> {
        const { transaction_id, user_id, amount, timestamp, transaction_data } = event.payload;

        try {
            // Idempotency check: if already processed, skip
            const existing = this.getFraudDetection(transaction_id);
            if (existing) {
                this.logAction('TRANSACTION_ALREADY_PROCESSED', {
                    transaction_id,
                    user_id,
                    fraud_detection_id: existing.id,
                    risk_score: existing.risk_score,
                    severity: existing.severity,
                });
                return; // Already processed, idempotent
            }

            this.logAction('FRAUD_ANALYSIS_STARTED', {
                transaction_id,
                user_id,
                amount,
                timestamp,
            });

            // Update baseline model for this account (maintain continuous detection)
            await this.updateBaselineModel(user_id, {
                transaction_id,
                amount,
                timestamp,
                transaction_data,
            });

            // Compute deterministic fraud signals (NO AI, NO NARRATIVES)
            const result = await this.scoringEngine.computeFraudSignals(
                transaction_id,
                user_id,
                amount,
                timestamp,
                transaction_data
            );

            // Persist findings to database
            const fraudDetectionId = this.persistFraudDetection(transaction_id, user_id, result);

            this.logAction('FRAUD_ANALYSIS_COMPLETED', {
                transaction_id,
                user_id,
                fraud_detection_id: fraudDetectionId,
                risk_score: result.risk_score,
                severity: result.severity,
            });

            // EMIT: Publish FRAUD_ALERT event if anomaly detected
            // Emit for all severities (LOW, MEDIUM, HIGH, CRITICAL) as alerts
            if (result.risk_score > 0) {
                await this.emitFraudAlert(event, fraudDetectionId, result);
            }
        } catch (error: any) {
            this.logAction('FRAUD_ANALYSIS_ERROR', {
                transaction_id,
                user_id,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Persist fraud detection result to database
     */
    private persistFraudDetection(
        transactionId: string,
        userId: string,
        result: FraudDetectionResult
    ): string {
        const fraudDetectionId = uuidv4();

        const stmt = db.prepare(`
            INSERT INTO fraud_detections (
                id, transaction_id, user_id, risk_score, severity,
                signals, explanation, config_used, detected_at, processed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            fraudDetectionId,
            transactionId,
            userId,
            result.risk_score,
            result.severity,
            JSON.stringify(result.signals),
            result.explanation,
            JSON.stringify(result.config_used),
            new Date().toISOString(),
            new Date().toISOString()
        );

        return fraudDetectionId;
    }

    /**
     * Get fraud detection by transaction ID (for idempotency)
     */
    private getFraudDetection(transactionId: string): any | null {
        const row = db.prepare(`
            SELECT * FROM fraud_detections
            WHERE transaction_id = ?
            LIMIT 1
        `).get(transactionId) as any;

        return row || null;
    }

    /**
     * EMIT: Publish FRAUD_ALERT events with relevant data to Investigation Agent
     * Never execute or block trades - only emit alerts
     */
    private async emitFraudAlert(
        sourceEvent: TransactionIngestedEvent,
        fraudDetectionId: string,
        result: FraudDetectionResult
    ): Promise<void> {
        // Map severity to alert format (lowercase)
        const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            CRITICAL: 'critical',
        };

        const alertEvent: FraudAlertCreatedEvent = {
            event_id: uuidv4(),
            event_type: EventType.FRAUD_ALERT_CREATED,
            timestamp: new Date().toISOString(),
            source_agent: this.agentId,
            correlation_id: sourceEvent.event_id,
            payload: {
                alert_id: fraudDetectionId,
                user_id: sourceEvent.payload.user_id,
                alert_type: 'fraud_anomaly',
                severity: severityMap[result.severity] || 'low',
                score: result.risk_score,
                timestamp: new Date().toISOString(),
            },
            metadata: {
                transaction_id: sourceEvent.payload.transaction_id,
                signals: {
                    amount_deviation: result.signals.amount_deviation.score,
                    velocity_anomaly: result.signals.velocity_anomaly.score,
                    geographic_inconsistency: result.signals.geographic_inconsistency.score,
                    rule_flags: result.signals.rule_flags.triggered,
                },
                // No narrative - agent does not generate narratives
            },
        };

        await this.publish(alertEvent);

        this.logAction('FRAUD_ALERT_EMITTED', {
            transaction_id: sourceEvent.payload.transaction_id,
            alert_id: fraudDetectionId,
            severity: result.severity,
            risk_score: result.risk_score,
        });
    }

    /**
     * Initialize baseline models for existing accounts
     * Called during INIT phase
     */
    private async initializeBaselineModels(): Promise<void> {
        // Load existing user activities from fraud_detections and event_store
        const users = db.prepare(`
            SELECT DISTINCT user_id FROM fraud_detections
        `).all() as Array<{ user_id: string }>;

        for (const { user_id } of users) {
            try {
                const userActivity = await this.loadUserActivity(user_id);
                if (userActivity && userActivity.transaction_history.length > 0) {
                    const baseline = this.baselineAnalyzer.calculateBaseline(userActivity);
                    this.baselineModels.set(user_id, baseline);
                }
            } catch (error: any) {
                console.warn(`[FraudDetectionAgent] Failed to initialize baseline for user ${user_id}:`, error.message);
            }
        }
    }

    /**
     * Update baseline model for account after transaction
     * Maintains baseline models for continuous detection (IDLE phase)
     * TERMINATE/IDLE: Maintain baseline models for continuous detection
     */
    private async updateBaselineModel(
        userId: string,
        transaction: {
            transaction_id: string;
            amount: number;
            timestamp: string;
            transaction_data: any;
        }
    ): Promise<void> {
        // Load or refresh user activity
        const userActivity = await this.loadUserActivity(userId);
        if (userActivity) {
            // Add current transaction to history if not already present
            const existingTx = userActivity.transaction_history.find(
                (t: any) => t.timestamp === transaction.timestamp && t.amount === transaction.amount
            );
            if (!existingTx) {
                userActivity.transaction_history.push({
                    timestamp: transaction.timestamp,
                    amount: transaction.amount,
                    type: transaction.transaction_data?.type || 'unknown',
                    status: 'completed',
                });
            }

            // Update locations if available
            if (transaction.transaction_data?.location) {
                const loc = transaction.transaction_data.location;
                userActivity.login_locations.push({
                    city: loc.city || '',
                    country: loc.country || '',
                    lat: loc.lat || 0,
                    lng: loc.lng || 0,
                    timestamp: transaction.timestamp,
                });
            }

            // Update device fingerprints if available
            if (transaction.transaction_data?.device_fingerprint) {
                if (!userActivity.device_fingerprints.includes(transaction.transaction_data.device_fingerprint)) {
                    userActivity.device_fingerprints.push(transaction.transaction_data.device_fingerprint);
                }
            }

            // Recalculate baseline with updated activity
            const baseline = this.baselineAnalyzer.calculateBaseline(userActivity);
            this.baselineModels.set(userId, baseline);
        } else {
            // First transaction for this user - create initial baseline
            const newUserActivity = {
                user_id: userId,
                transaction_history: [{
                    timestamp: transaction.timestamp,
                    amount: transaction.amount,
                    type: transaction.transaction_data?.type || 'unknown',
                    status: 'completed',
                }],
                login_locations: transaction.transaction_data?.location ? [{
                    city: transaction.transaction_data.location.city || '',
                    country: transaction.transaction_data.location.country || '',
                    lat: transaction.transaction_data.location.lat || 0,
                    lng: transaction.transaction_data.location.lng || 0,
                    timestamp: transaction.timestamp,
                }] : [],
                device_fingerprints: transaction.transaction_data?.device_fingerprint 
                    ? [transaction.transaction_data.device_fingerprint] 
                    : [],
                account_age_days: 0,
            };
            const baseline = this.baselineAnalyzer.calculateBaseline(newUserActivity);
            this.baselineModels.set(userId, baseline);
        }
    }

    /**
     * Load user activity for baseline calculation
     * Uses fraud_detections and event_store to reconstruct transaction history
     */
    private async loadUserActivity(userId: string): Promise<any | null> {
        // Load fraud detections (which contain transaction info)
        const fraudDetections = db.prepare(`
            SELECT id, transaction_id, detected_at as timestamp, signals
            FROM fraud_detections
            WHERE user_id = ?
            ORDER BY detected_at DESC
            LIMIT 100
        `).all(userId) as any[];

        // Load transaction events from event_store
        const transactionEvents = db.prepare(`
            SELECT event_data, created_at
            FROM event_store
            WHERE event_type = ? AND event_data LIKE ?
            ORDER BY created_at DESC
            LIMIT 100
        `).all(EventType.TRANSACTION_INGESTED, `%"user_id":"${userId}"%`) as any[];

        // Parse transaction data from events
        const transactions: Array<{ timestamp: string; amount: number; type: string; status: string }> = [];
        const locations: Array<{ city: string; country: string; lat: number; lng: number; timestamp: string }> = [];
        const devices: string[] = [];

        for (const event of transactionEvents) {
            try {
                const eventData = JSON.parse(event.event_data);
                const payload = eventData.payload || {};
                
                if (payload.user_id === userId && payload.amount) {
                    transactions.push({
                        timestamp: payload.timestamp || eventData.timestamp || event.created_at,
                        amount: payload.amount,
                        type: payload.transaction_data?.type || 'unknown',
                        status: 'completed',
                    });

                    // Extract location if available
                    if (payload.transaction_data?.location) {
                        const loc = payload.transaction_data.location;
                        locations.push({
                            city: loc.city || '',
                            country: loc.country || '',
                            lat: loc.lat || 0,
                            lng: loc.lng || 0,
                            timestamp: payload.timestamp || event.created_at,
                        });
                    }

                    // Extract device fingerprint if available
                    if (payload.transaction_data?.device_fingerprint) {
                        devices.push(payload.transaction_data.device_fingerprint);
                    }
                }
            } catch (error) {
                // Skip invalid event data
                continue;
            }
        }

        if (transactions.length === 0) {
            return null;
        }

        // Calculate account age (days since first transaction)
        const sortedTransactions = transactions.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const firstTransaction = sortedTransactions[0];
        const accountAgeDays = Math.floor(
            (Date.now() - new Date(firstTransaction.timestamp).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Deduplicate devices
        const uniqueDevices = Array.from(new Set(devices));

        return {
            user_id: userId,
            transaction_history: transactions,
            login_locations: locations,
            device_fingerprints: uniqueDevices,
            account_age_days: accountAgeDays,
        };
    }

    /**
     * Update fraud detection configuration (runtime config update)
     */
    updateConfiguration(config: Partial<any>): void {
        this.scoringEngine.updateConfig(config);
        this.logAction('CONFIGURATION_UPDATED', {
            config_keys: Object.keys(config),
        });
    }

    /**
     * Get current configuration
     */
    getConfiguration(): any {
        return this.scoringEngine.getConfig();
    }

    /**
     * Get baseline model for account (for monitoring/debugging)
     */
    getBaselineModel(userId: string): any | null {
        return this.baselineModels.get(userId) || null;
    }
}