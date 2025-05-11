const express = require('express');
const app = express();
const cors = require('cors');
const request = require('request');

const { loadData } = require('./data');
const { createMatchDriver } = require('./RideMatching');
const { findShortestPath, graph, graphNodes, findNearestNode, calculateDistance } = require('./util');

app.use(cors());
app.use(express.json());

// Temporary storage for active rides and ride requests (replace with a proper database in production)
const activeRides = {};

function getDirectionsRoute(user, driver, callback) {
    // Use Dijkstra's algorithm to find shortest path between user and driver locations
    const startNode = findNearestNode(user.location);
    const endNode = findNearestNode(driver.location);

    if (!startNode || !endNode) {
        return callback(new Error('Could not find nearest graph nodes for user or driver'));
    }

    const shortestPathResult = findShortestPath(graph, startNode, endNode);
    const pathNodes = shortestPathResult.path;
    const totalDistance = shortestPathResult.distance;

    // Approximate duration assuming average speed (e.g., 40 km/h)
    const averageSpeed = 40; // km/h
    const duration = (totalDistance / averageSpeed) * 60; // in minutes

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
        driverLocation: driver.location
    };

    // Calculate fare
    const fare = calculateFare(routeData.distance, routeData.duration, rideRequests.length); // Use active request count as a proxy for demand
    routeData.fare = fare;

    callback(null, routeData);
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

/* Removed duplicate calculateDistance function to avoid redeclaration error */

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

const PORT = 5000;
startServer();
