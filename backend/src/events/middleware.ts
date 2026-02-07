// Event Validation Middleware - Wraps event handlers with validation
import { SystemEvent } from './schema';
import { EventValidator, ValidationResult } from './validation';
import { EventHandler } from './types';

export interface ValidationMiddlewareOptions {
    strict?: boolean; // If true, reject invalid events. If false, log and continue
    logWarnings?: boolean;
}

/**
 * Middleware to validate events before processing
 */
export function withValidation<T extends SystemEvent>(
    handler: EventHandler<T>,
    options: ValidationMiddlewareOptions = {}
): EventHandler<T> {
    const { strict = true, logWarnings = true } = options;

    return async (event: T) => {
        // Validate event
        const validation = EventValidator.validate(event);

        if (!validation.valid) {
            if (strict) {
                throw new Error(
                    `Event validation failed: ${validation.errors.map(e => `${e.field}: ${e.message}`).join(', ')}`
                );
            } else {
                console.warn(`[ValidationMiddleware] Event validation failed but continuing:`, validation.errors);
            }
        }

        if (logWarnings && validation.warnings.length > 0) {
            console.warn(`[ValidationMiddleware] Validation warnings:`, validation.warnings);
        }

        // Check replay safety
        if (!EventValidator.isReplaySafe(event)) {
            console.warn(`[ValidationMiddleware] Event may not be replay-safe: ${event.event_id}`);
        }

        // Call original handler
        return handler(event);
    };
}

/**
 * Middleware to add correlation tracking
 */
export function withCorrelationTracking<T extends SystemEvent>(
    handler: EventHandler<T>,
    agentId: string
): EventHandler<T> {
    return async (event: T) => {
        // Ensure correlation_id is set if missing
        if (!event.correlation_id && event.event_id) {
            event.correlation_id = event.event_id;
        }

        // Ensure source_agent is set
        if (!event.source_agent) {
            event.source_agent = agentId;
        }

        return handler(event);
    };
}

/**
 * Middleware to add version checking
 */
export function withVersionCheck<T extends SystemEvent>(
    handler: EventHandler<T>,
    supportedVersions: string[] = ['1.0.0']
): EventHandler<T> {
    return async (event: T) => {
        const eventVersion = (event as any).version;

        if (!eventVersion) {
            console.warn(`[VersionCheck] Event missing version: ${event.event_id}`);
        } else if (!supportedVersions.includes(eventVersion)) {
            console.warn(
                `[VersionCheck] Event version ${eventVersion} not in supported versions: ${supportedVersions.join(', ')}`
            );
            // Could implement version migration logic here
        }

        return handler(event);
    };
}

/**
 * Compose multiple middlewares
 */
export function composeMiddleware<T extends SystemEvent>(
    ...middlewares: Array<(handler: EventHandler<T>) => EventHandler<T>>
): (handler: EventHandler<T>) => EventHandler<T> {
    return (handler: EventHandler<T>) => {
        return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
    };
}