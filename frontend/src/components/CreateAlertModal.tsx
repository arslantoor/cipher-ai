import React, { useState } from 'react';
import api from '../services/api';
import { Alert, AlertType } from '../types';

interface CreateAlertModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const CreateAlertModal: React.FC<CreateAlertModalProps> = ({ onClose, onSuccess }) => {
    const [userId, setUserId] = useState('');
    const [alertType, setAlertType] = useState('money_laundering');
    const [amount, setAmount] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const [rules, setRules] = useState('high_velocity');
    // Trading-specific fields
    const [instrument, setInstrument] = useState('EURUSD');
    const [pressureLevel, setPressureLevel] = useState('high_pressure');
    const [pressureScore, setPressureScore] = useState('70');
    const [isLoading, setIsLoading] = useState(false);

    const isTradingAlert = alertType === AlertType.BAD_TRADING_PATTERN || alertType === AlertType.SUSPICIOUS_TRADING;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const rawData: any = isTradingAlert
            ? {
                instrument,
                pressure_level: pressureLevel,
                pressure_score: parseFloat(pressureScore),
                behavior_factors: {
                    trade_frequency_spike: rules.includes('trade_frequency_spike') ? 2.0 : 1.0,
                    position_size_deviation: rules.includes('position_size_deviation') ? 2.5 : 1.0,
                    loss_clustering: rules.includes('loss_clustering') ? 0.6 : 0.0,
                    unusual_hours: rules.includes('unusual_hours') ? 1 : 0,
                    short_intervals: rules.includes('short_intervals') ? 1 : 0,
                },
            }
            : {
                transaction_amount: parseFloat(amount) || 0,
                location: { city, country, lat: 0, lng: 0 }
            };

        const newAlert: Omit<Alert, 'alert_id'> = {
            user_id: userId,
            alert_type: alertType as any,
            timestamp: new Date().toISOString(),
            triggered_rules: rules.split(',').map(r => r.trim()),
            raw_data: rawData,
        };

        try {
            await api.post('/alerts', newAlert);
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            alert('Failed to create alert');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create Manual Alert</h2>
                    <p className="modal-subtitle">
                        {isTradingAlert 
                            ? 'Manually trigger a trading pattern investigation for a trader.'
                            : 'Manually trigger a fraud investigation for a user.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-grid">
                        <div className="input-group">
                            <label htmlFor="userId">User ID</label>
                            <input
                                id="userId"
                                value={userId}
                                onChange={e => setUserId(e.target.value)}
                                placeholder="e.g. USR-001"
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="alertType">Alert Type</label>
                            <select
                                id="alertType"
                                className="select-input"
                                value={alertType}
                                onChange={e => setAlertType(e.target.value)}
                                title="Select alert type"
                            >
                                <optgroup label="Fraud Alerts">
                                    <option value="money_laundering">Money Laundering</option>
                                    <option value="account_takeover">Account Takeover</option>
                                    <option value="unusual_transaction_amount">Unusual Transaction Amount</option>
                                    <option value="suspicious_login_location">Suspicious Login Location</option>
                                </optgroup>
                                <optgroup label="Trading Pattern Alerts">
                                    <option value={AlertType.BAD_TRADING_PATTERN}>Bad Trading Pattern</option>
                                    <option value={AlertType.SUSPICIOUS_TRADING}>Suspicious Trading</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>

                    {isTradingAlert ? (
                        <>
                            <div className="form-grid">
                                <div className="input-group">
                                    <label htmlFor="instrument">Instrument</label>
                                    <select
                                        id="instrument"
                                        className="select-input"
                                        value={instrument}
                                        onChange={e => setInstrument(e.target.value)}
                                    >
                                        <option value="EURUSD">EUR/USD</option>
                                        <option value="GBPUSD">GBP/USD</option>
                                        <option value="USDJPY">USD/JPY</option>
                                        <option value="BTCUSD">BTC/USD</option>
                                        <option value="XAUUSD">XAU/USD (Gold)</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label htmlFor="pressureLevel">Pressure Level</label>
                                    <select
                                        id="pressureLevel"
                                        className="select-input"
                                        value={pressureLevel}
                                        onChange={e => setPressureLevel(e.target.value)}
                                    >
                                        <option value="stable">Stable</option>
                                        <option value="elevated">Elevated</option>
                                        <option value="high_pressure">High Pressure</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="input-group">
                                    <label htmlFor="pressureScore">Pressure Score (0-100)</label>
                                    <input
                                        id="pressureScore"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={pressureScore}
                                        onChange={e => setPressureScore(e.target.value)}
                                        placeholder="70"
                                        required
                                    />
                                </div>
                                <div className="input-group">
                                    <label htmlFor="rules">Triggered Rules</label>
                                    <input
                                        id="rules"
                                        value={rules}
                                        onChange={e => setRules(e.target.value)}
                                        placeholder="trade_frequency_spike, loss_clustering, position_size_deviation"
                                    />
                                    <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                        Common: trade_frequency_spike, loss_clustering, position_size_deviation, unusual_hours, short_intervals
                                    </small>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="form-grid">
                                <div className="input-group">
                                    <label htmlFor="amount">Transaction Amount ($)</label>
                                    <input
                                        id="amount"
                                        type="number"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                                <div className="input-group">
                                    <label htmlFor="rules">Triggered Rules</label>
                                    <input
                                        id="rules"
                                        value={rules}
                                        onChange={e => setRules(e.target.value)}
                                        placeholder="e.g. rule1, rule2"
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="input-group">
                                    <label htmlFor="city">City</label>
                                    <input
                                        id="city"
                                        value={city}
                                        onChange={e => setCity(e.target.value)}
                                        placeholder="New York"
                                    />
                                </div>
                                <div className="input-group">
                                    <label htmlFor="country">Country</label>
                                    <input
                                        id="country"
                                        value={country}
                                        onChange={e => setCountry(e.target.value)}
                                        placeholder="USA"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div className="modal-actions">
                        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="login-btn" disabled={isLoading}>
                            {isLoading ? 'Processing...' : 'Generate Alert'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateAlertModal;
