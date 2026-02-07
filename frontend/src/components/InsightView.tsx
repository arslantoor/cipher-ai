import React from 'react';
import { TradingInsight, BehavioralPressureLevel } from '../types';
import { PressureGauge } from './PressureGauge';
import { Timeline } from './Timeline';

interface InsightViewProps {
    insight: TradingInsight | null;
    isLoading: boolean;
}

export const InsightView: React.FC<InsightViewProps> = ({ insight, isLoading }) => {
    if (isLoading) {
        return (
            <div style={{ padding: '64px', textAlign: 'center' }}>
                <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    border: '3px solid var(--brand-cyan)', 
                    borderTopColor: 'transparent', 
                    borderRadius: '50%', 
                    animation: 'spin 1s linear infinite', 
                    margin: '0 auto 24px' 
                }}></div>
                <h2 className="text-gradient">Analyzing Trading Patterns...</h2>
                <p style={{ color: 'var(--text-muted)' }}>Autonomous analysis in progress.</p>
            </div>
        );
    }

    if (!insight) return null;

    const { market_context, behaviour_context, pressure_level, narrative, created_at, data_source_url, data_source_type } = insight;

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getMovementDescription = () => {
        const { movementType, magnitude, historicalContext } = market_context;
        const direction = magnitude >= 0 ? 'upward' : 'downward';
        const absMag = Math.abs(magnitude).toFixed(2);
        
        switch (movementType) {
            case 'sudden_spike':
                return `A sudden ${direction} movement of ${absMag}% occurred. ${historicalContext}`;
            case 'gradual_trend':
                return `A gradual ${direction} trend of ${absMag}% developed. ${historicalContext}`;
            case 'volatility_regime_change':
                return `Market volatility shifted significantly (${absMag}%). ${historicalContext}`;
            case 'session_anomaly':
                return `Unusual activity detected during this trading session. ${historicalContext}`;
            default:
                return historicalContext;
        }
    };

    const getBehavioralContext = () => {
        const { pressure_score, deviations, baseline } = behaviour_context;
        const factors = pressure_score.factors;
        const observations: string[] = [];

        if (factors.trade_frequency_spike > 0.3) {
            observations.push('Trading frequency increased noticeably');
        }
        if (factors.position_size_deviation > 0.3) {
            observations.push('Position sizes deviated from your typical range');
        }
        if (factors.loss_clustering > 0.3) {
            observations.push('Recent losses clustered in time');
        }
        if (factors.unusual_hours > 0.3) {
            observations.push('Trading occurred during unusual hours');
        }
        if (factors.short_intervals > 0.3) {
            observations.push('Rapid succession of trades detected');
        }

        if (observations.length === 0) {
            return 'Your trading behavior remained consistent with your baseline patterns.';
        }

        return `We observed: ${observations.join('; ')}. These patterns may indicate increased pressure or emotional response to market conditions.`;
    };

    const getWhyItMatters = () => {
        const { pressure_score } = behaviour_context;
        const { movementType, magnitude } = market_context;

        if (pressure_level === BehavioralPressureLevel.HIGH) {
            return 'High pressure moments often correlate with emotional trading decisions. This insight helps you recognize patterns that may impact your decision-making process.';
        }

        if (Math.abs(magnitude) > 3) {
            return 'Significant market movements combined with behavioral shifts can create decision-making pressure. Awareness of these moments supports more intentional trading.';
        }

        return 'Understanding the relationship between market conditions and your trading behavior builds self-awareness, which is foundational to consistent performance.';
    };

    // Build timeline from market and behavior data
    const timelineEvents = [
        {
            timestamp: created_at,
            event: `Market movement detected: ${market_context.movementType.replace(/_/g, ' ')}`,
            severity: 'alert' as const,
            details: `${Math.abs(market_context.magnitude).toFixed(2)}% change`
        },
        {
            timestamp: created_at,
            event: `Behavioral pressure: ${pressure_level}`,
            severity: 'deviation' as const,
            details: `Score: ${behaviour_context.pressure_score.score.toFixed(0)}/100`
        }
    ];

    return (
        <div className="insight-view">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
                <div>
                    <div style={{ 
                        fontSize: '12px', 
                        color: 'var(--text-muted)', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.1em', 
                        marginBottom: '8px' 
                    }}>
                        Insight: {insight.insight_id}
                    </div>
                    <h1 style={{ fontSize: '28px', marginBottom: '4px' }}>
                        {insight.instrument} Analysis
                    </h1>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Detected {formatTimestamp(created_at)}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <PressureGauge 
                        pressureLevel={pressure_level}
                        score={behaviour_context.pressure_score.score}
                        size="large"
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {/* What Happened in the Market */}
                    <section style={{ 
                        padding: '32px', 
                        background: 'var(--bg-secondary)', 
                        borderRadius: '24px', 
                        border: '1px solid var(--border-color)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ 
                            position: 'absolute', 
                            top: 0, 
                            left: 0, 
                            width: '4px', 
                            height: '100%', 
                            background: 'var(--brand-gradient)' 
                        }}></div>
                        <h3 style={{ 
                            fontSize: '14px', 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.1em', 
                            color: 'var(--text-secondary)', 
                            marginBottom: '16px' 
                        }}>
                            What Happened in the Market
                        </h3>
                        <p style={{ 
                            fontSize: '16px', 
                            lineHeight: '1.7', 
                            color: 'var(--text-primary)',
                            marginBottom: '16px'
                        }}>
                            {getMovementDescription()}
                        </p>
                        {market_context.ohlc && (
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(4, 1fr)', 
                                gap: '12px',
                                marginTop: '16px',
                                padding: '16px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '12px'
                            }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Open</div>
                                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{market_context.ohlc.open.toFixed(5)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>High</div>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--brand-cyan)' }}>{market_context.ohlc.high.toFixed(5)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Low</div>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--accent-red)' }}>{market_context.ohlc.low.toFixed(5)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Close</div>
                                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{market_context.ohlc.close.toFixed(5)}</div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* What We Observed in Your Behaviour */}
                    <section style={{ 
                        padding: '32px', 
                        background: 'var(--bg-secondary)', 
                        borderRadius: '24px', 
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ 
                            fontSize: '14px', 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.1em', 
                            color: 'var(--text-secondary)', 
                            marginBottom: '16px' 
                        }}>
                            What We Observed in Your Behaviour
                        </h3>
                        <p style={{ 
                            fontSize: '16px', 
                            lineHeight: '1.7', 
                            color: 'var(--text-primary)',
                            marginBottom: '16px'
                        }}>
                            {getBehavioralContext()}
                        </p>
                        <div style={{ 
                            marginTop: '20px',
                            padding: '16px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: '12px'
                        }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                Pressure Factors
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {Object.entries(behaviour_context.pressure_score.factors).map(([key, value]) => (
                                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                            {key.replace(/_/g, ' ')}
                                        </span>
                                        <div style={{ 
                                            width: '100px', 
                                            height: '6px', 
                                            background: 'var(--bg-primary)',
                                            borderRadius: '999px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${value * 100}%`,
                                                height: '100%',
                                                background: value > 0.5 ? 'var(--severity-high)' : 'var(--brand-cyan)',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Why This Moment Matters */}
                    <section style={{ 
                        padding: '32px', 
                        background: 'var(--bg-secondary)', 
                        borderRadius: '24px', 
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ 
                            fontSize: '14px', 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.1em', 
                            color: 'var(--text-secondary)', 
                            marginBottom: '16px' 
                        }}>
                            Why This Moment Matters
                        </h3>
                        <p style={{ 
                            fontSize: '16px', 
                            lineHeight: '1.7', 
                            color: 'var(--text-primary)'
                        }}>
                            {getWhyItMatters()}
                        </p>
                    </section>

                    {/* Data Source Link */}
                    {(data_source_url || data_source_type) && (
                        <section style={{ 
                            padding: '20px 24px', 
                            background: 'var(--bg-secondary)', 
                            borderRadius: '16px', 
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px'
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ 
                                    fontSize: '12px', 
                                    textTransform: 'uppercase', 
                                    letterSpacing: '0.1em', 
                                    color: 'var(--text-muted)', 
                                    marginBottom: '4px' 
                                }}>
                                    Data Source
                                </div>
                                <div style={{ 
                                    fontSize: '13px', 
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'var(--font-mono)'
                                }}>
                                    {data_source_type ? (
                                        <span style={{ textTransform: 'capitalize' }}>
                                            {data_source_type.replace('_', ' ')}
                                        </span>
                                    ) : 'External Source'}
                                </div>
                            </div>
                            {data_source_url && data_source_url !== '#' && (
                                <a
                                    href={data_source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        padding: '10px 20px',
                                        background: 'var(--brand-gradient)',
                                        borderRadius: '12px',
                                        color: '#fff',
                                        textDecoration: 'none',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s ease',
                                        cursor: 'pointer'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.opacity = '0.9';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.opacity = '1';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    <span>🔗</span>
                                    <span>View Source</span>
                                    <span style={{ fontSize: '10px' }}>↗</span>
                                </a>
                            )}
                        </section>
                    )}

                    {/* AI Narrative if available */}
                    {narrative && (
                        <section style={{ 
                            padding: '32px', 
                            background: 'var(--bg-secondary)', 
                            borderRadius: '24px', 
                            border: '1px solid var(--border-color)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ 
                                position: 'absolute', 
                                top: 0, 
                                left: 0, 
                                width: '4px', 
                                height: '100%', 
                                background: 'var(--brand-gradient)' 
                            }}></div>
                            <h3 style={{ 
                                fontSize: '14px', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.1em', 
                                color: 'var(--text-secondary)', 
                                marginBottom: '16px' 
                            }}>
                                AI Analysis Summary
                            </h3>
                            <p style={{ 
                                fontSize: '16px', 
                                lineHeight: '1.7', 
                                color: 'var(--text-primary)' 
                            }}>
                                {narrative}
                            </p>
                        </section>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {/* Timeline */}
                    <section>
                        <h3 style={{ 
                            fontSize: '14px', 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.1em', 
                            color: 'var(--text-secondary)', 
                            marginBottom: '24px' 
                        }}>
                            Timeline
                        </h3>
                        <Timeline events={timelineEvents} />
                    </section>

                    {/* Pressure Score Card */}
                    <section style={{ 
                        padding: '24px', 
                        background: 'var(--bg-secondary)', 
                        borderRadius: '20px', 
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ 
                            fontSize: '14px', 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.1em', 
                            color: 'var(--text-secondary)', 
                            marginBottom: '20px' 
                        }}>
                            Behavioral Pressure
                        </h3>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ fontSize: '36px', fontWeight: '800', color: 'var(--brand-cyan)', marginBottom: '8px' }}>
                                {behaviour_context.pressure_score.score.toFixed(0)}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                {pressure_level}
                            </div>
                        </div>
                        <PressureGauge 
                            pressureLevel={pressure_level}
                            score={behaviour_context.pressure_score.score}
                            size="large"
                        />
                    </section>
                </div>
            </div>
        </div>
    );
};
