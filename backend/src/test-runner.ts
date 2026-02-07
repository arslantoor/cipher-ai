// Simple test runner using tsx
import { MarketContextEngine } from './services/marketContext';
import { TradingInsightService } from './services/tradingInsight';
import { AutonomousOrchestrator } from './services/orchestrator';
import { TradingInsight, BehavioralPressureLevel, Trade } from './types';
import { initializeDatabase } from './config/database';
import { db } from './config/database';

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void | Promise<void>) {
    try {
        const result = fn();
        if (result instanceof Promise) {
            result
                .then(() => {
                    testsPassed++;
                    console.log(`✅ ${name}`);
                })
                .catch((error) => {
                    testsFailed++;
                    console.error(`❌ ${name}: ${error.message}`);
                });
        } else {
            testsPassed++;
            console.log(`✅ ${name}`);
        }
    } catch (error: any) {
        testsFailed++;
        console.error(`❌ ${name}: ${error.message}`);
    }
}

async function runTests() {
    console.log('🧪 Running tests...\n');

    // Initialize database
    initializeDatabase();

    // Clean up before tests
    db.prepare('DELETE FROM trading_insights').run();
    db.prepare('DELETE FROM social_content').run();
    db.prepare('DELETE FROM audit_logs').run();

    // Market Context Engine Tests
    test('MarketContextEngine: should detect sudden spike', () => {
        const engine = new MarketContextEngine();
        const context = engine.analyzeMarketContext({
            instrument: 'EURUSD',
            percentChange: 4.5,
            volatility: 0.015,
            timestamp: new Date().toISOString(),
        });
        if (context.movementType !== 'sudden_spike') {
            throw new Error(`Expected sudden_spike, got ${context.movementType}`);
        }
    });

    test('MarketContextEngine: should detect volatility regime change', () => {
        const engine = new MarketContextEngine();
        const context = engine.analyzeMarketContext({
            instrument: 'GBPUSD',
            percentChange: 6.0,
            volatility: 0.025,
            timestamp: new Date().toISOString(),
        });
        if (context.movementType !== 'volatility_regime_change') {
            throw new Error(`Expected volatility_regime_change, got ${context.movementType}`);
        }
    });

    test('MarketContextEngine: should include news catalysts', () => {
        const engine = new MarketContextEngine();
        const context = engine.analyzeMarketContext({
            instrument: 'EURUSD',
            percentChange: 3.0,
            timestamp: new Date().toISOString(),
            newsCatalysts: ['ECB rate decision'],
        });
        if (!context.knownCatalysts || context.knownCatalysts.length === 0) {
            throw new Error('Expected news catalysts');
        }
    });

    // Trading Insight Service Tests
    test('TradingInsightService: should create and retrieve insight', () => {
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

        TradingInsightService.createInsight(insight);
        const retrieved = TradingInsightService.getInsight('test-insight-1');
        
        if (!retrieved || retrieved.trader_id !== 'trader-123') {
            throw new Error('Failed to retrieve insight');
        }
    });

    test('TradingInsightService: should filter by trader_id', () => {
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
        if (filtered.length !== 1 || filtered[0].trader_id !== 'trader-1') {
            throw new Error('Filtering failed');
        }
    });

    // Orchestrator Tests
    test('AutonomousOrchestrator: should run analysis', async () => {
        const orchestrator = new AutonomousOrchestrator();
        const trades: Trade[] = [
            {
                trade_id: 'trade-1',
                trader_id: 'trader-123',
                instrument: 'EURUSD',
                timestamp: new Date().toISOString(),
                position_size: 1000,
                pnl: 50,
            },
        ];

        const marketData = {
            instrument: 'EURUSD',
            percentChange: 2.5,
            volatility: 0.015,
        };

        const insight = await orchestrator.runAutonomousAnalysis('trader-123', trades, marketData);
        
        if (!insight || insight.trader_id !== 'trader-123') {
            throw new Error('Orchestrator failed to create insight');
        }

        const stored = TradingInsightService.getInsight(insight.insight_id);
        if (!stored) {
            throw new Error('Insight not stored in database');
        }
    });

    // Wait for async tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`\n📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
    
    if (testsFailed > 0) {
        process.exit(1);
    } else {
        console.log('✅ All tests passed!');
        process.exit(0);
    }
}

runTests();