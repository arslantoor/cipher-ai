import React from 'react';
import { SeverityLevel } from '../types';

interface SeverityBadgeProps {
    severity?: SeverityLevel;
    level?: SeverityLevel;
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, level }) => {
    const severityLevel = severity || level || 'low';
    return (
        <div className={`badge badge-${severityLevel}`}>
            {severityLevel.toUpperCase()}
        </div>
    );
};

export default SeverityBadge;
