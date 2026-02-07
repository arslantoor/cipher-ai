import React, { useState, useEffect } from 'react';
import { TradingInsight, BehavioralPressureLevel } from '../types';
import api from '../services/api';
import { PressureGauge } from './PressureGauge';

interface AutonomousInsightsProps {
    onSelectInsight: (insight: TradingInsight) => void;
    selectedInsightId?: string;
}

export const AutonomousInsights: React.FC<AutonomousInsightsProps> = ({ 
    onSelectInsight, 
    selectedInsightId 
}) => {
    const [insights, setInsights] = useState<TradingInsight[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const fetchInsights = async () => {
        try {
            const res = await api.get('/insights', { params: { limit: 20 } });
            setInsights(res.data);
            setLastRefresh(new Date());
        } catch (error) {
            console.error('Failed to fetch insights', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsights();
        const interval = setInterval(fetchInsights, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    };

    const getPressureBadgeClass = (level: BehavioralPressureLevel) => {
        switch (level) {
            case BehavioralPressureLevel.STABLE:
                return 'pressure-badge stable';
            case BehavioralPressureLevel.ELEVATED:
                return 'pressure-badge elevated';
            case BehavioralPressureLevel.HIGH_PRESSURE:
            case BehavioralPressureLevel.HIGH:
                return 'pressure-badge high';
            default:
                return 'pressure-badge stable';
        }
    };

    const getPressureLabel = (level: BehavioralPressureLevel) => {
        switch (level) {
            case BehavioralPressureLevel.STABLE:
                return 'Stable';
            case BehavioralPressureLevel.ELEVATED:
                return 'Elevated';
            case BehavioralPressureLevel.HIGH_PRESSURE:
            case BehavioralPressureLevel.HIGH:
                return 'High Pressure';
            default:
                return 'Stable';
        }
    };

    const getMovementSummary = (insight: TradingInsight) => {
        const { movementType, magnitude } = insight.market_context;
        const direction = magnitude >= 0 ? 'up' : 'down';
        const absMag = Math.abs(magnitude).toFixed(2);
        
        switch (movementType) {
            case 'sudden_spike':
                return `Sudden ${direction} ${absMag}%`;
            case 'gradual_trend':
                return `Gradual ${direction} ${absMag}%`;
            case 'volatility_regime_change':
                return `Volatility shift ${absMag}%`;
            default:
                return `${absMag}% movement`;
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    border: '2px solid var(--brand-cyan)', 
                    borderTopColor: 'transparent', 
                    borderRadius: '50%', 
                    animation: 'spin 1s linear infinite', 
                    margin: '0 auto 16px' 
                }}></div>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading insights...</p>
            </div>
        );
    }

    return (
        <div className="autonomous-insights">
            <div className="insights-header">
                <h2 style={{ fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
                    Autonomous Insights
                </h2>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Updated {formatTime(lastRefresh.toISOString())}
                </div>
            </div>

            <div className="insights-list">
                {insights.length === 0 ? (
                    <div style={{ 
                        padding: '48px 24px', 
                        textAlign: 'center',
                        color: 'var(--text-muted)'
                    }}>
                        <div style={{ fontSize: '32px', marginBottom: '16px' }}>📊</div>
                        <p style={{ fontSize: '14px' }}>No insights detected yet</p>
                        <p style={{ fontSize: '12px', marginTop: '8px' }}>Analysis runs automatically in the background</p>
                    </div>
                ) : (
                    insights.map((insight) => (
                        <div
                            key={insight.insight_id}
                            className={`insight-card ${selectedInsightId === insight.insight_id ? 'selected' : ''}`}
                            onClick={() => onSelectInsight(insight)}
                        >
                            <div className="insight-card-header">
                                <div>
                                    <div style={{ 
                                        fontSize: '14px', 
                                        fontWeight: '600', 
                                        marginBottom: '4px',
                                        color: 'var(--text-primary)'
                                    }}>
                                        {insight.instrument}
                                    </div>
                                    <div style={{ 
                                        fontSize: '11px', 
                                        color: 'var(--text-muted)',
                                        fontFamily: 'var(--font-mono)'
                                    }}>
                                        {formatTime(insight.created_at)}
                                    </div>
                                </div>
                                <div className={getPressureBadgeClass(insight.pressure_level)}>
                                    {getPressureLabel(insight.pressure_level)}
                                </div>
                            </div>

                            <div style={{ marginTop: '12px', marginBottom: '12px' }}>
                                <div style={{ 
                                    fontSize: '13px', 
                                    color: 'var(--text-secondary)',
                                    marginBottom: '8px'
                                }}>
                                    {getMovementSummary(insight)}
                                </div>
                                {insight.narrative && (
                                    <div style={{ 
                                        fontSize: '12px', 
                                        color: 'var(--text-muted)',
                                        lineHeight: '1.5',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {insight.narrative.substring(0, 120)}...
                                    </div>
                                )}
                            </div>

                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '12px',
                                marginTop: '12px'
                            }}>
                                <PressureGauge 
                                    pressureLevel={insight.pressure_level}
                                    score={insight.behaviour_context.pressure_score.score}
                                    size="small"
                                />
                                <div style={{ 
                                    fontSize: '11px', 
                                    color: 'var(--text-muted)',
                                    marginLeft: 'auto'
                                }}>
                                    View details →
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
