#!/usr/bin/env node

/**
 * CipherAI Backend Test Script
 * Tests authentication and investigation endpoints
 */

const API_BASE = 'http://localhost:3001';

async function test() {
    console.log('🧪 Testing CipherAI Backend...\n');

    try {
        // Test 1: Health Check
        console.log('1️⃣  Testing health endpoint...');
        const healthRes = await fetch(`${API_BASE}/api/health`);
        const health = await healthRes.json();
        console.log('✅ Health:', health.status);
        console.log('');

        // Test 2: Login
        console.log('2️⃣  Testing login...');
        const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@cipherai.com',
                password: 'Admin123!',
            }),
        });

        if (!loginRes.ok) {
            throw new Error('Login failed');
        }

        const loginData = await loginRes.json();
        console.log('✅ Login successful');
        console.log('   User:', loginData.user.email);
        console.log('   Role:', loginData.user.role);
        console.log('');

        const accessToken = loginData.accessToken;

        // Test 3: Get Current User
        console.log('3️⃣  Testing /api/auth/me...');
        const meRes = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const meData = await meRes.json();
        console.log('✅ Current user:', meData.full_name);
        console.log('');

        // Test 4: Get Statistics
        console.log('4️⃣  Testing /api/statistics...');
        const statsRes = await fetch(`${API_BASE}/api/statistics`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const stats = await statsRes.json();
        console.log('✅ Statistics:', JSON.stringify(stats, null, 2));
        console.log('');

        // Test 5: Create Investigation
        console.log('5️⃣  Testing investigation creation...');
        const investigationRes = await fetch(`${API_BASE}/api/investigate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                alert: {
                    alert_id: 'TEST-001',
                    user_id: 'USR-TEST',
                    alert_type: 'money_laundering',
                    timestamp: new Date().toISOString(),
                    triggered_rules: ['high_velocity', 'unusual_amount'],
                    raw_data: {
                        transaction_amount: 15000,
                        location: {
                            city: 'Dubai',
                            country: 'UAE',
                            lat: 25.2048,
                            lng: 55.2708,
                        },
                    },
                },
                user_activity: {
                    user_id: 'USR-TEST',
                    account_age_days: 45,
                    login_locations: [],
                    device_fingerprints: [],
                    transaction_history: [
                        {
                            timestamp: '2024-01-01T12:00:00Z',
                            amount: 500,
                            type: 'deposit',
                            status: 'completed',
                        },
                    ],
                },
            }),
        });

        const investigation = await investigationRes.json();
        console.log('✅ Investigation created:', investigation.investigation_id);
        console.log('   Severity:', investigation.severity);
        console.log('   Final Score:', investigation.confidence_signals.final_score.toFixed(2));
        console.log('   Narrative preview:', investigation.narrative.substring(0, 100) + '...');
        console.log('');

        console.log('🎉 All tests passed!\n');
        console.log('📊 Backend is fully operational and ready for use.');
        console.log('');
        console.log('Next steps:');
        console.log('  1. Add your Gemini API key to backend/.env');
        console.log('  2. Build the frontend authentication UI');
        console.log('  3. Create alert input forms');
        console.log('');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('');
        console.log('Troubleshooting:');
        console.log('  1. Make sure backend is running: cd backend && npm run dev');
        console.log('  2. Check that database was seeded: npm run seed');
        console.log('  3. Verify .env file exists with correct values');
    }
}

test();
