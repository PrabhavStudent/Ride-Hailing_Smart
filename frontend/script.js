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
      const userLocation = data.userLocation; // Assuming the server sends back userLocation
      const driverLocation = data.driverLocation; //  and driverLocation
      displayRoute(userLocation, driverLocation);

      document.getElementById('result').innerHTML = `
          Matched Driver: ${data.matchedDriver} <br>
          ETA: ${data.etaInMinutes} minutes
      `;
  } catch (error) {
      console.error('Error:', error);
      alert('Error matching ride!');
  }
}

function displayRoute(userLocation, driverLocation) {
  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer({
      map: new google.maps.Map(document.getElementById('map'), { // Make sure you have <div id="map"> in your HTML
          center: userLocation, // Center the map on the user's location
          zoom: 13
      })
  });

  directionsService.route({
      origin: new google.maps.LatLng(userLocation.latitude, userLocation.longitude),
      destination: new google.maps.LatLng(driverLocation.latitude, driverLocation.longitude),
      travelMode: google.maps.TravelMode.DRIVING
  }, (response, status) => {
      if (status === google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(response);
      } else {
          console.error('Directions request failed:', status);
          alert('Could not display route.');
      }
  });
}