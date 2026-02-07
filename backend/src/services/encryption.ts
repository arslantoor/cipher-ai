import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

export class EncryptionService {
    /**
     * Encrypt sensitive data using AES-256
     */
    static encrypt(data: any): string {
        const jsonString = JSON.stringify(data);
        return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
    }

    /**
     * Decrypt sensitive data
     */
    static decrypt(encryptedData: string): any {
        const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
        const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decryptedString);
    }

    /**
     * Hash sensitive identifiers (one-way)
     */
    static hash(data: string): string {
        return CryptoJS.SHA256(data).toString();
    }

    /**
     * Mask PII for display (e.g., email, phone)
     */
    static maskEmail(email: string): string {
        const [local, domain] = email.split('@');
        if (local.length <= 2) return `${local[0]}***@${domain}`;
        return `${local.substring(0, 2)}***@${domain}`;
    }

    static maskUserId(userId: string): string {
        if (userId.length <= 4) return '***';
        return `${userId.substring(0, 4)}***`;
    }
}
