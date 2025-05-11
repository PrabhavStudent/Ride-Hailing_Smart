const { calculateDistance, calculateETA } = require('./utils');
const { drivers } = require('./data');

function matchDriver(userLocation) {
  let bestDriver = null;
  let shortestETA = Infinity;

  drivers.forEach(driver => {
    const distance = calculateDistance(userLocation, driver.location);
    const eta = calculateETA(distance, driver.speed); // smaller ETA is better

    if (eta < shortestETA) {
      bestDriver = driver;
      shortestETA = eta;
    }
  });

  return {
    driver: bestDriver,
    estimatedTimeInMinutes: (shortestETA * 60).toFixed(2)
  };
}

module.exports = matchDriver;