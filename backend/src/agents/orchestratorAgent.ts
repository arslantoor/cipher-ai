// Event Orchestrator Agent - Rule-based event routing
import { BaseAgent } from './baseAgent';
import {
    EventType,
    FraudDetectedEvent,
    FraudAlertCreatedEvent,
    FraudScoreCalculatedEvent,
    ReportRequestedEvent,
    EscalationTriggeredEvent,
    EventRoutedEvent,
    SystemEvent,
} from '../events/types';
import { RoutingRuleEngine, RoutingContext, RoutingAction, RoutingDecision } from '../services/routingRuleEngine';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export class OrchestratorAgent extends BaseAgent {
    private ruleEngine: RoutingRuleEngine;

    constructor(agentId?: string) {
        super('orchestrator', agentId);
        this.ruleEngine = new RoutingRuleEngine();
    }

    protected setupSubscriptions(): void {
        // Subscribe to all fraud-related events
        this.subscribe(
            [
                EventType.FRAUD_DETECTED,
                EventType.FRAUD_ALERT_CREATED,
                EventType.FRAUD_SCORE_CALCULATED,
            ],
            this.handleFraudEvent.bind(this),
            5 // Medium priority
        );
    }

    /**
     * Handle fraud-related events
     */
    private async handleFraudEvent(event: SystemEvent): Promise<void> {
        try {
            // Extract routing context from event
            const context = this.extractRoutingContext(event);

            // Evaluate routing rules
            const decisions = this.ruleEngine.evaluate(context);

            // Log all routing decisions
            await this.logRoutingDecisions(event, decisions);

            // Execute actions from matched rules
            const actions = this.ruleEngine.getActions(context);
            await this.executeActions(event, actions, context);
        } catch (error: any) {
            this.logAction('ORCHESTRATION_ERROR', {
                event_id: event.event_id,
                event_type: event.event_type,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Extract routing context from event
     */
    private extractRoutingContext(event: SystemEvent): RoutingContext {
        const context: RoutingContext = {
            severity: 'LOW',
            risk_score: 0,
        };

        if (event.event_type === EventType.FRAUD_DETECTED) {
            const payload = (event as FraudDetectedEvent).payload;
            context.severity = payload.severity;
            context.risk_score = payload.risk_score;
            context.transaction_id = payload.transaction_id;
            context.fraud_detection_id = payload.fraud_detection_id;
            context.user_id = payload.user_id;
            // Calculate regulatory impact
            context.regulatory_impact = RoutingRuleEngine.calculateRegulatoryImpact(context);
        } else if (event.event_type === EventType.FRAUD_ALERT_CREATED) {
            const payload = (event as FraudAlertCreatedEvent).payload;
            context.severity = this.mapSeverity(payload.severity);
            context.risk_score = payload.score;
            context.investigation_id = `INV-${payload.alert_id}`;
            context.user_id = payload.user_id;
            context.regulatory_impact = RoutingRuleEngine.calculateRegulatoryImpact(context);
        } else if (event.event_type === EventType.FRAUD_SCORE_CALCULATED) {
            const payload = (event as FraudScoreCalculatedEvent).payload;
            context.severity = this.mapSeverity(payload.severity);
            context.risk_score = payload.score;
            context.confidence_score = payload.justification?.confidence || 0.8;
            context.transaction_id = payload.transaction_id;
            context.user_id = payload.user_id;
            context.regulatory_impact = RoutingRuleEngine.calculateRegulatoryImpact(context);
        }

        return context;
    }

    /**
     * Map severity from lowercase to uppercase
     */
    private mapSeverity(severity: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
        const upper = severity.toUpperCase();
        if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(upper)) {
            return upper as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        }
        return 'LOW';
    }

    /**
     * Execute routing actions
     */
    private async executeActions(
        sourceEvent: SystemEvent,
        actions: RoutingAction[],
        context: RoutingContext
    ): Promise<void> {
        for (const action of actions) {
            try {
                if (action.type === 'emit_report') {
                    await this.emitReportRequested(sourceEvent, context, action.config.report_type!);
                } else if (action.type === 'emit_escalation') {
                    await this.emitEscalationTriggered(
                        sourceEvent,
                        context,
                        action.config.escalation_level!,
                        action.config.escalation_reason!
                    );
                } else if (action.type === 'log') {
                    this.logAction('ROUTING_LOG_ACTION', {
                        message: action.config.message,
                        context: JSON.stringify(context),
                    });
                }
            } catch (error: any) {
                this.logAction('ACTION_EXECUTION_ERROR', {
                    action_type: action.type,
                    error: error.message,
                });
            }
        }
    }

    /**
     * Emit ReportRequested event
     */
    private async emitReportRequested(
        sourceEvent: SystemEvent,
        context: RoutingContext,
        reportType: 'internal' | 'compliance' | 'full'
    ): Promise<void> {
        const reportEvent: ReportRequestedEvent = {
            event_id: uuidv4(),
            event_type: EventType.REPORT_REQUESTED,
            timestamp: new Date().toISOString(),
            source_agent: this.agentId,
            correlation_id: sourceEvent.event_id,
            payload: {
                transaction_id: context.transaction_id,
                fraud_detection_id: context.fraud_detection_id,
                investigation_id: context.investigation_id,
                report_type: reportType,
                severity: context.severity,
                risk_score: context.risk_score,
                regulatory_impact: context.regulatory_impact || 'low',
                requested_at: new Date().toISOString(),
            },
        };

        await this.publish(reportEvent);

        // Log routing
        await this.logRouting(
            sourceEvent.event_id,
            'report_generation',
            `Report requested: ${reportType} (severity: ${context.severity})`
        );

        this.logAction('REPORT_REQUESTED', {
            report_type: reportType,
            severity: context.severity,
            risk_score: context.risk_score,
        });
    }

    /**
     * Emit EscalationTriggered event
     */
    private async emitEscalationTriggered(
        sourceEvent: SystemEvent,
        context: RoutingContext,
        escalationLevel: 'senior_analyst' | 'compliance_team' | 'executive',
        reason: string
    ): Promise<void> {
        // Only escalate CRITICAL severity
        if (context.severity !== 'CRITICAL') {
            this.logAction('ESCALATION_SKIPPED', {
                reason: 'Escalation only for CRITICAL severity',
                current_severity: context.severity,
            });
            return;
        }

        const escalationEvent: EscalationTriggeredEvent = {
            event_id: uuidv4(),
            event_type: EventType.ESCALATION_TRIGGERED,
            timestamp: new Date().toISOString(),
            source_agent: this.agentId,
            correlation_id: sourceEvent.event_id,
            payload: {
                transaction_id: context.transaction_id,
                fraud_detection_id: context.fraud_detection_id,
                investigation_id: context.investigation_id,
                severity: 'CRITICAL',
                risk_score: context.risk_score,
                escalation_reason: reason,
                escalation_level: escalationLevel,
                regulatory_impact: context.regulatory_impact || 'high',
                triggered_at: new Date().toISOString(),
            },
        };

        await this.publish(escalationEvent);

        // Log routing
        await this.logRouting(
            sourceEvent.event_id,
            'escalation',
            `Escalation triggered: ${escalationLevel} - ${reason}`
        );

        this.logAction('ESCALATION_TRIGGERED', {
            escalation_level: escalationLevel,
            reason,
            severity: context.severity,
            risk_score: context.risk_score,
        });
    }

    /**
     * Log routing decisions to database
     */
    private async logRoutingDecisions(
        event: SystemEvent,
        decisions: RoutingDecision[]
    ): Promise<void> {
        const matchedRules = decisions.filter(d => d.matched);
        const unmatchedRules = decisions.filter(d => !d.matched);

        this.logAction('ROUTING_DECISIONS', {
            event_id: event.event_id,
            event_type: event.event_type,
            matched_rules: matchedRules.map(r => r.rule_id).join(','),
            unmatched_rules: unmatchedRules.map(r => r.rule_id).join(','),
            total_rules_evaluated: decisions.length,
            total_actions: matchedRules.reduce((sum, r) => sum + r.actions.length, 0),
        });

        // Store detailed routing log in database
        const stmt = db.prepare(`
            INSERT INTO routing_logs (
                id, event_id, event_type, matched_rules, actions_taken,
                context, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            uuidv4(),
            event.event_id,
            event.event_type,
            JSON.stringify(matchedRules.map(r => ({ id: r.rule_id, name: r.rule_name }))),
            JSON.stringify(matchedRules.flatMap(r => r.actions)),
            JSON.stringify(decisions[0]?.context || {}),
            new Date().toISOString()
        );
    }

    /**
     * Log routing event
     */
    private async logRouting(
        sourceEventId: string,
        targetAgent: string,
        reason: string
    ): Promise<void> {
        const routingEvent: EventRoutedEvent = {
            event_id: uuidv4(),
            event_type: EventType.EVENT_ROUTED,
            timestamp: new Date().toISOString(),
            source_agent: this.agentId,
            correlation_id: sourceEventId,
            payload: {
                source_event_id: sourceEventId,
                target_agent: targetAgent,
                routing_reason: reason,
            },
        };

        await this.publish(routingEvent);
    }

    /**
     * Add custom routing rule
     */
    addRoutingRule(rule: any): void {
        this.ruleEngine.addRule(rule);
        this.logAction('ROUTING_RULE_ADDED', {
            rule_id: rule.id,
            rule_name: rule.name,
        });
    }

    /**
     * Get all routing rules
     */
    getRoutingRules(): any[] {
        return this.ruleEngine.getRules();
    }

    /**
     * Enable/disable routing rule
     */
    setRuleEnabled(ruleId: string, enabled: boolean): void {
        this.ruleEngine.setRuleEnabled(ruleId, enabled);
        this.logAction('ROUTING_RULE_UPDATED', {
            rule_id: ruleId,
            enabled,
        });
    }
}