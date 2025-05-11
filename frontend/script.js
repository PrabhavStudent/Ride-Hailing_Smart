async function requestRide() {
    const userId = document.getElementById('userId').value;
    if (!userId) {
        alert('Please enter a User ID');
        return;
    }

    // Simulate user location input (replace with actual location input)
    const userLocation = {
        latitude: 22.5 + Math.random() * 0.1,
        longitude: 88.3 + Math.random() * 0.1
    };

    try {
        const response = await fetch('http://localhost:5000/api/requestRide', {  // New endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, userLocation })
        });

        const data = await response.json();
        alert(data.message); // "Ride request received"
    } catch (error) {
        console.error('Error requesting ride:', error);
        alert('Error requesting ride!');
    }
}

async function matchRide() {
    const userId = document.getElementById('userId').value;

    if (!userId) {
        alert('Please enter a User ID');
        return;
    }

    try {
        const response = await fetch('http://localhost:5000/api/matchRide', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });

        const data = await response.json();
        displayRoute(data.route);

        document.getElementById('result').innerHTML = `
            Matched Driver: ${data.matchedDriver} <br>
            ETA: ${data.etaInMinutes} minutes <br>
            Distance: ${data.route.distance} <br>
            Duration: ${data.route.duration} <br>
            Fare: ${data.fare.toFixed(2)}
        `;
    } catch (error) {
        console.error('Error:', error);
        alert('Error matching ride!');
    }
}

function decodePolyline(encoded) {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return points;
}

function displayRoute(route) {
    const map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: route.userLocation.latitude, lng: route.userLocation.longitude },
        zoom: 13
    });

    const path = [];
    if (route.path && route.path.length > 0) {
        route.path.forEach(node => {
            const coord = graphNodes[node];
            if (coord) {
                path.push(new google.maps.LatLng(coord.latitude, coord.longitude));
            }
        });
    } else {
        // Fallback to decoding polylines if available
        route.steps.forEach(step => {
            if (step.polyline && step.polyline.points) {
                const decodedPoints = decodePolyline(step.polyline.points);
                decodedPoints.forEach(point => {
                    path.push(new google.maps.LatLng(point.lat, point.lng));
                });
            }
        });
    }

    const routePath = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 4
    });

    routePath.setMap(map);
}

//  Mapping of graph nodes to lat/long (IMPORTANT:  Keep consistent with backend!)
const graphNodes = {
    'A': { latitude: 22.57, longitude: 88.36, x: 5.1, y: 5.1 },  // Example - Adjust as needed
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