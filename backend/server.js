require('dotenv').config();
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const request = require('request');

const app = express();

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

// App State
const activeRides = {};
const rideQueue = [];

// Constants
const POOL_WAIT_TIME = 60000;
const RIDE_RADIUS_LIMIT = 0.01;
const BASE_FARE = 50;
const PER_KM = 10;
const PER_MINUTE = 2;
const HIGH_DEMAND = 10;
const LOW_DEMAND = 2;
const SURGE_MULTIPLIER = 1.5;
const DISCOUNT_MULTIPLIER = 0.8;

let userList = [];
let driverList = [];
let getDriverMatch = null; // Will be initialized later

// Google Travel Time
function fetchGoogleTravelTime(origin, destination) {
    return new Promise((resolve, reject) => {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&departure_time=now&key=${process.env.GOOGLE_MAPS_API_KEY}`;

        request(url, (err, resp, body) => {
            if (err || resp.statusCode !== 200) return reject('Couldn’t fetch travel time');

            let data;
            try {
                data = JSON.parse(body);
            } catch (e) {
                return reject('Failed to parse response');
            }

            const leg = data.routes?.[0]?.legs?.[0];
            if (!leg) return reject('No leg data found');

            resolve(leg.duration_in_traffic?.value || leg.duration.value);
        });
    });
}

// Recalculate traffic weights
async function recalculateTrafficWeights() {
    const newGraph = JSON.parse(JSON.stringify(graph));
    for (let edgeKey in newGraph) {
        const [from, to] = edgeKey.split('-');
        const nodeA = graphNodes[from];
        const nodeB = graphNodes[to];
        if (!nodeA || !nodeB) continue;

        const coordA = `${nodeA.latitude},${nodeA.longitude}`;
        const coordB = `${nodeB.latitude},${nodeB.longitude}`;

        try {
            const timeInSec = await fetchGoogleTravelTime(coordA, coordB);
            newGraph[edgeKey] = timeInSec / 60;
        } catch {}
    }
    return newGraph;
}

// Get updated route from driver to user
async function getUpdatedRoute(user, driver, callback) {
    try {
        const origin = `${driver.location.latitude},${driver.location.longitude}`;
        const destination = `${user.location.latitude},${user.location.longitude}`;
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

        request(url, (err, resp, body) => {
            console.log('Google Directions API request URL:', url);
            if (err || resp.statusCode !== 200) {
                console.log('Google API error:', err || `Status code: ${resp.statusCode}`);
                return callback(new Error('Google API error'));
            }

            let data;
            try {
                data = JSON.parse(body);
                console.log('Google Directions API response:', JSON.stringify(data));
            } catch (parseErr) {
                console.log('Failed to parse Directions API response:', parseErr);
                return callback(new Error('Failed to parse Directions API response'));
            }

            const route = data.routes?.[0];
            const leg = route?.legs?.[0];
            if (!leg) {
                console.log('No valid route found in API response');
                return callback(new Error('No valid route found'));
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
        });
    } catch (e) {
        callback(e);
    }
}

// Request Ride
app.post('/api/requestRide', (req, res) => {
    const { userId, userLocation } = req.body;
    if (!userId || !userLocation) {
        return res.status(400).json({ error: 'Missing user data' });
    }

    rideQueue.push({ userId, userLocation, requestTime: Date.now() });
    res.json({ status: 'Request queued' });

    evaluateRideQueue();
});

// Match Ride
app.post('/api/matchRide', (req, res) => {
    const { userId } = req.body;

    const user = userList.find(u => u.id === userId);
    if (!user || !user.location) {
        return res.status(400).json({ error: 'Invalid user or missing location' });
    }

    // Log driver availability for debugging
    console.log('Driver availability states:');
    driverList.forEach(driver => {
        console.log(`Driver ${driver.id}: available=${driver.available}`);
    });

    const match = getDriverMatch(user.location);
    if (!match || !match.driver) {
        console.log('No drivers available for user:', userId);
        return res.json({ message: 'No drivers available at the moment. Please try again later.' });
    }

    getUpdatedRoute(user, match.driver, (err, routeDetails) => {
        if (err) {
            console.log('Route update error:', err.message);
            // Provide fallback route details or empty route instead of error
            const fallbackRoute = {
                distance: 'N/A',
                duration: 'N/A',
                steps: [],
                polyline: null,
                userLocation: user.location,
                driverLocation: match.driver.location,
                fare: 0
            };
            const rideId = `${user.id}-${match.driver.id}`;
            activeRides[rideId] = {
                users: [user],
                driver: match.driver,
                route: fallbackRoute,
                lastUpdated: Date.now()
            };
            scheduleRouteUpdates(rideId);
            return res.json({
                users: [{ id: user.id, name: user.name }],
                matchedDriver: match.driver.name,
                etaInMinutes: match.estimatedTimeInMinutes,
                route: fallbackRoute,
                fare: 0,
                message: 'Route details are currently unavailable, showing fallback data.'
            });
        }

        const rideId = `${user.id}-${match.driver.id}`;
        activeRides[rideId] = {
            users: [user],
            driver: match.driver,
            route: routeDetails,
            lastUpdated: Date.now()
        };

        scheduleRouteUpdates(rideId);

        res.json({
            users: [{ id: user.id, name: user.name }],
            matchedDriver: match.driver.name,
            etaInMinutes: match.estimatedTimeInMinutes,
            route: routeDetails,
            fare: routeDetails.fare
        });
    });
});

// Route updater every 30s
function scheduleRouteUpdates(rideId) {
    setInterval(() => {
        const ride = activeRides[rideId];
        if (!ride) return;

        getUpdatedRoute(ride.users[0], ride.driver, (err, newRoute) => {
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

// Ride queue evaluation
function evaluateRideQueue() {
    const now = Date.now();
    const recent = rideQueue.filter(r => now - r.requestTime <= POOL_WAIT_TIME);
    if (recent.length < 1) return;

    const grouped = groupRequests(recent);
    grouped.forEach(group => {
        if (group.length > 1) {
            tryPooling(group);
        } else {
            handleSingleRide(group[0]);
        }
    });

    rideQueue.splice(0, recent.length);
}

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

// Try pooling
function tryPooling(group) {
    const origin = `${group[0].userLocation.latitude},${group[0].userLocation.longitude}`;
    const destination = `${group[group.length - 1].userLocation.latitude},${group[group.length - 1].userLocation.longitude}`;
    const waypoints = group.slice(1, -1).map(r => `${r.userLocation.latitude},${r.userLocation.longitude}`).join('|');

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

// Single ride fallback
function handleSingleRide(req) {
    const match = getDriverMatch(req.userLocation);
    if (!match || !match.driver) return;

    getUpdatedRoute(req, match.driver, (err, details) => {
        if (!err) console.log('Single ride processed', details);
    });
}

// Fare calculator
function computeFare(distance, duration, demandLevel) {
    let multiplier = 1;
    if (demandLevel > HIGH_DEMAND) multiplier = SURGE_MULTIPLIER;
    else if (demandLevel < LOW_DEMAND) multiplier = DISCOUNT_MULTIPLIER;

    const total = BASE_FARE + (distance * PER_KM) + (duration * PER_MINUTE);
    return total * multiplier;
}

// Optimized route endpoint
app.post('/api/optimizedRoute', async (req, res) => {
    const { startNode, endNode } = req.body;
    if (!startNode || !endNode) return res.status(400).json({ error: 'Missing nodes' });

    try {
        const result = await getOptimizedRoute(startNode, endNode);
        res.json(result);
    } catch {
        res.status(500).json({ error: 'Failed to calculate optimized route' });
    }
});

// Driver availability
app.post('/api/updateDriverAvailability', (req, res) => {
    const { driverId, available } = req.body;
    if (!driverId || typeof available !== 'boolean') {
        return res.status(400).json({ error: 'Invalid driverId or availability' });
    }

    const driver = driverList.find(d => d.id === driverId);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    driver.available = available;
    res.json({ message: `Driver ${driverId} availability updated to ${available}` });
});

// Boot server
const PORT = 5000;
async function bootServer() {
    try {
        const { users, drivers } = await loadData();
        userList = users;
        driverList = drivers;
        getDriverMatch = createMatchDriver(driverList);

        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error('Server failed to start:', err);
    }
}
bootServer();
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
