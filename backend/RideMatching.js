// RideMatching.js
const { calculateDistance, calculateETA } = require('./util');

function createMatchDriver(drivers) {
    return function matchDriver(userLocation) {
        let bestDriver = null;
        let shortestETA = Infinity;

        drivers.forEach(driver => {
            if (!driver.available) { // Ensure driver is available
                return;
            }
            const distance = calculateDistance(userLocation, driver.location);
            const eta = calculateETA(distance, driver.speed);

            if (eta < shortestETA) {
                bestDriver = driver;
                shortestETA = eta;
            }
        });

        if (bestDriver) {
            return {
                driver: bestDriver,
                estimatedTimeInMinutes: (shortestETA * 60).toFixed(2)
            };
        } else {
            return {
                driver: null,
                estimatedTimeInMinutes: null
            };
        }
    };
}

module.exports = { createMatchDriver };