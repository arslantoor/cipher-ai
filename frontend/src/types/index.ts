export enum AlertType {
    IDENTITY_FRAUD = "identity_fraud",
    ACCOUNT_TAKEOVER = "account_takeover",
    MONEY_LAUNDERING = "money_laundering",
    AFFILIATE_FRAUD = "affiliate_fraud",
    SUSPICIOUS_TRADING = "suspicious_trading",
    UNUSUAL_TRANSACTION_AMOUNT = "unusual_transaction_amount",
    SUSPICIOUS_LOGIN_LOCATION = "suspicious_login_location",
    ACCOUNT_TAKEOVER_SUSPECTED = "account_takeover_suspected",
    BAD_TRADING_PATTERN = "bad_trading_pattern",
}

export interface User {
    id: string;
    email: string;
    full_name: string;
    role: 'admin' | 'senior_analyst' | 'analyst';
    department?: string;
}

export enum SeverityLevel {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical",
}

export interface Alert {
    alert_id: string;
    user_id: string;
    alert_type: AlertType;
    timestamp: string;
    triggered_rules: string[];
    raw_data: {
        transaction_amount?: number;
        location?: {
            city: string;
            country: string;
            lat: number;
            lng: number;
        };
        device_fingerprint?: string;
        ip_address?: string;
        [key: string]: any;
    };
}

export interface Transaction {
    timestamp: string;
    amount: number;
    type: string;
    status: string;
}

export interface LoginLocation {
    city: string;
    country: string;
    timestamp: string;
}

export interface UserActivity {
    user_id: string;
    login_locations: LoginLocation[];
    device_fingerprints: string[];
    transaction_history: Transaction[];
    account_age_days: number;
}

export interface TimelineEvent {
    timestamp: string;
    event: string;
    severity: "alert" | "deviation" | "action";
    details?: string;
}

export interface SeverityJustification {
    base_score: number;
    deviation_multiplier: number;
    final_score: number;
    thresholds_used: Record<string, number>;
    triggered_deviations: string[];
}

export interface AuditTrail {
    timestamp: string;
    alert_id: string;
    user_id: string;
    severity_assigned: SeverityLevel;
    thresholds_applied: Record<string, number>;
    final_score: number;
    deviation_multiplier: number;
}

export interface Investigation {
    investigation_id: string;
    alert: Alert;
    user_activity: UserActivity;
    severity: SeverityLevel;
    timeline: TimelineEvent[];
    narrative: string;
    allowed_actions: string[];
    confidence_signals: SeverityJustification;
    audit_trail: AuditTrail;
    generated_at: string;
    pattern_signature: string[];
    detection_summary: string;
}

// Trading Intelligence Types
export interface Baseline {
    avg_transaction_amount: number;
    avg_transactions_per_day: number;
    typical_transaction_hours: number[];
    common_locations: string[];
    device_consistency: number;
    account_maturity: number;
}

export interface Deviation {
    amount_deviation?: {
        deviation: number;
        multiplier: number;
        baseline: number;
        current: number;
    };
    frequency_deviation?: {
        deviation: number;
        multiplier: number;
    };
    temporal_deviation?: {
        is_unusual_time: boolean;
        multiplier: number;
        current_hour: number;
        typical_hours: number[];
    };
    location_deviation?: {
        is_new_location: boolean;
        multiplier: number;
        current: string;
        common: string[];
    };
    device_deviation?: {
        is_new_device: boolean;
        multiplier: number;
    };
    new_account_flag?: boolean;
    velocity_flag?: boolean;
}

export interface MarketContext {
    instrument: string;
    movementType: 'sudden_spike' | 'gradual_trend' | 'volatility_regime_change' | 'session_anomaly' | 'normal';
    magnitude: number;
    timeframe: string;
    historicalContext: string;
    knownCatalysts?: string[];
    ohlc?: {
        open: number;
        high: number;
        low: number;
        close: number;
    };
    volatility?: number;
}

export enum BehavioralPressureLevel {
    STABLE = 'stable',
    ELEVATED = 'elevated',
    HIGH_PRESSURE = 'high_pressure',
    // Legacy support
    HIGH = 'high_pressure',
}

export interface BehavioralPressureScore {
    score: number;
    level: BehavioralPressureLevel;
    factors: {
        trade_frequency_spike: number;
        position_size_deviation: number;
        loss_clustering: number;
        unusual_hours: number;
        short_intervals: number;
    };
}

export interface TradingInsight {
    insight_id: string;
    trader_id: string;
    instrument: string;
    market_context: MarketContext;
    behaviour_context: {
        pressure_score: BehavioralPressureScore;
        deviations: Deviation;
        baseline: Baseline;
    };
    pressure_level: BehavioralPressureLevel;
    deterministic_score: number;
    narrative?: string;
    data_source_url?: string;
    data_source_type?: 'trading_platform' | 'market_data_feed' | 'manual_entry' | 'demo' | 'api';
    created_at: string;
}

export interface SocialContent {
    insight_id: string;
    platform: 'linkedin' | 'x' | 'thread';
    content: string;
    persona: 'calm_analyst' | 'data_explainer' | 'trading_coach';
    generated_at: string;
}
