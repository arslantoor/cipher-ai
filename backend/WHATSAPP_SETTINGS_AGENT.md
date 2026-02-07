# WhatsApp Settings Agent

## Agent Role: WhatsAppSettingsAgent

**Purpose**: Autonomously manage the frontend interface for WhatsApp alert configuration, ensuring that users can securely add, update, or remove numbers for receiving fraud investigation narratives. Provides a clean, user-friendly experience and validates all inputs before storing them in the backend.

## Objectives

### 1. Display UI Panel for WhatsApp Settings

**Capabilities**:
- Add new WhatsApp number(s)
- Edit existing numbers
- Remove numbers
- Enable/disable WhatsApp notifications globally

**Implementation**:
- React component with form inputs
- List view of configured numbers
- Toggle switch for global enable/disable
- Real-time validation feedback

### 2. Validate Phone Numbers

**E.164 Standard Format**:
- Format: `+[country code][number]`
- Maximum 15 digits (excluding +)
- Minimum 7 digits
- Must start with + followed by country code (1-9)

**Validation Rules**:
- Real-time validation on input
- Normalization (auto-add country code if missing)
- Duplicate detection
- Format error messages

### 3. Real-Time Feedback

**Input Errors**:
- Invalid format → "Invalid phone number format. Use E.164 format: +[country code][number]"
- Missing country code → "Phone number must include country code (e.g., +1234567890)"
- Invalid length → "Phone number must be 7-15 digits (excluding country code)"
- Duplicate → "Phone number already exists"

**Success Messages**:
- "Phone number added successfully"
- "Phone number updated successfully"
- "Phone number removed successfully"
- "WhatsApp notifications enabled/disabled"

### 4. API Integration

**Endpoints**:
- `GET /api/settings/whatsapp` - Fetch current configuration
- `POST /api/settings/whatsapp` - Add new number
- `PATCH /api/settings/whatsapp/:id` - Update existing number
- `DELETE /api/settings/whatsapp/:id` - Remove number
- `PATCH /api/settings/whatsapp/enabled` - Toggle global enable/disable

**Request/Response**:
```typescript
// GET Response
{
  numbers: [
    { id: "whatsapp-0", number: "+1234567890", enabled: true }
  ],
  enabled: true
}

// POST Request
{
  number: "+1234567890"
}

// PATCH Request (update)
{
  number: "+1234567890"
}

// PATCH Request (toggle)
{
  enabled: true
}
```

### 5. Immediate System Updates

**Backend Integration**:
- Updates stored in `system_settings` table
- `ConfigService` retrieves numbers for `InvestigationReportAgent`
- Changes take effect immediately
- No restart required

### 6. Secure Data Handling

**PII Protection**:
- Phone numbers masked in UI display
- Masked format: `+12****90` (country code + last 2 digits)
- Numbers encrypted in database (via EventOrchestrator)
- Audit logs with masked numbers

### 7. Confirmation Messages

**Success Confirmations**:
- Green alert box with checkmark
- Auto-dismiss after 3 seconds (optional)
- Clear action feedback

**Error Handling**:
- Red alert box with warning icon
- Specific error messages
- Retry guidance

### 8. UI Consistency

**Noir Fintech Theme**:
- Dark background (`--bg-secondary`)
- Brand gradient accents
- Glass morphism effects
- Consistent spacing and typography
- Responsive design

## Constraints

### 1. Intuitive for Admins

- **Simple Interface**: Clear labels and instructions
- **No Technical Jargon**: User-friendly language
- **Visual Feedback**: Immediate validation and confirmations
- **Error Prevention**: Validation before submission

### 2. Data Validation

- **Client-Side**: Real-time validation in React
- **Server-Side**: Backend validation for security
- **E.164 Format**: Strict format enforcement
- **Duplicate Prevention**: Check before adding

### 3. Auditable Updates

- **Audit Logs**: All changes logged via `AuditService`
- **User Tracking**: Changes linked to admin user ID
- **Action Types**: 
  - `WHATSAPP_NUMBER_ADDED`
  - `WHATSAPP_NUMBER_UPDATED`
  - `WHATSAPP_NUMBER_REMOVED`
  - `WHATSAPP_NOTIFICATIONS_TOGGLED`

### 4. Multi-Agent Integration

- **ConfigService**: Shared configuration service
- **InvestigationReportAgent**: Consumes configuration
- **Event-Driven**: Changes propagate via configuration
- **No Direct Coupling**: Agents read from shared config

## Input

### Current Configuration
```typescript
{
  numbers: WhatsAppNumber[];
  enabled: boolean;
}
```

### User Actions
- Add: Form submission with phone number
- Edit: Click edit → modify → save
- Remove: Click remove → confirm → delete
- Toggle: Switch enable/disable

## Output

### Rendered Component
- UI panel with current numbers and status
- Form for adding new numbers
- List of configured numbers with actions
- Global toggle switch
- Info section with usage details

### API Calls
- GET on component mount
- POST on add
- PATCH on update/toggle
- DELETE on remove

### Visual Confirmations
- Success alerts (green)
- Error alerts (red)
- Loading states
- Disabled states

### Updated Configuration
- Stored in `system_settings` table
- Available to `InvestigationReportAgent`
- Immediate effect (no restart)

## Component Structure

### State Management
```typescript
- config: WhatsAppConfig (current configuration)
- loading: boolean (fetching state)
- error: string | null (error messages)
- success: string | null (success messages)
- newNumber: string (add form input)
- editingId: string | null (currently editing)
- editValue: string (edit form input)
```

### Key Functions
- `fetchConfig()`: Load current configuration
- `validatePhoneNumber()`: E.164 validation
- `handleAddNumber()`: Add new number
- `handleUpdateNumber()`: Update existing
- `handleRemoveNumber()`: Remove number
- `handleToggleEnabled()`: Toggle global setting
- `maskNumber()`: Mask for display

## Phone Number Validation

### E.164 Format Rules
1. Must start with `+`
2. Country code: 1-9 (first digit after +)
3. Total digits: 7-15 (excluding +)
4. No spaces, dashes, or parentheses

### Normalization
- Auto-add `+1` for 10-digit US numbers
- Remove spaces, dashes, parentheses
- Validate final format

### Examples
- Valid: `+1234567890`, `+441234567890`, `+8612345678`
- Invalid: `1234567890` (missing +), `+123` (too short), `+0123456789` (country code can't start with 0)

## Backend API Endpoints

### GET /api/settings/whatsapp
**Auth**: Admin only
**Response**:
```json
{
  "numbers": [
    {
      "id": "whatsapp-0",
      "number": "+1234567890",
      "enabled": true
    }
  ],
  "enabled": true
}
```

### POST /api/settings/whatsapp
**Auth**: Admin only
**Request**:
```json
{
  "number": "+1234567890"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Phone number added successfully"
}
```

### PATCH /api/settings/whatsapp/:id
**Auth**: Admin only
**Request**:
```json
{
  "number": "+1234567890"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Phone number updated successfully"
}
```

### DELETE /api/settings/whatsapp/:id
**Auth**: Admin only
**Response**:
```json
{
  "success": true,
  "message": "Phone number removed successfully"
}
```

### PATCH /api/settings/whatsapp/enabled
**Auth**: Admin only
**Request**:
```json
{
  "enabled": true
}
```
**Response**:
```json
{
  "success": true,
  "message": "WhatsApp notifications enabled"
}
```

## Security

### Authentication
- All endpoints require admin role
- JWT token validation
- Role-based access control

### Data Protection
- Phone numbers masked in UI
- Encrypted in database (via EventOrchestrator)
- Masked in audit logs
- Secure transmission (HTTPS)

### Validation
- Client-side validation (UX)
- Server-side validation (security)
- Format enforcement (E.164)
- Duplicate prevention

## Integration

### Frontend
- Component: `WhatsAppSettings.tsx`
- Route: `/whatsapp` (admin only)
- Navigation: Sidebar link for admins

### Backend
- Endpoints: `/api/settings/whatsapp/*`
- Service: `ConfigService`
- Storage: `system_settings` table
- Audit: `AuditService`

### Multi-Agent System
- `InvestigationReportAgent` reads configuration
- Changes take effect immediately
- No agent restart required
- Event-driven updates

## User Experience

### Add Number Flow
1. User enters phone number
2. Real-time validation feedback
3. Click "Add" button
4. Success message appears
5. Number appears in list
6. Configuration updated

### Edit Number Flow
1. Click "Edit" on existing number
2. Input field appears with current value
3. Modify number
4. Click "Save" or "Cancel"
5. Success message on save
6. List updates

### Remove Number Flow
1. Click "Remove" button
2. Confirmation dialog appears
3. Confirm removal
4. Number removed from list
5. Success message
6. Configuration updated

### Toggle Flow
1. Toggle switch for global enable/disable
2. Immediate API call
3. Success message
4. UI updates to reflect state

## Error Scenarios

### Invalid Format
- Real-time validation error
- Red error message
- Input highlighted
- Submit disabled

### Duplicate Number
- Error on submit
- "Phone number already exists"
- No API call made

### API Failure
- Error message displayed
- Retry option (manual refresh)
- Configuration unchanged

### Network Error
- Error message
- Retry on next action
- Graceful degradation

## Best Practices

1. **Validation**: Always validate before API call
2. **Feedback**: Provide immediate visual feedback
3. **Security**: Mask sensitive data in UI
4. **Audit**: Log all changes for compliance
5. **UX**: Clear error messages and confirmations
6. **Consistency**: Match existing design system
7. **Accessibility**: Keyboard navigation, screen reader support

## Example Usage

```typescript
// Component automatically:
// 1. Fetches configuration on mount
// 2. Displays current numbers
// 3. Validates inputs in real-time
// 4. Sends API requests on actions
// 5. Updates UI immediately
// 6. Shows success/error messages

<WhatsAppSettings />
```

## Compliance

- **GDPR**: PII masked and encrypted
- **Audit Trail**: All changes logged
- **Access Control**: Admin-only access
- **Data Validation**: Strict format enforcement
- **Secure Storage**: Encrypted in database
