import { AutonomousOrchestrator } from '../orchestrator';
import { Trade, BehavioralPressureLevel } from '../../types';
import { initializeDatabase } from '../../config/database';
import { db } from '../../config/database';
import { TradingInsightService } from '../tradingInsight';

describe('AutonomousOrchestrator', () => {
    let orchestrator: AutonomousOrchestrator;

    beforeAll(() => {
        initializeDatabase();
    });

    beforeEach(() => {
        orchestrator = new AutonomousOrchestrator();
        db.prepare('DELETE FROM trading_insights').run();
        db.prepare('DELETE FROM social_content').run();
        db.prepare('DELETE FROM audit_logs').run();
    });

    test('should run autonomous analysis and create insight', async () => {
        const trades: Trade[] = [
            {
                trade_id: 'trade-1',
                trader_id: 'trader-123',
                instrument: 'EURUSD',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                position_size: 1000,
                pnl: 50,
            },
            {
                trade_id: 'trade-2',
                trader_id: 'trader-123',
                instrument: 'EURUSD',
                timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
                position_size: 1500,
                pnl: -30,
            },
            {
                trade_id: 'trade-3',
                trader_id: 'trader-123',
                instrument: 'EURUSD',
                timestamp: new Date().toISOString(),
                position_size: 2000,
                pnl: 100,
            },
        ];

        const marketData = {
            instrument: 'EURUSD',
            percentChange: 2.5,
            volatility: 0.015,
            ohlc: {
                open: 1.1000,
                high: 1.1025,
                low: 1.0995,
                close: 1.1015,
            },
            newsCatalysts: ['ECB announcement'],
        };

        const insight = await orchestrator.runAutonomousAnalysis('trader-123', trades, marketData);

        expect(insight).toBeDefined();
        expect(insight.trader_id).toBe('trader-123');
        expect(insight.instrument).toBe('EURUSD');
        expect(insight.market_context.instrument).toBe('EURUSD');
        expect(insight.market_context.movementType).toBeDefined();
        expect(insight.behaviour_context.pressure_score).toBeDefined();
        expect(insight.pressure_level).toBeDefined();
        expect(insight.deterministic_score).toBeGreaterThan(0);
        expect(insight.narrative).toBeDefined();

        // Verify it was stored
        const stored = TradingInsightService.getInsight(insight.insight_id);
        expect(stored).not.toBeNull();
    });

    test('should calculate behavioral pressure correctly', async () => {
        const trades: Trade[] = [
            {
                trade_id: 'trade-1',
                trader_id: 'trader-456',
                instrument: 'GBPUSD',
                timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                position_size: 5000,
                pnl: -200,
            },
            {
                trade_id: 'trade-2',
                trader_id: 'trader-456',
                instrument: 'GBPUSD',
                timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                position_size: 6000,
                pnl: -150,
            },
            {
                trade_id: 'trade-3',
                trader_id: 'trader-456',
                instrument: 'GBPUSD',
                timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                position_size: 7000,
                pnl: -100,
            },
        ];

        const marketData = {
            instrument: 'GBPUSD',
            percentChange: 1.5,
        };

        const insight = await orchestrator.runAutonomousAnalysis('trader-456', trades, marketData);

        expect(insight.behaviour_context.pressure_score.score).toBeGreaterThan(0);
        expect(insight.behaviour_context.pressure_score.level).toBeDefined();
        expect(['stable', 'elevated', 'high_pressure']).toContain(insight.pressure_level);
    });

    test('should handle empty trades array', async () => {
        const marketData = {
            instrument: 'USDJPY',
            percentChange: 0.5,
        };

        await expect(
            orchestrator.runAutonomousAnalysis('trader-empty', [], marketData)
        ).rejects.toThrow();
    });

    test('should generate market context for different movement types', async () => {
        const trades: Trade[] = [
            {
                trade_id: 'trade-1',
                trader_id: 'trader-789',
                instrument: 'AUDUSD',
                timestamp: new Date().toISOString(),
                position_size: 1000,
                pnl: 50,
            },
        ];

        // Test volatility regime change
        const marketData1 = {
            instrument: 'AUDUSD',
            percentChange: 6.0,
            volatility: 0.025,
        };

        const insight1 = await orchestrator.runAutonomousAnalysis('trader-789', trades, marketData1);
        expect(insight1.market_context.movementType).toBe('volatility_regime_change');

        // Test normal movement
        const marketData2 = {
            instrument: 'AUDUSD',
            percentChange: 0.3,
            volatility: 0.01,
        };

        const insight2 = await orchestrator.runAutonomousAnalysis('trader-789', trades, marketData2);
        expect(insight2.market_context.movementType).toBe('normal');
    });
});