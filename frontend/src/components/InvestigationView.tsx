import React from 'react';
import { Investigation } from '../types';
import { Timeline } from './Timeline';
import { NetworkPanel } from './NetworkPanel';
import { ActionPanel } from './ActionPanel';
import SeverityBadge from './SeverityBadge';
import api from '../services/api';

interface InvestigationViewProps {
    investigation: Investigation | null;
    isLoading: boolean;
}

const InvestigationView: React.FC<InvestigationViewProps> = ({ investigation, isLoading }) => {
    if (isLoading) {
        return (
            <div style={{ padding: '64px', textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid var(--brand-cyan)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 24px' }}></div>
                <h2 className="text-gradient">Analyzing Behavior Patterns...</h2>
                <p style={{ color: 'var(--text-muted)' }}>CipherScan AI is processing historical deviations.</p>
            </div>
        );
    }

    if (!investigation) return null;

    const { alert, severity, narrative, timeline, confidence_signals, pattern_signature, detection_summary } = investigation;

    // Mock network data if not present
    const mockNetworkData = {
        related_accounts: ['ACC-4492', 'ACC-9912'],
        shared_signals: ['Matched Device Fingerprint (iphone-15-pro-max)', 'Shared Dubai IP Range'],
        risk_score: 0.82
    };

    return (
        <div className="investigation-view">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                        Case Report: {investigation.investigation_id}
                    </div>
                    <h1 style={{ fontSize: '28px' }}>{alert.alert_type.replace(/_/g, ' ')}</h1>
                </div>
                <SeverityBadge level={severity} />
            </div>

            <div className="hero-stats">
                <div className="hero-stat-card">
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Risk Score</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--brand-cyan)' }}>
                        {confidence_signals.final_score.toFixed(0)}
                    </div>
                </div>
                <div className="hero-stat-card">
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Deviation</div>
                    <div style={{ fontSize: '24px', fontWeight: '800' }}>x{confidence_signals.deviation_multiplier.toFixed(1)}</div>
                </div>
                <div className="hero-stat-card">
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>User Context</div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{alert.user_id}</div>
                </div>
                <div className="hero-stat-card">
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Status</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--accent-gold)' }}>PENDING REVIEW</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <section style={{ padding: '32px', background: 'var(--bg-secondary)', borderRadius: '24px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--brand-gradient)' }}></div>
                        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            AI Intelligence Narrative
                        </h3>
                        <p style={{ fontSize: '16px', lineHeight: '1.7', color: 'var(--text-primary)' }}>{narrative}</p>
                    </section>

                    <section className="card pattern-panel">
                        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pattern Recognition</h3>
                        <p className="text-muted" style={{ marginBottom: '12px' }}>{detection_summary}</p>
                        <div className="pattern-signature">
                            {pattern_signature.map((pattern, idx) => (
                                <div key={idx} className="pattern-chip">{pattern}</div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                            Execution Protocol
                        </h3>
                        <ActionPanel
                            severity={severity}
                            allowedActions={investigation.allowed_actions}
                            alertId={alert.alert_id}
                            onExecute={async (actions) => {
                                try {
                                    await api.post(`/investigations/${investigation.investigation_id}/actions`, {
                                        action_type: 'batch_actions',
                                        action_details: JSON.stringify({
                                            actions,
                                            severity,
                                        }),
                                    });
                                } catch (error) {
                                    console.error('Failed to record executed actions', error);
                                }
                            }}
                        />
                    </section>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <section>
                        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                            Investigation Timeline
                        </h3>
                        <Timeline events={timeline} />
                    </section>

                    <NetworkPanel data={mockNetworkData} />
                </div>
            </div>
        </div>
    );
};

export default InvestigationView;
