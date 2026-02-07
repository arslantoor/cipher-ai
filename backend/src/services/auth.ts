import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from './audit';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

export interface User {
    id: string;
    email: string;
    full_name: string;
    role: 'admin' | 'senior_analyst' | 'analyst';
    department?: string;
    is_active: number;
    created_at: string;
    last_login?: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'password_hash'>;
}

export class AuthService {
    /**
     * Register a new user (admin only)
     */
    static async register(data: {
        email: string;
        password: string;
        full_name: string;
        role: User['role'];
        department?: string;
    }): Promise<User> {
        const passwordHash = await bcrypt.hash(data.password, 12);
        const userId = uuidv4();

        const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, role, department)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            userId,
            data.email.toLowerCase(),
            passwordHash,
            data.full_name,
            data.role,
            data.department || null
        );

        AuditService.log({
            action: 'USER_REGISTERED',
            resource_type: 'user',
            resource_id: userId,
            details: JSON.stringify({ email: data.email, role: data.role }),
        });

        return this.getUserById(userId)!;
    }

    /**
     * Login with email and password
     */
    static async login(
        email: string,
        password: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<AuthTokens> {
        const user = this.getUserByEmail(email);

        if (!user) {
            AuditService.log({
                action: 'LOGIN_FAILED',
                details: `Email not found: ${email}`,
                ip_address: ipAddress,
                user_agent: userAgent,
            });
            throw new Error('Invalid credentials');
        }

        // Check if account is locked
        if (user.locked_until) {
            const lockExpiry = new Date(user.locked_until);
            if (lockExpiry > new Date()) {
                throw new Error(`Account locked until ${lockExpiry.toLocaleString()}`);
            } else {
                // Unlock account
                this.unlockAccount(user.id);
            }
        }

        // Check if account is active
        if (!user.is_active) {
            throw new Error('Account is disabled');
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            this.handleFailedLogin(user.id);
            AuditService.log({
                user_id: user.id,
                action: 'LOGIN_FAILED',
                details: 'Invalid password',
                ip_address: ipAddress,
                user_agent: userAgent,
            });
            throw new Error('Invalid credentials');
        }

        // Reset failed attempts on successful login
        this.resetFailedAttempts(user.id);

        // Update last login
        this.updateLastLogin(user.id);

        // Generate tokens
        const tokens = this.generateTokens(user);

        // Store refresh token
        this.storeRefreshToken(user.id, tokens.refreshToken);

        AuditService.log({
            user_id: user.id,
            action: 'LOGIN_SUCCESS',
            ip_address: ipAddress,
            user_agent: userAgent,
        });

        return tokens;
    }

    /**
     * Logout (invalidate refresh token)
     */
    static logout(userId: string, refreshToken: string): void {
        const stmt = db.prepare('DELETE FROM sessions WHERE user_id = ? AND refresh_token = ?');
        stmt.run(userId, refreshToken);

        AuditService.log({
            user_id: userId,
            action: 'LOGOUT',
        });
    }

    /**
     * Refresh access token
     */
    static async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
        try {
            const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;

            // Check if refresh token exists in database
            const session = db
                .prepare('SELECT * FROM sessions WHERE refresh_token = ? AND user_id = ?')
                .get(refreshToken, payload.userId) as any;

            if (!session) {
                throw new Error('Invalid refresh token');
            }

            // Check if session expired
            if (new Date(session.expires_at) < new Date()) {
                db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
                throw new Error('Session expired');
            }

            const user = this.getUserById(payload.userId);
            if (!user || !user.is_active) {
                throw new Error('User not found or inactive');
            }

            const accessToken = jwt.sign(
                { userId: user.id, email: user.email, role: user.role },
                JWT_SECRET,
                { expiresIn: ACCESS_TOKEN_EXPIRY }
            );

            return { accessToken };
        } catch (error) {
            throw new Error('Invalid or expired refresh token');
        }
    }

    /**
     * Change password
     */
    static async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
        const user = this.getUserById(userId);
        if (!user) throw new Error('User not found');

        const passwordMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!passwordMatch) {
            throw new Error('Current password is incorrect');
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 12);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, userId);

        // Invalidate all sessions
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

        AuditService.log({
            user_id: userId,
            action: 'PASSWORD_CHANGED',
        });
    }

    /**
     * Generate JWT tokens
     */
    private static generateTokens(user: any): AuthTokens {
        const accessToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );

        const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, {
            expiresIn: REFRESH_TOKEN_EXPIRY,
        });

        const { password_hash, failed_login_attempts, locked_until, ...userWithoutPassword } = user;

        return {
            accessToken,
            refreshToken,
            user: userWithoutPassword,
        };
    }

    /**
     * Store refresh token in database
     */
    private static storeRefreshToken(userId: string, refreshToken: string): void {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        db.prepare(`
      INSERT INTO sessions (id, user_id, refresh_token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), userId, refreshToken, expiresAt.toISOString());
    }

    /**
     * Handle failed login attempt
     */
    private static handleFailedLogin(userId: string): void {
        const user = this.getUserById(userId);
        if (!user) return;

        const newAttempts = (user.failed_login_attempts || 0) + 1;

        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
            const lockUntil = new Date();
            lockUntil.setMinutes(lockUntil.getMinutes() + LOCK_DURATION_MINUTES);

            db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?').run(
                newAttempts,
                lockUntil.toISOString(),
                userId
            );

            AuditService.log({
                user_id: userId,
                action: 'ACCOUNT_LOCKED',
                details: `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts`,
            });
        } else {
            db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(newAttempts, userId);
        }
    }

    /**
     * Reset failed login attempts
     */
    private static resetFailedAttempts(userId: string): void {
        db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(userId);
    }

    /**
     * Unlock account
     */
    private static unlockAccount(userId: string): void {
        db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(userId);
    }

    /**
     * Update last login timestamp
     */
    private static updateLastLogin(userId: string): void {
        db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    }

    /**
     * Get user by ID
     */
    static getUserById(userId: string): any {
        return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    }

    /**
     * Get user by email
     */
    private static getUserByEmail(email: string): any {
        return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    }

    /**
     * Get all users (admin only)
     */
    static getAllUsers(): User[] {
        return db.prepare('SELECT id, email, full_name, role, department, is_active, created_at, last_login FROM users').all() as User[];
    }

    /**
     * Update user role (admin only)
     */
    static updateUserRole(userId: string, role: User['role'], adminId: string): void {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);

        AuditService.log({
            user_id: adminId,
            action: 'USER_ROLE_UPDATED',
            resource_type: 'user',
            resource_id: userId,
            details: JSON.stringify({ new_role: role }),
        });
    }

    /**
     * Deactivate user (admin only)
     */
    static deactivateUser(userId: string, adminId: string): void {
        db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(userId);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

        AuditService.log({
            user_id: adminId,
            action: 'USER_DEACTIVATED',
            resource_type: 'user',
            resource_id: userId,
        });
    }

    /**
     * Activate user (admin only)
     */
    static activateUser(userId: string, adminId: string): void {
        db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(userId);

        AuditService.log({
            user_id: adminId,
            action: 'USER_ACTIVATED',
            resource_type: 'user',
            resource_id: userId,
        });
    }
}
