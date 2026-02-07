import { Alert, UserActivity, SeverityLevel, SeverityJustification, Deviation } from '../types';
import { DeviationDetector } from './deviation';
import { SEVERITY_THRESHOLDS } from '../config/thresholds';

export class SeverityEngine {
    constructor(private deviationDetector: DeviationDetector) { }

    classifySeverity(
        alert: Alert,
        userActivity: UserActivity
    ): { severity: SeverityLevel; justification: SeverityJustification } {
        const deviations = this.deviationDetector.detectDeviations(alert, userActivity);

        const baseScore = this.calculateBaseScore(alert);
        const deviationMultiplier = this.calculateDeviationMultiplier(deviations);

        const finalScore = baseScore * deviationMultiplier;

        const severity = this.applyThresholds(finalScore);

        const justification: SeverityJustification = {
            base_score: baseScore,
            deviation_multiplier: deviationMultiplier,
            final_score: finalScore,
            thresholds_used: SEVERITY_THRESHOLDS,
            triggered_deviations: this.getTriggeredDeviations(deviations),
        };

        return { severity, justification };
    }

    private calculateBaseScore(alert: Alert): number {
        const typeScores: Record<string, number> = {
            identity_fraud: 60,
            account_takeover: 70,
            money_laundering: 80,
            affiliate_fraud: 50,
            suspicious_trading: 65,
        };

        const base = typeScores[alert.alert_type] || 50;
        const ruleBonus = alert.triggered_rules.length * 5;

        return Math.min(base + ruleBonus, 100);
    }

    private calculateDeviationMultiplier(deviations: Deviation): number {
        let multiplier = 1.0;

        Object.values(deviations).forEach((value) => {
            if (typeof value === 'object' && value !== null && 'multiplier' in value) {
                multiplier *= value.multiplier;
            }
        });

        return multiplier;
    }

    private applyThresholds(score: number): SeverityLevel {
        if (score >= SEVERITY_THRESHOLDS.critical) return SeverityLevel.CRITICAL;
        if (score >= SEVERITY_THRESHOLDS.high) return SeverityLevel.HIGH;
        if (score >= SEVERITY_THRESHOLDS.medium) return SeverityLevel.MEDIUM;
        return SeverityLevel.LOW;
    }

    private getTriggeredDeviations(deviations: Deviation): string[] {
        const triggered: string[] = [];

        Object.entries(deviations).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null && 'multiplier' in value) {
                if (value.multiplier > 1.0) {
                    triggered.push(key);
                }
            } else if (value === true) {
                triggered.push(key);
            }
        });

        return triggered;
    }
}
