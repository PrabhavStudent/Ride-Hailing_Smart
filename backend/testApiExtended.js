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

async function testOptimizedRoute() {
    const response = await fetch('http://localhost:5000/api/optimizedRoute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startNode: 'A', endNode: 'B' })
    });
    const data = await response.json();
    console.log('Optimized Route Response:', data);
}

async function testUpdateDriverAvailability() {
    const response = await fetch('http://localhost:5000/api/updateDriverAvailability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: 'd1', available: true })
    });
    const data = await response.json();
    console.log('Update Driver Availability Response:', data);
}

async function testErrorHandling() {
    // Missing userId in requestRide
    let response = await fetch('http://localhost:5000/api/requestRide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLocation: { latitude: 22.57, longitude: 88.36 } })
    });
    let data = await response.json();
    console.log('Error Handling Request Ride (missing userId):', data);

    // Missing userId in matchRide
    response = await fetch('http://localhost:5000/api/matchRide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    data = await response.json();
    console.log('Error Handling Match Ride (missing userId):', data);

    // Missing nodes in optimizedRoute
    response = await fetch('http://localhost:5000/api/optimizedRoute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    data = await response.json();
    console.log('Error Handling Optimized Route (missing nodes):', data);

    // Invalid availability in updateDriverAvailability
    response = await fetch('http://localhost:5000/api/updateDriverAvailability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: 'd1', available: 'yes' })
    });
    data = await response.json();
    console.log('Error Handling Update Driver Availability (invalid available):', data);
}

async function runTests() {
    await testRequestRide();
    await testMatchRide();
    await testOptimizedRoute();
    await testUpdateDriverAvailability();
    await testErrorHandling();
}

runTests().catch(console.error);
