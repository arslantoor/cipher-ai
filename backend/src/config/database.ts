import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'cipherai.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize database schema
export function initializeDatabase() {
    db.exec(`
    -- Users table with role-based access
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'senior_analyst', 'analyst')),
      department TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until TEXT
    );

    -- Investigations table
    CREATE TABLE IF NOT EXISTS investigations (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      analyst_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('new', 'in_progress', 'resolved', 'escalated', 'closed')),
      narrative TEXT,
      confidence_score REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT,
      FOREIGN KEY (analyst_id) REFERENCES users(id)
    );

    -- Alerts table (encrypted sensitive data)
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      triggered_rules TEXT NOT NULL,
      raw_data_encrypted TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- User activity data (encrypted)
    CREATE TABLE IF NOT EXISTS user_activities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_age_days INTEGER,
      encrypted_data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Actions taken on investigations
    CREATE TABLE IF NOT EXISTS investigation_actions (
      id TEXT PRIMARY KEY,
      investigation_id TEXT NOT NULL,
      analyst_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_details TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (investigation_id) REFERENCES investigations(id),
      FOREIGN KEY (analyst_id) REFERENCES users(id)
    );

    -- Audit log for compliance
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Session management
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- System settings
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    );

    -- Trading insights table
    CREATE TABLE IF NOT EXISTS trading_insights (
      id TEXT PRIMARY KEY,
      trader_id TEXT NOT NULL,
      instrument TEXT NOT NULL,
      market_context TEXT NOT NULL,
      behaviour_context TEXT NOT NULL,
      pressure_level TEXT NOT NULL CHECK(pressure_level IN ('stable', 'elevated', 'high_pressure')),
      deterministic_score REAL NOT NULL,
      narrative TEXT,
      data_source_url TEXT,
      data_source_type TEXT CHECK(data_source_type IN ('trading_platform', 'market_data_feed', 'manual_entry', 'demo', 'api')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Social content table
    CREATE TABLE IF NOT EXISTS social_content (
      id TEXT PRIMARY KEY,
      insight_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('linkedin', 'x', 'thread')),
      content TEXT NOT NULL,
      persona TEXT NOT NULL CHECK(persona IN ('calm_analyst', 'data_explainer', 'trading_coach')),
      generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (insight_id) REFERENCES trading_insights(id)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_investigations_analyst ON investigations(analyst_id);
    CREATE INDEX IF NOT EXISTS idx_investigations_status ON investigations(status);
    CREATE INDEX IF NOT EXISTS idx_investigations_created ON investigations(created_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_trading_insights_trader ON trading_insights(trader_id);
    CREATE INDEX IF NOT EXISTS idx_trading_insights_instrument ON trading_insights(instrument);
    CREATE INDEX IF NOT EXISTS idx_trading_insights_created ON trading_insights(created_at);
    CREATE INDEX IF NOT EXISTS idx_social_content_insight ON social_content(insight_id);

    -- Event store for event-driven architecture
    CREATE TABLE IF NOT EXISTS event_store (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      event_data TEXT NOT NULL,
      source_agent TEXT,
      correlation_id TEXT,
      metadata TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Event processing log for idempotency
    CREATE TABLE IF NOT EXISTS event_processing_log (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      processed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES event_store(id),
      UNIQUE(event_id, agent_id)
    );

    -- Agent registry for monitoring
    CREATE TABLE IF NOT EXISTS agent_registry (
      id TEXT PRIMARY KEY,
      agent_id TEXT UNIQUE NOT NULL,
      agent_type TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('running', 'stopped', 'error')),
      last_heartbeat TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Additional indexes for events
    CREATE INDEX IF NOT EXISTS idx_event_store_type ON event_store(event_type);
    CREATE INDEX IF NOT EXISTS idx_event_store_created ON event_store(created_at);
    CREATE INDEX IF NOT EXISTS idx_event_store_status ON event_store(status);
    CREATE INDEX IF NOT EXISTS idx_event_store_correlation ON event_store(correlation_id);
    CREATE INDEX IF NOT EXISTS idx_event_processing_log_event ON event_processing_log(event_id);
    CREATE INDEX IF NOT EXISTS idx_event_processing_log_agent ON event_processing_log(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_registry_type ON agent_registry(agent_type);
    CREATE INDEX IF NOT EXISTS idx_agent_registry_status ON agent_registry(status);

    -- Fraud detection results table
    CREATE TABLE IF NOT EXISTS fraud_detections (
      id TEXT PRIMARY KEY,
      transaction_id TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      risk_score INTEGER NOT NULL CHECK(risk_score >= 0 AND risk_score <= 100),
      severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
      signals TEXT NOT NULL,
      explanation TEXT NOT NULL,
      config_used TEXT NOT NULL,
      detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
      processed_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_fraud_detections_transaction ON fraud_detections(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_fraud_detections_user ON fraud_detections(user_id);
    CREATE INDEX IF NOT EXISTS idx_fraud_detections_severity ON fraud_detections(severity);
    CREATE INDEX IF NOT EXISTS idx_fraud_detections_detected ON fraud_detections(detected_at);

    -- Routing logs table
    CREATE TABLE IF NOT EXISTS routing_logs (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      matched_rules TEXT NOT NULL,
      actions_taken TEXT NOT NULL,
      context TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_routing_logs_event ON routing_logs(event_id);
    CREATE INDEX IF NOT EXISTS idx_routing_logs_created ON routing_logs(created_at);

    -- Reports table
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      transaction_id TEXT,
      fraud_detection_id TEXT,
      investigation_id TEXT,
      report_type TEXT NOT NULL CHECK(report_type IN ('internal', 'compliance', 'full')),
      severity TEXT NOT NULL CHECK(severity IN ('MEDIUM', 'HIGH', 'CRITICAL')),
      risk_score INTEGER NOT NULL CHECK(risk_score >= 0 AND risk_score <= 100),
      executive_summary TEXT NOT NULL,
      fraud_explanation TEXT NOT NULL,
      timeline_narrative TEXT NOT NULL,
      risk_justification TEXT NOT NULL,
      markdown_content TEXT NOT NULL,
      structured_data TEXT NOT NULL,
      generated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_reports_transaction ON reports(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_reports_fraud_detection ON reports(fraud_detection_id);
    CREATE INDEX IF NOT EXISTS idx_reports_investigation ON reports(investigation_id);
    CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
    CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports(severity);
    CREATE INDEX IF NOT EXISTS idx_reports_generated ON reports(generated_at);

    -- Report validations table
    CREATE TABLE IF NOT EXISTS report_validations (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      passed INTEGER NOT NULL CHECK(passed IN (0, 1)),
      validation_score INTEGER NOT NULL CHECK(validation_score >= 0 AND validation_score <= 100),
      issues TEXT NOT NULL,
      feedback TEXT NOT NULL,
      structured_feedback TEXT NOT NULL,
      validated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id)
    );

    CREATE INDEX IF NOT EXISTS idx_report_validations_report ON report_validations(report_id);
    CREATE INDEX IF NOT EXISTS idx_report_validations_passed ON report_validations(passed);
    CREATE INDEX IF NOT EXISTS idx_report_validations_validated ON report_validations(validated_at);

    -- Investigation narratives table
    CREATE TABLE IF NOT EXISTS investigation_narratives (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      narrative TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
      risk_score INTEGER NOT NULL CHECK(risk_score >= 0 AND risk_score <= 100),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_investigation_narratives_alert ON investigation_narratives(alert_id);
    CREATE INDEX IF NOT EXISTS idx_investigation_narratives_user ON investigation_narratives(user_id);
    CREATE INDEX IF NOT EXISTS idx_investigation_narratives_created ON investigation_narratives(created_at);

    -- WhatsApp notifications table
    CREATE TABLE IF NOT EXISTS whatsapp_notifications (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      success INTEGER NOT NULL CHECK(success IN (0, 1)),
      error_message TEXT,
      message_id TEXT,
      sent_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_alert ON whatsapp_notifications(alert_id);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_sent ON whatsapp_notifications(sent_at);
  `);

    console.log('✅ Database initialized successfully');
    
    // Run migrations for existing databases
    migrateTradingInsightsTable();
}

// Migration function - adds new columns to existing tables
export function migrateTradingInsightsTable(): void {
    try {
        console.log('[Migration] Checking trading_insights table structure...');

        // Check if table exists
        const tableExists = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='trading_insights'
        `).get() as any;

        if (!tableExists) {
            console.log('[Migration] Table does not exist yet - will be created by schema');
            return;
        }

        // Check if columns exist
        const tableInfo = db.prepare("PRAGMA table_info(trading_insights)").all() as any[];
        const columnNames = tableInfo.map(col => col.name);

        let needsMigration = false;

        // Check for data_source_url
        if (!columnNames.includes('data_source_url')) {
            console.log('[Migration] Adding data_source_url column...');
            db.prepare(`
                ALTER TABLE trading_insights 
                ADD COLUMN data_source_url TEXT
            `).run();
            needsMigration = true;
        }

        // Check for data_source_type
        if (!columnNames.includes('data_source_type')) {
            console.log('[Migration] Adding data_source_type column...');
            db.prepare(`
                ALTER TABLE trading_insights 
                ADD COLUMN data_source_type TEXT CHECK(data_source_type IN ('trading_platform', 'market_data_feed', 'manual_entry', 'demo', 'api'))
            `).run();
            needsMigration = true;
        }

        if (needsMigration) {
            console.log('✅ Migration completed successfully');
        } else {
            console.log('✅ Database is up to date (no migration needed)');
        }
    } catch (error: any) {
        console.error('[Migration] Error:', error.message);
        // Don't throw - allow server to continue
        if (error.message.includes('duplicate column')) {
            console.log('[Migration] Columns already exist (safe to ignore)');
        }
    }
}
