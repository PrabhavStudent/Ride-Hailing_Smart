const fetch = require('node-fetch');

async function testRequestRide() {
    const response = await fetch('http://localhost:5000/api/requestRide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: 'u1',
            userLocation: { latitude: 22.57, longitude: 88.36 }
        })
    });
    const data = await response.json();
    console.log('Request Ride Response:', data);
}

async function testMatchRide() {
    const response = await fetch('http://localhost:5000/api/matchRide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'u1' })
    });
    const data = await response.json();
    console.log('Match Ride Response:', data);
}

async function runTests() {
    await testRequestRide();
    await testMatchRide();
}

runTests().catch(console.error);
