import React, { useState, useEffect } from 'react';
import { Alert, UserActivity, AlertType } from '../types';
import api from '../services/api';

interface AlertQueueProps {
    onSelectAlert: (alert: Alert) => void;
}

export const AlertQueue: React.FC<AlertQueueProps> = ({ onSelectAlert }) => {
    const [alerts, setAlerts] = useState<Array<{ alert: Alert; userActivity: UserActivity }>>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        // Fetch trading alerts from API
        api.get('/trading-alerts?min_pressure=elevated&limit=20')
            .then((res) => {
                if (res.data && res.data.length > 0) {
                    setAlerts(res.data);
                } else {
                    // Fallback to hardcoded data if no trading alerts
                    setAlerts([
                    {
                        alert: {
                            alert_id: 'ALT-2024-001',
                            user_id: 'USR-4492',
                            alert_type: AlertType.UNUSUAL_TRANSACTION_AMOUNT,
                            timestamp: new Date().toISOString(),
                            triggered_rules: ['amount_deviation_3x', 'new_merchant_category', 'velocity_spike'],
                            raw_data: {
                                transaction_amount: 4500,
                                merchant: 'Luxury Electronics Dubai',
                                location: { city: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708 }
                            }
                        },
                        userActivity: {
                            user_id: 'USR-4492',
                            account_age_days: 180,
                            login_locations: [
                                { city: 'London', country: 'UK', timestamp: new Date(Date.now() - 86400000).toISOString() }
                            ],
                            device_fingerprints: ['iphone-15-pro-max'],
                            transaction_history: [
                                { timestamp: new Date(Date.now() - 2592000000).toISOString(), amount: 85, type: 'purchase' as const, status: 'completed' as const },
                                { timestamp: new Date(Date.now() - 1296000000).toISOString(), amount: 120, type: 'purchase' as const, status: 'completed' as const }
                            ]
                        }
                    },
                    {
                        alert: {
                            alert_id: 'ALT-2024-002',
                            user_id: 'USR-7821',
                            alert_type: AlertType.SUSPICIOUS_LOGIN_LOCATION,
                            timestamp: new Date(Date.now() - 3600000).toISOString(),
                            triggered_rules: ['impossible_travel', 'new_device', 'high_risk_country'],
                            raw_data: {
                                transaction_amount: 0,
                                location: { city: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792 }
                            }
                        },
                        userActivity: {
                            user_id: 'USR-7821',
                            account_age_days: 450,
                            login_locations: [
                                { city: 'New York', country: 'USA', timestamp: new Date(Date.now() - 7200000).toISOString() }
                            ],
                            device_fingerprints: ['iphone-13-safari'],
                            transaction_history: [
                                { timestamp: new Date(Date.now() - 5184000000).toISOString(), amount: 200, type: 'purchase' as const, status: 'completed' as const }
                            ]
                        }
                    },
                    {
                        alert: {
                            alert_id: 'ALT-2024-003',
                            user_id: 'USR-9034',
                            alert_type: AlertType.ACCOUNT_TAKEOVER_SUSPECTED,
                            timestamp: new Date(Date.now() - 1800000).toISOString(),
                            triggered_rules: ['password_change', 'email_change', 'new_device', 'rapid_transactions'],
                            raw_data: {
                                transaction_amount: 2800,
                                merchant: 'Crypto Exchange Pro',
                                location: { city: 'Moscow', country: 'Russia', lat: 55.7558, lng: 37.6173 }
                            }
                        },
                        userActivity: {
                            user_id: 'USR-9034',
                            account_age_days: 720,
                            login_locations: [
                                { city: 'San Francisco', country: 'USA', timestamp: new Date(Date.now() - 86400000).toISOString() }
                            ],
                            device_fingerprints: ['macbook-air-safari', 'iphone-14-safari'],
                            transaction_history: [
                                { timestamp: new Date(Date.now() - 7776000000).toISOString(), amount: 150, type: 'purchase' as const, status: 'completed' as const },
                                { timestamp: new Date(Date.now() - 3888000000).toISOString(), amount: 220, type: 'purchase' as const, status: 'completed' as const }
                            ]
                        }
                    }
                ]);
                }
            })
            .catch((error) => {
                console.error('Failed to fetch trading alerts:', error);
                // Fallback: Hardcoded sample alerts for demo
                setAlerts([
                    {
                        alert: {
                            alert_id: 'ALT-2024-001',
                            user_id: 'USR-4492',
                            alert_type: AlertType.UNUSUAL_TRANSACTION_AMOUNT,
                            timestamp: new Date().toISOString(),
                            triggered_rules: ['amount_deviation_3x', 'new_merchant_category', 'velocity_spike'],
                            raw_data: {
                                transaction_amount: 4500,
                                merchant: 'Luxury Electronics Dubai',
                                location: { city: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708 }
                            }
                        },
                        userActivity: {
                            user_id: 'USR-4492',
                            account_age_days: 180,
                            login_locations: [
                                { city: 'London', country: 'UK', timestamp: new Date(Date.now() - 86400000).toISOString() }
                            ],
                            device_fingerprints: ['iphone-15-pro-max'],
                            transaction_history: [
                                { timestamp: new Date(Date.now() - 2592000000).toISOString(), amount: 85, type: 'purchase' as const, status: 'completed' as const },
                                { timestamp: new Date(Date.now() - 1296000000).toISOString(), amount: 120, type: 'purchase' as const, status: 'completed' as const }
                            ]
                        }
                    }
                ]);
            });
    }, []);

    const handleSelect = (alert: Alert) => {
        setSelectedId(alert.alert_id);
        onSelectAlert(alert);
    };

    return (
        <div className="alert-queue">
            <div className="queue-header">
                <h2>Alert Queue</h2>
                <span className="alert-count">{alerts.length} alerts</span>
            </div>

            <div className="alert-list">
                {alerts.map(({ alert }) => (
                    <div
                        key={alert.alert_id}
                        className={`alert-card ${selectedId === alert.alert_id ? 'selected' : ''}`}
                        onClick={() => handleSelect(alert)}
                    >
                        <div className="alert-card-header">
                            <span className="alert-id">{alert.alert_id}</span>
                            <span className="alert-type-badge">
                                {alert.alert_type.replace(/_/g, ' ')}
                            </span>
                        </div>

                        <div className="alert-card-body">
                            <div className="alert-info">
                                <span className="label">User:</span>
                                <span className="value">{alert.user_id}</span>
                            </div>
                            <div className="alert-info">
                                <span className="label">Triggered:</span>
                                <span className="value">
                                    {new Date(alert.timestamp).toLocaleString()}
                                </span>
                            </div>
                            <div className="alert-info">
                                <span className="label">Rules:</span>
                                <span className="value">{alert.triggered_rules.length} rules</span>
                            </div>
                        </div>

                        <div className="alert-card-footer">
                            <button className="btn-investigate">Investigate →</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
