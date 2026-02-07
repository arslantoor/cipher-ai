import React from 'react';
import { TimelineEvent } from '../types';

interface TimelineProps {
    events: TimelineEvent[];
}

export const Timeline: React.FC<TimelineProps> = ({ events }) => {
    return (
        <div className="timeline">
            {events.map((event, idx) => (
                <div key={idx} className="timeline-event">
                    <div className={`timeline-marker ${event.severity}`}></div>
                    <div className="timeline-content">
                        <div className="timeline-time">
                            {new Date(event.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="timeline-event-text">{event.event}</div>
                        {event.details && (
                            <div className="timeline-details">{event.details}</div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
