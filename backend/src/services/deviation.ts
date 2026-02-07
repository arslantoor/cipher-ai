import { Alert, UserActivity, Deviation, Baseline } from '../types';
import { BaselineAnalyzer } from './baseline';

export class DeviationDetector {
    constructor(private baselineAnalyzer: BaselineAnalyzer) { }

    detectDeviations(alert: Alert, userActivity: UserActivity): Deviation {
        const baseline = this.baselineAnalyzer.calculateBaseline(userActivity);

        return {
            amount_deviation: this.checkAmountDeviation(alert, baseline),
            temporal_deviation: this.checkTemporalDeviation(alert, baseline),
            location_deviation: this.checkLocationDeviation(alert, baseline),
            device_deviation: this.checkDeviceDeviation(alert, baseline),
            new_account_flag: baseline.account_maturity < 30,
        };
    }

    private checkAmountDeviation(alert: Alert, baseline: Baseline) {
        const currentAmount = alert.raw_data.transaction_amount || 0;
        const baselineAmount = baseline.avg_transaction_amount;

        if (baselineAmount === 0) {
            return { deviation: 0, multiplier: 1.0, baseline: 0, current: currentAmount };
        }

        const deviationRatio = currentAmount / baselineAmount;

        let multiplier = 1.0;
        if (deviationRatio > 10) {
            multiplier = 3.0;
        } else if (deviationRatio > 5) {
            multiplier = 2.0;
        }

        return {
            deviation: deviationRatio,
            multiplier,
            baseline: baselineAmount,
            current: currentAmount,
        };
    }

    private checkTemporalDeviation(alert: Alert, baseline: Baseline) {
        const currentHour = new Date(alert.timestamp).getHours();
        const typicalHours = baseline.typical_transaction_hours;

        const isUnusualTime = !typicalHours.includes(currentHour);

        return {
            is_unusual_time: isUnusualTime,
            multiplier: isUnusualTime ? 1.5 : 1.0,
            current_hour: currentHour,
            typical_hours: typicalHours,
        };
    }

    private checkLocationDeviation(alert: Alert, baseline: Baseline) {
        const currentLocation = alert.raw_data.location;
        const currentCity = currentLocation?.city || 'unknown';

        const commonLocations = baseline.common_locations;
        const isNewLocation = !commonLocations.some((loc) =>
            loc.includes(currentCity)
        );

        return {
            is_new_location: isNewLocation,
            multiplier: isNewLocation ? 1.8 : 1.0,
            current: currentCity,
            common: commonLocations,
        };
    }

    private checkDeviceDeviation(alert: Alert, baseline: Baseline) {
        const currentDevice = alert.raw_data.device_fingerprint;
        const isNewDevice = !!currentDevice;

        return {
            is_new_device: isNewDevice,
            multiplier: isNewDevice ? 1.5 : 1.0,
        };
    }
}
