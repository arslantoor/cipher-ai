// Data Validator - Ensures all trading data is legitimate and realistic
// Validates market data, trades, and prevents invalid/fake data

import { Trade, MarketContext } from '../types';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export class DataValidator {
    // Realistic price ranges for instruments (to detect fake data)
    private static readonly INSTRUMENT_RANGES: Record<string, { min: number; max: number }> = {
        EURUSD: { min: 0.8000, max: 1.5000 },
        GBPUSD: { min: 1.0000, max: 2.0000 },
        USDJPY: { min: 80.00, max: 200.00 },
        BTCUSD: { min: 10000, max: 100000 },
        XAUUSD: { min: 1000, max: 3000 },
        USDCAD: { min: 1.0000, max: 2.0000 },
        AUDUSD: { min: 0.5000, max: 1.2000 },
    };

    // Realistic volatility ranges (percentage)
    private static readonly VOLATILITY_RANGES = { min: 0.001, max: 0.10 }; // 0.1% to 10%

    // Realistic price movement ranges (percentage)
    private static readonly MOVEMENT_RANGES = { min: 0.01, max: 15.0 }; // 0.01% to 15%

    // Realistic position size ranges (USD)
    private static readonly POSITION_SIZE_RANGES = { min: 10, max: 1000000 };

    // Realistic PnL ranges (percentage of position size)
    private static readonly PNL_RANGES = { min: -0.50, max: 0.50 }; // -50% to +50%

    /**
     * Validate market data
     */
    static validateMarketData(marketData: {
        instrument: string;
        percentChange?: number;
        volatility?: number;
        ohlc?: { open: number; high: number; low: number; close: number };
    }): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate instrument
        if (!marketData.instrument || typeof marketData.instrument !== 'string') {
            errors.push('Instrument is required and must be a string');
        }

        // Validate price range for instrument
        if (marketData.ohlc) {
            const range = this.INSTRUMENT_RANGES[marketData.instrument];
            if (range) {
                const { open, high, low, close } = marketData.ohlc;
                
                // Check if prices are within realistic range
                [open, high, low, close].forEach((price, index) => {
                    const name = ['open', 'high', 'low', 'close'][index];
                    if (price < range.min || price > range.max) {
                        errors.push(`${name} price (${price}) is outside realistic range for ${marketData.instrument} (${range.min}-${range.max})`);
                    }
                });

                // Validate OHLC logic
                if (high < low) {
                    errors.push('High price cannot be less than low price');
                }
                if (high < open || high < close) {
                    errors.push('High price must be >= open and close');
                }
                if (low > open || low > close) {
                    errors.push('Low price must be <= open and close');
                }
            } else {
                warnings.push(`No price range validation for instrument: ${marketData.instrument}`);
            }
        }

        // Validate percent change
        if (marketData.percentChange !== undefined) {
            const absChange = Math.abs(marketData.percentChange);
            if (absChange > this.MOVEMENT_RANGES.max) {
                errors.push(`Price movement (${marketData.percentChange}%) exceeds realistic maximum (${this.MOVEMENT_RANGES.max}%)`);
            }
            if (absChange < this.MOVEMENT_RANGES.min && absChange > 0) {
                warnings.push(`Price movement (${marketData.percentChange}%) is very small`);
            }
        }

        // Validate volatility
        if (marketData.volatility !== undefined) {
            if (marketData.volatility < this.VOLATILITY_RANGES.min || marketData.volatility > this.VOLATILITY_RANGES.max) {
                errors.push(`Volatility (${marketData.volatility}) is outside realistic range (${this.VOLATILITY_RANGES.min}-${this.VOLATILITY_RANGES.max})`);
            }
        }

        // Cross-validate percentChange with OHLC if both provided
        if (marketData.ohlc && marketData.percentChange !== undefined) {
            const { open, close } = marketData.ohlc;
            const calculatedChange = ((close - open) / open) * 100;
            const diff = Math.abs(calculatedChange - marketData.percentChange);
            
            if (diff > 0.1) { // Allow 0.1% tolerance
                warnings.push(`percentChange (${marketData.percentChange}%) doesn't match OHLC calculation (${calculatedChange.toFixed(2)}%)`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validate trade data
     */
    static validateTrades(trades: Trade[]): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!Array.isArray(trades) || trades.length === 0) {
            errors.push('Trades must be a non-empty array');
            return { valid: false, errors, warnings };
        }

        // Check for duplicate trade IDs
        const tradeIds = trades.map(t => t.trade_id);
        const duplicates = tradeIds.filter((id, index) => tradeIds.indexOf(id) !== index);
        if (duplicates.length > 0) {
            errors.push(`Duplicate trade IDs found: ${duplicates.join(', ')}`);
        }

        // Validate each trade
        trades.forEach((trade, index) => {
            // Required fields
            if (!trade.trade_id) {
                errors.push(`Trade ${index}: trade_id is required`);
            }
            if (!trade.trader_id) {
                errors.push(`Trade ${index}: trader_id is required`);
            }
            if (!trade.instrument) {
                errors.push(`Trade ${index}: instrument is required`);
            }
            if (!trade.timestamp) {
                errors.push(`Trade ${index}: timestamp is required`);
            }

            // Validate timestamp format
            if (trade.timestamp) {
                const date = new Date(trade.timestamp);
                if (isNaN(date.getTime())) {
                    errors.push(`Trade ${index}: Invalid timestamp format: ${trade.timestamp}`);
                } else {
                    // Check if timestamp is in the future
                    if (date.getTime() > Date.now() + 60000) { // Allow 1 minute tolerance
                        errors.push(`Trade ${index}: Timestamp is in the future: ${trade.timestamp}`);
                    }
                    // Check if timestamp is too old (more than 1 year)
                    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
                    if (date.getTime() < oneYearAgo) {
                        warnings.push(`Trade ${index}: Timestamp is more than 1 year old`);
                    }
                }
            }

            // Validate position size
            if (trade.position_size !== undefined) {
                if (trade.position_size < this.POSITION_SIZE_RANGES.min) {
                    errors.push(`Trade ${index}: Position size (${trade.position_size}) is below minimum (${this.POSITION_SIZE_RANGES.min})`);
                }
                if (trade.position_size > this.POSITION_SIZE_RANGES.max) {
                    errors.push(`Trade ${index}: Position size (${trade.position_size}) exceeds maximum (${this.POSITION_SIZE_RANGES.max})`);
                }
            }

            // Validate PnL
            if (trade.pnl !== undefined) {
                if (trade.position_size) {
                    const pnlPercent = (trade.pnl / trade.position_size) * 100;
                    if (pnlPercent < this.PNL_RANGES.min * 100 || pnlPercent > this.PNL_RANGES.max * 100) {
                        warnings.push(`Trade ${index}: PnL (${trade.pnl}, ${pnlPercent.toFixed(2)}% of position) is outside typical range`);
                    }
                }
            }

            // Validate instrument format
            if (trade.instrument && !/^[A-Z]{3,6}(USD|EUR|GBP|JPY|CAD|AUD)?$/.test(trade.instrument)) {
                warnings.push(`Trade ${index}: Instrument format (${trade.instrument}) may be invalid`);
            }
        });

        // Validate trade sequence (timestamps should be in order)
        const timestamps = trades.map(t => new Date(t.timestamp).getTime()).filter(t => !isNaN(t));
        if (timestamps.length > 1) {
            for (let i = 1; i < timestamps.length; i++) {
                if (timestamps[i] < timestamps[i - 1]) {
                    warnings.push(`Trades are not in chronological order (trade ${i} is before trade ${i - 1})`);
                    break;
                }
            }
        }

        // Check for suspicious patterns
        if (trades.length > 10) {
            warnings.push(`Large number of trades (${trades.length}) - verify this is legitimate`);
        }

        // Check for rapid-fire trades (potential manipulation)
        if (trades.length >= 2) {
            const intervals: number[] = [];
            for (let i = 1; i < trades.length; i++) {
                const prev = new Date(trades[i - 1].timestamp).getTime();
                const curr = new Date(trades[i].timestamp).getTime();
                const intervalSeconds = (curr - prev) / 1000;
                intervals.push(intervalSeconds);
            }
            
            const veryShortIntervals = intervals.filter(i => i < 5); // Less than 5 seconds
            if (veryShortIntervals.length > 0) {
                warnings.push(`Multiple trades executed within 5 seconds - verify legitimacy`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validate complete insight request
     */
    static validateInsightRequest(data: {
        trader_id: string;
        trades: Trade[];
        market_data: any;
    }): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate trader_id
        if (!data.trader_id || typeof data.trader_id !== 'string') {
            errors.push('trader_id is required and must be a string');
        } else if (data.trader_id.length < 3 || data.trader_id.length > 50) {
            errors.push('trader_id must be between 3 and 50 characters');
        }

        // Validate trades
        const tradesValidation = this.validateTrades(data.trades);
        errors.push(...tradesValidation.errors);
        warnings.push(...tradesValidation.warnings);

        // Validate market data
        const marketValidation = this.validateMarketData(data.market_data);
        errors.push(...marketValidation.errors);
        warnings.push(...marketValidation.warnings);

        // Cross-validate: instrument should match between trades and market data
        if (data.trades.length > 0 && data.market_data.instrument) {
            const tradeInstruments = new Set(data.trades.map(t => t.instrument));
            if (!tradeInstruments.has(data.market_data.instrument)) {
                warnings.push(`Market data instrument (${data.market_data.instrument}) doesn't match trade instruments (${Array.from(tradeInstruments).join(', ')})`);
            }
        }

        // Cross-validate: trader_id should match in all trades
        if (data.trades.length > 0) {
            const tradeTraderIds = new Set(data.trades.map(t => t.trader_id));
            if (tradeTraderIds.size > 1) {
                errors.push('All trades must have the same trader_id');
            }
            if (!tradeTraderIds.has(data.trader_id)) {
                errors.push('trader_id in request must match trader_id in all trades');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Check if data looks suspicious (potential fake/manipulated data)
     */
    static detectSuspiciousPatterns(data: {
        trades: Trade[];
        market_data: any;
    }): {
        suspicious: boolean;
        reasons: string[];
    } {
        const reasons: string[] = [];

        // Check for impossible price movements
        if (data.market_data.percentChange && Math.abs(data.market_data.percentChange) > 20) {
            reasons.push(`Extreme price movement: ${data.market_data.percentChange}%`);
        }

        // Check for unrealistic position sizes
        if (data.trades.some(t => t.position_size && t.position_size > 10000000)) {
            reasons.push('Unusually large position sizes detected');
        }

        // Check for perfect patterns (suspicious)
        const pnls = data.trades.map(t => t.pnl).filter(p => p !== undefined);
        if (pnls.length > 3) {
            const allPositive = pnls.every(p => p! > 0);
            const allNegative = pnls.every(p => p! < 0);
            if (allPositive || allNegative) {
                reasons.push('All trades have same PnL direction (suspicious pattern)');
            }
        }

        // Check for unrealistic win rate
        if (pnls.length > 5) {
            const wins = pnls.filter(p => p! > 0).length;
            const winRate = wins / pnls.length;
            if (winRate > 0.95 || winRate < 0.05) {
                reasons.push(`Unrealistic win rate: ${(winRate * 100).toFixed(1)}%`);
            }
        }

        return {
            suspicious: reasons.length > 0,
            reasons,
        };
    }
}
