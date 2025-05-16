// Required modules
const express = require('express');
const app = express();
const cors = require('cors');
const request = require('request'); // Still using this old friend; yeah I know it's deprecated
const axios = require('axios');
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
const GOOGLE_API_KEY = 'AIzaSyB1cJOMNFXz_986RCHyT5Yeu9Du5X8DxBI';
app.use(cors());
app.use(express.json()); // Let Express handle JSON parsing

// App state - should probably be moved into a class or store later
const activeRides = {}; // rideId -> ride data
const rideQueue = [];   // holds unprocessed ride requests

// Tweakable parameters
const POOL_WAIT_TIME = 60000; // 1 min wait before attempting pool
const RIDE_RADIUS_LIMIT = 0.01; // Arbitrary proximity threshold

// Fare model - not very DRY but clear enough
const BASE_FARE = 50;
const PER_KM = 10;
const PER_MINUTE = 2;
const HIGH_DEMAND = 10;
const LOW_DEMAND = 2;
const SURGE_MULTIPLIER = 1.5;
const DISCOUNT_MULTIPLIER = 0.8;

let userList = [];
let driverList = [];
let getDriverMatch = null; // gets initialized once data is ready

const PORT = 5000; // moved here so bootServer can use it

// Pretty primitive method for travel time
function fetchGoogleTravelTime(origin, destination) {
    return new Promise((resolve, reject) => {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_API_KEY}`;
console.log("🚨 Final Google Directions API request URL:", url);
console.log("🚨 Final Google Directions API request URL:", url);

        request(url, (err, resp, body) => {
            if (err || resp.statusCode !== 200) {
                return reject('Couldn’t fetch travel time from Google');
            }

            let data;
            try {
                data = JSON.parse(body);
            } catch (e) {
                return reject('Failed to parse response');
            }

            if (data.status !== 'OK') return reject(`Google API error: ${data.status}`);

            const leg = data.routes?.[0]?.legs?.[0];
            if (!leg) return reject('No leg data found');

            resolve(leg.duration_in_traffic?.value || leg.duration.value);
        });
    });
}

// Overwrites edge weights based on current traffic
async function recalculateTrafficWeights() {
    const newGraph = JSON.parse(JSON.stringify(graph)); // deep clone to avoid mutation

    for (let edgeKey in newGraph) {
        const [from, to] = edgeKey.split('-');
        const nodeA = graphNodes[from];
        const nodeB = graphNodes[to];

        if (!nodeA || !nodeB) continue;

        const coordA = `${nodeA.latitude},${nodeA.longitude}`;
        const coordB = `${nodeB.latitude},${nodeB.longitude}`;

        try {
            const timeInSec = await fetchGoogleTravelTime(coordA, coordB);
            newGraph[edgeKey] = timeInSec / 60; // store in minutes
        } catch (err) {
            // failed? skip and move on
        }
    }

    return newGraph;
}

// Finds path and builds basic route object
// Finds path and builds basic route object using Google Maps API
async function getUpdatedRoute(user, driver, callback) {
    try {
        const origin = `${driver.location.latitude},${driver.location.longitude}`;
        const destination = `${user.location.latitude},${user.location.longitude}`;
        const GOOGLE_API_KEY = 'YOUR_WORKING_SERVER_KEY'; // ✅ insert the correct key

        const url = `https://maps.googleapis.com/maps/api/directions/json`;

        const response = await axios.get(url, {
            params: {
                origin,
                destination,
                key: GOOGLE_API_KEY
            }
        });

        const data = response.data;

        if (data.status !== 'OK') {
            console.error("❌ Google returned error:", data.status, data.error_message);
            return callback(new Error(`Google API error: ${data.status}`));
        }

        const route = data.routes[0];
        const leg = route.legs[0];

        if (!leg) {
            return callback(new Error("No leg data in route"));
        }

        const fare = computeFare(leg.distance.value / 1000, leg.duration.value / 60, rideQueue.length);

        callback(null, {
            distance: leg.distance.text,
            duration: leg.duration.text,
            steps: leg.steps,
            polyline: route.overview_polyline,
            userLocation: user.location,
            driverLocation: driver.location,
            fare
        });
    } catch (err) {
        console.error("🚨 Axios failed:", err.message);
        callback(new Error("Google Directions API error"));
    }
}  



// Handles a new ride request
app.post('/api/requestRide', (req, res) => {
    const { userId } = req.body;

    const user = userList.find(u => u.id === userId);
    if (!user) {
        return res.status(400).json({ error: 'User not found' });
    }

    rideQueue.push({
        userId,
        userLocation: user.location,
        requestTime: Date.now()
    });

    res.json({ status: 'Request queued' });

    evaluateRideQueue(); // process queue if needed
});

// Immediate matching endpoint
app.post('/api/matchRide', (req, res) => {
    const { userId } = req.body;

    const user = userList.find(u => u.id === userId);
    if (!user || !user.location) {
        return res.status(400).json({ error: 'Invalid user or missing location' });
    }

    const match = getDriverMatch(user.location);
    const { driver, estimatedTimeInMinutes } = match;

    if (!driver) {
        return res.status(500).json({ error: 'No drivers available' });
    }

    getUpdatedRoute(user, driver, (err, routeDetails) => {
        if (err) return res.status(500).json({ error: err.message });

        const rideId = `${userId}-${driver.id}`;
        activeRides[rideId] = {
            user,
            driver,
            route: routeDetails,
            lastUpdated: Date.now()
        };

        res.json({
            user: user.name,
            matchedDriver: driver.name,
            etaInMinutes: estimatedTimeInMinutes,
            route: routeDetails,
            fare: routeDetails.fare
        });

        scheduleRouteUpdates(rideId);
    });
});

// Keeps refreshing the route every 30s
function scheduleRouteUpdates(rideId) {
    setInterval(() => {
        const ride = activeRides[rideId];
        if (!ride) return;

        getUpdatedRoute(ride.user, ride.driver, (err, newRoute) => {
            if (!err && (
                newRoute.distance !== ride.route.distance ||
                newRoute.duration !== ride.route.duration
            )) {
                ride.route = newRoute;
                ride.lastUpdated = Date.now();
                console.log(`Updated route for ${rideId}`);
            }
        });
    }, 30000);
}

// Evaluates rideQueue to form pools or handle singles
function evaluateRideQueue() {
    const now = Date.now();
    const recent = rideQueue.filter(r => now - r.requestTime <= POOL_WAIT_TIME);

    if (recent.length < 2) return;

    const grouped = groupRequests(recent);
    grouped.forEach(group => {
        if (group.length > 1) {
            tryPooling(group);
        } else {
            handleSingleRide(group[0]);
        }
    });

    rideQueue.splice(0, recent.length); // remove handled ones
}

// Groups close rides together - very rough clustering
function groupRequests(requests) {
    const buckets = [];

    for (let req of requests) {
        let placed = false;

        for (let bucket of buckets) {
            if (calculateDistance(req.userLocation, bucket[0].userLocation) <= RIDE_RADIUS_LIMIT) {
                bucket.push(req);
                placed = true;
                break;
            }
        }

        if (!placed) buckets.push([req]);
    }

    return buckets;
}

// Try pooling the ride group
function tryPooling(group) {
    const origin = `${group[0].userLocation.latitude},${group[0].userLocation.longitude}`;
    const destination = `${group[group.length - 1].userLocation.latitude},${group[group.length - 1].userLocation.longitude}`;
    const waypoints = group.slice(1, -1).map(r => `${r.userLocation.latitude},${r.userLocation.longitude}`).join('|');

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_API_KEY}`;
console.log("🚨 Final Google Directions API request URL:", url);
console.log("🚨 Final Google Directions API request URL:", url);

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

// Handle non-pooled request
function handleSingleRide(req) {
    const match = getDriverMatch(req.userLocation);
    getUpdatedRoute(req, match.driver, (err, details) => {
        if (!err) console.log('Single ride processed', details);
    });
}

// Simple fare computation
function computeFare(distance, duration, demandLevel) {
    let multiplier = 1;

    if (demandLevel > HIGH_DEMAND) {
        multiplier = SURGE_MULTIPLIER;
    } else if (demandLevel < LOW_DEMAND) {
        multiplier = DISCOUNT_MULTIPLIER;
    }

    const total = BASE_FARE + (distance * PER_KM) + (duration * PER_MINUTE);
    return total * multiplier;
}

// Endpoint for optimized route
app.post('/api/optimizedRoute', async (req, res) => {
    const { startNode, endNode } = req.body;

    if (!startNode || !endNode) {
        return res.status(400).json({ error: 'Missing nodes' });
    }

    try {
        const result = await getOptimizedRoute(startNode, endNode);
        res.json(result);
    } catch {
        res.status(500).json({ error: 'Failed to calculate optimized route' });
    }
});

// Startup routine
async function bootServer() {
    try {
        const { users, drivers } = await loadData();
        userList = users;
        driverList = drivers;

        getDriverMatch = createMatchDriver(driverList); // init matcher

        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error('Server failed to start:', err);
    }
}

bootServer();
