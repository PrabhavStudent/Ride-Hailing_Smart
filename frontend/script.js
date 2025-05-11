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
  
      document.getElementById('result').innerHTML = `
         Matched Driver: ${data.matchedDriver} <br>
         ETA: ${data.etaInMinutes} minutes
      `;
    } catch (error) {
      console.error('Error:', error);
      alert('Error matching ride!');
    }
  }