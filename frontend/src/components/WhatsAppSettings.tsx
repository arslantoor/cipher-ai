// WhatsApp Settings Agent - Frontend component for managing WhatsApp alert configuration
// Agent Role: WhatsAppSettingsAgent
// Purpose: Autonomously manage the frontend interface for WhatsApp alert configuration
import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface WhatsAppNumber {
    id: string;
    number: string;
    enabled: boolean;
}

interface WhatsAppConfig {
    numbers: WhatsAppNumber[];
    enabled: boolean;
}

const WhatsAppSettings: React.FC = () => {
    const [config, setConfig] = useState<WhatsAppConfig>({ numbers: [], enabled: true });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [newNumber, setNewNumber] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    // Fetch current configuration
    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await api.get('/settings/whatsapp');
            setConfig(res.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load WhatsApp settings');
        } finally {
            setLoading(false);
        }
    };

    // Validate E.164 phone number format
    const validatePhoneNumber = (phone: string): { valid: boolean; error?: string; normalized?: string } => {
        // Remove all non-digit characters except +
        const cleaned = phone.trim();
        
        // E.164 format: +[country code][number] (max 15 digits total)
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        
        // Try to normalize: remove spaces, dashes, parentheses
        let normalized = cleaned.replace(/[\s\-\(\)]/g, '');
        
        // If doesn't start with +, try to add country code
        if (!normalized.startsWith('+')) {
            // Assume US if 10 digits
            if (/^\d{10}$/.test(normalized)) {
                normalized = `+1${normalized}`;
            } else if (/^\d{11}$/.test(normalized) && normalized.startsWith('1')) {
                normalized = `+${normalized}`;
            } else {
                return {
                    valid: false,
                    error: 'Phone number must include country code (e.g., +1234567890)',
                };
            }
        }

        if (!e164Regex.test(normalized)) {
            return {
                valid: false,
                error: 'Invalid phone number format. Use E.164 format: +[country code][number]',
            };
        }

        // Check length (E.164 max 15 digits after +)
        const digitsAfterPlus = normalized.substring(1);
        if (digitsAfterPlus.length < 7 || digitsAfterPlus.length > 15) {
            return {
                valid: false,
                error: 'Phone number must be 7-15 digits (excluding country code)',
            };
        }

        return {
            valid: true,
            normalized,
        };
    };

    // Add new WhatsApp number
    const handleAddNumber = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        const validation = validatePhoneNumber(newNumber);
        if (!validation.valid) {
            setError(validation.error || 'Invalid phone number');
            return;
        }

        try {
            await api.post('/settings/whatsapp', {
                number: validation.normalized,
            });

            setSuccess(`Phone number ${maskNumber(validation.normalized!)} added successfully`);
            setNewNumber('');
            await fetchConfig();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to add phone number');
        }
    };

    // Update existing number
    const handleUpdateNumber = async (id: string) => {
        setError(null);
        setSuccess(null);

        const validation = validatePhoneNumber(editValue);
        if (!validation.valid) {
            setError(validation.error || 'Invalid phone number');
            return;
        }

        try {
            await api.patch(`/settings/whatsapp/${id}`, {
                number: validation.normalized,
            });

            setSuccess(`Phone number updated successfully`);
            setEditingId(null);
            setEditValue('');
            await fetchConfig();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update phone number');
        }
    };

    // Remove number
    const handleRemoveNumber = async (id: string) => {
        if (!confirm('Are you sure you want to remove this phone number?')) {
            return;
        }

        setError(null);
        setSuccess(null);

        try {
            await api.delete(`/settings/whatsapp/${id}`);
            setSuccess('Phone number removed successfully');
            await fetchConfig();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to remove phone number');
        }
    };

    // Toggle global WhatsApp notifications
    const handleToggleEnabled = async () => {
        setError(null);
        setSuccess(null);

        try {
            await api.patch('/settings/whatsapp/enabled', {
                enabled: !config.enabled,
            });

            setConfig({ ...config, enabled: !config.enabled });
            setSuccess(`WhatsApp notifications ${!config.enabled ? 'enabled' : 'disabled'}`);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update settings');
        }
    };

    // Mask phone number for display (secure handling)
    const maskNumber = (number: string): string => {
        if (!number || number.length <= 4) return '***';
        // Show country code and last 2 digits, mask the rest
        if (number.startsWith('+') && number.length > 6) {
            const countryCode = number.substring(0, 3); // +12
            const lastTwo = number.substring(number.length - 2);
            return `${countryCode}****${lastTwo}`;
        }
        return `${number.substring(0, number.length - 4)}****`;
    };

    if (loading) {
        return (
            <div className="panel">
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ color: 'var(--text-muted)' }}>Loading WhatsApp settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="panel">
            <div className="panel-header">
                <h2>WhatsApp Alert Configuration</h2>
                <p className="panel-subtitle">
                    Manage phone numbers that receive fraud investigation notifications
                </p>
            </div>

            {/* Global Toggle */}
            <div className="setting-item">
                <div className="setting-label">
                    <label>WhatsApp Notifications</label>
                    <span className="setting-description">
                        Enable or disable WhatsApp notifications globally
                    </span>
                </div>
                <div className="toggle-switch">
                    <input
                        type="checkbox"
                        id="whatsapp-enabled"
                        checked={config.enabled}
                        onChange={handleToggleEnabled}
                    />
                    <label htmlFor="whatsapp-enabled" className="toggle-label">
                        <span className="toggle-slider"></span>
                    </label>
                </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="alert alert-error" style={{ marginBottom: '20px' }}>
                    <span>⚠️</span> {error}
                </div>
            )}
            {success && (
                <div className="alert alert-success" style={{ marginBottom: '20px' }}>
                    <span>✓</span> {success}
                </div>
            )}

            {/* Add New Number Form */}
            <div className="section-divider"></div>
            <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
                Add Phone Number
            </h3>
            <form onSubmit={handleAddNumber} className="whatsapp-form">
                <div className="input-group">
                    <label htmlFor="new-number">Phone Number (E.164 format)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            id="new-number"
                            type="tel"
                            value={newNumber}
                            onChange={(e) => {
                                setNewNumber(e.target.value);
                                setError(null);
                            }}
                            placeholder="+1234567890"
                            pattern="^\+[1-9]\d{1,14}$"
                            style={{ flex: 1 }}
                        />
                        <button type="submit" className="btn-primary" disabled={!newNumber.trim()}>
                            Add
                        </button>
                    </div>
                    <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Format: +[country code][number] (e.g., +1234567890)
                    </small>
                </div>
            </form>

            {/* Existing Numbers List */}
            <div className="section-divider"></div>
            <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
                Configured Numbers ({config.numbers.length})
            </h3>

            {config.numbers.length === 0 ? (
                <div className="empty-state">
                    <p style={{ color: 'var(--text-muted)' }}>No phone numbers configured</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
                        Add a phone number above to start receiving WhatsApp notifications
                    </p>
                </div>
            ) : (
                <div className="numbers-list">
                    {config.numbers.map((item) => (
                        <div key={item.id} className="number-item">
                            {editingId === item.id ? (
                                <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                                    <input
                                        type="tel"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        placeholder="+1234567890"
                                        style={{ flex: 1 }}
                                        autoFocus
                                    />
                                    <button
                                        className="btn-primary"
                                        onClick={() => handleUpdateNumber(item.id)}
                                        disabled={!editValue.trim()}
                                    >
                                        Save
                                    </button>
                                    <button
                                        className="btn-ghost"
                                        onClick={() => {
                                            setEditingId(null);
                                            setEditValue('');
                                            setError(null);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '18px' }}>📱</span>
                                            <span style={{ fontFamily: 'var(--font-mono)' }}>
                                                {maskNumber(item.number)}
                                            </span>
                                            {item.enabled ? (
                                                <span className="badge badge-success">Active</span>
                                            ) : (
                                                <span className="badge badge-muted">Disabled</span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            className="btn-ghost"
                                            onClick={() => {
                                                setEditingId(item.id);
                                                setEditValue(item.number);
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn-danger"
                                            onClick={() => handleRemoveNumber(item.id)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Info Section */}
            <div className="section-divider"></div>
            <div className="info-box">
                <h4 style={{ marginBottom: '8px', fontSize: '16px' }}>About WhatsApp Notifications</h4>
                <ul style={{ marginLeft: '20px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.8' }}>
                    <li>Notifications are sent when fraud alerts are detected</li>
                    <li>Messages include alert ID, severity, risk score, and investigation summary</li>
                    <li>Phone numbers are stored securely and masked in logs</li>
                    <li>All notifications are logged for audit purposes</li>
                    <li>Use E.164 format: +[country code][number] (max 15 digits)</li>
                </ul>
            </div>
        </div>
    );
};

export default WhatsAppSettings;
