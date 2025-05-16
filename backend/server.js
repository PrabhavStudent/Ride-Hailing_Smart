const express = require('express');
const cors = require('cors');
const request = require('request');

// Custom modules
const { loadData } = require('./data');
const { createMatchDriver } = require('./RideMatching');
const {
    findShortestPath,
    graph,
    graphNodes,
    findNearestNode,
    calculateDistance
} = require('./util');

const { getOptimizedRoute } = require('./RealTimeRouteOptimization');

// Middleware
app.use(cors());
app.use(express.json());

// Temporary storage for active rides and ride requests (replace with a proper database in production)
const activeRides = {};
const rideRequests = [];

const POOLING_BUFFER_TIME = 60000; // 1 minute (adjust as needed)
const POOLING_RADIUS = 0.01; // Example radius (in lat/lon degrees)

const BASE_FARE = 50;
const PER_KM = 10;
const PER_MINUTE = 2;
const HIGH_DEMAND = 10;
const LOW_DEMAND = 2;
const SURGE_MULTIPLIER = 1.5;
const DISCOUNT_MULTIPLIER = 0.8;

let users = [];
let drivers = [];
let matchDriver;

// Helper function to get travel time between two points from Google API
function getTravelTimeFromGoogle(origin, destination) {
    return new Promise((resolve, reject) => {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&departure_time=now&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        request(url, (error, response, body) => {
            if (error || response.statusCode !== 200) {
                console.error('Error fetching travel time from Google API:', error);
                return reject(new Error('Failed to fetch travel time from Google API'));
            }
            const data = JSON.parse(body);
            if (data.status !== 'OK') {
                console.error('Google Maps API error:', data.status);
                return reject(new Error(`Google Maps API error: ${data.status}`));
            }
            const leg = data.routes[0].legs[0];
            resolve(leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value); // seconds
        });
    });
}

// Function to update graph edge weights with real-time traffic data
async function updateGraphWeightsWithTraffic() {
    const updatedGraph = JSON.parse(JSON.stringify(graph)); // Deep copy to avoid mutation
    const edgeKeys = Object.keys(updatedGraph);

    for (const edgeKey of edgeKeys) {
        const [from, to] = edgeKey.split('-');
        const fromNode = graphNodes[from];
        const toNode = graphNodes[to];
        if (!fromNode || !toNode) continue;

        const coordA = `${nodeA.latitude},${nodeA.longitude}`;
        const coordB = `${nodeB.latitude},${nodeB.longitude}`;

        try {
            const travelTimeSeconds = await getTravelTimeFromGoogle(origin, destination);
            // Convert travel time to a weight (e.g., in minutes)
            updatedGraph[edgeKey] = travelTimeSeconds / 60;
        } catch (err) {
            console.error(`Failed to update edge weight for ${edgeKey}:`, err);
            // Keep original weight if API call fails
        }
    }
    return updatedGraph;
}

async function getDirectionsRoute(user, driver, callback) {
    try {
        const updatedGraph = await updateGraphWeightsWithTraffic();

        const startNode = findNearestNode(user.location);
        const endNode = findNearestNode(driver.location);

        if (!startNode || !endNode) {
            return callback(new Error('Could not find nearest graph nodes for user or driver'));
        }

        const shortestPathResult = findShortestPath(updatedGraph, startNode, endNode);
        const pathNodes = shortestPathResult.path;
        const totalDistance = shortestPathResult.distance;

        // Approximate duration using updated weights (sum of edge weights)
        const duration = shortestPathResult.distance; // Assuming distance is in minutes from updated weights

        // Construct route steps with dummy instructions and polylines (for frontend compatibility)
        const steps = [];
        for (let i = 0; i < pathNodes.length - 1; i++) {
            const fromNode = pathNodes[i];
            const toNode = pathNodes[i + 1];
            steps.push({
                html_instructions: `Drive from ${fromNode} to ${toNode}`,
                travel_mode: 'DRIVING',
                polyline: {
                    points: '' // Polyline encoding can be added if needed
                }
            });
        }

        const routeData = {
            distance: totalDistance,
            duration: duration,
            steps: steps,
            userLocation: user.location,
            driverLocation: driver.location,
            path: pathNodes  // Added path array for frontend route display
        };

        // Calculate fare
        const fare = calculateFare(routeData.distance, routeData.duration, rideRequests.length); // Use active request count as a proxy for demand
        routeData.fare = fare;

        callback(null, routeData);
    } catch (err) {
        callback(err);
    }
}

app.post('/api/requestRide', (req, res) => { // New endpoint for ride requests
    const { userId, userLocation } = req.body;
    const request = { userId, userLocation, requestTime: Date.now() };
    rideRequests.push(request);
    res.json({ message: 'Ride request received' });

    processRideRequests();
});

app.post('/api/matchRide', (req, res) => {
    const { userId } = req.body;

    const user = userList.find(u => u.id === userId);
    if (!user || !user.location) {
        return res.status(400).json({ error: 'Invalid user or missing location' });
    }

    const match = matchDriver(user.location);
    const driver = match.driver;

    if (!driver) {
        console.error(`No driver matched for userId: ${userId}`);
        return res.status(500).json({ error: 'No driver matched' });
    }

    getDirectionsRoute(user, driver, (err, routeData) => {
        if (err) {
            console.error(`Error in getDirectionsRoute: ${err.message}`);
            return res.status(500).json({ error: err.message });
        }

        const rideId = `${userId}-${driver.id}`; // Unique ride ID
        activeRides[rideId] = {
            user,
            driver,
            route: routeData,
            lastUpdated: Date.now()
        };

        scheduleRouteUpdates(rideId);

        res.json({
            user: user.name,
            matchedDriver: driver.name,
            etaInMinutes: match.estimatedTimeInMinutes,
            route: routeData,
            fare: routeData.fare // Include fare in the initial response
        });

        // Start periodic route updates
        startRouteUpdates(rideId);
    });
});

function updateRoute(rideId) {
    const ride = activeRides[rideId];
    if (!ride) return;

    // Use updated graph weights with traffic for route optimization
    getDirectionsRoute(ride.user, ride.driver, (err, newRouteData) => {
        if (err) {
            console.error('Error updating route:', err);
            return;
        }

        // Basic route comparison (you can improve this)
        if (newRouteData.duration !== ride.route.duration || newRouteData.distance !== ride.route.distance) {
            console.log(`Route updated for ride ${rideId}`);
            ride.route = newRouteData;
            ride.lastUpdated = Date.now();

            // TODO: Send newRouteData to the frontend (e.g., via WebSocket or a separate API endpoint)
            // For now, logging the updated route:
            console.log('Updated Route:', newRouteData);
        }
    });
}

function startRouteUpdates(rideId) {
    setInterval(() => {
        updateRoute(rideId);
    }, 30000); // Update every 30 seconds (adjust as needed)
}

function processRideRequests() {
    const now = Date.now();
    const eligibleRequests = rideRequests.filter(req => now - req.requestTime <= POOLING_BUFFER_TIME);
    if (eligibleRequests.length < 2) return; // Need at least 2 requests to pool

    const grouped = groupRequests(recent);
    grouped.forEach(group => {
        if (group.length > 1) {
            tryPooling(group);
        } else {
            handleSingleRide(group[0]);
        }
    });

    // Remove processed requests
    rideRequests.splice(0, eligibleRequests.length);
}

function clusterRideRequests(requests) {
    // Basic proximity-based clustering (can be improved)
    const clusters = [];
    requests.forEach(req => {
        let added = false;
        for (const cluster of clusters) {
            const representative = cluster[0];
            if (calculateDistance(req.userLocation, representative.userLocation) <= POOLING_RADIUS) {
                cluster.push(req);
                added = true;
                break;
            }
        }
        if (!added) {
            clusters.push([req]);
        }
    });
    return clusters;
}

/* Removed duplicate calculateDistance function to avoid redeclaration error */

function calculateAndMatchPooledRide(cluster) {
    const waypoints = cluster.slice(1).map(req => ({
        location: `${req.userLocation.latitude},${req.userLocation.longitude}`,
        stopover: true
    }));

    const origin = `${cluster[0].userLocation.latitude},${cluster[0].userLocation.longitude}`;
    const destination = `${cluster[cluster.length - 1].userLocation.latitude},${cluster[cluster.length - 1].userLocation.longitude}`;

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=${waypoints}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

    request(url, (err, resp, body) => {
        if (err || resp.statusCode !== 200) {
            group.forEach(r => handleSingleRide(r));
            return;
        }

        let response;
        try {
            response = JSON.parse(body);
        } catch {
            group.forEach(r => handleSingleRide(r));
            return;
        }

        if (response.status !== 'OK') {
            group.forEach(r => handleSingleRide(r));
            return;
        }

        const totalTime = response.routes[0].legs.reduce((acc, leg) => acc + leg.duration.value, 0);
        const estimatedSeparateTime = group.reduce((sum, r) =>
            sum + calculateDistance(group[0].userLocation, r.userLocation) * 100, 0
        );

        if (totalTime * 1.2 < estimatedSeparateTime) {
            const driver = getDriverMatch(group[0].userLocation).driver;
            console.log('Pooling assigned', response.routes[0]);
        } else {
            group.forEach(r => handleSingleRide(r));
        }
    });
}

function matchIndividualRide(request) {
    const driver = matchDriver(request.userLocation).driver;
    getDirectionsRoute(request, driver, (err, routeData) => {
        if (err) {
            console.error('Error getting individual route:', err);
            return;
        }
        // TODO: Send individual route and driver info to the user
        console.log('Individual Ride Matched!', routeData);
    });
}

function calculateFare(distance, duration, demand) {
    let demandMultiplier = 1;
    if (demand > HIGH_DEMAND_THRESHOLD) {
        demandMultiplier = HIGH_DEMAND_MULTIPLIER;
    } else if (demand < LOW_DEMAND_THRESHOLD) {
        demandMultiplier = LOW_DEMAND_MULTIPLIER;
    }

    const fare = BASE_FARE + (distance * DISTANCE_RATE) + (duration * DURATION_RATE);
    return fare * demandMultiplier;
}

async function startServer() {
    try {
        const data = await loadData();
        users = data.users;
        drivers = data.drivers;
        matchDriver = createMatchDriver(drivers);

        app.listen(PORT, () => {
            console.log(`Ride Matching Server is Running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to load data:', err);
    }
}

app.post('/api/optimizedRoute', async (req, res) => {
    const { startNode, endNode } = req.body;
    if (!startNode || !endNode) {
        return res.status(400).json({ error: 'startNode and endNode are required' });
    }
    try {
        const routeResult = await getOptimizedRoute(startNode, endNode);
        res.json(routeResult);
    } catch (err) {
        console.error('Error getting optimized route:', err);
        res.status(500).json({ error: 'Failed to get optimized route' });
    }
});



startServer();
