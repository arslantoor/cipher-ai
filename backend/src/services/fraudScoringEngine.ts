// Fraud Scoring Engine - Deterministic, explainable, configurable
import { UserActivity, Baseline } from '../types';
import { BaselineAnalyzer } from './baseline';
import { InvestigationService } from './investigation';
import { db } from '../config/database';

export interface FraudDetectionConfig {
    // Amount deviation thresholds
    amount_deviation_5x_threshold: number;
    amount_deviation_10x_threshold: number;
    amount_deviation_score_weight: number;

    // Velocity thresholds
    velocity_window_hours: number;
    velocity_threshold_transactions: number;
    velocity_score_weight: number;

    // Geographic thresholds
    geographic_new_country_score: number;
    geographic_new_city_score: number;
    geographic_distance_km_threshold: number;
    geographic_score_weight: number;

    // Rule-based flags
    rule_flags: {
        [key: string]: number; // flag_name -> score
    };

    // Severity thresholds (risk_score 0-100)
    severity_low_max: number;
    severity_medium_max: number;
    severity_high_max: number;
    severity_critical_max: number;
}

export const DEFAULT_FRAUD_CONFIG: FraudDetectionConfig = {
    amount_deviation_5x_threshold: 5.0,
    amount_deviation_10x_threshold: 10.0,
    amount_deviation_score_weight: 30,

    velocity_window_hours: 24,
    velocity_threshold_transactions: 10,
    velocity_score_weight: 25,

    geographic_new_country_score: 20,
    geographic_new_city_score: 10,
    geographic_distance_km_threshold: 1000,
    geographic_score_weight: 15,

    rule_flags: {
        new_account: 10,
        after_hours: 5,
        weekend_transaction: 5,
        high_value: 15,
        suspicious_ip: 20,
        vpn_detected: 15,
    },

    severity_low_max: 30,
    severity_medium_max: 60,
    severity_high_max: 85,
    severity_critical_max: 100,
};

export interface FraudSignals {
    amount_deviation: {
        detected: boolean;
        ratio: number;
        baseline_amount: number;
        current_amount: number;
        score: number;
        explanation: string;
    };
    velocity_anomaly: {
        detected: boolean;
        transactions_in_window: number;
        threshold: number;
        score: number;
        explanation: string;
    };
    geographic_inconsistency: {
        detected: boolean;
        is_new_country: boolean;
        is_new_city: boolean;
        distance_km?: number;
        score: number;
        explanation: string;
    };
    rule_flags: {
        triggered: string[];
        score: number;
        explanation: string;
    };
}

export interface FraudDetectionResult {
    risk_score: number; // 0-100
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    signals: FraudSignals;
    explanation: string;
    config_used: FraudDetectionConfig;
}

export class FraudScoringEngine {
    private baselineAnalyzer: BaselineAnalyzer;
    private config: FraudDetectionConfig;

    constructor(config?: Partial<FraudDetectionConfig>) {
        this.baselineAnalyzer = new BaselineAnalyzer();
        this.config = { ...DEFAULT_FRAUD_CONFIG, ...config };
    }

    /**
     * Compute fraud signals and score
     */
    async computeFraudSignals(
        transactionId: string,
        userId: string,
        amount: number,
        timestamp: string,
        transactionData: {
            location?: { city: string; country: string; lat: number; lng: number };
            device_fingerprint?: string;
            ip_address?: string;
            [key: string]: any;
        }
    ): Promise<FraudDetectionResult> {
        // Get user activity and baseline
        const userActivity = this.getUserActivity(userId);
        if (!userActivity) {
            throw new Error(`User activity not found for user ${userId}`);
        }

        const baseline = this.baselineAnalyzer.calculateBaseline(userActivity);

        // Compute all signals
        const amountSignal = this.computeAmountDeviation(amount, baseline);
        const velocitySignal = this.computeVelocityAnomaly(userId, timestamp, baseline);
        const geographicSignal = this.computeGeographicInconsistency(
            transactionData.location,
            userActivity,
            baseline
        );
        const ruleFlags = this.computeRuleFlags(amount, timestamp, transactionData, baseline);

        // Calculate total risk score
        const riskScore = Math.min(100, Math.round(
            amountSignal.score +
            velocitySignal.score +
            geographicSignal.score +
            ruleFlags.score
        ));

        // Determine severity
        const severity = this.determineSeverity(riskScore);

        // Build explanation
        const explanation = this.buildExplanation(
            amountSignal,
            velocitySignal,
            geographicSignal,
            ruleFlags,
            riskScore,
            severity
        );

        return {
            risk_score: riskScore,
            severity,
            signals: {
                amount_deviation: amountSignal,
                velocity_anomaly: velocitySignal,
                geographic_inconsistency: geographicSignal,
                rule_flags: ruleFlags,
            },
            explanation,
            config_used: this.config,
        };
    }

    /**
     * Compute amount deviation signal
     */
    private computeAmountDeviation(amount: number, baseline: Baseline): FraudSignals['amount_deviation'] {
        const avgAmount = baseline.avg_transaction_amount || 0;

        if (avgAmount === 0) {
            return {
                detected: false,
                ratio: 0,
                baseline_amount: 0,
                current_amount: amount,
                score: 0,
                explanation: 'No baseline available for amount comparison',
            };
        }

        const ratio = amount / avgAmount;
        let score = 0;
        let explanation = '';

        if (ratio >= this.config.amount_deviation_10x_threshold) {
            score = this.config.amount_deviation_score_weight;
            explanation = `Amount ${ratio.toFixed(2)}x baseline (${amount} vs ${avgAmount.toFixed(2)}) - extreme deviation`;
        } else if (ratio >= this.config.amount_deviation_5x_threshold) {
            score = this.config.amount_deviation_score_weight * 0.7;
            explanation = `Amount ${ratio.toFixed(2)}x baseline (${amount} vs ${avgAmount.toFixed(2)}) - significant deviation`;
        } else if (ratio >= 2.0) {
            score = this.config.amount_deviation_score_weight * 0.4;
            explanation = `Amount ${ratio.toFixed(2)}x baseline (${amount} vs ${avgAmount.toFixed(2)}) - moderate deviation`;
        } else {
            explanation = `Amount within normal range (${ratio.toFixed(2)}x baseline)`;
        }

        return {
            detected: ratio >= this.config.amount_deviation_5x_threshold,
            ratio,
            baseline_amount: avgAmount,
            current_amount: amount,
            score: Math.round(score),
            explanation,
        };
    }

    /**
     * Compute velocity anomaly signal
     */
    private computeVelocityAnomaly(
        userId: string,
        timestamp: string,
        baseline: Baseline
    ): FraudSignals['velocity_anomaly'] {
        const windowStart = new Date(timestamp);
        windowStart.setHours(windowStart.getHours() - this.config.velocity_window_hours);

        // Count transactions in window
        const transactionsInWindow = this.getTransactionCountInWindow(userId, windowStart.toISOString(), timestamp);

        const threshold = this.config.velocity_threshold_transactions;
        const detected = transactionsInWindow > threshold;

        let score = 0;
        let explanation = '';

        if (detected) {
            const excess = transactionsInWindow - threshold;
            const multiplier = Math.min(2.0, 1 + (excess / threshold));
            score = this.config.velocity_score_weight * multiplier;
            explanation = `${transactionsInWindow} transactions in ${this.config.velocity_window_hours}h window (threshold: ${threshold}) - velocity anomaly`;
        } else {
            explanation = `${transactionsInWindow} transactions in ${this.config.velocity_window_hours}h window - normal velocity`;
        }

        return {
            detected,
            transactions_in_window: transactionsInWindow,
            threshold,
            score: Math.round(score),
            explanation,
        };
    }

    /**
     * Compute geographic inconsistency signal
     */
    private computeGeographicInconsistency(
        location: { city: string; country: string; lat: number; lng: number } | undefined,
        userActivity: UserActivity,
        baseline: Baseline
    ): FraudSignals['geographic_inconsistency'] {
        if (!location) {
            return {
                detected: false,
                is_new_country: false,
                is_new_city: false,
                score: 0,
                explanation: 'No location data available',
            };
        }

        const commonLocations = baseline.common_locations || [];
        const isNewCity = !commonLocations.some(loc => loc.includes(location.city));
        const isNewCountry = !commonLocations.some(loc => loc.includes(location.country));

        let score = 0;
        let explanation = '';

        if (isNewCountry) {
            score = this.config.geographic_new_country_score;
            explanation = `New country detected: ${location.country} (previous: ${commonLocations.join(', ')})`;
        } else if (isNewCity) {
            score = this.config.geographic_new_city_score;
            explanation = `New city detected: ${location.city}, ${location.country}`;
        } else {
            explanation = `Location consistent with baseline: ${location.city}, ${location.country}`;
        }

        // Calculate distance if previous location exists
        let distanceKm: number | undefined;
        if (userActivity.login_locations && userActivity.login_locations.length > 0) {
            const lastLocation = userActivity.login_locations[userActivity.login_locations.length - 1];
            // Note: LoginLocation doesn't have lat/lng, so distance calculation skipped
            // In production, store coordinates separately or use geocoding service
        }

        return {
            detected: isNewCountry || isNewCity,
            is_new_country: isNewCountry,
            is_new_city: isNewCity,
            distance_km: distanceKm,
            score: Math.round(score * (this.config.geographic_score_weight / 20)),
            explanation,
        };
    }

    /**
     * Compute rule-based flags
     */
    private computeRuleFlags(
        amount: number,
        timestamp: string,
        transactionData: any,
        baseline: Baseline
    ): FraudSignals['rule_flags'] {
        const triggered: string[] = [];
        let totalScore = 0;

        // Check account age
        if (baseline.account_maturity < 30) {
            triggered.push('new_account');
            totalScore += this.config.rule_flags.new_account || 0;
        }

        // Check after hours
        const hour = new Date(timestamp).getHours();
        const typicalHours = baseline.typical_transaction_hours || [];
        if (typicalHours.length > 0 && !typicalHours.includes(hour)) {
            triggered.push('after_hours');
            totalScore += this.config.rule_flags.after_hours || 0;
        }

        // Check weekend
        const dayOfWeek = new Date(timestamp).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            triggered.push('weekend_transaction');
            totalScore += this.config.rule_flags.weekend_transaction || 0;
        }

        // Check high value
        const avgAmount = baseline.avg_transaction_amount || 0;
        if (avgAmount > 0 && amount > avgAmount * 5) {
            triggered.push('high_value');
            totalScore += this.config.rule_flags.high_value || 0;
        }

        // Check suspicious IP (simplified - in production, use IP reputation service)
        if (transactionData.ip_address) {
            // Example: check for known VPN patterns
            if (transactionData.ip_address.includes('vpn') || transactionData.ip_address.includes('proxy')) {
                triggered.push('vpn_detected');
                totalScore += this.config.rule_flags.vpn_detected || 0;
            }
        }

        const explanation = triggered.length > 0
            ? `Rule flags triggered: ${triggered.join(', ')}`
            : 'No rule flags triggered';

        return {
            triggered,
            score: Math.round(totalScore),
            explanation,
        };
    }

    /**
     * Determine severity from risk score
     */
    private determineSeverity(riskScore: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
        if (riskScore <= this.config.severity_low_max) return 'LOW';
        if (riskScore <= this.config.severity_medium_max) return 'MEDIUM';
        if (riskScore <= this.config.severity_high_max) return 'HIGH';
        return 'CRITICAL';
    }

    /**
     * Build explanation
     */
    private buildExplanation(
        amountSignal: FraudSignals['amount_deviation'],
        velocitySignal: FraudSignals['velocity_anomaly'],
        geographicSignal: FraudSignals['geographic_inconsistency'],
        ruleFlags: FraudSignals['rule_flags'],
        riskScore: number,
        severity: string
    ): string {
        const parts: string[] = [];

        parts.push(`Risk Score: ${riskScore}/100 (Severity: ${severity})`);

        if (amountSignal.detected) {
            parts.push(`Amount: ${amountSignal.explanation}`);
        }

        if (velocitySignal.detected) {
            parts.push(`Velocity: ${velocitySignal.explanation}`);
        }

        if (geographicSignal.detected) {
            parts.push(`Geography: ${geographicSignal.explanation}`);
        }

        if (ruleFlags.triggered.length > 0) {
            parts.push(`Rules: ${ruleFlags.explanation}`);
        }

        return parts.join(' | ');
    }

    /**
     * Get user activity (helper)
     */
    private getUserActivity(userId: string): UserActivity | null {
        return InvestigationService.getUserActivity(userId);
    }

    /**
     * Get transaction count in time window (helper)
     */
    private getTransactionCountInWindow(userId: string, from: string, to: string): number {
        // Simplified - in production, query actual transaction history
        const userActivity = this.getUserActivity(userId);
        if (!userActivity || !userActivity.transaction_history) {
            return 0;
        }

        return userActivity.transaction_history.filter(t => {
            const txTime = new Date(t.timestamp).getTime();
            const fromTime = new Date(from).getTime();
            const toTime = new Date(to).getTime();
            return txTime >= fromTime && txTime <= toTime;
        }).length;
    }

    /**
     * Calculate distance between two coordinates (simplified)
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        // Haversine formula (simplified version)
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<FraudDetectionConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): FraudDetectionConfig {
        return { ...this.config };
    }
}