// frontend/script.js
async function requestRide() {
    const userId = document.getElementById('userId').value;
    if (!userId) {
        alert('Please enter a User ID');
        return;
    }

    const userLocation = {
        latitude: 30.3165 + Math.random() * 0.01,
        longitude: 78.0322 + Math.random() * 0.01
    };

    try {
        const response = await fetch('/api/requestRide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, userLocation })
        });

        const data = await response.json();
        alert(data.status || data.message || "Ride requested");
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

    console.log(`Frontend: Sending matchRide request for userId: ${userId}`);

    try {
        const response = await fetch('/api/matchRide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        const data = await response.json();

        if (data.route) {
            displayRoute(data.route, data.matchedDriverLocation);
        } else {
            alert(data.error || "No available drivers found.");
            return;
        }

        let userList = data.users.map(u => `${u.name} (${u.id})`).join('<br>');
        const farePerUser = (data.fare / data.users.length).toFixed(2);

        document.getElementById('result').innerHTML = `
            <strong>Pooled Ride</strong><br>
            Users:<br>${userList}<br><br>
            Matched Driver: ${data.matchedDriver} <br>
            ETA: ${data.etaInMinutes} minutes <br>
            Distance: ${data.route.distance} <br>
            Duration: ${data.route.duration} <br>
            Fare (per user): ${farePerUser}
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

function displayRoute(route, driverLocation) {
    const map = new google.maps.Map(document.getElementById('map'), {
        center: {
            lat: route.userLocation.latitude,
            lng: route.userLocation.longitude
        },
        zoom: 13
    });

    const path = [];

    if (route.polyline && route.polyline.points) {
        const decodedPoints = decodePolyline(route.polyline.points);
        decodedPoints.forEach(point => {
            path.push(new google.maps.LatLng(point.lat, point.lng));
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

    // 🚩 Add marker for driver
    new google.maps.Marker({
        position: {
            lat: driverLocation.latitude,
            lng: driverLocation.longitude
        },
        map: map,
        label: "D",
        title: "Driver"
    });

    // 👥 Add markers for each user (if multiple)
    if (Array.isArray(route.pooledUsers)) {
        route.pooledUsers.forEach((user, index) => {
            new google.maps.Marker({
                position: {
                    lat: user.location.latitude,
                    lng: user.location.longitude
                },
                map: map,
                label: `${index + 1}`,
                title: `User ${user.id}`
            });
        });
    } else {
        // fallback for single ride
        new google.maps.Marker({
            position: {
                lat: route.userLocation.latitude,
                lng: route.userLocation.longitude
            },
            map: map,
            label: "U",
            title: "User"
        });
    }
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