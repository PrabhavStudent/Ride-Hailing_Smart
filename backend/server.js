const express = require('express');
const app = express();
const cors = require('cors');
const request = require('request'); //  For making HTTP requests to the Google Maps API

const { users, drivers } = require('./data');
const matchDriver = require('./ridematcher');

app.use(cors());
app.use(express.json());

const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY'; //  Replace with your actual API key

app.post('/api/matchRide', (req, res) => {
    const { userId } = req.body;

    const user = users.find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const match = matchDriver(user.location);
    const driver = match.driver;

    //  Call Google Maps Directions API to get the route
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${user.location.latitude},${user.location.longitude}&destination=${driver.location.latitude},${driver.location.longitude}&key=${GOOGLE_MAPS_API_KEY}`;

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

        const route = directionsData.routes[0]; //  Get the first route
        const legs = route.legs[0]; //  Get the first leg

        //  Extract relevant route information
        const routeData = {
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