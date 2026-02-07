// WhatsApp Service - Send notifications via WhatsApp API
import { EncryptionService } from './encryption';
import { AuditService } from './audit';

export interface WhatsAppMessage {
    to: string;
    message: string;
}

export interface WhatsAppDeliveryResult {
    number: string;
    success: boolean;
    error?: string;
    messageId?: string;
    timestamp?: string;
}

export class WhatsAppService {
    private apiKey: string;
    private apiUrl: string;
    private provider: 'twilio' | 'meta' | 'generic';
    private accountSid?: string; // For Twilio
    private maxRetries = 3;
    private retryDelay = 1000; // ms

    constructor() {
        this.apiKey = process.env.WHATSAPP_API_KEY || '';
        const envApiUrl = process.env.WHATSAPP_API_URL || '';
        
        // Detect provider from env variable
        const providerEnv = process.env.WHATSAPP_PROVIDER?.toLowerCase();
        
        if (providerEnv === 'twilio') {
            this.provider = 'twilio';
            // For Twilio, API key format is "AccountSid:AuthToken"
            const parts = this.apiKey.split(':');
            if (parts.length === 2) {
                this.accountSid = parts[0];
                // Construct Twilio URL with Account SID
                this.apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
            } else {
                // Fallback to env URL if format is wrong
                this.apiUrl = envApiUrl || 'https://api.twilio.com/2010-04-01/Accounts/Messages.json';
            }
            
            // Log Twilio configuration
            const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
            console.log(`[WhatsAppService] Twilio configured:`);
            console.log(`  - Provider: ${this.provider}`);
            console.log(`  - Account SID: ${this.accountSid ? this.accountSid.substring(0, 10) + '...' : 'NOT SET'}`);
            console.log(`  - WhatsApp Number from .env: ${twilioNumber || 'NOT SET'}`);
            console.log(`  - API URL: ${this.apiUrl}`);
        } else if (providerEnv === 'meta' || envApiUrl.includes('graph.facebook.com')) {
            this.provider = 'meta';
            this.apiUrl = envApiUrl || 'https://graph.facebook.com/v18.0/messages';
        } else {
            this.provider = 'generic';
            this.apiUrl = envApiUrl || 'https://api.whatsapp.com/v1/messages';
        }
    }

    /**
     * Send WhatsApp message
     */
    async sendMessage(message: WhatsAppMessage): Promise<WhatsAppDeliveryResult> {
        const startTime = Date.now();
        let lastError: Error | null = null;

        console.log(`[WhatsAppService] Sending message to: ${message.to}`);
        console.log(`[WhatsAppService] Message length: ${message.message.length} characters`);
        console.log(`[WhatsAppService] Provider: ${this.provider}, Has API Key: ${!!this.apiKey}`);

        // Validate phone number format
        const normalizedNumber = this.normalizePhoneNumber(message.to);
        if (!normalizedNumber) {
            console.error(`[WhatsAppService] Invalid phone number format: ${message.to}`);
            return {
                number: message.to,
                success: false,
                error: 'Invalid phone number format',
            };
        }
        
        console.log(`[WhatsAppService] Normalized number: ${normalizedNumber}`);

        // Retry logic
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                // In production, make actual API call
                // For now, simulate or use actual WhatsApp API
                const result = await this.callWhatsAppAPI({
                    to: normalizedNumber,
                    message: message.message,
                });

                const deliveryTime = Date.now() - startTime;

                // Log successful delivery
                AuditService.log({
                    action: 'WHATSAPP_MESSAGE_SENT',
                    resource_type: 'whatsapp',
                    resource_id: result.messageId || 'unknown',
                    details: JSON.stringify({
                        to: this.maskPhoneNumber(normalizedNumber),
                        message_length: message.message.length,
                        delivery_time_ms: deliveryTime,
                        attempt: attempt,
                    }),
                });

                return {
                    number: normalizedNumber,
                    success: true,
                    messageId: result.messageId,
                    timestamp: new Date().toISOString(),
                };
            } catch (error: any) {
                lastError = error;
                
                if (attempt < this.maxRetries) {
                    console.warn(
                        `[WhatsAppService] Send failed, retry ${attempt}/${this.maxRetries}:`,
                        error.message
                    );
                    await this.delay(this.retryDelay * attempt);
                }
            }
        }

        // Max retries exceeded
        AuditService.log({
            action: 'WHATSAPP_MESSAGE_FAILED',
            resource_type: 'whatsapp',
            resource_id: 'unknown',
            details: JSON.stringify({
                to: this.maskPhoneNumber(normalizedNumber),
                error: lastError?.message,
                retry_count: this.maxRetries,
            }),
        });

        return {
            number: normalizedNumber,
            success: false,
            error: lastError?.message || 'WhatsApp API call failed after retries',
        };
    }

    /**
     * Call WhatsApp API (supports Twilio, Meta, and generic providers)
     */
    private async callWhatsAppAPI(message: WhatsAppMessage): Promise<{ messageId: string }> {
        if (!this.apiKey) {
            console.warn('[WhatsAppService] No API key configured, simulating message send');
            console.warn('[WhatsAppService] Set WHATSAPP_API_KEY in .env to send real messages');
            return {
                messageId: `sim-${Date.now()}`,
            };
        }
        
        console.log(`[WhatsAppService] Calling WhatsApp API (${this.provider})`);
        console.log(`[WhatsAppService] API URL: ${this.apiUrl}`);

        // Format phone number with whatsapp: prefix for Twilio
        const formattedTo = this.provider === 'twilio' 
            ? `whatsapp:${message.to}` 
            : message.to;

        let headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        let body: any;

        // Provider-specific configuration
        if (this.provider === 'twilio') {
            // Twilio uses Basic Auth with AccountSid:AuthToken
            const [accountSid, authToken] = this.apiKey.split(':');
            if (!accountSid || !authToken) {
                throw new Error('Twilio API key must be in format: AccountSid:AuthToken');
            }
            if (!this.accountSid) {
                this.accountSid = accountSid;
            }
            
            const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
            
            // Get Twilio WhatsApp number from env
            const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
            if (!twilioNumber) {
                throw new Error('TWILIO_WHATSAPP_NUMBER environment variable is required for Twilio. For sandbox, use +14155238886');
            }
            
            // Validate number format
            if (!twilioNumber.startsWith('+')) {
                throw new Error('TWILIO_WHATSAPP_NUMBER must include country code with + prefix (e.g., +14155238886)');
            }
            
            console.log(`[WhatsAppService] Using Twilio WhatsApp number: ${twilioNumber}`);
            
            // Twilio Messages API requires form-encoded data, not JSON
            const formData = new URLSearchParams();
            formData.append('From', `whatsapp:${twilioNumber}`);
            formData.append('To', formattedTo);
            formData.append('Body', message.message);

            console.log(`[WhatsAppService] Twilio request:`, {
                url: this.apiUrl,
                from: `whatsapp:${twilioNumber}`,
                to: formattedTo,
                message_length: message.message.length,
            });

            // Twilio requires application/x-www-form-urlencoded, not JSON
            headers['Content-Type'] = 'application/x-www-form-urlencoded';

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers,
                body: formData.toString(),
            });

            const responseText = await response.text();
            console.log(`[WhatsAppService] Twilio response status: ${response.status}`);
            console.log(`[WhatsAppService] Twilio response: ${responseText.substring(0, 500)}`);

            if (!response.ok) {
                let errorMessage = `Twilio WhatsApp API error: ${responseText}`;
                
                try {
                    const errorData = JSON.parse(responseText);
                    
                    // Provide helpful error messages for common issues
                    if (errorData.code === 63007) {
                        errorMessage = `Twilio WhatsApp channel not found. The number ${twilioNumber} is not configured for WhatsApp in your Twilio account. ` +
                            `To fix this:\n` +
                            `1. Go to Twilio Console → Messaging → Settings → WhatsApp Sandbox\n` +
                            `2. Verify that ${twilioNumber} is listed as your WhatsApp sender number\n` +
                            `3. If using sandbox, make sure you're using the sandbox number (usually +14155238886)\n` +
                            `4. If ${twilioNumber} is a custom number, ensure it's verified and enabled for WhatsApp in Twilio Console`;
                    } else if (errorData.code === 21608) {
                        errorMessage = `Recipient ${formattedTo} has not joined the Twilio WhatsApp sandbox. ` +
                            `Send the join code from Twilio Console to ${formattedTo} first.`;
                    }
                } catch (e) {
                    // If parsing fails, use original error
                }
                
                throw new Error(errorMessage);
            }

            const data = JSON.parse(responseText) as { sid?: string };
            console.log(`[WhatsAppService] Message sent successfully. SID: ${data.sid}`);
            return {
                messageId: data.sid || `msg-${Date.now()}`,
            };
        } else if (this.provider === 'meta') {
            // Meta WhatsApp Business API uses Bearer token
            headers['Authorization'] = `Bearer ${this.apiKey}`;
            
            body = {
                messaging_product: 'whatsapp',
                to: formattedTo,
                type: 'text',
                text: {
                    body: message.message,
                },
            };

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Meta WhatsApp API error: ${error}`);
            }

            const data = await response.json() as { messages?: Array<{ id?: string }>, id?: string };
            return {
                messageId: data.messages?.[0]?.id || data.id || `msg-${Date.now()}`,
            };
        } else {
            // Generic provider - use Bearer token
            headers['Authorization'] = `Bearer ${this.apiKey}`;
            
            body = {
                to: formattedTo,
                text: message.message,
            };

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`WhatsApp API error: ${error}`);
            }

            const data = await response.json() as { message_id?: string, id?: string };
            return {
                messageId: data.message_id || data.id || `msg-${Date.now()}`,
            };
        }
    }

    /**
     * Normalize phone number format to E.164 (e.g., +1234567890)
     */
    private normalizePhoneNumber(phone: string): string | null {
        // Remove all non-digit characters except +
        let cleaned = phone.trim();
        
        // If already in E.164 format (starts with +), keep it
        if (cleaned.startsWith('+')) {
            const digits = cleaned.replace(/\D/g, '');
            if (digits.length >= 10 && digits.length <= 15) {
                return `+${digits}`;
            }
            return null;
        }

        // Remove all non-digit characters
        const digits = cleaned.replace(/\D/g, '');

        // Validate length (should be 10-15 digits)
        if (digits.length < 10 || digits.length > 15) {
            return null;
        }

        // Add country code if missing (assume +1 for US, adjust as needed)
        if (digits.length === 10) {
            return `+1${digits}`; // Add US country code with +
        }

        return `+${digits}`;
    }

    /**
     * Mask phone number for logging
     */
    private maskPhoneNumber(phone: string): string {
        if (phone.length <= 4) return '***';
        return `${phone.substring(0, phone.length - 4)}****`;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
