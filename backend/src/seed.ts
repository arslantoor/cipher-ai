import { initializeDatabase } from './config/database';
import { AuthService } from './services/auth';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
    console.log('🌱 Seeding database...');

    // Initialize database
    initializeDatabase();

    try {
        // Create default admin user
        const admin = await AuthService.register({
            email: 'admin@cipherai.com',
            password: 'Admin123!',
            full_name: 'System Administrator',
            role: 'admin',
            department: 'IT Security',
        });

        console.log('✅ Admin user created:');
        console.log('   Email: admin@cipherai.com');
        console.log('   Password: Admin123!');
        console.log('   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!');

        // Create sample analyst
        const analyst = await AuthService.register({
            email: 'analyst@cipherai.com',
            password: 'Analyst123!',
            full_name: 'John Doe',
            role: 'analyst',
            department: 'Fraud Investigation',
        });

        console.log('\n✅ Sample analyst created:');
        console.log('   Email: analyst@cipherai.com');
        console.log('   Password: Analyst123!');

        // Create senior analyst
        const seniorAnalyst = await AuthService.register({
            email: 'senior@cipherai.com',
            password: 'Senior123!',
            full_name: 'Jane Smith',
            role: 'senior_analyst',
            department: 'Fraud Investigation',
        });

        console.log('\n✅ Senior analyst created:');
        console.log('   Email: senior@cipherai.com');
        console.log('   Password: Senior123!');

        console.log('\n🎉 Database seeded successfully!');
        console.log('\n📝 Next steps:');
        console.log('   1. Start the backend: npm run dev');
        console.log('   2. Login with any of the accounts above');
        console.log('   3. Change default passwords immediately');

    } catch (error: any) {
        if (error.message.includes('UNIQUE constraint failed')) {
            console.log('⚠️  Database already seeded. Users already exist.');
        } else {
            console.error('❌ Seeding failed:', error.message);
        }
    }

    process.exit(0);
}

seed();
