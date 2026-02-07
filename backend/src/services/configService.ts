// Configuration Service - Retrieve system configuration
import { db } from '../config/database';
import { EncryptionService } from './encryption';

export class ConfigService {
    /**
     * Get system configuration value
     */
    static getConfig(key: string): string | null {
        const row = db.prepare(`
            SELECT value FROM system_settings
            WHERE key = ?
        `).get(key) as { value: string } | undefined;

        return row?.value || null;
    }

    /**
     * Set system configuration value
     */
    static setConfig(key: string, value: string, updatedBy?: string): void {
        db.prepare(`
            INSERT OR REPLACE INTO system_settings (key, value, updated_by, updated_at)
            VALUES (?, ?, ?, ?)
        `).run(key, value, updatedBy || null, new Date().toISOString());
    }

    /**
     * Get WhatsApp notification numbers
     * Returns array of phone numbers from system configuration
     */
    static getWhatsAppNumbers(): string[] {
        const configValue = this.getConfig('whatsapp_notification_numbers');
        
        if (!configValue) {
            return [];
        }

        try {
            // Configuration stored as JSON array
            const numbers = JSON.parse(configValue);
            if (Array.isArray(numbers)) {
                return numbers.filter((n: any) => typeof n === 'string' && n.length > 0);
            }
        } catch (error) {
            console.error('[ConfigService] Failed to parse WhatsApp numbers:', error);
        }

        return [];
    }

    /**
     * Set WhatsApp notification numbers
     */
    static setWhatsAppNumbers(numbers: string[], updatedBy?: string): void {
        this.setConfig('whatsapp_notification_numbers', JSON.stringify(numbers), updatedBy);
    }

    /**
     * Get all configuration keys
     */
    static getAllConfig(): Record<string, string> {
        const rows = db.prepare(`
            SELECT key, value FROM system_settings
        `).all() as Array<{ key: string; value: string }>;

        const config: Record<string, string> = {};
        rows.forEach(row => {
            config[row.key] = row.value;
        });

        return config;
    }
}
