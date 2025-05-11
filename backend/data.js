const users = [
    { id: 'u1', name: 'User1', location: { x: 5, y: 5 } },
    { id: 'u2', name: 'User2', location: { x: 15, y: 15 } },
    { id: 'u3', name: 'User3', location: { x: 6, y: 7 } },
    { id: 'u4', name: 'User4', location: { x: 13, y: 15 } }
  ];
  
  const drivers = [
    { id: 'd1', name: 'Driver1', location: { x: 6, y: 6 }, speed: 40 },  // in km/h
    { id: 'd2', name: 'Driver2', location: { x: 90, y: 70 }, speed: 110 },
    { id: 'd3', name: 'Driver3', location: { x: 4, y: 4 }, speed: 35 },
  ];
  
  module.exports = { users, drivers };