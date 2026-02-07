import { UserActivity, Baseline, Transaction, LoginLocation } from '../types';

export class BaselineAnalyzer {
    private lookbackDays = 90;

    calculateBaseline(userActivity: UserActivity): Baseline {
        const transactions = userActivity.transaction_history;

        return {
            avg_transaction_amount: this.avgTransactionAmount(transactions),
            avg_transactions_per_day: this.avgFrequency(transactions),
            typical_transaction_hours: this.typicalHours(transactions),
            common_locations: this.commonLocations(userActivity.login_locations),
            device_consistency: this.deviceConsistency(userActivity.device_fingerprints),
            account_maturity: userActivity.account_age_days,
        };
    }

    private avgTransactionAmount(transactions: Transaction[]): number {
        if (!transactions.length) return 0;
        const sum = transactions.reduce((acc, t) => acc + t.amount, 0);
        return sum / transactions.length;
    }

    private avgFrequency(transactions: Transaction[]): number {
        if (!transactions.length) return 0;

        const dates = new Set(
            transactions.map((t) => new Date(t.timestamp).toDateString())
        );

        return transactions.length / Math.max(dates.size, 1);
    }

    private typicalHours(transactions: Transaction[]): number[] {
        if (!transactions.length) return [];

        const hourCounts: Record<number, number> = {};

        transactions.forEach((t) => {
            const hour = new Date(t.timestamp).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        const sorted = Object.entries(hourCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([hour]) => parseInt(hour));

        return sorted;
    }

    private commonLocations(locations: LoginLocation[]): string[] {
        if (!locations.length) return [];

        const locationCounts: Record<string, number> = {};

        locations.forEach((loc) => {
            const key = `${loc.city}, ${loc.country}`;
            locationCounts[key] = (locationCounts[key] || 0) + 1;
        });

        const sorted = Object.entries(locationCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([loc]) => loc);

        return sorted;
    }

    private deviceConsistency(devices: string[]): number {
        if (!devices.length) return 0;

        const uniqueDevices = new Set(devices).size;
        const totalLogins = devices.length;

        return 1 - (uniqueDevices - 1) / Math.max(totalLogins, 1);
    }
}
