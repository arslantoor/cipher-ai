# WhatsApp Configuration Guide

This guide explains how to configure WhatsApp notifications for receiving fraud investigation reports.

## Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```env
# WhatsApp API Configuration
WHATSAPP_API_KEY=your-api-key-here
WHATSAPP_API_URL=https://api.whatsapp.com/v1/messages
```

## Supported Providers

### Option 1: Twilio WhatsApp API (Recommended for Development)

1. **Sign up for Twilio**: https://www.twilio.com/try-twilio
2. **Get your credentials**:
   - Account SID
   - Auth Token
3. **Configure WhatsApp Sandbox** (for testing):
   - Go to Twilio Console → Messaging → Try it out → Send a WhatsApp message
   - Follow instructions to join the sandbox
   - Note your Twilio WhatsApp number (format: +14155238886)
4. **Set environment variables**:
   ```env
   WHATSAPP_PROVIDER=twilio
   WHATSAPP_API_KEY=your-account-sid:your-auth-token
   WHATSAPP_API_URL=https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
   TWILIO_WHATSAPP_NUMBER=+14155238886
   ```
   Replace `{AccountSid}` with your actual Account SID and `TWILIO_WHATSAPP_NUMBER` with your Twilio WhatsApp number.

**Note**: The service automatically detects Twilio from the URL or `WHATSAPP_PROVIDER` env variable and uses Basic Auth.

### Option 2: WhatsApp Business API (Meta)

1. **Create a Meta Business Account**: https://business.facebook.com
2. **Set up WhatsApp Business API**:
   - Go to Meta for Developers
   - Create a WhatsApp Business App
   - Get your Access Token and Phone Number ID
3. **Set environment variables**:
   ```env
   WHATSAPP_PROVIDER=meta
   WHATSAPP_API_KEY=your-meta-access-token
   WHATSAPP_API_URL=https://graph.facebook.com/v18.0/{phone-number-id}/messages
   ```
   Replace `{phone-number-id}` with your actual Phone Number ID.

**Note**: The service automatically detects Meta from the URL or `WHATSAPP_PROVIDER` env variable.

### Option 3: Other Providers

For other WhatsApp Business API providers, adjust the `WHATSAPP_API_URL` and authentication method in the service implementation.

## Complete .env File Template

Here's a complete `.env` file template with all required variables:

```env
# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:3000

# Authentication & Security
JWT_SECRET=change-this-secret-in-production
JWT_REFRESH_SECRET=change-this-refresh-secret-in-production
ENCRYPTION_KEY=change-this-encryption-key-in-production

# Google Gemini API (for AI narrative generation)
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.5-flash

# WhatsApp API Configuration
# Optional: Specify provider (twilio, meta, or leave empty for auto-detect)
WHATSAPP_PROVIDER=
WHATSAPP_API_KEY=your-whatsapp-api-key-here
WHATSAPP_API_URL=https://api.whatsapp.com/v1/messages
# For Twilio only:
TWILIO_WHATSAPP_NUMBER=+1234567890
```

## Setting Up WhatsApp Numbers

After configuring the API, you need to add WhatsApp numbers in the system:

1. **Login as Admin** to the frontend
2. **Navigate to WhatsApp Settings** (admin panel)
3. **Add your WhatsApp number** in E.164 format (e.g., `+1234567890`)
4. **Enable WhatsApp notifications**

Alternatively, you can add numbers via the API:

```bash
curl -X POST http://localhost:3001/api/settings/whatsapp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"number": "+1234567890"}'
```

## Testing

1. **Start the backend**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Create a test alert** through the frontend or API

3. **Check your WhatsApp** - you should receive a notification with the investigation report

## Troubleshooting

### No messages received?

1. **Check API key**: Verify `WHATSAPP_API_KEY` is set correctly
2. **Check API URL**: Ensure `WHATSAPP_API_URL` matches your provider
3. **Check logs**: Look for WhatsApp service errors in backend console
4. **Verify numbers**: Ensure WhatsApp numbers are added and enabled in settings
5. **Check provider status**: Verify your WhatsApp provider account is active

### Development Mode

If no API key is configured, the service will simulate message sending (you'll see warnings in logs). This allows development without a WhatsApp provider account.

## Security Notes

- **Never commit `.env` file** to version control
- **Use strong secrets** for production
- **Rotate API keys** regularly
- **Monitor usage** to prevent abuse
