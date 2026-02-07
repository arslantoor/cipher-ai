export const SEVERITY_THRESHOLDS = {
    low: 0,
    medium: 120,
    high: 180,
    critical: 240,
} as const;

export const ACTION_RULES: Record<string, string[]> = {
    low: [
        "Flag for monitoring",
        "Add to watchlist",
        "Log activity",
    ],
    medium: [
        "Flag for monitoring",
        "Add to watchlist",
        "Log activity",
        "Request verification",
        "Limit transaction amounts",
    ],
    high: [
        "Flag for monitoring",
        "Add to watchlist",
        "Log activity",
        "Request verification",
        "Limit transaction amounts",
        "Temporary account restriction",
        "Escalate to senior analyst",
    ],
    critical: [
        "Flag for monitoring",
        "Add to watchlist",
        "Log activity",
        "Request verification",
        "Limit transaction amounts",
        "Temporary account restriction",
        "Escalate to senior analyst",
        "Suspend account",
        "Contact user immediately",
        "File suspicious activity report",
    ],
};

export const DEVIATION_MULTIPLIERS = {
    amount_5x: 2.0,
    amount_10x: 3.0,
    new_location: 1.8,
    new_device: 1.5,
    unusual_time: 1.5,
    new_account: 1.3,
    high_velocity: 2.2,
} as const;
