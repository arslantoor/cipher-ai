import { TradingInsightService } from './tradingInsight';
import { Trade, TradingInsight, MarketContext } from '../types';
import { db } from '../config/database';

interface TradingPattern {
    pattern_id: string;
    description: string;
    historical_losses: number;
    loss_rate: number;
    market_conditions: {
        instrument?: string;
        movement_type?: string;
        volatility_range?: [number, number];
    };
    behavior_signals: {
        pressure_level: string;
        frequency_spike?: number;
        position_deviation?: number;
        loss_clustering?: number;
    };
}

export class TradingPatternDetector {
    /**
     * Detect if trader is repeating a bad trading pattern
     */
    static detectBadPattern(
        traderId: string,
        currentInsight: TradingInsight
    ): {
        isBadPattern: boolean;
        matchedPattern?: TradingPattern;
        warningMessage?: string;
    } {
        // Get historical insights for this trader
        const historicalInsights = TradingInsightService.getInsights({
            trader_id: traderId,
            limit: 50,
        });

        if (historicalInsights.length < 5) {
            return { isBadPattern: false }; // Not enough history
        }

        // Filter insights that resulted in losses (high pressure + negative outcomes)
        const losingPatterns = this.identifyLosingPatterns(historicalInsights);

        // Check if current insight matches any losing pattern
        const match = this.matchPattern(currentInsight, losingPatterns);

        if (match) {
            return {
                isBadPattern: true,
                matchedPattern: match,
                warningMessage: this.generateWarningMessage(match, currentInsight),
            };
        }

        return { isBadPattern: false };
    }

    /**
     * Identify patterns from historical losing trades
     */
    private static identifyLosingPatterns(
        insights: TradingInsight[]
    ): TradingPattern[] {
        const patterns: Map<string, TradingPattern> = new Map();

        insights.forEach((insight) => {
            // Consider high pressure insights as potential loss indicators
            if (insight.pressure_level === 'high_pressure' || 
                insight.deterministic_score > 70) {
                
                const patternKey = this.getPatternKey(insight);
                
                if (!patterns.has(patternKey)) {
                    patterns.set(patternKey, {
                        pattern_id: `pattern_${patternKey}`,
                        description: this.describePattern(insight),
                        historical_losses: 0,
                        loss_rate: 0,
                        market_conditions: {
                            instrument: insight.instrument,
                            movement_type: insight.market_context.movementType,
                            volatility_range: insight.market_context.volatility 
                                ? [insight.market_context.volatility * 0.9, insight.market_context.volatility * 1.1]
                                : undefined,
                        },
                        behavior_signals: {
                            pressure_level: insight.pressure_level,
                            frequency_spike: insight.behaviour_context.pressure_score.factors.trade_frequency_spike,
                            position_deviation: insight.behaviour_context.pressure_score.factors.position_size_deviation,
                            loss_clustering: insight.behaviour_context.pressure_score.factors.loss_clustering,
                        },
                    });
                }

                const pattern = patterns.get(patternKey)!;
                pattern.historical_losses += 1;
            }
        });

        // Calculate loss rates
        patterns.forEach((pattern) => {
            const totalSimilar = insights.filter(i => 
                this.matchesPatternKey(i, pattern.pattern_id)
            ).length;
            pattern.loss_rate = pattern.historical_losses / Math.max(totalSimilar, 1);
        });

        // Return patterns with >50% loss rate
        return Array.from(patterns.values()).filter(p => p.loss_rate > 0.5);
    }

    /**
     * Generate pattern key for grouping similar patterns
     */
    private static getPatternKey(insight: TradingInsight): string {
        const market = insight.market_context.movementType;
        const instrument = insight.instrument;
        const pressure = insight.pressure_level;
        const freqSpike = insight.behaviour_context.pressure_score.factors.trade_frequency_spike > 1.5 ? 'high' : 'normal';
        const lossCluster = insight.behaviour_context.pressure_score.factors.loss_clustering > 0.5 ? 'high' : 'low';
        
        return `${instrument}_${market}_${pressure}_${freqSpike}_${lossCluster}`;
    }

    /**
     * Check if insight matches pattern key
     */
    private static matchesPatternKey(insight: TradingInsight, patternId: string): boolean {
        const key = this.getPatternKey(insight);
        return key === patternId.replace('pattern_', '');
    }

    /**
     * Match current insight to historical losing patterns
     */
    private static matchPattern(
        current: TradingInsight,
        patterns: TradingPattern[]
    ): TradingPattern | undefined {
        for (const pattern of patterns) {
            // Check market conditions match
            const marketMatch = 
                pattern.market_conditions.instrument === current.instrument &&
                pattern.market_conditions.movement_type === current.market_context.movementType;

            if (!marketMatch) continue;

            // Check volatility range
            if (pattern.market_conditions.volatility_range && current.market_context.volatility) {
                const [min, max] = pattern.market_conditions.volatility_range;
                if (current.market_context.volatility < min || current.market_context.volatility > max) {
                    continue;
                }
            }

            // Check behavior signals match
            const behaviorMatch = 
                pattern.behavior_signals.pressure_level === current.pressure_level &&
                (pattern.behavior_signals.frequency_spike === undefined ||
                 Math.abs(pattern.behavior_signals.frequency_spike - 
                         current.behaviour_context.pressure_score.factors.trade_frequency_spike) < 0.5) &&
                (pattern.behavior_signals.loss_clustering === undefined ||
                 Math.abs(pattern.behavior_signals.loss_clustering - 
                         current.behaviour_context.pressure_score.factors.loss_clustering) < 0.3);

            if (behaviorMatch) {
                return pattern;
            }
        }

        return undefined;
    }

    /**
     * Describe pattern in human-readable format
     */
    private static describePattern(insight: TradingInsight): string {
        const parts: string[] = [];
        
        if (insight.behaviour_context.pressure_score.factors.trade_frequency_spike > 1.5) {
            parts.push('high trade frequency');
        }
        if (insight.behaviour_context.pressure_score.factors.loss_clustering > 0.5) {
            parts.push('loss clustering');
        }
        if (insight.behaviour_context.pressure_score.factors.position_size_deviation > 2) {
            parts.push('oversized positions');
        }
        if (insight.market_context.movementType === 'volatility_regime_change') {
            parts.push('volatile market conditions');
        }

        return parts.length > 0 
            ? `Pattern: ${parts.join(', ')} in ${insight.instrument}`
            : `Trading pattern in ${insight.instrument}`;
    }

    /**
     * Generate warning message for matched pattern
     */
    private static generateWarningMessage(
        pattern: TradingPattern,
        current: TradingInsight
    ): string {
        const lossRate = (pattern.loss_rate * 100).toFixed(0);
        return `You're repeating a pattern that led to losses ${lossRate}% of the time. ` +
               `Similar conditions: ${pattern.description}. ` +
               `Consider pausing to review your strategy.`;
    }

    /**
     * Get historical trades for a trader (if available)
     */
    static getHistoricalTrades(traderId: string): Trade[] {
        // This would query trades from database
        // For now, return empty array - can be extended
        return [];
    }
}
