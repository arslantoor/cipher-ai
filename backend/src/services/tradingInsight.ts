import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { TradingInsight } from '../types';
import { AuditService } from './audit';

export class TradingInsightService {
    /**
     * Create a new trading insight
     */
    static createInsight(insight: TradingInsight): string {
        const stmt = db.prepare(`
            INSERT INTO trading_insights (
                id, trader_id, instrument, market_context, behaviour_context,
                pressure_level, deterministic_score, narrative, data_source_url, data_source_type, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            insight.insight_id,
            insight.trader_id,
            insight.instrument,
            JSON.stringify(insight.market_context),
            JSON.stringify(insight.behaviour_context),
            insight.pressure_level,
            insight.deterministic_score,
            insight.narrative || null,
            insight.data_source_url || null,
            insight.data_source_type || null,
            insight.created_at
        );

        AuditService.log({
            action: 'TRADING_INSIGHT_CREATED',
            resource_type: 'trading_insight',
            resource_id: insight.insight_id,
            details: JSON.stringify({
                trader_id: insight.trader_id,
                instrument: insight.instrument,
                pressure_level: insight.pressure_level,
            }),
        });

        return insight.insight_id;
    }

    /**
     * Get insight by ID
     */
    static getInsight(insightId: string): TradingInsight | null {
        const row = db.prepare('SELECT * FROM trading_insights WHERE id = ?').get(insightId) as any;

        if (!row) return null;

        return {
            insight_id: row.id,
            trader_id: row.trader_id,
            instrument: row.instrument,
            market_context: JSON.parse(row.market_context),
            behaviour_context: JSON.parse(row.behaviour_context),
            pressure_level: row.pressure_level,
            deterministic_score: row.deterministic_score,
            narrative: row.narrative,
            data_source_url: row.data_source_url || undefined,
            data_source_type: row.data_source_type || undefined,
            created_at: row.created_at,
        };
    }

    /**
     * Get insights with filters
     */
    static getInsights(filters: {
        trader_id?: string;
        instrument?: string;
        pressure_level?: string;
        limit?: number;
        start_date?: string;
        end_date?: string;
    }): TradingInsight[] {
        let query = 'SELECT * FROM trading_insights WHERE 1=1';
        const params: any[] = [];

        if (filters.trader_id) {
            query += ' AND trader_id = ?';
            params.push(filters.trader_id);
        }

        if (filters.instrument) {
            query += ' AND instrument = ?';
            params.push(filters.instrument);
        }

        if (filters.pressure_level) {
            query += ' AND pressure_level = ?';
            params.push(filters.pressure_level);
        }

        if (filters.start_date) {
            query += ' AND created_at >= ?';
            params.push(filters.start_date);
        }

        if (filters.end_date) {
            query += ' AND created_at <= ?';
            params.push(filters.end_date);
        }

        query += ' ORDER BY created_at DESC';

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }

        const stmt = db.prepare(query);
        const rows = stmt.all(...params) as any[];

        return rows.map(row => ({
            insight_id: row.id,
            trader_id: row.trader_id,
            instrument: row.instrument,
            market_context: JSON.parse(row.market_context),
            behaviour_context: JSON.parse(row.behaviour_context),
            pressure_level: row.pressure_level,
            deterministic_score: row.deterministic_score,
            narrative: row.narrative,
            data_source_url: row.data_source_url || undefined,
            data_source_type: row.data_source_type || undefined,
            created_at: row.created_at,
        }));
    }

    /**
     * Get insights for daily/weekly summary
     */
    static getSummaryInsights(period: 'daily' | 'weekly'): TradingInsight[] {
        const now = new Date();
        let startDate: Date;

        if (period === 'daily') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else {
            // Weekly: last 7 days
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
        }

        return this.getInsights({
            start_date: startDate.toISOString(),
            end_date: now.toISOString(),
            limit: 100,
        });
    }
}