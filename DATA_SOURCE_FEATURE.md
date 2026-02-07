# 🔗 Data Source Links Feature

## Overview

Every trading insight now includes a **clickable link to the original data source**, allowing users to verify the data and see where it came from. This adds transparency and trust to the insights.

---

## ✨ Features

### 1. Data Source URL

- **Clickable link** in each insight
- **Opens in new tab** (secure, noopener)
- **Shows source type** (Trading Platform, Market Data Feed, Demo, etc.)
- **Visual indicator** with icon and "View Source" button

### 2. Data Source Types

- `trading_platform` - Data from Deriv trading platform
- `market_data_feed` - Data from market data provider
- `manual_entry` - Manually entered data
- `demo` - Demo/simulated data
- `api` - Data from API integration

### 3. Automatic URL Generation

If no source URL is provided, the system automatically generates one based on:
- Trader ID
- Instrument
- Timestamp
- Source type

---

## 🎯 How It Works

### Backend

1. **Database Schema**: Added `data_source_url` and `data_source_type` fields
2. **API Endpoint**: Accepts optional `data_source` parameter
3. **Auto-Generation**: Creates URLs if not provided
4. **Storage**: Saves source link with each insight

### Frontend

1. **Display**: Shows data source section in insight view
2. **Link**: Clickable button that opens source in new tab
3. **Type Badge**: Shows source type (Trading Platform, Demo, etc.)
4. **Styling**: Matches design system with gradient button

---

## 📊 Usage Examples

### API Request with Source

```json
{
  "trader_id": "TRADER-001",
  "trades": [...],
  "market_data": {...},
  "data_source": {
    "url": "https://app.deriv.com/trades/TRADER-001/EURUSD?trade_id=12345",
    "type": "trading_platform"
  }
}
```

### API Request without Source (Auto-Generated)

```json
{
  "trader_id": "TRADER-001",
  "trades": [...],
  "market_data": {...}
}
```

**Result**: System auto-generates URL like:
```
https://app.deriv.com/trades/TRADER-001/EURUSD?timestamp=1234567890&source=api
```

### Autonomous Demo

The autonomous demo service automatically generates source URLs:
```
https://demo.deriv.com/trades/TRADER-001/EURUSD?timestamp=1234567890&scenario=normal
```

---

## 🎨 Frontend Display

### Data Source Section

Each insight shows:

```
┌─────────────────────────────────────────┐
│ Data Source                              │
│ Trading Platform                         │
│                    [🔗 View Source ↗]   │
└─────────────────────────────────────────┘
```

### Features

- **Source Type Badge**: Shows type (capitalized, readable)
- **View Source Button**: Gradient button with icon
- **Hover Effect**: Button lifts slightly on hover
- **New Tab**: Opens securely in new tab
- **Responsive**: Works on all screen sizes

---

## 🔧 Configuration

### Environment Variables

```bash
# Base URL for auto-generated source links
DATA_SOURCE_BASE_URL=https://app.deriv.com

# For demo mode
DEMO_BASE_URL=https://demo.deriv.com
```

### Source URL Format

Auto-generated URLs follow this pattern:
```
{BASE_URL}/trades/{trader_id}/{instrument}?timestamp={timestamp}&source={type}
```

For demo:
```
{DEMO_BASE_URL}/trades/{trader_id}/{instrument}?timestamp={timestamp}&scenario={scenario}
```

---

## 📋 Database Schema

```sql
CREATE TABLE trading_insights (
  ...
  data_source_url TEXT,
  data_source_type TEXT CHECK(data_source_type IN (
    'trading_platform', 
    'market_data_feed', 
    'manual_entry', 
    'demo', 
    'api'
  )),
  ...
);
```

---

## ✅ Benefits

1. **Transparency**: Users can verify data sources
2. **Trust**: Shows where data came from
3. **Verification**: Click to see original data
4. **Audit Trail**: Source is stored with insight
5. **Compliance**: Helps with regulatory requirements

---

## 🎯 Use Cases

### Production

- Link to actual trading platform trade details
- Link to market data provider charts
- Link to API documentation

### Demo

- Link to demo trading platform
- Shows simulated data source
- Demonstrates feature functionality

### Testing

- Link to test data sources
- Verify link generation
- Test different source types

---

## 🔍 Example Responses

### Insight with Source

```json
{
  "insight_id": "abc123",
  "trader_id": "TRADER-001",
  "instrument": "EURUSD",
  "data_source_url": "https://app.deriv.com/trades/TRADER-001/EURUSD?trade_id=12345",
  "data_source_type": "trading_platform",
  ...
}
```

### Insight without Source (Auto-Generated)

```json
{
  "insight_id": "abc123",
  "trader_id": "TRADER-001",
  "instrument": "EURUSD",
  "data_source_url": "https://app.deriv.com/trades/TRADER-001/EURUSD?timestamp=1234567890&source=api",
  "data_source_type": "api",
  ...
}
```

---

## 🚀 Future Enhancements

- **QR Codes**: Generate QR codes for mobile access
- **Deep Links**: Direct links to specific trades/charts
- **Source Verification**: Verify source URLs are valid
- **Multiple Sources**: Support multiple source links
- **Source History**: Track source changes over time

---

**Users can now click to verify the original data source for every insight!** 🔗
