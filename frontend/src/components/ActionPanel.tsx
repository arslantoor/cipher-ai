import React, { useState, useEffect } from 'react';
import { SeverityLevel } from '../types';

interface ActionPanelProps {
    severity: SeverityLevel;
    allowedActions?: string[];
    alertId?: string;
    onExecute?: (actions: string[]) => void;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
    severity,
    allowedActions = [],
    alertId = 'N/A',
    onExecute,
}) => {
    const [selectedActions, setSelectedActions] = useState<string[]>([]);

    useEffect(() => {
        setSelectedActions([]);
    }, [allowedActions]);

    const handleToggleAction = (action: string) => {
        setSelectedActions((prev) =>
            prev.includes(action)
                ? prev.filter((a) => a !== action)
                : [...prev, action]
        );
    };

    const handleExecute = () => {
        console.log('Executing actions:', selectedActions);
        if (onExecute) {
            onExecute(selectedActions);
        } else {
            alert(`Actions executed for alert ${alertId}:\n${selectedActions.join('\n')}`);
        }
    };

    return (
        <div className="card action-panel">
            <h3>Allowed Actions</h3>
            <p className="action-panel-subtitle">
                Based on <span className={`severity-${severity}`}>{severity.toUpperCase()}</span> severity
            </p>
            {allowedActions.length === 0 && (
                <p className="action-panel-note">
                    Allowed actions have not been configured yet; fall back to manual policy review.
                </p>
            )}

            <div className="action-list">
                {allowedActions.map((action, idx) => (
                    <label key={idx} className="action-item">
                        <input
                            type="checkbox"
                            checked={selectedActions.includes(action)}
                            onChange={() => handleToggleAction(action)}
                        />
                        <span className="action-text">{action}</span>
                    </label>
                ))}
            </div>

            <button
                className="btn btn-primary btn-block mt-3"
                onClick={handleExecute}
                disabled={selectedActions.length === 0}
            >
                Execute Selected Actions
            </button>
        </div>
    );
};
