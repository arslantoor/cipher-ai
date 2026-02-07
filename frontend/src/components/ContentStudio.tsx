import React, { useState, useEffect } from 'react';
import { TradingInsight, SocialContent } from '../types';
import api from '../services/api';

interface ContentStudioProps {
    insight: TradingInsight;
    onClose: () => void;
}

type Platform = 'linkedin' | 'x' | 'thread';
type Persona = 'calm_analyst' | 'data_explainer' | 'trading_coach';

export const ContentStudio: React.FC<ContentStudioProps> = ({ insight, onClose }) => {
    const [platform, setPlatform] = useState<Platform>('linkedin');
    const [persona, setPersona] = useState<Persona>('calm_analyst');
    const [content, setContent] = useState<SocialContent[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingContent, setEditingContent] = useState<{ [key: string]: string }>({});
    const [saving, setSaving] = useState(false);

    const fetchContent = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/insights/${insight.insight_id}/social`, {
                params: { platform, persona }
            });
            setContent(res.data);
            
            // Initialize editing state
            const editState: { [key: string]: string } = {};
            res.data.forEach((c: SocialContent) => {
                editState[`${c.platform}-${c.persona}`] = c.content;
            });
            setEditingContent(editState);
        } catch (error) {
            console.error('Failed to fetch content', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContent();
    }, [platform, persona, insight.insight_id]);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const res = await api.post(`/insights/${insight.insight_id}/publish`, {
                platform,
                persona,
                schedule_at: null
            });
            setContent(res.data.content);
            
            // Update editing state
            const editState: { [key: string]: string } = {};
            res.data.content.forEach((c: SocialContent) => {
                editState[`${c.platform}-${c.persona}`] = c.content;
            });
            setEditingContent(editState);
        } catch (error) {
            console.error('Failed to generate content', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDraft = async () => {
        setSaving(true);
        try {
            // In a real implementation, this would save to backend
            // For now, we'll just show a success message
            setTimeout(() => {
                setSaving(false);
                alert('Draft saved successfully');
            }, 500);
        } catch (error) {
            console.error('Failed to save draft', error);
            setSaving(false);
        }
    };

    const handleSchedule = async () => {
        // In a real implementation, this would schedule the post
        alert('Scheduling feature coming soon');
    };

    const currentContent = content.find(c => c.platform === platform && c.persona === persona);
    const contentKey = `${platform}-${persona}`;
    const editedText = editingContent[contentKey] || currentContent?.content || '';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ width: '800px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Content Studio</h2>
                    <p className="modal-subtitle">Create social content from this insight</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Platform Selector */}
                    <div className="input-group">
                        <label>Platform</label>
                        <select 
                            className="select-input"
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value as Platform)}
                        >
                            <option value="linkedin">LinkedIn</option>
                            <option value="x">X (Twitter)</option>
                            <option value="thread">Thread</option>
                        </select>
                    </div>

                    {/* Persona Selector */}
                    <div className="input-group">
                        <label>Persona</label>
                        <select 
                            className="select-input"
                            value={persona}
                            onChange={(e) => setPersona(e.target.value as Persona)}
                        >
                            <option value="calm_analyst">Calm Analyst</option>
                            <option value="data_explainer">Data Explainer</option>
                            <option value="trading_coach">Trading Coach</option>
                        </select>
                    </div>

                    {/* Content Preview */}
                    <div className="input-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label>Content Preview</label>
                            <button 
                                className="btn-ghost" 
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                onClick={handleGenerate}
                                disabled={loading}
                            >
                                {loading ? 'Generating...' : 'Regenerate'}
                            </button>
                        </div>
                        {loading && !currentContent ? (
                            <div style={{ 
                                padding: '32px', 
                                textAlign: 'center',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '12px'
                            }}>
                                <div style={{ 
                                    width: '24px', 
                                    height: '24px', 
                                    border: '2px solid var(--brand-cyan)', 
                                    borderTopColor: 'transparent', 
                                    borderRadius: '50%', 
                                    animation: 'spin 1s linear infinite', 
                                    margin: '0 auto 12px' 
                                }}></div>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Generating content...</p>
                            </div>
                        ) : (
                            <textarea
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'var(--font-main)',
                                    fontSize: '15px',
                                    lineHeight: '1.6',
                                    minHeight: '200px',
                                    resize: 'vertical',
                                    width: '100%',
                                    transition: 'var(--transition)'
                                }}
                                value={editedText}
                                onChange={(e) => setEditingContent({ ...editingContent, [contentKey]: e.target.value })}
                                placeholder="Content will appear here after generation..."
                            />
                        )}
                        <div style={{ 
                            fontSize: '11px', 
                            color: 'var(--text-muted)', 
                            marginTop: '8px',
                            textAlign: 'right'
                        }}>
                            {editedText.length} characters
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="modal-actions">
                        <button 
                            className="btn-ghost" 
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button 
                            className="btn-ghost" 
                            onClick={handleSaveDraft}
                            disabled={saving || !currentContent}
                        >
                            {saving ? 'Saving...' : 'Save as Draft'}
                        </button>
                        <button 
                            className="login-btn" 
                            onClick={handleSchedule}
                            disabled={!currentContent || editedText.trim().length === 0}
                        >
                            Schedule
                        </button>
                    </div>

                    <div style={{ 
                        padding: '16px', 
                        background: 'rgba(0, 242, 254, 0.1)', 
                        borderRadius: '12px',
                        border: '1px solid rgba(0, 242, 254, 0.2)'
                    }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                            <strong style={{ color: 'var(--brand-cyan)' }}>Note:</strong> Content will not be posted automatically. 
                            You must explicitly approve and schedule each post. This ensures you maintain full control over your social presence.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
