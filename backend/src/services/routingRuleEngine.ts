// Routing Rule Engine - Rule-based event routing (no hard-coded if/else)
import { FraudDetectedEvent, SystemEvent } from '../events/types';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RegulatoryImpact = 'low' | 'medium' | 'high';
export type ReportType = 'internal' | 'compliance' | 'full';
export type EscalationLevel = 'senior_analyst' | 'compliance_team' | 'executive';

export interface RoutingContext {
    severity: Severity;
    risk_score: number;
    confidence_score?: number;
    regulatory_impact?: RegulatoryImpact;
    transaction_id?: string;
    fraud_detection_id?: string;
    investigation_id?: string;
    user_id?: string;
    [key: string]: any;
}

export interface RoutingRule {
    id: string;
    name: string;
    description: string;
    condition: (context: RoutingContext) => boolean;
    actions: RoutingAction[];
    priority: number; // Higher priority rules evaluated first
    enabled: boolean;
}

export interface RoutingAction {
    type: 'emit_report' | 'emit_escalation' | 'log';
    config: {
        report_type?: ReportType;
        escalation_level?: EscalationLevel;
        escalation_reason?: string;
        message?: string;
    };
}

export interface RoutingDecision {
    rule_id: string;
    rule_name: string;
    matched: boolean;
    actions: RoutingAction[];
    context: RoutingContext;
    explanation: string;
}

export interface RoutingRuleSet {
    rules: RoutingRule[];
    default_actions?: RoutingAction[];
}

export class RoutingRuleEngine {
    private rules: RoutingRule[] = [];

    constructor(rules?: RoutingRule[]) {
        if (rules) {
            this.rules = rules;
        } else {
            this.loadDefaultRules();
        }
        // Sort by priority (highest first)
        this.rules.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Evaluate context against all rules and return decisions
     */
    evaluate(context: RoutingContext): RoutingDecision[] {
        const decisions: RoutingDecision[] = [];

        for (const rule of this.rules) {
            if (!rule.enabled) continue;

            const matched = rule.condition(context);
            
            decisions.push({
                rule_id: rule.id,
                rule_name: rule.name,
                matched,
                actions: matched ? rule.actions : [],
                context: { ...context },
                explanation: matched
                    ? `Rule "${rule.name}" matched: ${rule.description}`
                    : `Rule "${rule.name}" did not match`,
            });

            // If rule matched and has stop_on_match flag, break
            if (matched && (rule as any).stop_on_match) {
                break;
            }
        }

        return decisions;
    }

    /**
     * Get all actions from matched rules
     */
    getActions(context: RoutingContext): RoutingAction[] {
        const decisions = this.evaluate(context);
        const actions: RoutingAction[] = [];

        for (const decision of decisions) {
            if (decision.matched) {
                actions.push(...decision.actions);
            }
        }

        return actions;
    }

    /**
     * Add or update a rule
     */
    addRule(rule: RoutingRule): void {
        const existingIndex = this.rules.findIndex(r => r.id === rule.id);
        if (existingIndex >= 0) {
            this.rules[existingIndex] = rule;
        } else {
            this.rules.push(rule);
        }
        this.rules.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Remove a rule
     */
    removeRule(ruleId: string): void {
        this.rules = this.rules.filter(r => r.id !== ruleId);
    }

    /**
     * Enable/disable a rule
     */
    setRuleEnabled(ruleId: string, enabled: boolean): void {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = enabled;
        }
    }

    /**
     * Get all rules
     */
    getRules(): RoutingRule[] {
        return [...this.rules];
    }

    /**
     * Load default routing rules
     */
    private loadDefaultRules(): void {
        // Rule 1: MEDIUM severity → internal report only
        this.rules.push({
            id: 'medium-severity-internal-report',
            name: 'Medium Severity Internal Report',
            description: 'MEDIUM severity requires internal report only',
            priority: 30,
            enabled: true,
            condition: (ctx) => ctx.severity === 'MEDIUM',
            actions: [
                {
                    type: 'emit_report',
                    config: {
                        report_type: 'internal',
                    },
                },
            ],
        });

        // Rule 2: HIGH severity → full compliance report
        this.rules.push({
            id: 'high-severity-compliance-report',
            name: 'High Severity Compliance Report',
            description: 'HIGH severity requires full compliance report',
            priority: 40,
            enabled: true,
            condition: (ctx) => ctx.severity === 'HIGH',
            actions: [
                {
                    type: 'emit_report',
                    config: {
                        report_type: 'compliance',
                    },
                },
            ],
        });

        // Rule 3: CRITICAL severity → full report + escalation
        this.rules.push({
            id: 'critical-severity-escalation',
            name: 'Critical Severity Escalation',
            description: 'CRITICAL severity requires full report and escalation',
            priority: 50,
            enabled: true,
            condition: (ctx) => ctx.severity === 'CRITICAL',
            actions: [
                {
                    type: 'emit_report',
                    config: {
                        report_type: 'full',
                    },
                },
                {
                    type: 'emit_escalation',
                    config: {
                        escalation_level: 'senior_analyst',
                        escalation_reason: 'CRITICAL severity fraud detected',
                    },
                },
            ],
        });

        // Rule 4: High regulatory impact → compliance report
        this.rules.push({
            id: 'high-regulatory-impact',
            name: 'High Regulatory Impact',
            description: 'High regulatory impact requires compliance report',
            priority: 35,
            enabled: true,
            condition: (ctx) => ctx.regulatory_impact === 'high',
            actions: [
                {
                    type: 'emit_report',
                    config: {
                        report_type: 'compliance',
                    },
                },
            ],
        });

        // Rule 5: CRITICAL with high regulatory impact → executive escalation
        this.rules.push({
            id: 'critical-regulatory-escalation',
            name: 'Critical Regulatory Escalation',
            description: 'CRITICAL severity with high regulatory impact requires executive escalation',
            priority: 60,
            enabled: true,
            condition: (ctx) => 
                ctx.severity === 'CRITICAL' && ctx.regulatory_impact === 'high',
            actions: [
                {
                    type: 'emit_escalation',
                    config: {
                        escalation_level: 'executive',
                        escalation_reason: 'CRITICAL fraud with high regulatory impact',
                    },
                },
            ],
        });

        // Rule 6: High risk score with low confidence → additional review
        this.rules.push({
            id: 'high-risk-low-confidence',
            name: 'High Risk Low Confidence',
            description: 'High risk score with low confidence requires additional review',
            priority: 25,
            enabled: true,
            condition: (ctx) => 
                ctx.risk_score >= 70 && ctx.confidence_score !== undefined && ctx.confidence_score < 0.7,
            actions: [
                {
                    type: 'emit_escalation',
                    config: {
                        escalation_level: 'senior_analyst',
                        escalation_reason: 'High risk score with low confidence requires review',
                    },
                },
            ],
        });
    }

    /**
     * Calculate regulatory impact from context
     */
    static calculateRegulatoryImpact(context: RoutingContext): RegulatoryImpact {
        // Simple heuristic - can be enhanced
        if (context.severity === 'CRITICAL' || context.risk_score >= 85) {
            return 'high';
        }
        if (context.severity === 'HIGH' || context.risk_score >= 60) {
            return 'medium';
        }
        return 'low';
    }
}