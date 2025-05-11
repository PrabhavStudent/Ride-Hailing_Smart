const express = require('express');
const app = express();
const cors = require('cors');
const request = require('request');

const { users, drivers } = require('./data');
const matchDriver = require('./RideMatching');
const { findShortestPath } = require('./util'); // You might not need this anymore

app.use(cors());
app.use(express.json());

const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY'; // Replace with your actual API key

// Temporary storage for active rides and ride requests (replace with a proper database in production)
const activeRides = {};
const rideRequests = [];

const POOLING_BUFFER_TIME = 60000; // 1 minute (adjust as needed)
const POOLING_RADIUS = 0.01; // Example radius (in lat/lon degrees)

const BASE_FARE = 50;
const DISTANCE_RATE = 10; // Per kilometer (or unit of distance)
const DURATION_RATE = 2; // Per minute
const HIGH_DEMAND_THRESHOLD = 10; // Example: Number of active requests for high demand
const LOW_DEMAND_THRESHOLD = 2; // Example: Number of active requests for low demand
const HIGH_DEMAND_MULTIPLIER = 1.5;
const LOW_DEMAND_MULTIPLIER = 0.8;

app.post('/api/requestRide', (req, res) => { // New endpoint for ride requests
    const { userId, userLocation } = req.body;
    const request = { userId, userLocation, requestTime: Date.now() };
    rideRequests.push(request);
    res.json({ message: 'Ride request received' });

    processRideRequests();
});

app.post('/api/matchRide', (req, res) => {
    const { userId } = req.body;

    const user = users.find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const match = matchDriver(user.location);
    const driver = match.driver;

    getDirectionsRoute(user, driver, (err, routeData) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const rideId = `${userId}-${driver.id}`; // Unique ride ID
        activeRides[rideId] = {
            user,
            driver,
            route: routeData,
            lastUpdated: Date.now()
        };

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

function getDirectionsRoute(user, driver, callback) {
    const origin = `${user.location.latitude},${user.location.longitude}`;
    const destination = `${driver.location.latitude},${driver.location.longitude}`;

    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}`;

    request(directionsUrl, (error, response, body) => {
        if (error || response.statusCode !== 200) {
            return callback(new Error('Failed to get route from Google Maps'));
        }

        const directionsData = JSON.parse(body);
        if (directionsData.status !== 'OK') {
            return callback(new Error(`Google Maps API error: ${directionsData.status}`));
        }

        const route = directionsData.routes[0];
        const legs = route.legs[0];

        const routeData = {
            distance: legs.distance.value / 1000, // Distance in kilometers
            duration: legs.duration.value / 60,   // Duration in minutes
            steps: legs.steps.map(step => ({
                html_instructions: step.html_instructions,
                travel_mode: step.travel_mode,
                polyline: step.polyline.points
            })),
            userLocation: user.location,
            driverLocation: driver.location
        };

        // Calculate fare
        const fare = calculateFare(routeData.distance, routeData.duration, rideRequests.length); // Use active request count as a proxy for demand
        routeData.fare = fare;

        callback(null, routeData);
    });
}

function updateRoute(rideId) {
    const ride = activeRides[rideId];
    if (!ride) return;

    // Simulate driver's current location (replace with actual driver location)
    ride.driver.location.latitude += 0.001;
    ride.driver.location.longitude += 0.001;

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

    const clusters = clusterRideRequests(eligibleRequests);
    clusters.forEach(cluster => {
        if (cluster.length > 1) {
            calculateAndMatchPooledRide(cluster);
        } else if (cluster.length === 1) {
            matchIndividualRide(cluster[0]);
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

function calculateDistance(loc1, loc2) {
    // Simple distance calculation (replace with a more accurate one if needed)
    const dx = loc1.latitude - loc2.latitude;
    const dy = loc1.longitude - loc2.longitude;
    return Math.sqrt(dx * dx + dy * dy);
}

function calculateAndMatchPooledRide(cluster) {
    const waypoints = cluster.slice(1).map(req => ({
        location: `${req.userLocation.latitude},${req.userLocation.longitude}`,
        stopover: true
    }));

    const origin = `${cluster[0].userLocation.latitude},${cluster[0].userLocation.longitude}`;
    const destination = `${cluster[cluster.length - 1].userLocation.latitude},${cluster[cluster.length - 1].userLocation.longitude}`;

    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=${waypoints.map(wp => wp.location).join('|')}&key=${GOOGLE_MAPS_API_KEY}`;

    request(directionsUrl, (error, response, body) => {
        if (error || response.statusCode !== 200) {
            console.error('Error getting pooled route:', error);
            cluster.forEach(req => matchIndividualRide(req)); // Fallback to individual rides
            return;
        }

        const directionsData = JSON.parse(body);
        if (directionsData.status !== 'OK') {
            console.error('Google Maps API error:', directionsData.status);
            cluster.forEach(req => matchIndividualRide(req)); // Fallback to individual rides
            return;
        }

        const pooledRoute = directionsData.routes[0];
        const totalPooledDuration = pooledRoute.legs.reduce((sum, leg) => sum + leg.duration.value, 0);

        let totalIndividualDuration = 0;
        cluster.forEach(req => {
            // Approximate individual duration (can be made more accurate)
            totalIndividualDuration += calculateDistance(cluster[0].userLocation, req.userLocation) * 100; // Just an example
        });

        if (totalPooledDuration * 1.2 < totalIndividualDuration) { // Allow 20% extra time for pooling
            const driver = matchDriver(cluster[0].userLocation).driver; // Match a driver to the first user
            // TODO: Send pooled route and driver info to all users in the cluster
            console.log('Pooled Ride Matched!', pooledRoute);
        } else {
            cluster.forEach(req => matchIndividualRide(req));
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

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Ride Matching Server is Running on port ${PORT}`);
});