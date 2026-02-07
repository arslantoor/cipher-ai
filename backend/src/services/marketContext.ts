import { MarketContext } from '../types';

export interface PriceMovementData {
    instrument: string;
    ohlc?: {
        open: number;
        high: number;
        low: number;
        close: number;
    };
    percentChange?: number;
    volatility?: number;
    timestamp: string;
    newsCatalysts?: string[];
}

export class MarketContextEngine {
    /**
     * Analyze market context - NO PREDICTIONS, only explanations
     */
    analyzeMarketContext(data: PriceMovementData): MarketContext {
        const { instrument, ohlc, percentChange = 0, volatility, newsCatalysts } = data;
        
        // Detect movement type
        const movementType = this.detectMovementType(percentChange, volatility);
        
        // Calculate magnitude
        const magnitude = Math.abs(percentChange);
        
        // Determine timeframe context
        const timeframe = this.determineTimeframe(data.timestamp);
        
        // Generate historical context explanation
        const historicalContext = this.generateHistoricalContext(magnitude, movementType);
        
        return {
            instrument,
            movementType,
            magnitude,
            timeframe,
            historicalContext,
            knownCatalysts: newsCatalysts || [],
            ohlc,
            volatility,
        };
    }

    private detectMovementType(
        percentChange: number,
        volatility?: number
    ): MarketContext['movementType'] {
        const absChange = Math.abs(percentChange);
        const highVolatility = volatility && volatility > 0.02;

        if (absChange > 5 && highVolatility) {
            return 'volatility_regime_change';
        }
        
        if (absChange > 3) {
            return 'sudden_spike';
        }
        
        if (absChange > 1 && absChange <= 3) {
            return 'gradual_trend';
        }

        const hour = new Date().getHours();
        const isSessionOverlap = (hour >= 8 && hour <= 12) || (hour >= 13 && hour <= 16);
        
        if (absChange > 1 && isSessionOverlap) {
            return 'session_anomaly';
        }

        return 'normal';
    }

    private determineTimeframe(timestamp: string): string {
        const date = new Date(timestamp);
        const hour = date.getHours();
        
        if (hour >= 0 && hour < 8) {
            return 'Asia session';
        } else if (hour >= 8 && hour < 13) {
            return 'London session';
        } else if (hour >= 13 && hour < 22) {
            return 'NY session';
        } else {
            return 'Overlap period';
        }
    }

    private generateHistoricalContext(
        magnitude: number,
        movementType: MarketContext['movementType']
    ): string {
        if (movementType === 'sudden_spike') {
            return `Price movement of ${magnitude.toFixed(2)}% represents a significant intraday shift, typically seen during major news events or liquidity gaps.`;
        }
        
        if (movementType === 'volatility_regime_change') {
            return `Elevated volatility suggests a shift in market regime, potentially driven by macroeconomic factors or structural market changes.`;
        }
        
        if (movementType === 'session_anomaly') {
            return `Movement during session overlap periods often reflects increased liquidity and cross-market flows.`;
        }
        
        if (movementType === 'gradual_trend') {
            return `Gradual price movement indicates sustained directional bias, consistent with trend-following behavior.`;
        }
        
        return `Price movement within normal range, consistent with typical market microstructure.`;
    }
}