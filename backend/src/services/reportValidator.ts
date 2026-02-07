// Report Validator - AI-powered validation (validation only, no rewriting)
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ReportValidationContext {
    report_id: string;
    report_type: 'internal' | 'compliance' | 'full';
    severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
    risk_score: number;
    executive_summary: string;
    fraud_explanation: string;
    timeline_narrative: string;
    risk_justification: string;
    structured_data: {
        severity: string;
        risk_score: number;
        signals: Record<string, any>;
        timeline_events: Array<{ timestamp: string; event: string }>;
    };
    markdown_content: string;
}

export interface ValidationIssue {
    type: 'completeness' | 'consistency' | 'missing_section' | 'weak_justification' | 'anomaly';
    severity: 'low' | 'medium' | 'high';
    description: string;
    section?: string;
}

export interface ValidationResult {
    passed: boolean;
    validation_score: number; // 0-100
    issues: ValidationIssue[];
    feedback: string;
    requires_regeneration: boolean;
    structured_feedback: {
        completeness_check: boolean;
        consistency_check: boolean;
        sections_present: string[];
        sections_missing: string[];
        justification_strength: 'weak' | 'adequate' | 'strong';
        timeline_present: boolean;
        score_severity_alignment: boolean;
    };
}

export class ReportValidator {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private maxRetries = 2;
    private timeoutMs = 20000; // 20 seconds

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY || '';
        this.genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        this.model = this.genAI.getGenerativeModel({ model: modelName });
    }

    /**
     * Validate report quality using AI (validation only, no rewriting)
     */
    async validateReport(context: ReportValidationContext): Promise<ValidationResult> {
        // Run deterministic checks first
        const deterministicChecks = this.runDeterministicChecks(context);

        // Run AI validation for quality assessment
        const aiValidation = await this.runAIValidation(context, deterministicChecks);

        // Combine results
        const issues: ValidationIssue[] = [
            ...deterministicChecks.issues,
            ...aiValidation.issues,
        ];

        const validationScore = this.calculateValidationScore(deterministicChecks, aiValidation, issues);
        const passed = validationScore >= 70 && issues.filter(i => i.severity === 'high').length === 0;

        return {
            passed,
            validation_score: validationScore,
            issues,
            feedback: aiValidation.feedback,
            requires_regeneration: issues.some(i => i.severity === 'high' && i.type === 'missing_section'),
            structured_feedback: {
                completeness_check: deterministicChecks.completeness_check,
                consistency_check: deterministicChecks.consistency_check,
                sections_present: deterministicChecks.sections_present,
                sections_missing: deterministicChecks.sections_missing,
                justification_strength: aiValidation.justification_strength,
                timeline_present: deterministicChecks.timeline_present,
                score_severity_alignment: deterministicChecks.score_severity_alignment,
            },
        };
    }

    /**
     * Run deterministic validation checks (no AI)
     */
    private runDeterministicChecks(context: ReportValidationContext): {
        completeness_check: boolean;
        consistency_check: boolean;
        sections_present: string[];
        sections_missing: string[];
        timeline_present: boolean;
        score_severity_alignment: boolean;
        issues: ValidationIssue[];
    } {
        const issues: ValidationIssue[] = [];
        const sectionsPresent: string[] = [];
        const sectionsMissing: string[] = [];

        // Check required sections
        if (context.executive_summary && context.executive_summary.trim().length > 50) {
            sectionsPresent.push('executive_summary');
        } else {
            sectionsMissing.push('executive_summary');
            issues.push({
                type: 'missing_section',
                severity: 'high',
                description: 'Executive summary is missing or too short',
                section: 'executive_summary',
            });
        }

        if (context.fraud_explanation && context.fraud_explanation.trim().length > 100) {
            sectionsPresent.push('fraud_explanation');
        } else {
            sectionsMissing.push('fraud_explanation');
            issues.push({
                type: 'missing_section',
                severity: 'high',
                description: 'Fraud explanation is missing or too short',
                section: 'fraud_explanation',
            });
        }

        if (context.timeline_narrative && context.timeline_narrative.trim().length > 50) {
            sectionsPresent.push('timeline_narrative');
        } else {
            sectionsMissing.push('timeline_narrative');
            issues.push({
                type: 'missing_section',
                severity: 'medium',
                description: 'Timeline narrative is missing or too short',
                section: 'timeline_narrative',
            });
        }

        if (context.risk_justification && context.risk_justification.trim().length > 50) {
            sectionsPresent.push('risk_justification');
        } else {
            sectionsMissing.push('risk_justification');
            issues.push({
                type: 'missing_section',
                severity: 'high',
                description: 'Risk justification is missing or too short',
                section: 'risk_justification',
            });
        }

        // Check timeline presence
        const timelinePresent = context.structured_data.timeline_events.length > 0;

        // Check score-severity alignment
        const expectedSeverity = this.getSeverityFromScore(context.risk_score);
        const scoreSeverityAlignment = expectedSeverity === context.severity;

        if (!scoreSeverityAlignment) {
            issues.push({
                type: 'consistency',
                severity: 'high',
                description: `Score-severity mismatch: risk_score ${context.risk_score} suggests ${expectedSeverity}, but report shows ${context.severity}`,
            });
        }

        // Check consistency
        const consistencyCheck = 
            context.structured_data.risk_score === context.risk_score &&
            context.structured_data.severity === context.severity;

        if (!consistencyCheck) {
            issues.push({
                type: 'consistency',
                severity: 'high',
                description: 'Inconsistency between structured data and report metadata',
            });
        }

        return {
            completeness_check: sectionsMissing.length === 0,
            consistency_check: consistencyCheck && scoreSeverityAlignment,
            sections_present: sectionsPresent,
            sections_missing: sectionsMissing,
            timeline_present: timelinePresent,
            score_severity_alignment: scoreSeverityAlignment,
            issues,
        };
    }

    /**
     * Run AI validation for quality assessment
     */
    private async runAIValidation(
        context: ReportValidationContext,
        deterministicChecks: any
    ): Promise<{
        issues: ValidationIssue[];
        feedback: string;
        justification_strength: 'weak' | 'adequate' | 'strong';
    }> {
        if (!process.env.GEMINI_API_KEY) {
            return {
                issues: [],
                feedback: '[AI validation unavailable] Deterministic checks only.',
                justification_strength: 'adequate',
            };
        }

        const prompt = this.getValidationPrompt(context, deterministicChecks);

        try {
            const result = await Promise.race([
                this.model.generateContent(prompt),
                this.createTimeout(this.timeoutMs),
            ]);

            if (result === 'TIMEOUT') {
                throw new Error('AI validation timeout');
            }

            const response = await (result as any).response;
            const text = response.text();

            // Parse AI response (structured JSON expected)
            return this.parseAIValidationResponse(text, deterministicChecks);
        } catch (error: any) {
            console.warn('AI validation failed, using deterministic only:', error.message);
            return {
                issues: [],
                feedback: 'AI validation unavailable. Deterministic checks passed.',
                justification_strength: 'adequate',
            };
        }
    }

    /**
     * Get validation prompt template
     */
    private getValidationPrompt(
        context: ReportValidationContext,
        deterministicChecks: any
    ): string {
        return `You are a quality assurance supervisor validating a fraud detection report.

CRITICAL CONSTRAINTS:
- You are VALIDATING only, NOT rewriting
- Provide structured feedback in JSON format
- Identify issues but do NOT modify content
- Assess justification strength
- Flag weak explanations

REPORT TO VALIDATE:
- Severity: ${context.severity}
- Risk Score: ${context.risk_score}/100
- Report Type: ${context.report_type}

SECTIONS:
- Executive Summary: ${context.executive_summary.substring(0, 200)}...
- Fraud Explanation: ${context.fraud_explanation.substring(0, 200)}...
- Timeline: ${context.timeline_narrative.substring(0, 200)}...
- Risk Justification: ${context.risk_justification.substring(0, 200)}...

DETERMINISTIC CHECKS:
${JSON.stringify(deterministicChecks, null, 2)}

INSTRUCTION: Return JSON with this structure:
{
  "issues": [
    {
      "type": "weak_justification" | "anomaly",
      "severity": "low" | "medium" | "high",
      "description": "Clear description of issue",
      "section": "section_name (optional)"
    }
  ],
  "feedback": "Overall validation feedback (100-150 words)",
  "justification_strength": "weak" | "adequate" | "strong"
}

Focus on:
1. Is the justification clear and logical?
2. Are there any anomalies or contradictions?
3. Is the explanation sufficient for the severity level?
4. Are there gaps in the narrative?

Do NOT rewrite or modify the report. Only validate and provide feedback.`;
    }

    /**
     * Parse AI validation response
     */
    private parseAIValidationResponse(
        text: string,
        deterministicChecks: any
    ): {
        issues: ValidationIssue[];
        feedback: string;
        justification_strength: 'weak' | 'adequate' | 'strong';
    } {
        try {
            // Try to extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    issues: (parsed.issues || []).map((issue: any) => ({
                        type: issue.type || 'anomaly',
                        severity: issue.severity || 'medium',
                        description: issue.description || 'Issue detected',
                        section: issue.section,
                    })),
                    feedback: parsed.feedback || text.substring(0, 200),
                    justification_strength: parsed.justification_strength || 'adequate',
                };
            }
        } catch (error) {
            console.warn('Failed to parse AI validation response as JSON');
        }

        // Fallback: extract issues from text
        const issues: ValidationIssue[] = [];
        if (text.toLowerCase().includes('weak justification') || text.toLowerCase().includes('insufficient')) {
            issues.push({
                type: 'weak_justification',
                severity: 'medium',
                description: 'AI validation flagged weak justification',
            });
        }

        return {
            issues,
            feedback: text.substring(0, 300),
            justification_strength: 'adequate',
        };
    }

    /**
     * Calculate validation score
     */
    private calculateValidationScore(
        deterministicChecks: any,
        aiValidation: any,
        issues: ValidationIssue[]
    ): number {
        let score = 100;

        // Deduct for missing sections
        score -= deterministicChecks.sections_missing.length * 15;

        // Deduct for consistency issues
        if (!deterministicChecks.consistency_check) {
            score -= 20;
        }

        if (!deterministicChecks.score_severity_alignment) {
            score -= 15;
        }

        // Deduct for AI-detected issues
        for (const issue of issues) {
            if (issue.severity === 'high') {
                score -= 10;
            } else if (issue.severity === 'medium') {
                score -= 5;
            } else {
                score -= 2;
            }
        }

        // Deduct for weak justification
        if (aiValidation.justification_strength === 'weak') {
            score -= 15;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get expected severity from score
     */
    private getSeverityFromScore(score: number): 'MEDIUM' | 'HIGH' | 'CRITICAL' {
        if (score >= 86) return 'CRITICAL';
        if (score >= 61) return 'HIGH';
        return 'MEDIUM';
    }

    /**
     * Create timeout promise
     */
    private createTimeout(ms: number): Promise<string> {
        return new Promise(resolve => {
            setTimeout(() => resolve('TIMEOUT'), ms);
        });
    }
}