const express = require('express');
const app = express();
const cors = require('cors');

const { users } = require('./data');
const matchDriver = require('./ridematcher');

app.use(cors());
app.use(express.json());


app.post('/api/matchRide', (req, res) => {
  const { userId } = req.body;

  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const match = matchDriver(user.location);

  res.json({
    user: user.name,
    matchedDriver: match.driver.name,
    etaInMinutes: match.estimatedTimeInMinutes
  });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log('Ride Matching Server is Running on port ${PORT}');
});