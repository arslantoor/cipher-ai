import { TradingInsightService } from '../tradingInsight';
import { TradingInsight, BehavioralPressureLevel } from '../../types';
import { initializeDatabase } from '../../config/database';
import { db } from '../../config/database';

describe('TradingInsightService', () => {
    beforeAll(() => {
        initializeDatabase();
    });

    beforeEach(() => {
        // Clean up before each test
        db.prepare('DELETE FROM trading_insights').run();
    });

    test('should create and retrieve trading insight', () => {
        const insight: TradingInsight = {
            insight_id: 'test-insight-1',
            trader_id: 'trader-123',
            instrument: 'EURUSD',
            market_context: {
                instrument: 'EURUSD',
                movementType: 'sudden_spike',
                magnitude: 3.5,
                timeframe: 'London session',
                historicalContext: 'Test context',
            },
            behaviour_context: {
                pressure_score: {
                    score: 65,
                    level: BehavioralPressureLevel.ELEVATED,
                    factors: {
                        trade_frequency_spike: 2.5,
                        position_size_deviation: 1.8,
                        loss_clustering: 40,
                        unusual_hours: 1,
                        short_intervals: 0,
                    },
                },
                deviations: {},
                baseline: {
                    avg_transaction_amount: 1000,
                    avg_transactions_per_day: 5,
                    typical_transaction_hours: [9, 10, 11],
                    common_locations: [],
                    device_consistency: 0.9,
                    account_maturity: 90,
                },
            },
            pressure_level: BehavioralPressureLevel.ELEVATED,
            deterministic_score: 150.5,
            narrative: 'Test narrative',
            created_at: new Date().toISOString(),
        };

        const id = TradingInsightService.createInsight(insight);
        expect(id).toBe('test-insight-1');

        const retrieved = TradingInsightService.getInsight('test-insight-1');
        expect(retrieved).not.toBeNull();
        expect(retrieved?.trader_id).toBe('trader-123');
        expect(retrieved?.instrument).toBe('EURUSD');
        expect(retrieved?.pressure_level).toBe(BehavioralPressureLevel.ELEVATED);
        expect(retrieved?.deterministic_score).toBe(150.5);
    });

    test('should filter insights by trader_id', () => {
        // Create multiple insights
        const insight1: TradingInsight = {
            insight_id: 'insight-1',
            trader_id: 'trader-1',
            instrument: 'EURUSD',
            market_context: {
                instrument: 'EURUSD',
                movementType: 'normal',
                magnitude: 1.0,
                timeframe: 'Asia session',
                historicalContext: 'Test',
            },
            behaviour_context: {
                pressure_score: {
                    score: 30,
                    level: BehavioralPressureLevel.STABLE,
                    factors: {
                        trade_frequency_spike: 1.0,
                        position_size_deviation: 1.0,
                        loss_clustering: 20,
                        unusual_hours: 0,
                        short_intervals: 0,
                    },
                },
                deviations: {},
                baseline: {
                    avg_transaction_amount: 1000,
                    avg_transactions_per_day: 5,
                    typical_transaction_hours: [9],
                    common_locations: [],
                    device_consistency: 0.9,
                    account_maturity: 90,
                },
            },
            pressure_level: BehavioralPressureLevel.STABLE,
            deterministic_score: 50,
            created_at: new Date().toISOString(),
        };

        const insight2: TradingInsight = {
            ...insight1,
            insight_id: 'insight-2',
            trader_id: 'trader-2',
        };

        TradingInsightService.createInsight(insight1);
        TradingInsightService.createInsight(insight2);

        const filtered = TradingInsightService.getInsights({ trader_id: 'trader-1' });
        expect(filtered.length).toBe(1);
        expect(filtered[0].trader_id).toBe('trader-1');
    });

    test('should filter insights by instrument', () => {
        const insight1: TradingInsight = {
            insight_id: 'insight-1',
            trader_id: 'trader-1',
            instrument: 'EURUSD',
            market_context: {
                instrument: 'EURUSD',
                movementType: 'normal',
                magnitude: 1.0,
                timeframe: 'Asia session',
                historicalContext: 'Test',
            },
            behaviour_context: {
                pressure_score: {
                    score: 30,
                    level: BehavioralPressureLevel.STABLE,
                    factors: {
                        trade_frequency_spike: 1.0,
                        position_size_deviation: 1.0,
                        loss_clustering: 20,
                        unusual_hours: 0,
                        short_intervals: 0,
                    },
                },
                deviations: {},
                baseline: {
                    avg_transaction_amount: 1000,
                    avg_transactions_per_day: 5,
                    typical_transaction_hours: [9],
                    common_locations: [],
                    device_consistency: 0.9,
                    account_maturity: 90,
                },
            },
            pressure_level: BehavioralPressureLevel.STABLE,
            deterministic_score: 50,
            created_at: new Date().toISOString(),
        };

        const insight2: TradingInsight = {
            ...insight1,
            insight_id: 'insight-2',
            instrument: 'GBPUSD',
        };

        TradingInsightService.createInsight(insight1);
        TradingInsightService.createInsight(insight2);

        const filtered = TradingInsightService.getInsights({ instrument: 'EURUSD' });
        expect(filtered.length).toBe(1);
        expect(filtered[0].instrument).toBe('EURUSD');
    });

    test('should return null for non-existent insight', () => {
        const result = TradingInsightService.getInsight('non-existent');
        expect(result).toBeNull();
    });
});