import { MarketContextEngine } from '../marketContext';

describe('MarketContextEngine', () => {
    let engine: MarketContextEngine;

    beforeEach(() => {
        engine = new MarketContextEngine();
    });

    test('should detect sudden spike movement', () => {
        const data = {
            instrument: 'EURUSD',
            percentChange: 4.5,
            volatility: 0.015,
            timestamp: new Date().toISOString(),
        };

        const context = engine.analyzeMarketContext(data);

        expect(context.movementType).toBe('sudden_spike');
        expect(context.magnitude).toBe(4.5);
        expect(context.instrument).toBe('EURUSD');
        expect(context.historicalContext).toContain('significant intraday shift');
    });

    test('should detect volatility regime change', () => {
        const data = {
            instrument: 'GBPUSD',
            percentChange: 6.0,
            volatility: 0.025,
            timestamp: new Date().toISOString(),
        };

        const context = engine.analyzeMarketContext(data);

        expect(context.movementType).toBe('volatility_regime_change');
        expect(context.volatility).toBe(0.025);
    });

    test('should detect gradual trend', () => {
        const data = {
            instrument: 'USDJPY',
            percentChange: 2.0,
            volatility: 0.01,
            timestamp: new Date().toISOString(),
        };

        const context = engine.analyzeMarketContext(data);

        expect(context.movementType).toBe('gradual_trend');
        expect(context.historicalContext).toContain('Gradual price movement');
    });

    test('should detect normal movement', () => {
        const data = {
            instrument: 'AUDUSD',
            percentChange: 0.5,
            volatility: 0.01,
            timestamp: new Date().toISOString(),
        };

        const context = engine.analyzeMarketContext(data);

        expect(context.movementType).toBe('normal');
        expect(context.historicalContext).toContain('normal range');
    });

    test('should include news catalysts when provided', () => {
        const data = {
            instrument: 'EURUSD',
            percentChange: 3.0,
            timestamp: new Date().toISOString(),
            newsCatalysts: ['ECB rate decision', 'GDP data release'],
        };

        const context = engine.analyzeMarketContext(data);

        expect(context.knownCatalysts).toEqual(['ECB rate decision', 'GDP data release']);
    });

    test('should determine correct timeframe for Asia session', () => {
        const date = new Date();
        date.setHours(5, 0, 0, 0);
        
        const data = {
            instrument: 'EURUSD',
            percentChange: 1.0,
            timestamp: date.toISOString(),
        };

        const context = engine.analyzeMarketContext(data);

        expect(context.timeframe).toBe('Asia session');
    });

    test('should include OHLC data when provided', () => {
        const data = {
            instrument: 'EURUSD',
            percentChange: 2.0,
            timestamp: new Date().toISOString(),
            ohlc: {
                open: 1.1000,
                high: 1.1020,
                low: 1.0990,
                close: 1.1015,
            },
        };

        const context = engine.analyzeMarketContext(data);

        expect(context.ohlc).toEqual({
            open: 1.1000,
            high: 1.1020,
            low: 1.0990,
            close: 1.1015,
        });
    });
});