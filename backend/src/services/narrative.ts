import { GoogleGenerativeAI } from '@google/generative-ai';
import { Alert, SeverityLevel, SeverityJustification, Deviation, TimelineEvent, MarketContext, BehavioralPressureScore, BehavioralPressureLevel, Baseline, TradingInsight } from '../types';

export class NarrativeGenerator {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        // Initialize Gemini with API Key from environment
        const apiKey = process.env.GEMINI_API_KEY || '';
        this.genAI = new GoogleGenerativeAI(apiKey);
        // Using latest available Gemini model (gemini-2.5-flash recommended for production)
        // Can be configured via GEMINI_MODEL env variable
        // Available models: gemini-2.5-flash, gemini-2.5-pro, gemini-3-flash-preview, gemini-3-pro-preview
        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        this.model = this.genAI.getGenerativeModel({ model: modelName });
    }

    async generateNarrative(
        alert: Alert,
        severity: SeverityLevel,
        justification: SeverityJustification,
        deviations: Deviation,
        timeline: TimelineEvent[]
    ): Promise<string> {
        if (!process.env.GEMINI_API_KEY) {
            return `[SIMULATED NARRATIVE] Gemini API Key missing. Alert ${alert.alert_id} (${alert.alert_type}) classified as ${severity.toUpperCase()}. 
      Base score of ${justification.base_score} with a deviation multiplier of ${justification.deviation_multiplier.toFixed(2)}x leading to a final score of ${justification.final_score.toFixed(2)}. 
      Triggered deviations: ${this.getTriggeredDeviationsList(deviations)}. 
      Allowed actions include: ${severity.toUpperCase()} level protocols.`;
        }

        const systemPrompt = this.getSystemPrompt(severity);
        const userPrompt = this.buildPrompt(alert, severity, justification, deviations, timeline);

        try {
            // Combine system context with the user request for Gemini
            const fullPrompt = `${systemPrompt}\n\nINVESTIGATION DATA:\n${userPrompt}`;

            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            console.error('Gemini Narrative generation error:', error);
            
            // Try fallback models if primary model fails
            const fallbackModels = ['gemini-2.5-pro', 'gemini-flash-latest', 'gemini-pro'];
            for (const fallbackModel of fallbackModels) {
                try {
                    console.log(`Trying fallback model: ${fallbackModel}`);
                    const fallbackModelInstance = this.genAI.getGenerativeModel({ model: fallbackModel });
                    // Reuse existing prompts
                    const fullPrompt = `${systemPrompt}\n\nINVESTIGATION DATA:\n${userPrompt}`;
                    
                    const result = await fallbackModelInstance.generateContent(fullPrompt);
                    const response = await result.response;
                    return response.text();
                } catch (fallbackError) {
                    console.error(`Fallback model ${fallbackModel} also failed:`, fallbackError);
                    continue;
                }
            }
            
            // Return fallback narrative if all models fail
            return `[FALLBACK NARRATIVE] Alert ${alert.alert_id} (${alert.alert_type}) classified as ${severity.toUpperCase()}. 
Base score of ${justification.base_score} with a deviation multiplier of ${justification.deviation_multiplier.toFixed(2)}x leading to a final score of ${justification.final_score.toFixed(2)}. 
Triggered deviations: ${this.getTriggeredDeviationsList(deviations)}. 
Allowed actions include: ${severity.toUpperCase()} level protocols. 
Note: AI narrative generation unavailable. Please check your Gemini API key and model configuration.`;
        }
    }

    private getTriggeredDeviationsList(deviations: Deviation): string {
        const triggered: string[] = [];
        Object.entries(deviations).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null && 'multiplier' in value && value.multiplier > 1.0) {
                triggered.push(key);
            } else if (value === true) {
                triggered.push(key);
            }
        });
        return triggered.length > 0 ? triggered.join(', ') : 'None';
    }

    private getSystemPrompt(severity: SeverityLevel): string {
        const base = `You are CipherAI, a professional fraud investigation copilot.
Your role is to explain why an alert was classified at a specific severity level.

CRITICAL RULES:
1. Be factual and precise - no speculation.
2. Reference specific thresholds (Score: ${severity}) and deviations.
3. Use professional, measured language (Fintech industry standard).
4. Always explain what changed from the user's historical baseline.
5. End with what actions are permitted at this severity level.`;

        const toneGuidance: Record<SeverityLevel, string> = {
            [SeverityLevel.LOW]: 'Tone: Calm, informational. Context: Routine monitoring.',
            [SeverityLevel.MEDIUM]: 'Tone: Attentive, measured. Context: Verification required.',
            [SeverityLevel.HIGH]: 'Tone: Serious, urgent. Context: Immediate review required.',
            [SeverityLevel.CRITICAL]: 'Tone: Decisive, immediate action. Context: Potential active fraud.',
        };

        return `${base}\n\n${toneGuidance[severity]}`;
    }

    private buildPrompt(
        alert: Alert,
        severity: SeverityLevel,
        justification: SeverityJustification,
        deviations: Deviation,
        timeline: TimelineEvent[]
    ): string {
        return `
ALERT SUMMARY:
- ID: ${alert.alert_id}
- Type: ${alert.alert_type}
- User: ${alert.user_id}
- Occurred: ${alert.timestamp}

ENGINE CLASSIFICATION: ${severity.toUpperCase()}
- Calculated Score: ${justification.final_score.toFixed(2)}
- Deviation Multiplier: ${justification.deviation_multiplier.toFixed(2)}x

TRIGGERED DEVIATIONS:
${this.formatDeviations(deviations)}

TIMELINE OF EVENTS:
${timeline.map((e) => `- ${e.event}`).join('\n')}

INSTRUCTION: Generate a professional investigation narrative (180-220 words) for the internal audit log.`;
    }

    private formatDeviations(deviations: Deviation): string {
        const lines: string[] = [];
        Object.entries(deviations).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null && 'multiplier' in value) {
                if (value.multiplier > 1.0) {
                    lines.push(`- ${key}: ${JSON.stringify(value)}`);
                }
            }
        });
        return lines.length > 0 ? lines.join('\n') : 'No significant deviations detected.';
    }

    /**
     * Generate trading narrative - explains market context and behavioral patterns
     * NO PREDICTIONS, NO TRADING ADVICE
     */
    async generateTradingNarrative(
        marketContext: MarketContext,
        pressureScore: BehavioralPressureScore,
        baseline: Baseline,
        deviations: Deviation,
        severity: SeverityLevel,
        justification: SeverityJustification,
        historicalPatterns?: string
    ): Promise<string> {
        if (!process.env.GEMINI_API_KEY) {
            return this.getFallbackTradingNarrative(marketContext, pressureScore, baseline, deviations);
        }

        const systemPrompt = this.getTradingSystemPrompt(pressureScore.level);
        const userPrompt = this.buildTradingPrompt(marketContext, pressureScore, baseline, deviations, severity, justification, historicalPatterns);

        try {
            const fullPrompt = `${systemPrompt}\n\nTRADING ANALYSIS DATA:\n${userPrompt}`;
            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            console.error('Gemini Trading Narrative generation error:', error);
            return this.getFallbackTradingNarrative(marketContext, pressureScore, baseline, deviations);
        }
    }

    private getTradingSystemPrompt(pressureLevel: BehavioralPressureLevel): string {
        const base = `You are CipherAI, an intelligent trading analyst assistant for Deriv.

CRITICAL CONSTRAINTS - YOU MUST FOLLOW THESE:
1. NEVER provide trading predictions, price forecasts, or buy/sell signals
2. NEVER recommend entering or exiting trades
3. ONLY explain what happened and what patterns were observed
4. Use plain English, 150-220 words
5. Be factual, educational, and compliance-safe
6. Explain market movements and behavioral patterns
7. Focus on "what happened" and "what patterns were detected"

CORE FEATURE - PERSONALIZED MARKET-BEHAVIOR CONNECTION:
You MUST connect market movements to the trader's historical behavioral patterns using this format:
"The market just did [X - describe the market movement], and based on your trading history, you tend to [Y - describe their behavioral pattern in similar situations]."

This is the KEY differentiator - combining market intelligence with personal behavioral awareness.

Your role: Explain market context and trading behavior patterns in an educational, non-advisory manner, ALWAYS connecting market events to the trader's personal behavioral history.`;

        // Add behavioral coaching guidance based on pressure level
        if (pressureLevel === BehavioralPressureLevel.HIGH_PRESSURE) {
            return `${base}

BEHAVIORAL COACHING (for HIGH pressure):
- Gently suggest taking a break to reflect on patterns
- Recommend reviewing recent trading decisions when calm
- Suggest setting temporary trading limits if patterns indicate emotional trading
- Use supportive, non-judgmental language
- Frame as self-awareness building, not criticism`;
        } else if (pressureLevel === BehavioralPressureLevel.STABLE) {
            return `${base}

BEHAVIORAL COACHING (for STABLE pressure):
- Celebrate consistent, disciplined trading patterns
- Acknowledge sustainable trading habits
- Reinforce positive behavior patterns
- Use encouraging, supportive language`;
        }

        return base;
    }

    private buildTradingPrompt(
        marketContext: MarketContext,
        pressureScore: BehavioralPressureScore,
        baseline: Baseline,
        deviations: Deviation,
        severity: SeverityLevel,
        justification: SeverityJustification,
        historicalPatterns?: string
    ): string {
        return `
MARKET CONTEXT:
- Instrument: ${marketContext.instrument}
- Movement Type: ${marketContext.movementType}
- Magnitude: ${marketContext.magnitude.toFixed(2)}%
- Timeframe: ${marketContext.timeframe}
- Historical Context: ${marketContext.historicalContext}
${marketContext.knownCatalysts && marketContext.knownCatalysts.length > 0 
    ? `- Known Catalysts: ${marketContext.knownCatalysts.join(', ')}` 
    : ''}

TRADER'S HISTORICAL BASELINE (Their Normal Patterns):
- Average Position Size: ${baseline.avg_transaction_amount.toFixed(2)}
- Typical Trading Hours: ${baseline.typical_transaction_hours.join(', ')}
- Average Trades Per Day: ${baseline.avg_transactions_per_day.toFixed(2)}
- Account Maturity: Based on ${baseline.avg_transactions_per_day.toFixed(1)} trades/day average
${historicalPatterns ? `- Historical Patterns in Similar Situations: ${historicalPatterns}` : ''}

CURRENT BEHAVIORAL ANALYSIS:
- Pressure Level: ${pressureScore.level.toUpperCase()}
- Pressure Score: ${pressureScore.score}/100
- Factors:
  * Trade Frequency: ${pressureScore.factors.trade_frequency_spike}x baseline (${pressureScore.factors.trade_frequency_spike > 2 ? 'SIGNIFICANT INCREASE' : pressureScore.factors.trade_frequency_spike > 1.5 ? 'MODERATE INCREASE' : 'NORMAL'})
  * Position Size Deviation: ${pressureScore.factors.position_size_deviation.toFixed(2)}x (${pressureScore.factors.position_size_deviation > 2 ? 'LARGER THAN USUAL' : 'NORMAL'})
  * Loss Clustering: ${pressureScore.factors.loss_clustering}% (${pressureScore.factors.loss_clustering > 0.5 ? 'HIGH CLUSTERING' : 'NORMAL'})
  * Unusual Hours: ${pressureScore.factors.unusual_hours ? 'Yes - Trading outside normal hours' : 'No - Trading during typical hours'}
  * Short Intervals: ${pressureScore.factors.short_intervals ? 'Yes - Rapid succession of trades' : 'No - Normal spacing'}

DEVIATIONS FROM BASELINE:
${this.formatDeviations(deviations)}

KEY INSIGHT FOR PERSONALIZATION:
Compare the current market situation (${marketContext.movementType}, ${marketContext.magnitude.toFixed(2)}% move) with the trader's current behavior (${pressureScore.factors.trade_frequency_spike}x frequency, ${pressureScore.factors.position_size_deviation.toFixed(2)}x position size). Identify the pattern: "When markets do [this], this trader tends to [that]."

INSTRUCTION: Generate a professional trading analysis narrative (150-220 words) that:
1. **MUST START WITH**: "The market just did [describe market movement], and based on your trading history, you tend to [describe their behavioral pattern in similar situations]."
2. Explains the market context and what happened
3. Describes the behavioral patterns observed, connecting them to historical patterns
4. Compares current activity to historical baseline with specific examples
5. Uses educational, non-advisory language
6. NEVER includes predictions or trading recommendations
7. Make it personal - reference their specific trading history and patterns
${pressureScore.level === BehavioralPressureLevel.HIGH_PRESSURE 
    ? '8. Gently suggest taking a break and reflecting on patterns if pressure is high\n9. Recommend reviewing decisions when calm, not in the moment' 
    : ''}
${pressureScore.level === BehavioralPressureLevel.STABLE 
    ? '8. Celebrate consistent, disciplined trading patterns\n9. Acknowledge sustainable trading habits positively' 
    : ''}

EXAMPLE STRUCTURE:
"The market just did [X]. Based on your trading history, you tend to [Y] in these situations. [Explain the connection and what patterns were observed]. [Provide context and educational insight]."`;
    }

    private getFallbackTradingNarrative(
        marketContext: MarketContext,
        pressureScore: BehavioralPressureScore,
        baseline: Baseline,
        deviations: Deviation
    ): string {
        // Build personalized market-behavior connection
        const marketAction = marketContext.movementType === 'sudden_spike' 
            ? `experienced a sudden ${marketContext.magnitude.toFixed(2)}% spike`
            : marketContext.movementType === 'volatility_regime_change'
            ? `entered a high volatility regime with ${marketContext.magnitude.toFixed(2)}% movement`
            : `showed ${marketContext.movementType} movement of ${marketContext.magnitude.toFixed(2)}%`;

        const behavioralPattern = pressureScore.factors.trade_frequency_spike > 2
            ? 'increase your trading frequency significantly'
            : pressureScore.factors.loss_clustering > 0.5
            ? 'experience clustered losses'
            : pressureScore.factors.position_size_deviation > 2
            ? 'deviate from your typical position sizes'
            : 'maintain relatively stable trading patterns';

        let narrative = `The market just ${marketAction} in ${marketContext.instrument}, and based on your trading history, you tend to ${behavioralPattern} in these situations. ${marketContext.historicalContext}

Behavioral analysis indicates ${pressureScore.level} pressure level (score: ${pressureScore.score}/100). Key factors include trade frequency at ${pressureScore.factors.trade_frequency_spike}x baseline, position size deviation of ${pressureScore.factors.position_size_deviation.toFixed(2)}x, and ${pressureScore.factors.loss_clustering}% loss clustering.

Compared to your historical baseline, current activity shows deviations in ${this.getTriggeredDeviationsList(deviations) || 'none detected'}. Your typical pattern shows average position size of ${baseline.avg_transaction_amount.toFixed(2)} with trading hours around ${baseline.typical_transaction_hours.join(', ')}.`;

        // Add behavioral coaching based on pressure level
        if (pressureScore.level === BehavioralPressureLevel.HIGH_PRESSURE) {
            narrative += `\n\nGiven the elevated pressure patterns observed, consider taking a moment to step back and reflect. High-pressure trading moments often benefit from a brief pause to review patterns and decisions with clarity. This self-awareness supports sustainable trading habits.`;
        } else if (pressureScore.level === BehavioralPressureLevel.STABLE) {
            narrative += `\n\nYour trading patterns demonstrate consistency and discipline. Maintaining this steady approach supports long-term trading sustainability. Well done on recognizing and maintaining healthy trading habits.`;
        }

        narrative += `\n\nThis analysis reflects observed patterns and market context. No trading predictions or recommendations are provided.`;
        
        return narrative;
    }

    /**
     * Generate daily/weekly market summary narrative
     */
    async generateSummaryNarrative(
        insights: any[],
        period: 'daily' | 'weekly',
        statistics: {
            instrumentCount: number;
            insightCount: number;
            pressureLevels: { stable: number; elevated: number; high_pressure: number };
            avgPressureScore: number;
        }
    ): Promise<string> {
        if (!process.env.GEMINI_API_KEY) {
            return this.getFallbackSummaryNarrative(insights, period, statistics);
        }

        const prompt = `Generate a ${period} market summary for Deriv traders.

STATISTICS:
- Insights Analyzed: ${statistics.insightCount}
- Instruments Tracked: ${statistics.instrumentCount}
- Pressure Distribution:
  * Stable: ${statistics.pressureLevels.stable}
  * Elevated: ${statistics.pressureLevels.elevated}
  * High Pressure: ${statistics.pressureLevels.high_pressure}
- Average Pressure Score: ${statistics.avgPressureScore}/100

KEY INSIGHTS:
${insights.slice(0, 5).map((i, idx) => 
    `${idx + 1}. ${i.instrument}: ${i.market_context.movementType} (${i.market_context.magnitude.toFixed(2)}%), Pressure: ${i.pressure_level}`
).join('\n')}

CRITICAL RULES:
1. NO trading predictions or price forecasts
2. NO buy/sell signals or recommendations
3. Educational, brand-safe language only
4. Focus on patterns observed, not future actions
5. ${period === 'daily' ? '150-200 words' : '200-300 words'}

Generate a professional ${period} summary that explains market patterns and behavioral trends observed during this period.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            console.error('Summary narrative generation error:', error);
            return this.getFallbackSummaryNarrative(insights, period, statistics);
        }
    }

    private getFallbackSummaryNarrative(
        insights: any[],
        period: 'daily' | 'weekly',
        statistics: any
    ): string {
        return `${period.charAt(0).toUpperCase() + period.slice(1)} Market Summary

Analyzed ${statistics.insightCount} insights across ${statistics.instrumentCount} instruments.

Pressure Distribution:
- Stable: ${statistics.pressureLevels.stable} insights
- Elevated: ${statistics.pressureLevels.elevated} insights  
- High Pressure: ${statistics.pressureLevels.high_pressure} insights

Average behavioral pressure score: ${statistics.avgPressureScore}/100

Key observations: Market activity showed varied patterns across instruments. Behavioral analysis indicates ${statistics.pressureLevels.stable > statistics.pressureLevels.high_pressure ? 'predominantly stable' : 'elevated'} pressure levels among traders.

This summary reflects observed patterns and market context. No trading predictions or recommendations are provided.`;
    }

    /**
     * Generate trading pattern warning narrative for Investigation Queue
     * Focuses on warning trader about repeating bad patterns
     */
    async generateTradingPatternNarrative(
        alert: Alert,
        insight: TradingInsight,
        severity: SeverityLevel,
        justification: SeverityJustification,
        deviations: any
    ): Promise<string> {
        if (!process.env.GEMINI_API_KEY) {
            return this.getFallbackTradingPatternNarrative(alert, insight, severity, deviations);
        }

        const systemPrompt = `You are CipherAI, a trading pattern analyst that helps traders learn from their mistakes.

CRITICAL RULES:
1. NEVER provide trading advice or predictions
2. Focus on PATTERN RECOGNITION - what pattern is repeating
3. Connect current behavior to historical losses
4. Use supportive, educational language (not judgmental)
5. Be specific about what pattern was detected
6. Suggest reflection, not action
7. Keep it 180-220 words

Your goal: Help the trader recognize they're repeating a pattern that historically led to losses, so they can make better decisions.`;

        const matchedPattern = alert.raw_data?.matched_pattern;
        const warningMessage = alert.raw_data?.warning_message;
        const behaviorFactors = alert.raw_data?.behavior_factors || {};

        const userPrompt = `
TRADING PATTERN ALERT:
- Alert ID: ${alert.alert_id}
- Trader: ${alert.user_id}
- Instrument: ${insight.instrument}
- Timestamp: ${alert.timestamp}

CURRENT BEHAVIOR DETECTED:
- Pressure Level: ${insight.pressure_level}
- Pressure Score: ${insight.behaviour_context.pressure_score.score}/100
- Market Context: ${insight.market_context.movementType}
- Trade Frequency Spike: ${behaviorFactors.trade_frequency_spike?.toFixed(2) || 'N/A'}x normal
- Position Size Deviation: ${behaviorFactors.position_size_deviation?.toFixed(2) || 'N/A'}x normal
- Loss Clustering: ${(behaviorFactors.loss_clustering * 100)?.toFixed(0) || '0'}% of recent trades

${matchedPattern ? `
MATCHED HISTORICAL PATTERN:
- Pattern: ${matchedPattern.description}
- Historical Loss Rate: ${(matchedPattern.loss_rate * 100).toFixed(0)}%
- Times This Pattern Occurred: ${matchedPattern.historical_losses}
- Warning: ${warningMessage || 'Pattern matches historical losing behavior'}
` : ''}

TRIGGERED SIGNALS:
${Object.entries(deviations)
    .filter(([_, v]) => v === true)
    .map(([k, _]) => `- ${k.replace(/_/g, ' ')}`)
    .join('\n')}

INSTRUCTION: Generate a narrative that:
1. Explains what pattern was detected
2. Connects it to their trading history
3. Warns them gently about repeating mistakes
4. Suggests taking a moment to reflect
5. Uses their own data to make it personal and relevant`;

        try {
            const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            console.error('Gemini Trading Pattern Narrative error:', error);
            return this.getFallbackTradingPatternNarrative(alert, insight, severity, deviations);
        }
    }

    private getFallbackTradingPatternNarrative(
        alert: Alert,
        insight: TradingInsight,
        severity: SeverityLevel,
        deviations: any
    ): string {
        const matchedPattern = alert.raw_data?.matched_pattern;
        const triggeredSignals = Object.entries(deviations)
            .filter(([_, v]) => v === true)
            .map(([k, _]) => k.replace(/_/g, ' '))
            .join(', ');

        let narrative = `Trading Pattern Alert: ${alert.alert_id}\n\n`;
        narrative += `You're exhibiting trading behavior that matches patterns associated with losses in your trading history. `;
        
        if (matchedPattern) {
            narrative += `This specific pattern (${matchedPattern.description}) has historically resulted in losses ${(matchedPattern.loss_rate * 100).toFixed(0)}% of the time. `;
        }
        
        narrative += `Current signals detected: ${triggeredSignals || 'multiple behavioral indicators'}. `;
        narrative += `Your pressure score is ${insight.behaviour_context.pressure_score.score}/100, indicating ${insight.pressure_level} trading conditions. `;
        narrative += `Consider pausing to review your strategy and reflect on similar past situations. `;
        narrative += `This is an opportunity to learn from your trading history and make more informed decisions.`;

        return narrative;
    }
}
