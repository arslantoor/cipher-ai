import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import api from './services/api';
import { Alert, Investigation, UserActivity, TradingInsight } from './types';
import Login from './pages/Login';
import { AlertQueue } from './components/AlertQueue';
import InvestigationView from './components/InvestigationView';
import { AutonomousInsights } from './components/AutonomousInsights';
import { InsightView } from './components/InsightView';
import { ContentStudio } from './components/ContentStudio';
import { AutonomousModeIndicator } from './components/AutonomousModeIndicator';
import CreateAlertModal from './components/CreateAlertModal';
import WhatsAppSettings from './components/WhatsAppSettings';
import './styles/noir.css';

const App: React.FC = () => {
    const { user, loading, logout } = useAuth();
    const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
    const [investigation, setInvestigation] = useState<Investigation | null>(null);
    const [selectedInsight, setSelectedInsight] = useState<TradingInsight | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showContentStudio, setShowContentStudio] = useState(false);
    const [view, setView] = useState<'trading' | 'queue' | 'admin' | 'whatsapp'>('trading');
    const [isInvestigating, setIsInvestigating] = useState(false);

    const fetchUserActivity = async (userId: string): Promise<UserActivity | null> => {
        try {
            const res = await api.get(`/user-activity/${userId}`);
            return res.data as UserActivity;
        } catch (error) {
            console.warn('No historical activity found for', userId, error);
            return null;
        }
    };

    const buildDefaultActivity = (alert: Alert): UserActivity => ({
        user_id: alert.user_id,
        account_age_days: 180,
        login_locations: [
            { city: 'London', country: 'UK', timestamp: '2024-01-20T10:00:00Z' }
        ],
        device_fingerprints: ['iphone-15-pro-max'],
        transaction_history: [
            { timestamp: '2024-01-01T12:00:00Z', amount: 50, type: 'purchase', status: 'completed' },
            { timestamp: '2024-01-15T15:30:00Z', amount: 120, type: 'purchase', status: 'completed' }
        ]
    });

    const handleSelectAlert = async (alert: Alert) => {
        setSelectedAlert(alert);
        setIsInvestigating(true);
        setInvestigation(null);

        try {
            const historicalActivity = await fetchUserActivity(alert.user_id);
            const userActivity = historicalActivity || buildDefaultActivity(alert);

            const res = await api.post('/investigate', {
                alert,
                user_activity: userActivity
            });

            setInvestigation(res.data);
        } catch (err) {
            console.error('Investigation failed', err);
        } finally {
            setIsInvestigating(false);
        }
    };

    if (loading) {
        return (
            <div className="auth-container">
                <div style={{ textAlign: 'center' }}>
                    <div className="brand-icon" style={{ margin: '0 auto 24px', width: '48px', height: '48px' }}>C</div>
                    <p style={{ color: 'var(--text-muted)' }}>Initializing Secure Session...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Login onSuccess={() => window.location.reload()} />;
    }

    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="brand">
                    <div className="brand-icon">C</div>
                    <div className="brand-text">
                        <h2>CipherScan AI</h2>
                        <span>Intelligent Trading Analyst</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <a href="#" className={`nav-link ${view === 'trading' ? 'active' : ''}`} onClick={() => { setView('trading'); setSelectedInsight(null); setSelectedAlert(null); }}>
                        <span style={{ fontSize: '18px' }}>📈</span> Trading Insights
                    </a>
                    <a href="#" className={`nav-link ${view === 'queue' ? 'active' : ''}`} onClick={() => { setView('queue'); setSelectedInsight(null); }}>
                        <span style={{ fontSize: '18px' }}>🛡️</span> Investigation Queue
                    </a>
                    {user.role === 'admin' && (
                        <>
                            <a href="#" className={`nav-link ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>
                                <span style={{ fontSize: '18px' }}>👤</span> User Management
                            </a>
                            <a href="#" className={`nav-link ${view === 'whatsapp' ? 'active' : ''}`} onClick={() => setView('whatsapp')}>
                                <span style={{ fontSize: '18px' }}>📱</span> WhatsApp Settings
                            </a>
                        </>
                    )}
                    {(user.role === 'admin' || user.role === 'senior_analyst') && (
                        <a href="#" className="nav-link">
                            <span style={{ fontSize: '18px' }}>📜</span> Audit Logs
                        </a>
                    )}
                    <a href="#" className="nav-link">
                        <span style={{ fontSize: '18px' }}>📊</span> Analytics
                    </a>
                </nav>

                <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: 'var(--brand-gradient)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: '700', fontSize: '14px'
                        }}>
                            {user.full_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: '600' }}>{user.full_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                {user.role.replace('_', ' ')}
                            </div>
                        </div>
                    </div>
                    <button onClick={logout} className="btn-ghost" style={{ width: '100%' }}>
                        Sign Out
                    </button>
                </div>
            </aside>

            <header className="header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <h1 style={{ fontSize: '20px', fontWeight: '600' }}>
                        {view === 'trading' ? 'Autonomous Trading Intelligence' : 
                         view === 'queue' ? 'Active Investigation Queue' : 
                         view === 'whatsapp' ? 'WhatsApp Alert Configuration' :
                         'Admin Console'}
                    </h1>
                    {view === 'queue' && (
                        <button
                            className="login-btn"
                            style={{ padding: '10px 20px', fontSize: '14px' }}
                            onClick={() => setShowCreateModal(true)}
                        >
                            + Create Alert
                        </button>
                    )}
                    {view === 'trading' && selectedInsight && (
                        <button
                            className="btn-ghost"
                            style={{ padding: '10px 20px', fontSize: '14px' }}
                            onClick={() => setShowContentStudio(true)}
                        >
                            📝 Create Content
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {view === 'trading' && <AutonomousModeIndicator />}
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        System: <span style={{ color: 'var(--brand-cyan)' }}>● Operational</span>
                    </div>
                </div>
            </header>

            <main className="main-content">
                {view === 'trading' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '32px', height: '100%' }}>
                        <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '32px', overflowY: 'auto' }}>
                            <AutonomousInsights
                                onSelectInsight={(insight) => setSelectedInsight(insight)}
                                selectedInsightId={selectedInsight?.insight_id}
                            />
                        </div>

                        <div style={{ overflowY: 'auto' }}>
                            {selectedInsight ? (
                                <InsightView
                                    insight={selectedInsight}
                                    isLoading={false}
                                />
                            ) : (
                                <div style={{
                                    height: '100%', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', flexDirection: 'column', gap: '24px'
                                }}>
                                    <div style={{
                                        width: '120px', height: '120px', background: 'var(--brand-gradient)',
                                        opacity: 0.15, borderRadius: '50%', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <span style={{ fontSize: '48px' }}>📊</span>
                                    </div>
                                    <h2 className="text-gradient" style={{ fontSize: '24px' }}>Select an insight to explore</h2>
                                    <p style={{ color: 'var(--text-muted)' }}>Autonomous analysis runs continuously in the background.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : view === 'whatsapp' ? (
                    <WhatsAppSettings />
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '32px', height: '100%' }}>
                        <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '32px', overflowY: 'auto' }}>
                            <AlertQueue
                                onSelectAlert={(alert) => handleSelectAlert(alert)}
                            />
                        </div>

                        <div style={{ overflowY: 'auto' }}>
                            {selectedAlert ? (
                                <InvestigationView
                                    investigation={investigation}
                                    isLoading={isInvestigating}
                                />
                            ) : (
                                <div style={{
                                    height: '100%', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', flexDirection: 'column', gap: '24px'
                                }}>
                                    <div style={{
                                        width: '120px', height: '120px', background: 'var(--brand-gradient)',
                                        opacity: 0.15, borderRadius: '50%', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <span style={{ fontSize: '48px' }}>🔍</span>
                                    </div>
                                    <h2 className="text-gradient" style={{ fontSize: '24px' }}>Select an alert to begin</h2>
                                    <p style={{ color: 'var(--text-muted)' }}>CipherScan AI is standing by for pattern analysis.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {showCreateModal && (
                <CreateAlertModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => window.location.reload()}
                />
            )}

            {showContentStudio && selectedInsight && (
                <ContentStudio
                    insight={selectedInsight}
                    onClose={() => setShowContentStudio(false)}
                />
            )}
        </div>
    );
};

export default App;
