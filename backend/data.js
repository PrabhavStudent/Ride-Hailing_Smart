const { parse } = require('csv-parse');
const fs = require('fs');

let users = [];
let drivers = [];

function loadCSVData(filename, headers, callback) {
    const results = [];
    fs.createReadStream(filename)
        .pipe(parse({
            delimiter: ',',
            columns: headers
        }))
        .on('data', (data) => results.push(data))
        .on('end', () => {
            callback(null, results);
        })
        .on('error', (error) => {
            callback(error);
        });
}

// Load users from CSV
loadCSVData('./users.csv', ['id', 'name', 'latitude', 'longitude'], (err, userData) => {
    if (err) {
        console.error('Error loading users.csv:', err);
        // Handle error appropriately, e.g., exit the program or use default data
        users = []; // set default
    } else {
        users = userData.map(row => ({
            id: row.id,
            name: row.name,
            location: {
                latitude: parseFloat(row.latitude),
                longitude: parseFloat(row.longitude)
            }
        }));
        console.log('Users loaded successfully.');
    }

    // Load drivers from CSV
    loadCSVData('./drivers.csv', ['id', 'name', 'latitude', 'longitude', 'speed', 'available'], (err, driverData) => {
        if (err) {
            console.error('Error loading drivers.csv:', err);
             drivers = [];
        } else {
            drivers = driverData.map(row => ({
                id: row.id,
                name: row.name,
                location: {
                    latitude: parseFloat(row.latitude),
                    longitude: parseFloat(row.longitude)
                },
                speed: parseFloat(row.speed),
                available: row.available === 'true' // Convert 'true'/'false' to boolean
            }));
             console.log('Drivers loaded successfully.');
        }


    });
});

module.exports = { users, drivers };