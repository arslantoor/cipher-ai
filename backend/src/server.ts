import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from './config/database';
import { BaselineAnalyzer } from './services/baseline';
import { DeviationDetector } from './services/deviation';
import { SeverityEngine } from './services/severity';
import { NarrativeGenerator } from './services/narrative';
import { AuthService } from './services/auth';
import { InvestigationService } from './services/investigation';
import { AuditService } from './services/audit';
import { AutonomousOrchestrator } from './services/orchestrator';
import { TradingInsightService } from './services/tradingInsight';
import { TradingPatternDetector } from './services/tradingPatternDetector';
import { SocialContentGenerator } from './services/socialContent';
import { AutonomousDemoService } from './services/autonomousDemo';
import { DataValidator } from './services/dataValidator';
import { getAgentManager } from './agents/agentManager';
import { getEventBus } from './events/eventBus';
import { EventType, TransactionReceivedEvent, FraudAlertCreatedEvent } from './events/types';
import { EVENT_SCHEMA_VERSION } from './events/schema';
import { authenticate, authorize, AuthRequest } from './middleware/auth';
import { ACTION_RULES } from './config/thresholds';
import {
    InvestigationRequest,
    Investigation,
    TimelineEvent,
    AuditTrail,
    SeverityJustification,
    SeverityLevel,
    Deviation,
    Trade,
} from './types';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later.',
});

// Initialize database
initializeDatabase();

// Initialize services
const baselineAnalyzer = new BaselineAnalyzer();
const deviationDetector = new DeviationDetector(baselineAnalyzer);
const severityEngine = new SeverityEngine(deviationDetector);
const narrativeGenerator = new NarrativeGenerator();
const orchestrator = new AutonomousOrchestrator();

// Initialize event-driven agents
const agentManager = getAgentManager();
const eventBus = getEventBus();

// Start all agents
agentManager.startAllAgents().catch(error => {
    console.error('[Server] Failed to start agents:', error);
});

// ==================== AUTH ROUTES ====================

/**
 * Register new user (admin only)
 */
app.post('/api/auth/register', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const user = await AuthService.register(req.body);
        res.json({ success: true, user });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Login
 */
app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const tokens = await AuthService.login(email, password, req.ip, req.get('user-agent'));

        res.json(tokens);
    } catch (error: any) {
        res.status(401).json({ error: error.message });
    }
});

/**
 * Logout
 */
app.post('/api/auth/logout', authenticate, async (req: AuthRequest, res) => {
    try {
        const { refreshToken } = req.body;
        AuthService.logout(req.user!.userId, refreshToken);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Refresh access token
 */
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const tokens = await AuthService.refreshAccessToken(refreshToken);
        res.json(tokens);
    } catch (error: any) {
        res.status(401).json({ error: error.message });
    }
});

/**
 * Change password
 */
app.post('/api/auth/change-password', authenticate, async (req: AuthRequest, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        await AuthService.changePassword(req.user!.userId, oldPassword, newPassword);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get current user
 */
app.get('/api/auth/me', authenticate, async (req: AuthRequest, res) => {
    try {
        const user = AuthService.getUserById(req.user!.userId);
        const { password_hash, failed_login_attempts, locked_until, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== EVENT-DRIVEN TRANSACTION ROUTES ====================

/**
 * Ingest transaction (emits event for fraud detection agent)
 */
app.post('/api/transactions', authenticate, async (req: AuthRequest, res) => {
    try {
        const { transaction_id, user_id, amount, transaction_data } = req.body;

        if (!transaction_id || !user_id || amount === undefined) {
            return res.status(400).json({ error: 'Missing required fields: transaction_id, user_id, amount' });
        }

        // Emit transaction received event
        const transactionEvent: TransactionReceivedEvent = {
            event_id: uuidv4(),
            event_type: EventType.TRANSACTION_RECEIVED,
            timestamp: new Date().toISOString(),
            source_agent: 'api',
            payload: {
                transaction_id,
                user_id,
                amount,
                timestamp: new Date().toISOString(),
                transaction_data: transaction_data || {},
            },
        };

        await eventBus.publish(transactionEvent);

        res.json({
            success: true,
            transaction_id,
            event_id: transactionEvent.event_id,
            message: 'Transaction received and queued for processing',
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to process transaction' });
    }
});

// ==================== INVESTIGATION ROUTES ====================

/**
 * Create new alert (legacy endpoint - now uses events)
 */
app.post('/api/alerts', authenticate, async (req: AuthRequest, res) => {
    try {
        const alert = req.body;
        const alertId = InvestigationService.createAlert(alert, req.user!.userId);
        
        // Emit FRAUD_ALERT_CREATED event to trigger investigation and WhatsApp notifications
        const eventBus = getEventBus();
        const severity = alert.severity || 'medium'; // Default to medium if not provided
        const score = alert.score || 50; // Default score if not provided
        
        // Create event with all required fields including version
        // Use 'any' type to ensure version field is included at runtime
        const fraudAlertEvent: any = {
            event_id: uuidv4(),
            event_type: EventType.FRAUD_ALERT_CREATED,
            version: EVENT_SCHEMA_VERSION, // Required for validation - must be string
            timestamp: new Date().toISOString(),
            source_agent: 'api',
            correlation_id: alertId,
            payload: {
                alert_id: alertId,
                user_id: alert.user_id,
                alert_type: alert.alert_type || 'fraud_anomaly',
                severity: severity.toLowerCase() as 'low' | 'medium' | 'high' | 'critical',
                score: score,
                timestamp: alert.timestamp || new Date().toISOString(),
            },
            metadata: {
                transaction_id: alert.transaction_id,
                signals: alert.signals || {},
            },
        };
        
        // Ensure version is definitely a string
        if (typeof fraudAlertEvent.version !== 'string') {
            fraudAlertEvent.version = String(EVENT_SCHEMA_VERSION);
        }
        
        // Verify event structure before publishing
        console.log('[API] Publishing fraud alert event:', {
            event_id: fraudAlertEvent.event_id,
            event_type: fraudAlertEvent.event_type,
            version: fraudAlertEvent.version,
            has_version: !!fraudAlertEvent.version,
            version_type: typeof fraudAlertEvent.version
        });
        
        await eventBus.publish(fraudAlertEvent);
        
        res.json({ success: true, alert_id: alertId });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Store user activity
 */
app.post('/api/user-activity', authenticate, async (req: AuthRequest, res) => {
    try {
        const activityId = InvestigationService.storeUserActivity(req.body, req.user!.userId);
        res.json({ success: true, activity_id: activityId });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Retrieve latest user activity (baseline) for a given user
 */
app.get('/api/user-activity/:user_id', authenticate, async (req: AuthRequest, res) => {
    try {
        const activity = InvestigationService.getUserActivity(req.params.user_id);
        if (!activity) {
            return res.status(404).json({ error: 'User activity not found' });
        }
        res.json(activity);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Run investigation
 */
app.post('/api/investigate', authenticate, async (req: AuthRequest, res) => {
    try {
        const request: InvestigationRequest = req.body;

        // Check if this is a trading pattern alert
        const isTradingAlert = request.alert.alert_type === 'bad_trading_pattern' || 
                               request.alert.alert_type === 'suspicious_trading' ||
                               request.alert.raw_data?.insight_id;

        let deviations, severity, justification, narrative, timeline;

        if (isTradingAlert && request.alert.raw_data?.insight_id) {
            // Handle trading pattern investigation
            const insight = TradingInsightService.getInsight(request.alert.raw_data.insight_id);
            
            if (insight) {
                // Use trading-specific analysis
                deviations = {
                    trade_frequency_spike: insight.behaviour_context.pressure_score.factors.trade_frequency_spike > 1.5,
                    position_size_deviation: insight.behaviour_context.pressure_score.factors.position_size_deviation > 2,
                    loss_clustering: insight.behaviour_context.pressure_score.factors.loss_clustering > 0.5,
                    unusual_hours: insight.behaviour_context.pressure_score.factors.unusual_hours > 0,
                    short_intervals: insight.behaviour_context.pressure_score.factors.short_intervals > 0,
                };

                // Map pressure level to severity
                const severityMap: Record<string, SeverityLevel> = {
                    'high_pressure': SeverityLevel.HIGH,
                    'elevated': SeverityLevel.MEDIUM,
                    'stable': SeverityLevel.LOW,
                };
                severity = severityMap[insight.pressure_level] || SeverityLevel.MEDIUM;

                justification = {
                    base_score: insight.deterministic_score,
                    deviation_multiplier: 1.0,
                    final_score: insight.deterministic_score,
                    thresholds_used: {},
                    triggered_deviations: Object.entries(deviations)
                        .filter(([_, v]) => v === true)
                        .map(([k, _]) => k),
                };

                timeline = [
                    {
                        timestamp: insight.created_at,
                        event: 'Trading pattern detected',
                        severity: 'alert' as const,
                        details: `Pressure level: ${insight.pressure_level}, Score: ${insight.deterministic_score}`,
                    },
                ];

                // Generate trading-specific narrative
                narrative = await narrativeGenerator.generateTradingPatternNarrative(
                    request.alert,
                    insight,
                    severity,
                    justification,
                    deviations
                );
            } else {
                // Fallback to standard investigation
                deviations = deviationDetector.detectDeviations(
                    request.alert,
                    request.user_activity
                );
                const result = severityEngine.classifySeverity(
                    request.alert,
                    request.user_activity
                );
                severity = result.severity;
                justification = result.justification;
                timeline = buildTimeline(request.alert, deviations);
                narrative = await narrativeGenerator.generateNarrative(
                    request.alert,
                    severity,
                    justification,
                    deviations,
                    timeline
                );
            }
        } else {
            // Standard fraud investigation
            deviations = deviationDetector.detectDeviations(
                request.alert,
                request.user_activity
            );

            const result = severityEngine.classifySeverity(
                request.alert,
                request.user_activity
            );
            severity = result.severity;
            justification = result.justification;

            timeline = buildTimeline(request.alert, deviations);

            narrative = await narrativeGenerator.generateNarrative(
                request.alert,
                severity,
                justification,
                deviations,
                timeline
            );
        }

        const allowedActions = ACTION_RULES[severity];

        const patternSignature = summarizePattern(justification, deviations);
        const detectionSummary = buildDetectionSummary(request.alert, severity, justification, patternSignature);

        // Generate unique investigation ID with timestamp to avoid duplicates
        const timestamp = Date.now();
        const investigation: Investigation = {
            investigation_id: `INV-${request.alert.alert_id}-${timestamp}`,
            alert: request.alert,
            user_activity: request.user_activity,
            severity,
            timeline,
            narrative,
            allowed_actions: allowedActions,
            confidence_signals: justification,
            audit_trail: createAuditTrail(request, severity, justification),
            generated_at: new Date().toISOString(),
            pattern_signature: patternSignature,
            detection_summary: detectionSummary,
        };

        // Store investigation
        InvestigationService.createInvestigation(investigation, req.user!.userId);
        InvestigationService.storeUserActivity(request.user_activity, req.user!.userId);

        AuditService.log({
            user_id: req.user!.userId,
            action: 'INVESTIGATION_DECISION',
            resource_type: 'investigation',
            resource_id: investigation.investigation_id,
            details: JSON.stringify({
                severity,
                final_score: justification.final_score,
                deviation_multiplier: justification.deviation_multiplier,
                allowed_actions: allowedActions,
                triggered_deviations: justification.triggered_deviations,
                pattern_signature: patternSignature,
                narrative_snippet: narrative.slice(0, 256),
            }),
        });

        res.json(investigation);
    } catch (error: any) {
        console.error('Investigation error:', error);
        res.status(500).json({ error: 'Investigation failed' });
    }
});

/**
 * Get investigations
 */
app.get('/api/investigations', authenticate, async (req: AuthRequest, res) => {
    try {
        const filters: any = {
            limit: parseInt(req.query.limit as string) || 50,
        };

        // Analysts can only see their own investigations
        if (req.user!.role === 'analyst') {
            filters.analyst_id = req.user!.userId;
        } else if (req.query.analyst_id) {
            filters.analyst_id = req.query.analyst_id;
        }

        if (req.query.status) filters.status = req.query.status;
        if (req.query.severity) filters.severity = req.query.severity;

        const investigations = InvestigationService.getInvestigations(filters);
        res.json(investigations);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Update investigation status
 */
app.patch('/api/investigations/:id/status', authenticate, async (req: AuthRequest, res) => {
    try {
        const { status } = req.body;
        InvestigationService.updateInvestigationStatus(req.params.id, status, req.user!.userId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Log investigation action
 */
app.post('/api/investigations/:id/actions', authenticate, async (req: AuthRequest, res) => {
    try {
        const { action_type, action_details } = req.body;
        InvestigationService.logAction(req.params.id, req.user!.userId, action_type, action_details);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get investigation statistics
 */
app.get('/api/statistics', authenticate, async (req: AuthRequest, res) => {
    try {
        const analystId = req.user!.role === 'analyst' ? req.user!.userId : undefined;
        const stats = InvestigationService.getStatistics(analystId);
        res.json(stats);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== ADMIN ROUTES ====================

/**
 * Get all users (admin only)
 */
app.get('/api/admin/users', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const users = AuthService.getAllUsers();
        res.json(users);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Update user role (admin only)
 */
app.patch('/api/admin/users/:id/role', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const { role } = req.body;
        AuthService.updateUserRole(req.params.id, role, req.user!.userId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Deactivate user (admin only)
 */
app.post('/api/admin/users/:id/deactivate', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        AuthService.deactivateUser(req.params.id, req.user!.userId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Activate user (admin only)
 */
app.post('/api/admin/users/:id/activate', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        AuthService.activateUser(req.params.id, req.user!.userId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get audit logs (admin/senior analyst only)
 */
app.get('/api/admin/audit-logs', authenticate, authorize('admin', 'senior_analyst'), async (req: AuthRequest, res) => {
    try {
        const filters: any = {
            limit: parseInt(req.query.limit as string) || 100,
        };

        if (req.query.user_id) filters.user_id = req.query.user_id;
        if (req.query.action) filters.action = req.query.action;
        if (req.query.resource_type) filters.resource_type = req.query.resource_type;
        if (req.query.start_date) filters.start_date = req.query.start_date;
        if (req.query.end_date) filters.end_date = req.query.end_date;

        const logs = AuditService.getLogs(filters);
        res.json(logs);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get audit summary (admin only)
 */
app.get('/api/admin/audit-summary', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const days = parseInt(req.query.days as string) || 7;
        const summary = AuditService.getSummary(days);
        res.json(summary);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== AUTONOMOUS TRADING INTELLIGENCE ROUTES ====================

/**
 * Run autonomous analysis for a trader
 */
app.post('/api/autonomous/run', authenticate, async (req: AuthRequest, res) => {
    try {
        const { trader_id, trades, market_data, data_source } = req.body;

        if (!trader_id || !trades || !market_data) {
            return res.status(400).json({ error: 'Missing required fields: trader_id, trades, market_data' });
        }

        // Validate data legitimacy
        const validation = DataValidator.validateInsightRequest({ trader_id, trades, market_data });
        
        if (!validation.valid) {
            console.warn('[DataValidator] Invalid data rejected:', validation.errors);
            AuditService.log({
                user_id: req.user!.userId,
                action: 'INVALID_DATA_REJECTED',
                resource_type: 'trading_insight',
                resource_id: trader_id,
                details: JSON.stringify({
                    errors: validation.errors,
                    warnings: validation.warnings,
                }),
            });
            return res.status(400).json({ 
                error: 'Invalid data provided', 
                validation_errors: validation.errors,
                warnings: validation.warnings,
            });
        }

        // Check for suspicious patterns
        const suspicious = DataValidator.detectSuspiciousPatterns({ trades, market_data });
        if (suspicious.suspicious) {
            console.warn('[DataValidator] Suspicious patterns detected:', suspicious.reasons);
            AuditService.log({
                user_id: req.user!.userId,
                action: 'SUSPICIOUS_DATA_DETECTED',
                resource_type: 'trading_insight',
                resource_id: trader_id,
                details: JSON.stringify({
                    reasons: suspicious.reasons,
                    action: 'proceeding_with_warning',
                }),
            });
        }

        // Log warnings if any
        if (validation.warnings.length > 0) {
            console.warn('[DataValidator] Warnings:', validation.warnings);
        }

        // Generate data source URL if not provided
        let finalDataSource = data_source;
        if (!finalDataSource || !finalDataSource.url) {
            // Auto-generate source URL based on data source type or default
            const sourceType = data_source?.type || 'api';
            const baseUrl = process.env.DATA_SOURCE_BASE_URL;
            const timestamp = Date.now();
            
            // Only create URL if baseUrl is provided and valid
            if (baseUrl && baseUrl.trim() && baseUrl !== '#' && !baseUrl.includes('broken')) {
                try {
                    // Validate URL format
                    new URL(baseUrl);
                    finalDataSource = {
                        url: `${baseUrl}/trades/${trader_id}/${market_data.instrument}?timestamp=${timestamp}&source=${sourceType}`,
                        type: sourceType,
                    };
                } catch (e) {
                    // Invalid URL format, skip URL
                    console.warn('[Server] Invalid DATA_SOURCE_BASE_URL, skipping data source URL');
                    finalDataSource = {
                        url: undefined,
                        type: sourceType,
                    };
                }
            } else {
                // No URL provided or invalid, just set type
                finalDataSource = {
                    url: undefined,
                    type: sourceType,
                };
            }
        }

        const insight = await orchestrator.runAutonomousAnalysis(trader_id, trades, market_data, finalDataSource);
        
        res.json({ 
            success: true, 
            insight,
            validation: {
                passed: true,
                warnings: validation.warnings,
                suspicious_patterns: suspicious.suspicious ? suspicious.reasons : null,
            },
        });
    } catch (error: any) {
        console.error('Autonomous analysis error:', error);
        res.status(500).json({ error: error.message || 'Autonomous analysis failed' });
    }
});

/**
 * Get trading insights
 */
app.get('/api/insights', authenticate, async (req: AuthRequest, res) => {
    try {
        const filters: any = {
            limit: parseInt(req.query.limit as string) || 50,
        };

        if (req.query.trader_id) filters.trader_id = req.query.trader_id;
        if (req.query.instrument) filters.instrument = req.query.instrument;
        if (req.query.pressure_level) filters.pressure_level = req.query.pressure_level;
        if (req.query.start_date) filters.start_date = req.query.start_date;
        if (req.query.end_date) filters.end_date = req.query.end_date;

        const insights = TradingInsightService.getInsights(filters);
        res.json(insights);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get insight by ID
 */
app.get('/api/insights/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const insight = TradingInsightService.getInsight(req.params.id);
        if (!insight) {
            return res.status(404).json({ error: 'Insight not found' });
        }
        res.json(insight);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get trading insights as alerts for Investigation Queue
 * Converts high-pressure trading insights into alerts for pattern warnings
 */
app.get('/api/trading-alerts', authenticate, async (req: AuthRequest, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const minPressure = req.query.min_pressure || 'elevated'; // elevated or high_pressure
        
        // Get insights with elevated/high pressure
        const insights = TradingInsightService.getInsights({
            limit,
        }).filter(insight => {
            if (minPressure === 'high_pressure') {
                return insight.pressure_level === 'high_pressure';
            }
            return insight.pressure_level === 'elevated' || insight.pressure_level === 'high_pressure';
        });

        // Convert insights to alerts
        const alerts = insights.map(insight => {
            // Check if this is a bad pattern
            const patternCheck = TradingPatternDetector.detectBadPattern(
                insight.trader_id,
                insight
            );

            // Build triggered rules from behavioral factors
            const rules: string[] = [];
            if (insight.behaviour_context.pressure_score.factors.trade_frequency_spike > 1.5) {
                rules.push('trade_frequency_spike');
            }
            if (insight.behaviour_context.pressure_score.factors.position_size_deviation > 2) {
                rules.push('position_size_deviation');
            }
            if (insight.behaviour_context.pressure_score.factors.loss_clustering > 0.5) {
                rules.push('loss_clustering');
            }
            if (insight.behaviour_context.pressure_score.factors.unusual_hours > 0) {
                rules.push('unusual_trading_hours');
            }
            if (insight.behaviour_context.pressure_score.factors.short_intervals > 0) {
                rules.push('rapid_fire_trading');
            }
            if (patternCheck.isBadPattern) {
                rules.push('repeating_bad_pattern');
            }

            return {
                alert: {
                    alert_id: `TRADE-${insight.insight_id}`,
                    user_id: insight.trader_id,
                    alert_type: patternCheck.isBadPattern ? 'bad_trading_pattern' : 'suspicious_trading',
                    timestamp: insight.created_at,
                    triggered_rules: rules,
                    raw_data: {
                        insight_id: insight.insight_id,
                        instrument: insight.instrument,
                        pressure_level: insight.pressure_level,
                        pressure_score: insight.behaviour_context.pressure_score.score,
                        deterministic_score: insight.deterministic_score,
                        market_context: insight.market_context,
                        behavior_factors: insight.behaviour_context.pressure_score.factors,
                        matched_pattern: patternCheck.matchedPattern,
                        warning_message: patternCheck.warningMessage,
                    },
                },
                userActivity: {
                    user_id: insight.trader_id,
                    account_age_days: 0, // Will be populated from actual user data if available
                    login_locations: [],
                    device_fingerprints: [],
                    transaction_history: [],
                },
            };
        });

        res.json(alerts);
    } catch (error: any) {
        console.error('Error fetching trading alerts:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch trading alerts' });
    }
});

/**
 * Publish social content (manual or scheduled)
 */
app.post('/api/insights/:id/publish', authenticate, async (req: AuthRequest, res) => {
    try {
        const { platform, persona, schedule_at } = req.body;

        const insight = TradingInsightService.getInsight(req.params.id);
        if (!insight) {
            return res.status(404).json({ error: 'Insight not found' });
        }

        // Get or generate content
        let content = SocialContentGenerator.getContent(req.params.id, platform, persona);
        
        if (content.length === 0) {
            // Generate if not exists
            const generator = new SocialContentGenerator();
            const generated = await generator.generateContent(insight);
            content = generated.filter(c => 
                (!platform || c.platform === platform) && 
                (!persona || c.persona === persona)
            );
        }

        AuditService.log({
            user_id: req.user!.userId,
            action: 'SOCIAL_CONTENT_PUBLISH_REQUESTED',
            resource_type: 'trading_insight',
            resource_id: req.params.id,
            details: JSON.stringify({
                platform,
                persona,
                schedule_at,
                content_count: content.length,
            }),
        });

        res.json({ 
            success: true, 
            message: schedule_at ? 'Content scheduled for publication' : 'Content ready for publication',
            content,
            schedule_at: schedule_at || null,
        });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get social content for an insight
 */
app.get('/api/insights/:id/social', authenticate, async (req: AuthRequest, res) => {
    try {
        const platform = req.query.platform as 'linkedin' | 'x' | 'thread' | undefined;
        const persona = req.query.persona as 'calm_analyst' | 'data_explainer' | 'trading_coach' | undefined;

        const content = SocialContentGenerator.getContent(req.params.id, platform, persona);
        res.json(content);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get daily or weekly market summary
 */
app.get('/api/insights/summary/:period', authenticate, async (req: AuthRequest, res) => {
    try {
        const period = req.params.period as 'daily' | 'weekly';
        
        if (period !== 'daily' && period !== 'weekly') {
            return res.status(400).json({ error: 'Period must be "daily" or "weekly"' });
        }

        const insights = TradingInsightService.getSummaryInsights(period);
        
        // Aggregate statistics
        const instruments = new Set(insights.map(i => i.instrument));
        const pressureLevels = {
            stable: insights.filter(i => i.pressure_level === 'stable').length,
            elevated: insights.filter(i => i.pressure_level === 'elevated').length,
            high_pressure: insights.filter(i => i.pressure_level === 'high_pressure').length,
        };
        
        const avgPressureScore = insights.length > 0
            ? insights.reduce((sum, i) => sum + i.behaviour_context.pressure_score.score, 0) / insights.length
            : 0;

        // Generate summary narrative using AI
        const narrativeGenerator = new NarrativeGenerator();
        const summaryNarrative = await narrativeGenerator.generateSummaryNarrative(
            insights,
            period,
            {
                instrumentCount: instruments.size,
                insightCount: insights.length,
                pressureLevels,
                avgPressureScore: Math.round(avgPressureScore),
            }
        );

        res.json({
            period,
            date_range: {
                start: period === 'daily' 
                    ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
                    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                end: new Date().toISOString(),
            },
            statistics: {
                total_insights: insights.length,
                instruments_tracked: instruments.size,
                instruments: Array.from(instruments),
                pressure_distribution: pressureLevels,
                average_pressure_score: Math.round(avgPressureScore),
            },
            narrative: summaryNarrative,
            insights: insights.slice(0, 10), // Top 10 for preview
        });
    } catch (error: any) {
        console.error('Summary generation error:', error);
        res.status(500).json({ error: error.message || 'Summary generation failed' });
    }
});

// ==================== UTILITY ROUTES ====================

// ==================== AGENT MANAGEMENT ROUTES ====================

/**
 * Get agent status
 */
app.get('/api/agents/status', authenticate, authorize('admin', 'senior_analyst'), async (req: AuthRequest, res) => {
    try {
        const status = agentManager.getAgentStatus();
        const health = agentManager.getAgentHealth();
        res.json({ agents: status, health });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get event bus subscriptions
 */
app.get('/api/events/subscriptions', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const subscriptions = eventBus.getAllSubscriptions();
        const result: any = {};
        subscriptions.forEach((subs, eventType) => {
            result[eventType] = subs.map(s => ({
                agent_id: s.agent_id,
                priority: s.priority,
            }));
        });
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== UTILITY ROUTES ====================

app.get('/api/health', (req, res) => {
    const agentStatus = agentManager.getAgentStatus();
    const allRunning = agentStatus.every(a => a.running);
    
    res.json({
        status: allRunning ? 'operational' : 'degraded',
        timestamp: new Date().toISOString(),
        agents: agentStatus.length,
        agents_running: agentStatus.filter(a => a.running).length,
    });
});

// ==================== HELPER FUNCTIONS ====================

function buildTimeline(alert: any, deviations: any): TimelineEvent[] {
    const timeline: TimelineEvent[] = [
        {
            timestamp: alert.timestamp,
            event: `Alert triggered: ${alert.alert_type}`,
            severity: 'alert',
        },
    ];

    Object.entries(deviations).forEach(([key, value]: [string, any]) => {
        if (typeof value === 'object' && value?.multiplier > 1.0) {
            timeline.push({
                timestamp: alert.timestamp,
                event: `Deviation detected: ${key}`,
                severity: 'deviation',
            });
        }
    });

    return timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function createAuditTrail(
    request: InvestigationRequest,
    severity: any,
    justification: any
): AuditTrail {
    return {
        timestamp: new Date().toISOString(),
        alert_id: request.alert.alert_id,
        user_id: request.alert.user_id,
        severity_assigned: severity,
        thresholds_applied: justification.thresholds_used,
        final_score: justification.final_score,
        deviation_multiplier: justification.deviation_multiplier,
    };
}

function summarizePattern(justification: SeverityJustification, deviations: Deviation): string[] {
    const patterns: string[] = [];

    if (justification.triggered_deviations.includes('amount_deviation')) {
        patterns.push('Transaction amount spiked vs. baseline');
    }

    if (justification.triggered_deviations.includes('location_deviation')) {
        patterns.push('New geographic cluster detected');
    }

    if (justification.triggered_deviations.includes('device_deviation')) {
        patterns.push('New device fingerprint in play');
    }

    if (deviations.new_account_flag) {
        patterns.push('Relatively new account (<30 days)');
    }

    if (deviations.velocity_flag || justification.triggered_deviations.includes('frequency_deviation')) {
        patterns.push('Velocity spikes show burst behavior');
    }

    if (!patterns.length) {
        patterns.push('Pattern matches baseline behavior');
    }

    return patterns;
}

function buildDetectionSummary(
    alert: any,
    severity: any,
    justification: SeverityJustification,
    patterns: string[]
): string {
    const triggered = justification.triggered_deviations.join(', ') || 'None';
    return `Alert ${alert.alert_id} (${alert.alert_type}) classified as ${severity.toUpperCase()} with score ${justification.final_score.toFixed(2)} and multiplier ${justification.deviation_multiplier.toFixed(2)}. Patterns: ${patterns.join('; ')}. Triggered deviations: ${triggered}.`;
}

// ==================== WHATSAPP SETTINGS ROUTES ====================

/**
 * Get WhatsApp configuration (admin only)
 */
app.get('/api/settings/whatsapp', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const { ConfigService } = require('./services/configService');
        const numbers = ConfigService.getWhatsAppNumbers();
        const enabled = ConfigService.getConfig('whatsapp_notifications_enabled') !== 'false';

        // Return with IDs for frontend management
        const numbersWithIds = numbers.map((num: string, index: number) => ({
            id: `whatsapp-${index}`,
            number: num,
            enabled: true,
        }));

        res.json({
            numbers: numbersWithIds,
            enabled,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all WhatsApp numbers with detailed information (admin only)
 */
app.get('/api/settings/whatsapp/list', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const { ConfigService } = require('./services/configService');
        const { db } = require('./config/database');
        const { WhatsAppService } = require('./services/whatsappService');
        
        const numbers = ConfigService.getWhatsAppNumbers();
        const enabled = ConfigService.getConfig('whatsapp_notifications_enabled') !== 'false';
        
        // Get delivery history for each number
        const numbersWithDetails = await Promise.all(numbers.map(async (num: string, index: number) => {
            // Get recent delivery stats
            const recentDeliveries = db.prepare(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
                    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
                    MAX(sent_at) as last_sent
                FROM whatsapp_notifications
                WHERE phone_number = ?
            `).get(num) as any;
            
            // Get last delivery details
            const lastDelivery = db.prepare(`
                SELECT success, error_message, sent_at, message_id
                FROM whatsapp_notifications
                WHERE phone_number = ?
                ORDER BY sent_at DESC
                LIMIT 1
            `).get(num) as any;
            
            return {
                id: `whatsapp-${index}`,
                number: num,
                enabled: true,
                stats: {
                    total_sent: recentDeliveries?.total || 0,
                    successful: recentDeliveries?.successful || 0,
                    failed: recentDeliveries?.failed || 0,
                    last_sent: recentDeliveries?.last_sent || null,
                },
                last_delivery: lastDelivery ? {
                    success: lastDelivery.success === 1,
                    error: lastDelivery.error_message,
                    sent_at: lastDelivery.sent_at,
                    message_id: lastDelivery.message_id,
                } : null,
            };
        }));
        
        // Get WhatsApp service configuration status
        const whatsappService = new WhatsAppService();
        const hasApiKey = !!(process.env.WHATSAPP_API_KEY);
        const provider = process.env.WHATSAPP_PROVIDER || 'auto-detect';
        
        res.json({
            numbers: numbersWithDetails,
            enabled,
            service_config: {
                has_api_key: hasApiKey,
                provider: provider,
                twilio_number: process.env.TWILIO_WHATSAPP_NUMBER || null,
            },
            total_numbers: numbers.length,
        });
    } catch (error: any) {
        console.error('[API] Error getting WhatsApp list:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Add WhatsApp number (admin only)
 */
app.post('/api/settings/whatsapp', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const { number } = req.body;

        if (!number || typeof number !== 'string') {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Validate E.164 format
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        if (!e164Regex.test(number)) {
            return res.status(400).json({
                error: 'Invalid phone number format. Use E.164 format: +[country code][number]',
            });
        }

        const { ConfigService } = require('./services/configService');
        const { AuditService } = require('./services/audit');

        // Get existing numbers
        const existingNumbers = ConfigService.getWhatsAppNumbers();

        // Check for duplicates
        if (existingNumbers.includes(number)) {
            return res.status(400).json({ error: 'Phone number already exists' });
        }

        // Add new number
        const updatedNumbers = [...existingNumbers, number];
        ConfigService.setWhatsAppNumbers(updatedNumbers, req.user!.userId);

        // Audit log
        AuditService.log({
            action: 'WHATSAPP_NUMBER_ADDED',
            resource_type: 'settings',
            resource_id: 'whatsapp',
            details: JSON.stringify({
                number: number.substring(0, number.length - 4) + '****', // Masked
                total_numbers: updatedNumbers.length,
            }),
        });

        res.json({
            success: true,
            message: 'Phone number added successfully',
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update WhatsApp number (admin only)
 */
app.patch('/api/settings/whatsapp/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { number } = req.body;

        if (!number || typeof number !== 'string') {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Validate E.164 format
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        if (!e164Regex.test(number)) {
            return res.status(400).json({
                error: 'Invalid phone number format. Use E.164 format: +[country code][number]',
            });
        }

        const { ConfigService } = require('./services/configService');
        const { AuditService } = require('./services/audit');

        // Get existing numbers
        const existingNumbers = ConfigService.getWhatsAppNumbers();

        // Extract index from ID (format: whatsapp-0, whatsapp-1, etc.)
        const index = parseInt(id.replace('whatsapp-', ''));
        if (isNaN(index) || index < 0 || index >= existingNumbers.length) {
            return res.status(404).json({ error: 'Phone number not found' });
        }

        // Check for duplicates (excluding current index)
        const otherNumbers = existingNumbers.filter((_: any, i: number) => i !== index);
        if (otherNumbers.includes(number)) {
            return res.status(400).json({ error: 'Phone number already exists' });
        }

        // Update number
        const oldNumber = existingNumbers[index];
        existingNumbers[index] = number;
        ConfigService.setWhatsAppNumbers(existingNumbers, req.user!.userId);

        // Audit log
        AuditService.log({
            action: 'WHATSAPP_NUMBER_UPDATED',
            resource_type: 'settings',
            resource_id: 'whatsapp',
            details: JSON.stringify({
                old_number: oldNumber.substring(0, oldNumber.length - 4) + '****',
                new_number: number.substring(0, number.length - 4) + '****',
            }),
        });

        res.json({
            success: true,
            message: 'Phone number updated successfully',
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete WhatsApp number (admin only)
 */
app.delete('/api/settings/whatsapp/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;

        const { ConfigService } = require('./services/configService');
        const { AuditService } = require('./services/audit');

        // Get existing numbers
        const existingNumbers = ConfigService.getWhatsAppNumbers();

        // Extract index from ID
        const index = parseInt(id.replace('whatsapp-', ''));
        if (isNaN(index) || index < 0 || index >= existingNumbers.length) {
            return res.status(404).json({ error: 'Phone number not found' });
        }

        // Remove number
        const removedNumber = existingNumbers[index];
        const updatedNumbers = existingNumbers.filter((_: any, i: number) => i !== index);
        ConfigService.setWhatsAppNumbers(updatedNumbers, req.user!.userId);

        // Audit log
        AuditService.log({
            action: 'WHATSAPP_NUMBER_REMOVED',
            resource_type: 'settings',
            resource_id: 'whatsapp',
            details: JSON.stringify({
                number: removedNumber.substring(0, removedNumber.length - 4) + '****',
                remaining_numbers: updatedNumbers.length,
            }),
        });

        res.json({
            success: true,
            message: 'Phone number removed successfully',
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Toggle WhatsApp notifications enabled/disabled (admin only)
 */
app.patch('/api/settings/whatsapp/enabled', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'enabled must be a boolean' });
        }

        const { ConfigService } = require('./services/configService');
        const { AuditService } = require('./services/audit');

        ConfigService.setConfig('whatsapp_notifications_enabled', enabled.toString(), req.user!.userId);

        // Audit log
        AuditService.log({
            action: 'WHATSAPP_NOTIFICATIONS_TOGGLED',
            resource_type: 'settings',
            resource_id: 'whatsapp',
            details: JSON.stringify({
                enabled,
            }),
        });

        res.json({
            success: true,
            message: `WhatsApp notifications ${enabled ? 'enabled' : 'disabled'}`,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize autonomous demo service
const autonomousDemo = new AutonomousDemoService();

// Auto-start autonomous mode if enabled (for demo/testing)
if (process.env.AUTONOMOUS_DEMO_ENABLED === 'true') {
    const intervalMinutes = parseInt(process.env.AUTONOMOUS_DEMO_INTERVAL || '2');
    autonomousDemo.start(intervalMinutes);
    console.log(`🤖 Autonomous demo mode enabled (generates insights every ${intervalMinutes} minutes)`);
}

/**
 * Start/Stop Autonomous Demo Mode
 */
app.post('/api/autonomous/demo/start', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const { interval_minutes } = req.body;
        const interval = interval_minutes || 2;
        
        autonomousDemo.start(interval);
        res.json({ 
            success: true, 
            message: `Autonomous demo started (generates insights every ${interval} minutes)`,
            interval_minutes: interval
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/autonomous/demo/stop', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        autonomousDemo.stop();
        res.json({ success: true, message: 'Autonomous demo stopped' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/autonomous/demo/status', authenticate, async (req: AuthRequest, res) => {
    try {
        res.json({ 
            is_running: autonomousDemo.isActive(),
            message: autonomousDemo.isActive() 
                ? 'Autonomous demo is generating insights automatically' 
                : 'Autonomous demo is stopped'
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🔒 CipherAI backend running on port ${PORT}`);
    console.log(`📊 Database initialized`);
    console.log(`🛡️  Security features enabled`);
    console.log(`🤖 Event-driven agents starting...`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[Server] SIGTERM received, shutting down gracefully...');
    autonomousDemo.stop();
    await agentManager.stopAllAgents();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[Server] SIGINT received, shutting down gracefully...');
    autonomousDemo.stop();
    await agentManager.stopAllAgents();
    process.exit(0);
});
