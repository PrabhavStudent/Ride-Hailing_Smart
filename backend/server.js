const express = require('express');
const app = express();
const cors = require('cors');
const request = require('request');

const { users, drivers } = require('./data');
const matchDriver = require('./ridematcher');
const { findShortestPath } = require('./util');

app.use(cors());
app.use(express.json());

const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';

// Synthetic Road Graph (Adapt to your data's coordinate ranges)
const roadGraph = {
    'A': { 'B': 5, 'C': 10 },
    'B': { 'A': 5, 'D': 3, 'E': 12 },
    'C': { 'A': 10, 'F': 20 },
    'D': { 'B': 3, 'E': 1, 'G': 9 },
    'E': { 'B': 12, 'D': 1, 'H': 7 },
    'F': { 'C': 20, 'I': 15 },
    'G': { 'D': 9, 'H': 2, 'J': 6 },
    'H': { 'E': 7, 'G': 2, 'K': 4 },
    'I': { 'F': 15, 'L': 11 },
    'J': { 'G': 6, 'K': 8, 'M': 13 },
    'K': { 'H': 4, 'J': 8, 'N': 10 },
    'L': { 'I': 11 },
    'M': { 'J': 13 },
    'N': { 'K': 10 }
};

//  Mapping of graph nodes to user/driver locations (Directly from synthetic data ranges)
const graphNodes = {
    'A': { latitude: 22.57, longitude: 88.36, x: 5.1, y: 5.1 }, // Example - Adjust as needed
    'B': { latitude: 22.58, longitude: 88.37, x: 6.1, y: 6.1 },
    'C': { latitude: 22.56, longitude: 88.35, x: 5.9, y: 7.1 },
    'D': { latitude: 22.59, longitude: 88.38, x: 6.9, y: 7.1 },
    'E': { latitude: 22.60, longitude: 88.37, x: 7.0, y: 8.1 },
    'F': { latitude: 22.55, longitude: 88.34, x: 5.2, y: 5.2 },
    'G': { latitude: 22.61, longitude: 88.39, x: 7.2, y: 8.2 },
    'H': { latitude: 22.62, longitude: 88.38, x: 7.3, y: 8.2 },
    'I': { latitude: 22.54, longitude: 88.33, x: 5.3, y: 5.3 },
    'J': { latitude: 22.63, longitude: 88.40, x: 7.4, y: 8.4 },
    'K': { latitude: 22.64, longitude: 88.39, x: 7.5, y: 8.3 },
    'L': { latitude: 22.53, longitude: 88.32, x: 5.4, y: 5.4 },
    'M': { latitude: 22.65, longitude: 88.41, x: 7.6, y: 8.5 },
    'N': { latitude: 22.66, longitude: 88.40, x: 7.7, y: 8.4 }
};

app.post('/api/matchRide', (req, res) => {
    const { userId } = req.body;

    const user = users.find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const match = matchDriver(user.location);
    const driver = match.driver;

    //  1. Calculate route with Dijkstra's
    //  Assuming user.location and driver.location have x and y
    const startNode = findClosestNode({x: user.location.x, y: user.location.y}, graphNodes);
    const endNode = findClosestNode({x: driver.location.x, y: driver.location.y}, graphNodes);
    const shortestPathResult = findShortestPath(roadGraph, startNode, endNode);
    const pathNodes = shortestPathResult.path;

    //  2.  Use Google Maps Directions API to get detailed route info + traffic
    let waypoints = [];
    if (pathNodes.length > 2) {
        waypoints = pathNodes.slice(1, pathNodes.length - 1).map(node => ({
            location: graphNodes[node].latitude + ',' + graphNodes[node].longitude,
            stopover: true
        }));
    }

    const origin = graphNodes[pathNodes[0]].latitude + ',' + graphNodes[pathNodes[0]].longitude;
    const destination = graphNodes[pathNodes[pathNodes.length - 1]].latitude + ',' + graphNodes[pathNodes[pathNodes.length - 1]].longitude;

    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=${waypoints.map(wp => wp.location).join('|')}&key=${GOOGLE_MAPS_API_KEY}`;

    request(directionsUrl, (error, response, body) => {
        if (error || response.statusCode !== 200) {
            console.error('Google Maps Directions API Error:', error || response.statusCode);
            return res.status(500).json({ error: 'Failed to get route from Google Maps' });
        }

        const directionsData = JSON.parse(body);
        if (directionsData.status !== 'OK') {
            console.error('Google Maps Directions API Error:', directionsData.status);
            return res.status(500).json({ error: `Google Maps API error: ${directionsData.status}` });
        }

        const route = directionsData.routes[0];
        const legs = route.legs[0];

        const routeData = {
            path: pathNodes,
            distance: legs.distance.text,
            duration: legs.duration.text,
            steps: legs.steps.map(step => ({
                html_instructions: step.html_instructions,
                travel_mode: step.travel_mode,
                polyline: step.polyline.points
            })),
            userLocation: user.location,
            driverLocation: driver.location
        };

        res.json({
            user: user.name,
            matchedDriver: driver.name,
            etaInMinutes: match.estimatedTimeInMinutes,
            route: routeData
        });
    });
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Ride Matching Server is Running on port ${PORT}`);
});