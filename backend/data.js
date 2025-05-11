function generateSyntheticData(numUsers, numDrivers) {
    const users = [];
    const drivers = [];

    for (let i = 1; i <= numUsers; i++) {
        users.push({
            id: `u${100 + i}`,
            name: `User${i}`,
            location: {
                latitude:  30.3165 + Math.random() * 0.2, //  Roughly Kolkata latitude range
                longitude: 78.0322 + Math.random() * 0.2  // Roughly Kolkata longitude range
            }
        });
    }

    for (let i = 1; i <= numDrivers; i++) {
        drivers.push({
            id: `d${500 + i}`,
            name: `Driver${i}`,
            location: {
                latitude: 22.5 + Math.random() * 0.2,
                longitude: 88.3 + Math.random() * 0.2
            },
            speed: 30 + Math.random() * 30, // Speed between 30-60 km/h
            available: Math.random() < 0.8  // 80% chance of being available
        });
    }

    return { users, drivers };
}

const { users, drivers } = generateSyntheticData(20, 10); // Generate 20 users and 10 drivers

module.exports = { users, drivers };