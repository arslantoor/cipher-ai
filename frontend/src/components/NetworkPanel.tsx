import React, { useState, useEffect } from 'react';

interface NetworkPanelProps {
    userId?: string;
    data?: {
        related_accounts: string[];
        shared_signals: string[];
        risk_score: number;
    };
}

interface RelatedAccount {
    user_id: string;
    connection_type: string;
    risk_score: number;
    shared_signals: string[];
}

export const NetworkPanel: React.FC<NetworkPanelProps> = ({ userId, data }) => {
    const [relatedAccounts, setRelatedAccounts] = useState<RelatedAccount[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // If data is provided directly, use it
        if (data) {
            setRelatedAccounts(
                data.related_accounts.map((accountId, idx) => ({
                    user_id: accountId,
                    connection_type: idx === 0 ? 'Shared Device' : 'Shared IP',
                    risk_score: Math.round(data.risk_score * 100),
                    shared_signals: data.shared_signals,
                }))
            );
            return;
        }

        // Otherwise, fetch mock data (simulating API call)
        setLoading(true);
        setTimeout(() => {
            setRelatedAccounts([
                {
                    user_id: 'USR-8821',
                    connection_type: 'Shared Device',
                    risk_score: 78,
                    shared_signals: ['device_fingerprint', 'login_timing'],
                },
                {
                    user_id: 'USR-9034',
                    connection_type: 'Shared IP',
                    risk_score: 65,
                    shared_signals: ['ip_address', 'geolocation'],
                },
            ]);
            setLoading(false);
        }, 1000);
    }, [userId, data]);

    if (loading) {
        return (
            <div className="card">
                <h3>Network Analysis</h3>
                <div className="skeleton" style={{ height: '100px' }}></div>
            </div>
        );
    }

    return (
        <div className="card network-panel">
            <h3>Network Analysis</h3>
            <p className="network-subtitle">
                {relatedAccounts.length} related account(s) detected
            </p>

            {relatedAccounts.length > 0 ? (
                <div className="network-list">
                    {relatedAccounts.map((account, idx) => (
                        <div key={idx} className="network-item">
                            <div className="network-header">
                                <span className="network-user">{account.user_id}</span>
                                <span className={`network-risk risk-${account.risk_score > 70 ? 'high' : 'medium'}`}>
                                    {account.risk_score}
                                </span>
                            </div>
                            <div className="network-connection">
                                {account.connection_type}
                            </div>
                            <div className="network-signals">
                                {account.shared_signals.map((signal, i) => (
                                    <span key={i} className="signal-badge">
                                        {signal.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-muted">No related accounts detected</p>
            )}
        </div>
    );
};
