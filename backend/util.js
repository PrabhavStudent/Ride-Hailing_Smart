function calculateDistance(loc1, loc2) {
    const dx = loc1.x - loc2.x;
    const dy = loc1.y - loc2.y;
    return Math.sqrt(dx * dx + dy * dy); 
  }
  

  function calculateETA(distance, speed) {
    return distance / speed; 
  }
  
  module.exports = { calculateDistance, calculateETA };