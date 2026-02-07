import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface AutonomousModeIndicatorProps {
    traderId?: string;
}

interface SystemStatus {
    lastRun: string | null;
    instrumentsMonitored: number;
    health: 'operational' | 'degraded' | 'offline';
}

export const AutonomousModeIndicator: React.FC<AutonomousModeIndicatorProps> = ({ traderId }) => {
    const [status, setStatus] = useState<SystemStatus>({
        lastRun: null,
        instrumentsMonitored: 0,
        health: 'operational'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                // Fetch recent insights to determine status
                const res = await api.get('/insights', { 
                    params: { 
                        limit: 1,
                        ...(traderId && { trader_id: traderId })
                    } 
                });
                
                const insights = res.data || [];
                const lastInsight = insights[0];
                
                // Get unique instruments
                const allInsights = await api.get('/insights', { params: { limit: 100 } });
                const instruments = new Set(allInsights.data.map((i: any) => i.instrument));
                
                setStatus({
                    lastRun: lastInsight?.created_at || null,
                    instrumentsMonitored: instruments.size,
                    health: 'operational'
                });
            } catch (error) {
                console.error('Failed to fetch system status', error);
                setStatus({
                    lastRun: null,
                    instrumentsMonitored: 0,
                    health: 'offline'
                });
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [traderId]);

    const formatLastRun = (timestamp: string | null) => {
        if (!timestamp) return 'Never';
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

    const getHealthColor = (health: SystemStatus['health']) => {
        switch (health) {
            case 'operational':
                return 'var(--brand-cyan)';
            case 'degraded':
                return 'var(--severity-medium)';
            case 'offline':
                return 'var(--text-muted)';
            default:
                return 'var(--brand-cyan)';
        }
    };

    if (loading) {
        return (
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                padding: '8px 16px',
                background: 'var(--bg-tertiary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
            }}>
                <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    background: 'var(--text-muted)',
                    animation: 'pulse 2s infinite'
                }}></div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Checking status...</span>
            </div>
        );
    }

    return (
        <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px',
            padding: '8px 16px',
            background: 'var(--bg-tertiary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    background: getHealthColor(status.health),
                    boxShadow: `0 0 8px ${getHealthColor(status.health)}40`
                }}></div>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    Autonomous Analysis: Active
                </span>
            </div>
            
            <div style={{ 
                width: '1px', 
                height: '20px', 
                background: 'var(--border-color)' 
            }}></div>
            
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Last run: <span style={{ color: 'var(--text-secondary)' }}>{formatLastRun(status.lastRun)}</span>
            </div>
            
            <div style={{ 
                width: '1px', 
                height: '20px', 
                background: 'var(--border-color)' 
            }}></div>
            
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Instruments: <span style={{ color: 'var(--text-secondary)' }}>{status.instrumentsMonitored}</span>
            </div>
            
            <div style={{ 
                width: '1px', 
                height: '20px', 
                background: 'var(--border-color)' 
            }}></div>
            
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Status: <span style={{ color: getHealthColor(status.health) }}>● {status.health}</span>
            </div>
        </div>
    );
};
