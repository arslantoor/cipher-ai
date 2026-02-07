// Autonomous Demo Service - Simulates real-time market monitoring and automatic insight generation
// This demonstrates how the system would work autonomously in production

import { AutonomousOrchestrator } from './orchestrator';
import { Trade } from '../types';
import { AuditService } from './audit';
import { DataValidator } from './dataValidator';

export class AutonomousDemoService {
    private orchestrator: AutonomousOrchestrator;
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    private traders: string[] = ['TRADER-001', 'TRADER-002', 'TRADER-003'];
    private instruments: string[] = ['EURUSD', 'GBPUSD', 'BTCUSD', 'XAUUSD', 'USDJPY'];
    private lastTradeTimes: Map<string, Date> = new Map();

    constructor() {
        this.orchestrator = new AutonomousOrchestrator();
    }

    /**
     * Start autonomous demo mode - generates insights automatically
     * @param intervalMinutes - How often to generate insights (default: 2 minutes)
     */
    start(intervalMinutes: number = 2): void {
        if (this.isRunning) {
            console.log('[AutonomousDemo] Already running');
            return;
        }

        this.isRunning = true;
        const intervalMs = intervalMinutes * 60 * 1000;

        console.log(`[AutonomousDemo] Starting autonomous insight generation (every ${intervalMinutes} minutes)`);
        console.log('[AutonomousDemo] This simulates real-time market monitoring and automatic analysis');

        // Generate initial insight immediately
        this.generateRandomInsight();

        // Then generate periodically
        this.intervalId = setInterval(() => {
            this.generateRandomInsight();
        }, intervalMs);

        AuditService.log({
            action: 'AUTONOMOUS_DEMO_STARTED',
            resource_type: 'system',
            resource_id: 'autonomous-demo',
            details: JSON.stringify({
                interval_minutes: intervalMinutes,
                traders: this.traders,
                instruments: this.instruments,
            }),
        });
    }

    /**
     * Stop autonomous demo mode
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        console.log('[AutonomousDemo] Stopped');
        AuditService.log({
            action: 'AUTONOMOUS_DEMO_STOPPED',
            resource_type: 'system',
            resource_id: 'autonomous-demo',
        });
    }

    /**
     * Generate a random insight based on simulated market conditions
     */
    private async generateRandomInsight(): Promise<void> {
        try {
            const traderId = this.getRandomTrader();
            const instrument = this.getRandomInstrument();
            const scenario = this.getRandomScenario();

            console.log(`[AutonomousDemo] Generating insight for ${traderId} on ${instrument} (${scenario.type})`);

            const trades = this.generateTrades(traderId, instrument, scenario);
            const marketData = this.generateMarketData(instrument, scenario);
            const dataSource = this.generateDataSource(traderId, instrument, scenario);

            // Validate generated data to ensure it's legitimate
            const validation = DataValidator.validateInsightRequest({ trader_id: traderId, trades, market_data: marketData });
            
            if (!validation.valid) {
                console.error('[AutonomousDemo] Generated data failed validation:', validation.errors);
                // Regenerate if invalid
                return this.generateRandomInsight();
            }

            if (validation.warnings.length > 0) {
                console.warn('[AutonomousDemo] Validation warnings:', validation.warnings);
            }

            await this.orchestrator.runAutonomousAnalysis(traderId, trades, marketData, dataSource);

            console.log(`[AutonomousDemo] ✅ Insight generated successfully (validated)`);
        } catch (error: any) {
            console.error('[AutonomousDemo] Failed to generate insight:', error.message);
        }
    }

    /**
     * Get random trader ID
     */
    private getRandomTrader(): string {
        return this.traders[Math.floor(Math.random() * this.traders.length)];
    }

    /**
     * Get random instrument
     */
    private getRandomInstrument(): string {
        return this.instruments[Math.floor(Math.random() * this.instruments.length)];
    }

    /**
     * Get random scenario type
     */
    private getRandomScenario(): {
        type: 'normal' | 'high_pressure' | 'market_spike' | 'volatile';
        tradeCount: number;
        percentChange: number;
        volatility: number;
    } {
        const scenarios = [
            {
                type: 'normal' as const,
                tradeCount: 2,
                percentChange: 0.5 + Math.random() * 1.5,
                volatility: 0.008 + Math.random() * 0.005,
            },
            {
                type: 'high_pressure' as const,
                tradeCount: 4 + Math.floor(Math.random() * 3),
                percentChange: 2 + Math.random() * 2,
                volatility: 0.015 + Math.random() * 0.010,
            },
            {
                type: 'market_spike' as const,
                tradeCount: 1,
                percentChange: 5 + Math.random() * 4,
                volatility: 0.025 + Math.random() * 0.015,
            },
            {
                type: 'volatile' as const,
                tradeCount: 3 + Math.floor(Math.random() * 2),
                percentChange: 3 + Math.random() * 3,
                volatility: 0.020 + Math.random() * 0.015,
            },
        ];

        return scenarios[Math.floor(Math.random() * scenarios.length)];
    }

    /**
     * Generate trades based on scenario
     */
    private generateTrades(traderId: string, instrument: string, scenario: any): Trade[] {
        const trades: Trade[] = [];
        const baseSize = 1000 + Math.random() * 2000;
        const now = Date.now();

        for (let i = 0; i < scenario.tradeCount; i++) {
            const minutesAgo = scenario.type === 'high_pressure' 
                ? i * 10  // Trades every 10 minutes (high frequency)
                : i * 60; // Trades every hour (normal)

            const timestamp = new Date(now - minutesAgo * 60 * 1000).toISOString();
            const positionSize = scenario.type === 'high_pressure'
                ? baseSize * (1.5 + Math.random() * 1.5) // Larger positions
                : baseSize * (0.8 + Math.random() * 0.4); // Normal positions

            const pnl = scenario.type === 'high_pressure' && i > 0 && Math.random() > 0.5
                ? -(50 + Math.random() * 100) // More losses in high pressure
                : (Math.random() > 0.4 ? (50 + Math.random() * 100) : -(30 + Math.random() * 50));

            trades.push({
                trade_id: `auto-${traderId}-${Date.now()}-${i}`,
                trader_id: traderId,
                instrument,
                timestamp,
                position_size: Math.round(positionSize),
                pnl: Math.round(pnl),
            });
        }

        return trades.reverse(); // Oldest first
    }

    /**
     * Generate market data based on scenario
     */
    private generateMarketData(instrument: string, scenario: any): any {
        const basePrice = this.getBasePrice(instrument);
        const change = scenario.percentChange * (Math.random() > 0.5 ? 1 : -1);
        const high = basePrice * (1 + Math.abs(change) * 1.1);
        const low = basePrice * (1 - Math.abs(change) * 0.9);
        const close = basePrice * (1 + change / 100);

        const newsCatalysts = this.getNewsCatalysts(scenario.type);

        return {
            instrument,
            percentChange: change,
            volatility: scenario.volatility,
            ohlc: {
                open: basePrice,
                high: Math.round(high * 10000) / 10000,
                low: Math.round(low * 10000) / 10000,
                close: Math.round(close * 10000) / 10000,
            },
            newsCatalysts,
        };
    }

    /**
     * Get base price for instrument
     */
    private getBasePrice(instrument: string): number {
        const prices: Record<string, number> = {
            EURUSD: 1.1000,
            GBPUSD: 1.2700,
            BTCUSD: 42000,
            XAUUSD: 2000,
            USDJPY: 150.00,
        };
        return prices[instrument] || 1.0000;
    }

    /**
     * Get news catalysts based on scenario
     */
    private getNewsCatalysts(scenarioType: string): string[] {
        const catalysts: Record<string, string[]> = {
            normal: ['Routine market update', 'Standard trading session'],
            high_pressure: ['Market volatility', 'Increased trading activity', 'Economic data release'],
            market_spike: ['Major news event', 'Central bank announcement', 'Geopolitical development'],
            volatile: ['High volatility period', 'Market uncertainty', 'Multiple catalysts'],
        };

        return catalysts[scenarioType] || [];
    }

    /**
     * Generate data source URL and type for demo
     */
    private generateDataSource(traderId: string, instrument: string, scenario: any): {
        url?: string;
        type: 'trading_platform' | 'market_data_feed' | 'manual_entry' | 'demo' | 'api';
    } {
        // Generate realistic source URLs based on type
        const baseUrl = process.env.DEMO_BASE_URL;
        const timestamp = Date.now();
        
        // Only create URL if baseUrl is provided and valid
        if (baseUrl && baseUrl.trim() && !baseUrl.includes('broken') && baseUrl !== '#') {
            try {
                // Validate URL format
                new URL(baseUrl);
                const url = `${baseUrl}/trades/${traderId}/${instrument}?timestamp=${timestamp}&scenario=${scenario.type}`;
                return {
                    url,
                    type: 'demo', // Mark as demo data
                };
            } catch (e) {
                // Invalid URL format, skip URL
                console.warn('[AutonomousDemo] Invalid DEMO_BASE_URL, skipping data source URL');
            }
        }
        
        // Return without URL if baseUrl is not set or invalid
        return {
            url: undefined,
            type: 'demo', // Mark as demo data
        };
    }

    /**
     * Check if service is running
     */
    isActive(): boolean {
        return this.isRunning;
    }
}
