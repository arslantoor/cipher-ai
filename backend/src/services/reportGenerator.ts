// Report Generator - AI-powered report generation (language only, no scoring)
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';

export interface ReportContext {
    transaction_id?: string;
    fraud_detection_id?: string;
    investigation_id?: string;
    user_id: string;
    severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
    risk_score: number;
    fraud_signals: {
        amount_deviation: any;
        velocity_anomaly: any;
        geographic_inconsistency: any;
        rule_flags: any;
    };
    transaction_data?: {
        amount: number;
        timestamp: string;
        location?: { city: string; country: string };
        [key: string]: any;
    };
    timeline?: Array<{
        timestamp: string;
        event: string;
        details?: string;
    }>;
    baseline?: {
        avg_transaction_amount: number;
        typical_transaction_hours: number[];
        common_locations: string[];
    };
    correlation_data?: {
        prior_alerts: number;
        user_activity_summary: any;
        similar_patterns: string[];
    };
}

export interface GeneratedReport {
    report_id: string;
    report_type: 'internal' | 'compliance' | 'full';
    executive_summary: string;
    fraud_explanation: string;
    timeline: string;
    risk_justification: string;
    investigation_narrative?: string; // 180-220 words AI-generated narrative
    recommended_next_steps?: string; // For audit trail
    structured_data: {
        severity: string;
        risk_score: number;
        signals: Record<string, any>;
        timeline_events: Array<{ timestamp: string; event: string }>;
    };
    markdown_content: string;
    generated_at: string;
}

export class ReportGenerator {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private maxRetries = 3;
    private timeoutMs = 30000; // 30 seconds

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY || '';
        this.genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        this.model = this.genAI.getGenerativeModel({ model: modelName });
    }

    /**
     * Generate investigation report with 180-220 word narrative
     * EMIT: Output detailed investigation report including:
     * - Detected anomaly
     * - Severity classification
     * - Timeline of events
     * - AI-generated narrative (180-220 words)
     * - Recommended next steps (for audit trail)
     */
    async generateInvestigationReport(
        context: ReportContext,
        reportType: 'internal' | 'compliance' | 'full'
    ): Promise<GeneratedReport> {
        return this.generateReport(context, reportType, true);
    }

    /**
     * Generate complete report from context
     */
    async generateReport(
        context: ReportContext,
        reportType: 'internal' | 'compliance' | 'full',
        includeInvestigationNarrative: boolean = false
    ): Promise<GeneratedReport> {
        const reportId = uuidv4();
        const startTime = Date.now();

        // Redact sensitive fields
        const redactedContext = this.redactSensitiveData(context);

        // Generate structured data (deterministic, no AI)
        const structuredData = this.generateStructuredData(redactedContext);

        // Generate narrative sections using AI (language only)
        const executiveSummary = await this.generateExecutiveSummary(redactedContext, reportType);
        const fraudExplanation = await this.generateFraudExplanation(redactedContext);
        const timeline = await this.generateTimelineNarrative(redactedContext);
        const riskJustification = await this.generateRiskJustification(redactedContext);

        // Generate investigation narrative (180-220 words) if requested
        let investigationNarrative: string | undefined;
        let recommendedNextSteps: string | undefined;
        
        if (includeInvestigationNarrative) {
            investigationNarrative = await this.generateInvestigationNarrative(redactedContext);
            recommendedNextSteps = this.generateRecommendedNextSteps(redactedContext);
        }

        // Combine into markdown report
        const markdownContent = this.buildMarkdownReport({
            reportId,
            reportType,
            executiveSummary,
            fraudExplanation,
            timeline,
            riskJustification,
            investigationNarrative,
            recommendedNextSteps,
            structuredData,
            context: redactedContext,
        });

        return {
            report_id: reportId,
            report_type: reportType,
            executive_summary: executiveSummary,
            fraud_explanation: fraudExplanation,
            timeline,
            risk_justification: riskJustification,
            investigation_narrative: investigationNarrative,
            recommended_next_steps: recommendedNextSteps,
            structured_data: structuredData,
            markdown_content: markdownContent,
            generated_at: new Date().toISOString(),
        };
    }

    /**
     * Generate investigation narrative (180-220 words)
     * Professional, compliance-ready investigation summary
     */
    private async generateInvestigationNarrative(context: ReportContext): Promise<string> {
        const prompt = `You are a professional fraud investigator writing a compliance-ready investigation summary.

Context:
- User ID: ${context.user_id}
- Severity: ${context.severity}
- Risk Score: ${context.risk_score}/100
- Detected Anomaly: ${this.summarizeAnomaly(context.fraud_signals)}
${context.correlation_data ? `- Prior Alerts: ${context.correlation_data.prior_alerts}` : ''}
${context.timeline ? `- Timeline Events: ${context.timeline.length} events` : ''}

Requirements:
- Write a professional investigation narrative (180-220 words)
- Include: detected anomaly, severity classification, timeline summary, risk assessment
- Use neutral, investigator tone
- No speculation, only facts
- Compliance-friendly language
- Clear cause → effect → justification

Generate the investigation narrative:`;

        const narrative = await this.callAIWithRetry(prompt);
        
        // Ensure word count is within range (rough check)
        const wordCount = narrative.split(/\s+/).length;
        if (wordCount < 150) {
            // Too short, ask for expansion
            const expanded = await this.callAIWithRetry(`${prompt}\n\nPrevious attempt was too short (${wordCount} words). Expand to 180-220 words.`);
            return expanded;
        } else if (wordCount > 250) {
            // Too long, ask for compression
            const compressed = await this.callAIWithRetry(`${prompt}\n\nPrevious attempt was too long (${wordCount} words). Compress to 180-220 words.`);
            return compressed;
        }
        
        return narrative;
    }

    /**
     * Generate recommended next steps for audit trail
     */
    private generateRecommendedNextSteps(context: ReportContext): string {
        const steps: string[] = [];

        if (context.severity === 'CRITICAL') {
            steps.push('1. Immediate account review and potential account freeze');
            steps.push('2. Escalate to senior compliance team');
            steps.push('3. Document all findings in investigation system');
        } else if (context.severity === 'HIGH') {
            steps.push('1. Review account activity patterns');
            steps.push('2. Contact user for verification if necessary');
            steps.push('3. Monitor subsequent transactions closely');
        } else {
            steps.push('1. Monitor account for additional anomalies');
            steps.push('2. Review baseline behavior patterns');
            steps.push('3. Document findings for future reference');
        }

        steps.push('4. Update fraud detection models if patterns emerge');
        steps.push('5. Maintain audit trail of all actions taken');

        return steps.join('\n');
    }

    /**
     * Summarize detected anomaly for prompt
     */
    private summarizeAnomaly(signals: any): string {
        const anomalies: string[] = [];
        
        if (signals.amount_deviation?.detected) {
            anomalies.push(`Amount deviation (${signals.amount_deviation.explanation || 'unusual amount'})`);
        }
        if (signals.velocity_anomaly?.detected) {
            anomalies.push(`Velocity anomaly (${signals.velocity_anomaly.explanation || 'unusual frequency'})`);
        }
        if (signals.geographic_inconsistency?.detected) {
            anomalies.push(`Geographic inconsistency (${signals.geographic_inconsistency.explanation || 'unusual location'})`);
        }
        if (signals.rule_flags?.triggered?.length > 0) {
            anomalies.push(`Rule flags: ${signals.rule_flags.triggered.join(', ')}`);
        }

        return anomalies.length > 0 ? anomalies.join('; ') : 'Multiple fraud signals detected';
    }

    /**
     * Generate executive summary (AI - language only)
     */
    private async generateExecutiveSummary(
        context: ReportContext,
        reportType: string
    ): Promise<string> {
        const prompt = this.getExecutiveSummaryPrompt(context, reportType);
        return await this.callAIWithRetry(prompt);
    }

    /**
     * Generate fraud explanation narrative (AI - language only)
     */
    private async generateFraudExplanation(context: ReportContext): Promise<string> {
        const prompt = this.getFraudExplanationPrompt(context);
        return await this.callAIWithRetry(prompt);
    }

    /**
     * Generate timeline narrative (AI - language only)
     */
    private async generateTimelineNarrative(context: ReportContext): Promise<string> {
        const prompt = this.getTimelinePrompt(context);
        return await this.callAIWithRetry(prompt);
    }

    /**
     * Generate risk justification (AI - language only)
     */
    private async generateRiskJustification(context: ReportContext): Promise<string> {
        const prompt = this.getRiskJustificationPrompt(context);
        return await this.callAIWithRetry(prompt);
    }

    /**
     * Call AI with retry and timeout handling
     */
    private async callAIWithRetry(prompt: string, retryCount = 0): Promise<string> {
        if (!process.env.GEMINI_API_KEY) {
            return '[AI UNAVAILABLE] Report generation requires Gemini API key.';
        }

        try {
            const result = await Promise.race([
                this.model.generateContent(prompt),
                this.createTimeout(this.timeoutMs),
            ]);

            if (result === 'TIMEOUT') {
                throw new Error('AI call timeout');
            }

            const response = await (result as any).response;
            return response.text();
        } catch (error: any) {
            if (retryCount < this.maxRetries) {
                console.warn(`AI call failed, retry ${retryCount + 1}/${this.maxRetries}:`, error.message);
                await this.delay(1000 * (retryCount + 1)); // Exponential backoff
                return this.callAIWithRetry(prompt, retryCount + 1);
            }

            console.error('AI call failed after retries:', error);
            return this.getFallbackNarrative(prompt);
        }
    }

    /**
     * Create timeout promise
     */
    private createTimeout(ms: number): Promise<string> {
        return new Promise(resolve => {
            setTimeout(() => resolve('TIMEOUT'), ms);
        });
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get executive summary prompt template
     */
    private getExecutiveSummaryPrompt(context: ReportContext, reportType: string): string {
        return `You are a fraud investigation analyst writing an executive summary.

CRITICAL CONSTRAINTS:
- Use neutral, investigator tone
- No speculation or assumptions
- State facts only
- Clear cause → effect → justification structure
- 100-150 words maximum

CONTEXT (JSON):
${JSON.stringify({
    severity: context.severity,
    risk_score: context.risk_score,
    transaction_amount: context.transaction_data?.amount,
    detected_signals: Object.keys(context.fraud_signals).filter(
        key => context.fraud_signals[key as keyof typeof context.fraud_signals]?.detected || 
               context.fraud_signals[key as keyof typeof context.fraud_signals]?.triggered?.length > 0
    ),
}, null, 2)}

INSTRUCTION: Write a concise executive summary explaining:
1. What fraud signals were detected
2. Why this transaction was flagged
3. The risk level and severity classification

Do NOT modify scores or facts. Only explain what happened in professional language.`;
    }

    /**
     * Get fraud explanation prompt template
     */
    private getFraudExplanationPrompt(context: ReportContext): string {
        const signals = context.fraud_signals;
        const signalDetails: string[] = [];

        if (signals.amount_deviation?.detected) {
            signalDetails.push(`Amount Deviation: ${signals.amount_deviation.explanation}`);
        }
        if (signals.velocity_anomaly?.detected) {
            signalDetails.push(`Velocity Anomaly: ${signals.velocity_anomaly.explanation}`);
        }
        if (signals.geographic_inconsistency?.detected) {
            signalDetails.push(`Geographic Inconsistency: ${signals.geographic_inconsistency.explanation}`);
        }
        if (signals.rule_flags?.triggered?.length > 0) {
            signalDetails.push(`Rule Flags: ${signals.rule_flags.explanation}`);
        }

        return `You are a fraud investigation analyst explaining fraud detection findings.

CRITICAL CONSTRAINTS:
- Neutral, investigator tone
- No speculation
- Explain cause → effect → justification
- Reference specific signals and thresholds
- 200-250 words

FRAUD SIGNALS DETECTED:
${signalDetails.join('\n')}

BASELINE COMPARISON:
${context.baseline ? JSON.stringify({
    avg_amount: context.baseline.avg_transaction_amount,
    typical_hours: context.baseline.typical_transaction_hours,
    common_locations: context.baseline.common_locations,
}, null, 2) : 'No baseline available'}

INSTRUCTION: Explain:
1. What fraud signals were triggered and why
2. How current activity compares to historical baseline
3. The logical connection between signals and risk assessment

Do NOT modify scores. Only explain the detection logic in clear, professional language.`;
    }

    /**
     * Get timeline prompt template
     */
    private getTimelinePrompt(context: ReportContext): string {
        const timelineEvents = context.timeline || [];

        return `You are a fraud investigation analyst summarizing a timeline of events.

CRITICAL CONSTRAINTS:
- Chronological order
- Factual, no speculation
- Clear cause-effect relationships
- 150-200 words

TIMELINE EVENTS:
${timelineEvents.map((e, i) => `${i + 1}. ${e.timestamp}: ${e.event}${e.details ? ` (${e.details})` : ''}`).join('\n')}

INSTRUCTION: Summarize the timeline, explaining:
1. The sequence of events
2. How events relate to fraud detection
3. Key decision points

Use professional, neutral language. No speculation.`;
    }

    /**
     * Get risk justification prompt template
     */
    private getRiskJustificationPrompt(context: ReportContext): string {
        return `You are a fraud investigation analyst justifying the risk assessment.

CRITICAL CONSTRAINTS:
- Reference specific scores and thresholds
- Explain severity classification logic
- No speculation
- 150-200 words

RISK ASSESSMENT:
- Risk Score: ${context.risk_score}/100
- Severity: ${context.severity}
- Signals Detected: ${Object.keys(context.fraud_signals).filter(
    key => context.fraud_signals[key as keyof typeof context.fraud_signals]?.detected ||
           context.fraud_signals[key as keyof typeof context.fraud_signals]?.triggered?.length > 0
).length}

INSTRUCTION: Justify:
1. Why this risk score was assigned
2. How severity was determined
3. The relationship between signals and final assessment

Reference actual numbers and thresholds. Do NOT modify scores. Only explain the assessment logic.`;
    }

    /**
     * Generate structured data (deterministic, no AI)
     */
    private generateStructuredData(context: ReportContext): GeneratedReport['structured_data'] {
        return {
            severity: context.severity,
            risk_score: context.risk_score,
            signals: {
                amount_deviation: context.fraud_signals.amount_deviation,
                velocity_anomaly: context.fraud_signals.velocity_anomaly,
                geographic_inconsistency: context.fraud_signals.geographic_inconsistency,
                rule_flags: context.fraud_signals.rule_flags,
            },
            timeline_events: (context.timeline || []).map(e => ({
                timestamp: e.timestamp,
                event: e.event,
            })),
        };
    }

    /**
     * Build markdown report
     */
    private buildMarkdownReport(data: {
        reportId: string;
        reportType: string;
        executiveSummary: string;
        fraudExplanation: string;
        timeline: string;
        riskJustification: string;
        investigationNarrative?: string;
        recommendedNextSteps?: string;
        structuredData: GeneratedReport['structured_data'];
        context: ReportContext;
    }): string {
        let report = `# Investigation Report

**Report ID**: ${data.reportId}  
**Type**: ${data.reportType.toUpperCase()}  
**Generated**: ${new Date().toISOString()}

---

## Executive Summary

${data.executiveSummary}

---

## Detected Anomaly

${this.formatDetectedAnomaly(data.context)}

---

## Severity Classification

**Severity**: ${data.context.severity}  
**Risk Score**: ${data.context.risk_score}/100

${data.riskJustification}

---

## Timeline of Events

${data.timeline}

---

`;

        // Add investigation narrative if available
        if (data.investigationNarrative) {
            report += `## Investigation Narrative

${data.investigationNarrative}

---

`;
        }

        report += `## Fraud Explanation

${data.fraudExplanation}

---

`;

        // Add recommended next steps if available
        if (data.recommendedNextSteps) {
            report += `## Recommended Next Steps

${data.recommendedNextSteps}

---

`;
        }

        report += `## Structured Data

\`\`\`json
${JSON.stringify(data.structuredData, null, 2)}
\`\`\`

---

## Detection Details

- **Severity**: ${data.context.severity}
- **Risk Score**: ${data.context.risk_score}/100
- **Transaction ID**: ${data.context.transaction_id || 'N/A'}
- **Fraud Detection ID**: ${data.context.fraud_detection_id || 'N/A'}
- **User ID**: ${data.context.user_id}

---

*Report generated by CipherAI Investigation / Report Generator*
*This report is for internal use only. All scores and classifications are deterministic and explainable.*
*Agent does not flag or block accounts - only generates summaries for audit trail.*
`;

        return report;
    }

    /**
     * Format detected anomaly section
     */
    private formatDetectedAnomaly(context: ReportContext): string {
        const anomalies: string[] = [];
        
        if (context.fraud_signals.amount_deviation?.detected) {
            anomalies.push(`- **Amount Deviation**: ${context.fraud_signals.amount_deviation.explanation || 'Unusual transaction amount detected'}`);
        }
        if (context.fraud_signals.velocity_anomaly?.detected) {
            anomalies.push(`- **Velocity Anomaly**: ${context.fraud_signals.velocity_anomaly.explanation || 'Unusual transaction frequency detected'}`);
        }
        if (context.fraud_signals.geographic_inconsistency?.detected) {
            anomalies.push(`- **Geographic Inconsistency**: ${context.fraud_signals.geographic_inconsistency.explanation || 'Unusual location detected'}`);
        }
        if (context.fraud_signals.rule_flags?.triggered?.length > 0) {
            anomalies.push(`- **Rule Flags**: ${context.fraud_signals.rule_flags.triggered.join(', ')}`);
        }

        return anomalies.length > 0 
            ? anomalies.join('\n')
            : 'Multiple fraud signals detected';
    }

    /**
     * Redact sensitive fields
     */
    private redactSensitiveData(context: ReportContext): ReportContext {
        const redacted = { ...context };

        // Redact user_id (keep last 4 chars)
        if (redacted.user_id) {
            redacted.user_id = `***${redacted.user_id.slice(-4)}`;
        }

        // Redact IP addresses
        if (redacted.transaction_data?.ip_address) {
            redacted.transaction_data.ip_address = '[REDACTED]';
        }

        // Redact device fingerprints
        if (redacted.transaction_data?.device_fingerprint) {
            redacted.transaction_data.device_fingerprint = '[REDACTED]';
        }

        // Remove any other sensitive fields
        if (redacted.transaction_data) {
            delete (redacted.transaction_data as any).sensitive_data;
            delete (redacted.transaction_data as any).pii;
        }

        return redacted;
    }

    /**
     * Fallback narrative when AI fails
     */
    private getFallbackNarrative(prompt: string): string {
        return `[FALLBACK] AI generation unavailable. Report generated using deterministic data only. Please review structured data section for details.`;
    }
}