import { BaselineAnalyzer } from './baseline';
import { DeviationDetector } from './deviation';
import { SeverityEngine } from './severity';
import { NarrativeGenerator } from './narrative';
import { MarketContextEngine } from './marketContext';
import { TradingInsightService } from './tradingInsight';
import { SocialContentGenerator } from './socialContent';
import { AuditService } from './audit';
import { WhatsAppService } from './whatsappService';
import { 
    Trade, 
    TradingInsight, 
    UserActivity,
    Alert,
    AlertType,
    BehavioralPressureLevel
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class AutonomousOrchestrator {
    private baselineAnalyzer: BaselineAnalyzer;
    private deviationDetector: DeviationDetector;
    private severityEngine: SeverityEngine;
    private narrativeGenerator: NarrativeGenerator;
    private marketContextEngine: MarketContextEngine;
    private socialContentGenerator: SocialContentGenerator;
    private whatsappService: WhatsAppService;

    constructor() {
        this.baselineAnalyzer = new BaselineAnalyzer();
        this.deviationDetector = new DeviationDetector(this.baselineAnalyzer);
        this.severityEngine = new SeverityEngine(this.deviationDetector);
        this.narrativeGenerator = new NarrativeGenerator();
        this.marketContextEngine = new MarketContextEngine();
        this.socialContentGenerator = new SocialContentGenerator();
        this.whatsappService = new WhatsAppService();
    }

    /**
     * Run autonomous analysis for a trader
     */
    async runAutonomousAnalysis(
        traderId: string,
        trades: Trade[],
        marketData: {
            instrument: string;
            ohlc?: { open: number; high: number; low: number; close: number };
            percentChange?: number;
            volatility?: number;
            newsCatalysts?: string[];
        },
        dataSource?: {
            url?: string;
            type?: 'trading_platform' | 'market_data_feed' | 'manual_entry' | 'demo' | 'api';
        }
    ): Promise<TradingInsight> {
        const startTime = Date.now();

        try {
            // 1. Get or create user activity from trades
            const userActivity = this.buildUserActivityFromTrades(traderId, trades);
            
            // 2. Analyze market context
            const marketContext = this.marketContextEngine.analyzeMarketContext({
                instrument: marketData.instrument,
                ohlc: marketData.ohlc,
                percentChange: marketData.percentChange,
                volatility: marketData.volatility,
                timestamp: new Date().toISOString(),
                newsCatalysts: marketData.newsCatalysts,
            });

            // 3. Calculate baseline
            const baseline = this.baselineAnalyzer.calculateBaseline(userActivity);

            // 4. Create alert from recent trade for deviation detection
            const recentTrade = trades[trades.length - 1];
            const alert = this.createAlertFromTrade(recentTrade, marketData.instrument);

            // 5. Detect deviations
            const deviations = this.deviationDetector.detectDeviations(alert, userActivity);

            // 6. Calculate behavioral pressure
            const pressureScore = this.calculateBehavioralPressure(trades, baseline, deviations);

            // 7. Calculate deterministic score
            const { severity, justification } = this.severityEngine.classifySeverity(alert, userActivity);
            const deterministicScore = justification.final_score;

            // 8. Get historical patterns for similar market conditions
            const historicalPatterns = this.analyzeHistoricalPatterns(traderId, marketContext, trades);

            // 9. Generate AI narrative with personalized market-behavior connection
            const narrative = await this.narrativeGenerator.generateTradingNarrative(
                marketContext,
                pressureScore,
                baseline,
                deviations,
                severity,
                justification,
                historicalPatterns
            );

            // 9. Create trading insight
            const insight: TradingInsight = {
                insight_id: uuidv4(),
                trader_id: traderId,
                instrument: marketData.instrument,
                market_context: marketContext,
                behaviour_context: {
                    pressure_score: pressureScore,
                    deviations,
                    baseline,
                },
                pressure_level: pressureScore.level,
                deterministic_score: deterministicScore,
                narrative,
                data_source_url: dataSource?.url,
                data_source_type: dataSource?.type,
                created_at: new Date().toISOString(),
            };

            // 10. Store insight
            TradingInsightService.createInsight(insight);

            // 11. Generate social content (ready but not auto-posted)
            await this.socialContentGenerator.generateContent(insight);

            // 12. Send proactive behavioral nudge if high pressure detected
            if (pressureScore.level === BehavioralPressureLevel.HIGH_PRESSURE) {
                await this.sendBehavioralNudge(traderId, insight, pressureScore);
            }

            // 13. Audit log
            AuditService.log({
                action: 'AUTONOMOUS_ANALYSIS_COMPLETED',
                resource_type: 'trading_insight',
                resource_id: insight.insight_id,
                details: JSON.stringify({
                    trader_id: traderId,
                    instrument: marketData.instrument,
                    pressure_level: pressureScore.level,
                    deterministic_score: deterministicScore,
                    duration_ms: Date.now() - startTime,
                }),
            });

            return insight;
        } catch (error: any) {
            AuditService.log({
                action: 'AUTONOMOUS_ANALYSIS_FAILED',
                resource_type: 'trading_insight',
                resource_id: traderId,
                details: JSON.stringify({ error: error.message, trader_id: traderId }),
            });
            throw error;
        }
    }

    private buildUserActivityFromTrades(traderId: string, trades: Trade[]): UserActivity {
        const now = new Date();
        const accountAge = 90; // Default, could be calculated from first trade

        return {
            user_id: traderId,
            login_locations: [],
            device_fingerprints: [],
            transaction_history: trades.map(t => ({
                timestamp: t.timestamp,
                amount: t.position_size,
                type: 'trade',
                status: t.pnl >= 0 ? 'profit' : 'loss',
            })),
            account_age_days: accountAge,
        };
    }

    private createAlertFromTrade(trade: Trade, instrument: string): Alert {
        return {
            alert_id: uuidv4(),
            user_id: trade.trader_id,
            alert_type: AlertType.SUSPICIOUS_TRADING,
            timestamp: trade.timestamp,
            triggered_rules: ['trading_activity'],
            raw_data: {
                transaction_amount: trade.position_size,
                position_size: trade.position_size,
                pnl: trade.pnl,
                instrument,
            },
        };
    }

    private calculateBehavioralPressure(
        trades: Trade[],
        baseline: any,
        deviations: any
    ): any {
        // Trade frequency spike
        const recentTrades = trades.filter(t => {
            const tradeTime = new Date(t.timestamp).getTime();
            const hoursAgo = (Date.now() - tradeTime) / (1000 * 60 * 60);
            return hoursAgo <= 24;
        });
        const avgTradesPerDay = baseline.avg_transactions_per_day || 1;
        const frequencySpike = recentTrades.length / Math.max(avgTradesPerDay, 1);

        // Position size deviation
        const positionDeviation = deviations.amount_deviation?.deviation || 1;

        // Loss clustering
        const recentLosses = recentTrades.filter(t => t.pnl < 0).length;
        const lossClustering = recentLosses / Math.max(recentTrades.length, 1);

        // Unusual hours
        const unusualHours = deviations.temporal_deviation?.is_unusual_time ? 1 : 0;

        // Short intervals
        const intervals: number[] = [];
        for (let i = 1; i < recentTrades.length; i++) {
            const prev = new Date(recentTrades[i - 1].timestamp).getTime();
            const curr = new Date(recentTrades[i].timestamp).getTime();
            intervals.push((curr - prev) / (1000 * 60)); // minutes
        }
        const avgInterval = intervals.length > 0 
            ? intervals.reduce((a, b) => a + b, 0) / intervals.length 
            : 60;
        const shortIntervals = avgInterval < 15 ? 1 : 0;

        // Calculate composite score (0-100)
        const score = Math.min(100, 
            (frequencySpike * 20) +
            (Math.min(positionDeviation, 5) * 15) +
            (lossClustering * 30) +
            (unusualHours * 15) +
            (shortIntervals * 20)
        );

        let level: BehavioralPressureLevel;
        if (score >= 70) {
            level = BehavioralPressureLevel.HIGH_PRESSURE;
        } else if (score >= 40) {
            level = BehavioralPressureLevel.ELEVATED;
        } else {
            level = BehavioralPressureLevel.STABLE;
        }

        return {
            score: Math.round(score),
            level,
            factors: {
                trade_frequency_spike: Math.round(frequencySpike * 100) / 100,
                position_size_deviation: Math.round(positionDeviation * 100) / 100,
                loss_clustering: Math.round(lossClustering * 100),
                unusual_hours: unusualHours,
                short_intervals: shortIntervals,
            },
        };
    }

    /**
     * Send proactive behavioral nudge when high pressure detected
     */
    private async sendBehavioralNudge(
        traderId: string,
        insight: TradingInsight,
        pressureScore: BehavioralPressureScore
    ): Promise<void> {
        try {
            // Get trader's phone number from config or database (placeholder)
            const traderPhone = process.env[`TRADER_${traderId}_PHONE`];
            
            if (!traderPhone) {
                // No phone configured, log for manual follow-up
                AuditService.log({
                    action: 'BEHAVIORAL_NUDGE_SKIPPED',
                    resource_type: 'trading_insight',
                    resource_id: insight.insight_id,
                    details: JSON.stringify({
                        trader_id: traderId,
                        reason: 'No phone number configured',
                        pressure_level: pressureScore.level,
                    }),
                });
                return;
            }

            // Generate gentle nudge message
            const nudgeMessage = this.generateNudgeMessage(insight, pressureScore);

            // Send via WhatsApp
            const result = await this.whatsappService.sendMessage({
                to: traderPhone,
                message: nudgeMessage,
            });

            if (result.success) {
                AuditService.log({
                    action: 'BEHAVIORAL_NUDGE_SENT',
                    resource_type: 'trading_insight',
                    resource_id: insight.insight_id,
                    details: JSON.stringify({
                        trader_id: traderId,
                        pressure_level: pressureScore.level,
                        message_id: result.messageId,
                    }),
                });
            } else {
                AuditService.log({
                    action: 'BEHAVIORAL_NUDGE_FAILED',
                    resource_type: 'trading_insight',
                    resource_id: insight.insight_id,
                    details: JSON.stringify({
                        trader_id: traderId,
                        error: result.error,
                    }),
                });
            }
        } catch (error: any) {
            console.error('Failed to send behavioral nudge:', error);
            AuditService.log({
                action: 'BEHAVIORAL_NUDGE_ERROR',
                resource_type: 'trading_insight',
                resource_id: insight.insight_id,
                details: JSON.stringify({
                    trader_id: traderId,
                    error: error.message,
                }),
            });
        }
    }

    /**
     * Generate gentle, supportive nudge message
     */
    private generateNudgeMessage(
        insight: TradingInsight,
        pressureScore: BehavioralPressureScore
    ): string {
        const factors = pressureScore.factors;
        const observations: string[] = [];

        if (factors.trade_frequency_spike > 2) {
            observations.push(`trading frequency is ${factors.trade_frequency_spike.toFixed(1)}x your usual pace`);
        }
        if (factors.loss_clustering > 0.5) {
            observations.push(`recent losses have clustered together`);
        }
        if (factors.unusual_hours) {
            observations.push(`trading during unusual hours`);
        }

        let message = `🔔 CipherAI Insight: ${insight.instrument}\n\n`;
        
        if (observations.length > 0) {
            message += `We've noticed ${observations.join(', ')}. `;
        }
        
        message += `Your behavioral pressure score is ${pressureScore.score}/100, indicating elevated stress levels.\n\n`;
        message += `💡 Consider taking a brief break to reflect on recent patterns. `;
        message += `Reviewing decisions when calm often leads to better outcomes.\n\n`;
            message += `This is a gentle reminder to support your trading sustainability. `;
            message += `No trading advice - just awareness.`;

        return message;
    }

    /**
     * Analyze historical patterns for similar market conditions
     * Returns a string describing how the trader typically behaves in similar situations
     */
    private analyzeHistoricalPatterns(
        traderId: string,
        currentMarketContext: MarketContext,
        recentTrades: Trade[]
    ): string {
        // Get historical insights for this trader
        const historicalInsights = TradingInsightService.getInsights({
            trader_id: traderId,
            limit: 20, // Last 20 insights
        });

        if (historicalInsights.length === 0) {
            return 'No historical patterns available yet.';
        }

        // Find similar market conditions
        const similarConditions = historicalInsights.filter(insight => {
            const sameInstrument = insight.instrument === currentMarketContext.instrument;
            const similarMovement = 
                insight.market_context.movementType === currentMarketContext.movementType ||
                (Math.abs(insight.market_context.magnitude - currentMarketContext.magnitude) < 1.0);
            return sameInstrument && similarMovement;
        });

        if (similarConditions.length === 0) {
            return 'This is a new market condition for this trader.';
        }

        // Analyze behavioral patterns in similar conditions
        const patterns: string[] = [];
        
        const avgPressure = similarConditions.reduce((sum, i) => 
            sum + i.behaviour_context.pressure_score.score, 0) / similarConditions.length;
        
        const highPressureCount = similarConditions.filter(i => 
            i.pressure_level === 'high_pressure').length;
        
        const elevatedFrequency = similarConditions.filter(i => 
            i.behaviour_context.pressure_score.factors.trade_frequency_spike > 1.5).length;

        if (highPressureCount > similarConditions.length * 0.6) {
            patterns.push('typically shows elevated pressure');
        }
        
        if (elevatedFrequency > similarConditions.length * 0.5) {
            patterns.push('often increases trading frequency');
        }
        
        if (avgPressure > 60) {
            patterns.push('tends to experience higher stress levels');
        } else if (avgPressure < 40) {
            patterns.push('usually maintains calm, disciplined approach');
        }

        if (patterns.length === 0) {
            return 'Historical patterns show varied responses in similar conditions.';
        }

        return `In similar market conditions, this trader ${patterns.join(', ')}.`;
    }
}