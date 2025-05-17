const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

const testUserIds = [
    'user001',
    'user002',
    'user003'
];

const invalidUserIds = [
    'invalidUser1',
    '12345',
    ''
];

async function testRequestRide(userId) {
    try {
        const response = await axios.post(`${BASE_URL}/requestRide`, { userId });
        console.log(`requestRide for ${userId} response:`, response.data);
    } catch (error) {
        console.error(`requestRide for ${userId} error:`, error.response ? error.response.data : error.message);
    }
}

async function testMatchRide(userId) {
    try {
        const response = await axios.post(`${BASE_URL}/matchRide`, { userId });
        console.log(`matchRide for ${userId} response:`, response.data);
    } catch (error) {
        console.error(`matchRide for ${userId} error:`, error.response ? error.response.data : error.message);
    }
}

async function testOptimizedRoute(startNode, endNode) {
    try {
        const response = await axios.post(`${BASE_URL}/optimizedRoute`, { startNode, endNode });
        console.log(`optimizedRoute from ${startNode} to ${endNode} response:`, response.data);
    } catch (error) {
        console.error(`optimizedRoute from ${startNode} to ${endNode} error:`, error.response ? error.response.data : error.message);
    }
}

async function runTests() {
    console.log('--- Testing valid user IDs ---');
    for (const userId of testUserIds) {
        console.log(`Testing userId: ${userId}`);
        await testRequestRide(userId);
        await testMatchRide(userId);
        console.log('-----------------------------');
    }

    console.log('--- Testing invalid user IDs ---');
    for (const userId of invalidUserIds) {
        console.log(`Testing invalid userId: ${userId}`);
        await testRequestRide(userId);
        await testMatchRide(userId);
        console.log('-----------------------------');
    }

    console.log('--- Testing optimizedRoute endpoint ---');
    // Example nodes for testing, these should be valid nodes in the graph
    await testOptimizedRoute('NodeA', 'NodeB');
    await testOptimizedRoute('', 'NodeB'); // missing startNode
    await testOptimizedRoute('NodeA', ''); // missing endNode
    await testOptimizedRoute(null, null);  // null nodes
}

runTests();
