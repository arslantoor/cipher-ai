import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuditService } from '../services/audit';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        email: string;
        role: 'admin' | 'senior_analyst' | 'analyst';
    };
}

/**
 * Verify JWT token and attach user to request
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
        };

        next();
    } catch (error) {
        AuditService.log({
            action: 'AUTH_FAILED',
            details: 'Invalid or expired token',
            ip_address: req.ip,
            user_agent: req.get('user-agent'),
        });

        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * Check if user has required role
 */
export function authorize(...allowedRoles: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            AuditService.log({
                user_id: req.user.userId,
                action: 'AUTHORIZATION_FAILED',
                details: `Required roles: ${allowedRoles.join(', ')}, User role: ${req.user.role}`,
                ip_address: req.ip,
            });

            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
}

/**
 * Optional authentication (doesn't fail if no token)
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, JWT_SECRET) as any;

            req.user = {
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role,
            };
        }
    } catch (error) {
        // Silently fail for optional auth
    }

    next();
}
