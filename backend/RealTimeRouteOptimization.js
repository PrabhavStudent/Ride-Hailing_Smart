const axios = require('axios');
async function getRoute(origin, destination) {
  const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
    params: {
      origin: origin,
      destination: destination,
      key: 'AIzaSyB1cJOMNFXz_986RCHyT5Yeu9Du5X8DxBI'
    }
  });

  return response.data;
}
const { findShortestPath, graph, graphNodes } = require('./util');

// Placeholder function to fetch traffic data from Google API
// In real implementation, this should call Google Maps Traffic API with proper parameters and API key
async function fetchTrafficData() {
    // Example response format: { 'A-B': 1.2, 'B-C': 0.8, ... } multipliers for edge weights
    // For now, return dummy data simulating traffic multipliers on edges
    return {
        'A-B': 1.0,
        'B-A': 1.0,
        'B-D': 1.5,
        'D-B': 1.5,
        'B-E': 1.2,
        'E-B': 1.2,
        'A-C': 0.9,
        'C-A': 0.9,
        // Add other edges as needed
    };
}

// Function to create a new graph with adjusted weights based on traffic data
function adjustGraphWeights(baseGraph, trafficMultipliers) {
    const adjustedGraph = {};

    for (const node in baseGraph) {
        adjustedGraph[node] = {};
        for (const neighbor in baseGraph[node]) {
            const edgeKey = `${node}-${neighbor}`;
            const multiplier = trafficMultipliers[edgeKey] || 1.0;
            adjustedGraph[node][neighbor] = baseGraph[node][neighbor] * multiplier;
        }
    }

    return adjustedGraph;
}

// Main function to get optimized route considering traffic
async function getOptimizedRoute(startNode, endNode) {
    const trafficMultipliers = await fetchTrafficData();
    const adjustedGraph = adjustGraphWeights(graph, trafficMultipliers);
    const result = findShortestPath(adjustedGraph, startNode, endNode);
    return result;
}

module.exports = { getOptimizedRoute };
