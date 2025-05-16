const { parse } = require('csv-parse');
const fs = require('fs');
const path = require('path');

function loadCSVData(filename, headers) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filename)
            .pipe(parse({
                delimiter: ',',
                columns: headers,
                from_line: 2
            }))
            .on('data', (data) => results.push(data))
            .on('end', () => {
                resolve(results);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

async function loadData() {
    let users = [];
    let drivers = [];
    try {
        const userData = await loadCSVData(path.join(__dirname, 'users.csv'), ['id', 'name', 'latitude', 'longitude']);
        users = userData.map(row => ({
            id: row.id,
            name: row.name,
            location: {
                latitude: parseFloat(row.latitude),
                longitude: parseFloat(row.longitude)
            }
        }));
        console.log('Users loaded successfully.');
    } catch (err) {
        console.error('Error loading users.csv:', err);
    }

    try {
        const driverData = await loadCSVData(path.join(__dirname, 'drivers.csv'), ['id', 'name', 'latitude', 'longitude', 'speed', 'available']);
        drivers = driverData.map(row => ({
            id: row.id,
            name: row.name,
            location: {
                latitude: parseFloat(row.latitude),
                longitude: parseFloat(row.longitude)
            },
            speed: parseFloat(row.speed),
            available: row.available.toLowerCase() === 'true'
        }));
        console.log('Drivers loaded successfully.');
    } catch (err) {
        console.error('Error loading drivers.csv:', err);
    }

    return { users, drivers };
}

module.exports = { loadData };
