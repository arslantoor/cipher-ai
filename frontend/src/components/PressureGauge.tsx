import React from 'react';
import { BehavioralPressureLevel } from '../types';

interface PressureGaugeProps {
    pressureLevel: BehavioralPressureLevel;
    score: number;
    size?: 'small' | 'medium' | 'large';
}

export const PressureGauge: React.FC<PressureGaugeProps> = ({ 
    pressureLevel, 
    score,
    size = 'medium' 
}) => {
    const sizeMap = {
        small: { width: '60px', height: '8px' },
        medium: { width: '120px', height: '12px' },
        large: { width: '180px', height: '16px' }
    };

    const dimensions = sizeMap[size];

    const getColor = (level: BehavioralPressureLevel) => {
        switch (level) {
            case BehavioralPressureLevel.STABLE:
                return 'var(--brand-cyan)';
            case BehavioralPressureLevel.ELEVATED:
                return 'var(--severity-medium)';
            case BehavioralPressureLevel.HIGH:
                return 'var(--severity-high)';
            default:
                return 'var(--brand-cyan)';
        }
    };

    const getGradient = (level: BehavioralPressureLevel) => {
        switch (level) {
            case BehavioralPressureLevel.STABLE:
                return 'linear-gradient(90deg, var(--brand-cyan) 0%, var(--brand-purple) 100%)';
            case BehavioralPressureLevel.ELEVATED:
                return 'linear-gradient(90deg, var(--severity-medium) 0%, var(--severity-high) 100%)';
            case BehavioralPressureLevel.HIGH:
                return 'linear-gradient(90deg, var(--severity-high) 0%, var(--severity-critical) 100%)';
            default:
                return 'var(--brand-gradient)';
        }
    };

    const fillPercentage = Math.min(100, Math.max(0, score));

    return (
        <div style={{ 
            position: 'relative',
            width: dimensions.width,
            height: dimensions.height,
            background: 'var(--bg-tertiary)',
            borderRadius: '999px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)'
        }}>
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${fillPercentage}%`,
                    background: getGradient(pressureLevel),
                    borderRadius: '999px',
                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: `0 0 ${size === 'large' ? '12px' : '8px'} ${getColor(pressureLevel)}40`
                }}
            />
        </div>
    );
};
