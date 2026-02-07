# 🧪 Complete Testing Guide - CipherAI Fraud Investigation Platform

This guide walks you through testing the entire system end-to-end, from creating alerts to receiving WhatsApp notifications.

## 🚀 Prerequisites

1. **Backend running** on `http://localhost:3001`
2. **Frontend running** on `http://localhost:3000`
3. **Database seeded** (run `npm run seed` in backend)
4. **WhatsApp configured** (Twilio credentials in `.env`)
5. **WhatsApp number added** in system settings

## 📋 Step-by-Step Testing Flow

### Step 1: Start Both Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Verify:**
- Backend: `✅ CipherAI backend running on port 3001`
- Frontend: Open `http://localhost:3000` in browser

---

### Step 2: Login to Frontend

1. Open `http://localhost:3000`
2. **Login Credentials:**
   - **Email:** `admin@cipherai.com`
   - **Password:** `Admin123!`
3. You should see the dashboard with the alert queue

---

### Step 3: Configure WhatsApp (If Not Done)

1. In the frontend, navigate to **WhatsApp Settings** (admin panel)
2. Add your WhatsApp number: `+923066225182`
3. Enable WhatsApp notifications
4. Verify it's saved

**Or via API:**
```bash
# Get JWT token first (login)
TOKEN="your-jwt-token"

# Add WhatsApp number
curl -X POST http://localhost:3001/api/settings/whatsapp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"number": "+923066225182"}'

# Enable notifications
curl -X PATCH http://localhost:3001/api/settings/whatsapp/enabled \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"enabled": true}'
```

---

### Step 4: Create Test Alerts via Frontend

#### Test Case 1: High Severity Alert (Money Laundering)

1. Click **"+ Create Alert"** button (top right)
2. Fill in the form:
   - **User ID:** `USR-001`
   - **Alert Type:** `Money Laundering`
   - **Amount:** `50000`
   - **City:** `New York`
   - **Country:** `US`
   - **Rules:** `high_velocity, unusual_amount`
3. Click **"Generate Alert"**

**Expected Results:**
- Alert appears in the queue (left sidebar)
- Backend logs show:
  - `[API] Publishing fraud alert event`
  - `[InvestigationReportAgent] INVESTIGATION_STARTED`
  - `[InvestigationReportAgent] WhatsApp enabled. Found 1 numbers`
  - `[WhatsAppService] Message sent successfully`
- WhatsApp message received on `+923066225182`

#### Test Case 2: Medium Severity Alert (Account Takeover)

1. Click **"+ Create Alert"**
2. Fill in:
   - **User ID:** `USR-002`
   - **Alert Type:** `Account Takeover`
   - **Amount:** `5000`
   - **City:** `London`
   - **Country:** `UK`
   - **Rules:** `device_change`
3. Click **"Generate Alert"**

#### Test Case 3: Critical Severity Alert (Unusual Velocity)

1. Click **"+ Create Alert"**
2. Fill in:
   - **User ID:** `USR-003`
   - **Alert Type:** `Unusual Velocity`
   - **Amount:** `100000`
   - **City:** `Dubai`
   - **Country:** `UAE`
   - **Rules:** `high_velocity, unusual_amount, geographical_anomaly`
3. Click **"Generate Alert"**

---

### Step 5: View Investigation Results

1. **Select an alert** from the queue (left sidebar)
2. The investigation view will show:
   - **Severity Badge** (LOW/MEDIUM/HIGH/CRITICAL)
   - **Risk Score** (0-100)
   - **Investigation Narrative** (AI-generated)
   - **Timeline** of events
   - **Allowed Actions** based on severity
   - **Network Analysis** (if available)

3. **Check Action Panel:**
   - Different severity levels show different allowed actions
   - CRITICAL: Suspend Account, Freeze Assets, etc.
   - HIGH: Flag for Review, Require 2FA, etc.
   - MEDIUM: Monitor, Request Verification, etc.
   - LOW: Log Only, etc.

---

### Step 6: Verify WhatsApp Notifications

1. **Check your WhatsApp** (`+923066225182`)
2. You should receive messages like:
   ```
   🚨 Fraud Alert 🟠
   
   Alert: [alert-id]
   Severity: HIGH
   Risk Score: 75/100
   
   [Investigation Summary...]
   ```

3. **Check backend logs** for delivery status:
   - `[WhatsAppService] Message sent successfully. SID: SM...`
   - Or error details if delivery failed

4. **View WhatsApp stats:**
   ```bash
   curl -X GET http://localhost:3001/api/settings/whatsapp/list \
     -H "Authorization: Bearer $TOKEN"
   ```

---

### Step 7: Test Different Scenarios

#### Scenario A: Multiple Alerts in Sequence

1. Create 3-5 alerts quickly
2. Verify:
   - All alerts appear in queue
   - Each triggers investigation
   - Each sends WhatsApp notification
   - No duplicate processing

#### Scenario B: Different User IDs

1. Create alerts with different User IDs:
   - `USR-001`, `USR-002`, `USR-003`
2. Verify:
   - Each user's baseline is calculated separately
   - Investigations are independent
   - WhatsApp notifications include correct alert IDs

#### Scenario C: Different Severity Levels

1. Create alerts with different amounts to trigger different severities:
   - **LOW:** Amount: `1000`
   - **MEDIUM:** Amount: `10000`
   - **HIGH:** Amount: `50000`
   - **CRITICAL:** Amount: `100000`
2. Verify:
   - Correct severity classification
   - Appropriate actions available
   - WhatsApp messages reflect severity

---

## 🔍 Verification Checklist

After each test, verify:

- [ ] Alert created successfully
- [ ] Alert appears in frontend queue
- [ ] Investigation runs automatically
- [ ] Severity is classified correctly
- [ ] Narrative is generated (AI-powered)
- [ ] WhatsApp notification sent
- [ ] WhatsApp message received on phone
- [ ] Backend logs show no errors
- [ ] Investigation view displays correctly
- [ ] Actions are available based on severity

---

## 🐛 Troubleshooting

### Alert Not Appearing in Queue

**Check:**
- Backend is running
- Frontend is connected to backend
- Browser console for errors
- Backend logs for API errors

### WhatsApp Not Received

**Check:**
1. WhatsApp number is configured:
   ```bash
   curl -X GET http://localhost:3001/api/settings/whatsapp \
     -H "Authorization: Bearer $TOKEN"
   ```

2. WhatsApp notifications are enabled

3. Twilio credentials in `.env`:
   ```env
   WHATSAPP_PROVIDER=twilio
   WHATSAPP_API_KEY=ACxxx:xxx
   TWILIO_WHATSAPP_NUMBER=+12202377719
   ```

4. Backend logs show WhatsApp service calls

5. For Twilio Sandbox: Recipient must join sandbox first

### Investigation Not Running

**Check:**
- Backend logs for event processing
- Event orchestrator is running
- Agents are started (check logs: `[AgentManager] All agents started`)
- No validation errors in logs

### Narrative Not Generated

**Check:**
- `GEMINI_API_KEY` is set in `.env`
- Backend logs show Gemini API calls
- Check for API quota/rate limits

---

## 📊 Sample Test Data

### High-Risk Transaction
```json
{
  "user_id": "USR-HIGH-001",
  "alert_type": "money_laundering",
  "amount": "75000",
  "city": "Miami",
  "country": "US",
  "rules": "high_velocity, unusual_amount, geographical_anomaly"
}
```

### Medium-Risk Transaction
```json
{
  "user_id": "USR-MED-001",
  "alert_type": "account_takeover",
  "amount": "15000",
  "city": "Toronto",
  "country": "CA",
  "rules": "device_change, unusual_hours"
}
```

### Low-Risk Transaction
```json
{
  "user_id": "USR-LOW-001",
  "alert_type": "unusual_velocity",
  "amount": "2500",
  "city": "Boston",
  "country": "US",
  "rules": "velocity_check"
}
```

---

## 🎯 Expected Flow Summary

```
User Creates Alert (Frontend)
    ↓
Alert Saved to Database
    ↓
FRAUD_ALERT_CREATED Event Emitted
    ↓
InvestigationReportAgent Receives Event
    ↓
Agent Analyzes Alert Data
    ↓
AI Generates Investigation Narrative (Gemini)
    ↓
Narrative Stored in Database
    ↓
WhatsApp Numbers Retrieved from Config
    ↓
Message Formatted for WhatsApp
    ↓
WhatsApp Service Sends via Twilio
    ↓
Message Delivered to +923066225182
    ↓
Investigation Complete - Available in Frontend
```

---

## ✅ Success Criteria

The system is working correctly if:

1. ✅ Alerts can be created via frontend
2. ✅ Alerts appear in queue immediately
3. ✅ Investigations run automatically (no manual trigger needed)
4. ✅ Severity is classified correctly
5. ✅ AI narratives are generated
6. ✅ WhatsApp notifications are sent
7. ✅ WhatsApp messages are received
8. ✅ Investigation view shows all data
9. ✅ Actions are available based on severity
10. ✅ No errors in backend logs

---

## 🚀 Quick Test Script

Run this to test everything quickly:

```bash
# 1. Start backend (Terminal 1)
cd backend && npm run dev

# 2. Start frontend (Terminal 2)
cd frontend && npm run dev

# 3. Open browser
open http://localhost:3000

# 4. Login: admin@cipherai.com / Admin123!

# 5. Create alert via UI or API
# 6. Check WhatsApp for notification
# 7. View investigation in frontend
```

---

## 📝 Notes

- **First-time setup:** Run `npm run seed` in backend to create default users
- **WhatsApp Sandbox:** If using Twilio sandbox, join it first
- **API Testing:** Use Postman or curl for API-level testing
- **Logs:** Check both frontend (browser console) and backend (terminal) logs
- **Database:** SQLite database is in `backend/data/cipherai.db`

---

**Happy Testing! 🎉**
