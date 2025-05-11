const express = require('express');
const app = express();
const cors = require('cors');
const request = require('request');

const { users, drivers } = require('./data');
const matchDriver = require('./ridematcher');
const { findShortestPath } = require('./util');

app.use(cors());
app.use(express.json());

const GOOGLE_MAPS_API_KEY = 'AIzaSyC7tJgww5a2zJgTow868pISVefaKnaryvs'; //  Replace with your actual API key

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