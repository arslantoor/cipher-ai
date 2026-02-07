# 🔒 Data Validation Guide - Ensuring Legitimate Insights

## Overview

The system includes comprehensive data validation to ensure all trading insights are generated from **legitimate, realistic data**. This prevents fake, manipulated, or invalid data from creating misleading insights.

---

## ✅ What Gets Validated

### 1. Market Data Validation

- **Price Ranges**: Checks if prices are within realistic ranges for each instrument
  - EURUSD: 0.8000 - 1.5000
  - BTCUSD: 10,000 - 100,000
  - XAUUSD: 1,000 - 3,000
  - etc.

- **OHLC Logic**: Validates that High >= Open/Close and Low <= Open/Close

- **Price Movements**: Ensures percent changes are realistic (0.01% - 15%)

- **Volatility**: Validates volatility is within normal ranges (0.1% - 10%)

- **Cross-Validation**: Checks that percentChange matches OHLC calculation

### 2. Trade Data Validation

- **Required Fields**: trade_id, trader_id, instrument, timestamp, position_size

- **Timestamp Validation**:
  - Must be valid date format
  - Cannot be in the future
  - Warns if more than 1 year old

- **Position Size**: Must be between $10 and $1,000,000

- **PnL Validation**: Checks if PnL is realistic relative to position size

- **Trade Sequence**: Validates trades are in chronological order

- **Duplicate Detection**: Prevents duplicate trade IDs

### 3. Suspicious Pattern Detection

- **Extreme Movements**: Flags movements > 20%

- **Unrealistic Position Sizes**: Flags positions > $10M

- **Perfect Patterns**: Detects suspicious patterns (all wins/losses)

- **Unrealistic Win Rates**: Flags win rates > 95% or < 5%

- **Rapid-Fire Trades**: Detects trades within 5 seconds (potential manipulation)

---

## 🛡️ How Validation Works

### Automatic Validation

Every API request to `/api/autonomous/run` is automatically validated:

```typescript
// 1. Validate data structure
const validation = DataValidator.validateInsightRequest({ trader_id, trades, market_data });

// 2. Check for suspicious patterns
const suspicious = DataValidator.detectSuspiciousPatterns({ trades, market_data });

// 3. Reject if invalid
if (!validation.valid) {
    return res.status(400).json({ 
        error: 'Invalid data',
        validation_errors: validation.errors 
    });
}

// 4. Log warnings if suspicious
if (suspicious.suspicious) {
    AuditService.log({ action: 'SUSPICIOUS_DATA_DETECTED' });
}
```

### Validation in Autonomous Demo

The autonomous demo service also validates generated data:

```typescript
// Generate data
const trades = this.generateTrades(...);
const marketData = this.generateMarketData(...);

// Validate before processing
const validation = DataValidator.validateInsightRequest(...);

// Regenerate if invalid
if (!validation.valid) {
    return this.generateRandomInsight(); // Try again
}
```

---

## 📊 Validation Results

### Response Format

When data is validated, the API response includes:

```json
{
  "success": true,
  "insight": { ... },
  "validation": {
    "passed": true,
    "warnings": [
      "Price movement (0.05%) is very small"
    ],
    "suspicious_patterns": null
  }
}
```

### Error Response

If validation fails:

```json
{
  "error": "Invalid data provided",
  "validation_errors": [
    "High price cannot be less than low price",
    "Position size (5) is below minimum (10)"
  ],
  "warnings": [
    "Instrument format (XYZ) may be invalid"
  ]
}
```

---

## 🔍 Example Validations

### ✅ Valid Data

```json
{
  "trader_id": "TRADER-001",
  "trades": [
    {
      "trade_id": "t1",
      "trader_id": "TRADER-001",
      "instrument": "EURUSD",
      "timestamp": "2024-01-15T10:00:00Z",
      "position_size": 1000,
      "pnl": 50
    }
  ],
  "market_data": {
    "instrument": "EURUSD",
    "percentChange": 1.5,
    "volatility": 0.012,
    "ohlc": {
      "open": 1.1000,
      "high": 1.1025,
      "low": 1.0995,
      "close": 1.1015
    }
  }
}
```

**Result**: ✅ Passes validation

### ❌ Invalid Data

```json
{
  "trader_id": "TRADER-001",
  "trades": [
    {
      "trade_id": "t1",
      "trader_id": "TRADER-001",
      "instrument": "EURUSD",
      "timestamp": "2024-01-15T10:00:00Z",
      "position_size": 5,  // ❌ Too small
      "pnl": 50
    }
  ],
  "market_data": {
    "instrument": "EURUSD",
    "percentChange": 25.0,  // ❌ Too extreme
    "ohlc": {
      "open": 1.1000,
      "high": 1.0995,  // ❌ High < Low
      "low": 1.1025,
      "close": 1.1015
    }
  }
}
```

**Result**: ❌ Rejected with errors:
- "Position size (5) is below minimum (10)"
- "Price movement (25.0%) exceeds realistic maximum (15.0%)"
- "High price cannot be less than low price"

### ⚠️ Suspicious Data

```json
{
  "trades": [
    { "pnl": 100 },
    { "pnl": 150 },
    { "pnl": 200 },
    { "pnl": 120 },
    { "pnl": 180 }
  ]
}
```

**Result**: ⚠️ Warning:
- "All trades have same PnL direction (suspicious pattern)"
- "Unrealistic win rate: 100.0%"

---

## 🔐 Security Features

### 1. Audit Logging

All validation events are logged:

- **Invalid Data Rejected**: Logged with errors
- **Suspicious Patterns**: Logged with reasons
- **Validation Warnings**: Logged for review

### 2. Data Source Tracking

The system tracks:
- Who submitted the data (user_id)
- When it was submitted (timestamp)
- Validation results (errors, warnings)
- Whether it was accepted or rejected

### 3. Automatic Rejection

Invalid data is **automatically rejected** - no insights are generated from invalid data.

---

## 🧪 Testing Validation

### Test Valid Data

```bash
curl -X POST http://localhost:3001/api/autonomous/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "trader_id": "TRADER-001",
    "trades": [{
      "trade_id": "t1",
      "trader_id": "TRADER-001",
      "instrument": "EURUSD",
      "timestamp": "2024-01-15T10:00:00Z",
      "position_size": 1000,
      "pnl": 50
    }],
    "market_data": {
      "instrument": "EURUSD",
      "percentChange": 1.5,
      "volatility": 0.012
    }
  }'
```

**Expected**: ✅ Success with validation passed

### Test Invalid Data

```bash
curl -X POST http://localhost:3001/api/autonomous/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "trader_id": "TRADER-001",
    "trades": [{
      "trade_id": "t1",
      "trader_id": "TRADER-001",
      "instrument": "EURUSD",
      "timestamp": "2024-01-15T10:00:00Z",
      "position_size": 5,
      "pnl": 50
    }],
    "market_data": {
      "instrument": "EURUSD",
      "percentChange": 1.5
    }
  }'
```

**Expected**: ❌ 400 error with validation errors

---

## 📋 Validation Checklist

Before generating insights, the system checks:

- [x] All required fields present
- [x] Data types are correct
- [x] Price ranges are realistic
- [x] OHLC logic is valid
- [x] Timestamps are valid and not in future
- [x] Position sizes are within limits
- [x] PnL is realistic
- [x] Trades are in chronological order
- [x] No duplicate trade IDs
- [x] No suspicious patterns
- [x] Cross-validation passes (instrument matches, trader_id matches)

---

## 🎯 Benefits

✅ **Data Integrity**: Only legitimate data creates insights
✅ **Prevents Manipulation**: Detects fake/suspicious patterns
✅ **Realistic Insights**: Ensures insights are based on real-world scenarios
✅ **Audit Trail**: All validation events are logged
✅ **Automatic Protection**: Invalid data is rejected automatically
✅ **Warning System**: Suspicious but valid data is flagged for review

---

## 🔧 Configuration

### Adjust Validation Rules

Edit `backend/src/services/dataValidator.ts`:

```typescript
// Adjust price ranges
private static readonly INSTRUMENT_RANGES = {
    EURUSD: { min: 0.8000, max: 1.5000 },
    // Add more instruments...
};

// Adjust position size limits
private static readonly POSITION_SIZE_RANGES = { 
    min: 10,      // Minimum position
    max: 1000000  // Maximum position
};
```

---

## 📊 Monitoring

### Check Validation Logs

```sql
-- View rejected data
SELECT * FROM audit_logs 
WHERE action = 'INVALID_DATA_REJECTED' 
ORDER BY timestamp DESC;

-- View suspicious patterns
SELECT * FROM audit_logs 
WHERE action = 'SUSPICIOUS_DATA_DETECTED' 
ORDER BY timestamp DESC;
```

### API Endpoint

Check validation status in API responses - all successful insights include validation results.

---

**All insights are validated to ensure they're based on legitimate, realistic trading data!** 🔒
