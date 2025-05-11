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
            Duration: ${data.route.duration}
        `;
    } catch (error) {
        console.error('Error:', error);
        alert('Error matching ride!');
    }
}

function displayRoute(route) {
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
        map: new google.maps.Map(document.getElementById('map'), {
            center: route.userLocation, // Center on user location
            zoom: 13
        })
    });

    const origin = new google.maps.LatLng(route.userLocation.latitude, route.userLocation.longitude);
    const destination = new google.maps.LatLng(route.driverLocation.latitude, route.driverLocation.longitude);

    directionsService.route(
        {
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING
        },
        (response, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                directionsRenderer.setDirections(response);
            } else {
                console.error('Directions request failed:', status);
                alert('Could not display route.');
            }
        }
    );
}