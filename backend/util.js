function calculateDistance(loc1, loc2) {
    const dx = loc1.latitude - loc2.latitude;
    const dy = loc1.longitude - loc2.longitude;
    return Math.sqrt(dx * dx + dy * dy);
}

function calculateETA(distance, speed) {
    return distance / speed;
}

// Dijkstra's Algorithm Implementation (Not directly used in the core logic now, but kept for potential future use)
function findShortestPath(graph, startNode, endNode) {
    const distances = {};
    const visited = {};
    const previousNodes = {};
    const priorityQueue = [];

    for (const node in graph) {
        distances[node] = Infinity;
    }
    distances[startNode] = 0;

    priorityQueue.push({ node: startNode, distance: 0 });
    priorityQueue.sort((a, b) => a.distance - b.distance);

    while (priorityQueue.length > 0) {
        const { node } = priorityQueue.shift();

        if (visited[node]) {
            continue;
        }
        visited[node] = true;

        if (node === endNode) {
            break;
        }

        for (const neighbor in graph[node]) {
            const distance = distances[node] + graph[node][neighbor];
            if (distance < distances[neighbor]) {
                distances[neighbor] = distance;
                previousNodes[neighbor] = node;
                priorityQueue.push({ node: neighbor, distance });
                priorityQueue.sort((a, b) => a.distance - b.distance);
            }
        }
    }

    const shortestPath = [];
    let currentNode = endNode;
    while (currentNode) {
        shortestPath.unshift(currentNode);
        currentNode = previousNodes[currentNode];
    }

    return {
        path: shortestPath,
        distance: distances[endNode]
    };
}

// Graph representation for the ride hailing area (nodes and edges with distances)
const graph = {
    'A': { 'B': 1.5, 'C': 2.0 },
    'B': { 'A': 1.5, 'D': 2.5, 'E': 3.0 },
    'C': { 'A': 2.0, 'F': 2.2 },
    'D': { 'B': 2.5, 'G': 1.8 },
    'E': { 'B': 3.0, 'G': 2.1, 'H': 2.4 },
    'F': { 'C': 2.2, 'I': 1.7 },
    'G': { 'D': 1.8, 'E': 2.1, 'J': 2.5 },
    'H': { 'E': 2.4, 'K': 1.9 },
    'I': { 'F': 1.7, 'L': 2.3 },
    'J': { 'G': 2.5, 'M': 2.0 },
    'K': { 'H': 1.9, 'N': 2.2 },
    'L': { 'I': 2.3 },
    'M': { 'J': 2.0 },
    'N': { 'K': 2.2 }
};

// Mapping of graph nodes to lat/long coordinates
const graphNodes = {
    'A': { latitude: 22.57, longitude: 88.36 },
    'B': { latitude: 22.58, longitude: 88.37 },
    'C': { latitude: 22.56, longitude: 88.35 },
    'D': { latitude: 22.59, longitude: 88.38 },
    'E': { latitude: 22.60, longitude: 88.37 },
    'F': { latitude: 22.55, longitude: 88.34 },
    'G': { latitude: 22.61, longitude: 88.39 },
    'H': { latitude: 22.62, longitude: 88.38 },
    'I': { latitude: 22.54, longitude: 88.33 },
    'J': { latitude: 22.63, longitude: 88.40 },
    'K': { latitude: 22.64, longitude: 88.39 },
    'L': { latitude: 22.53, longitude: 88.32 },
    'M': { latitude: 22.65, longitude: 88.41 },
    'N': { latitude: 22.66, longitude: 88.40 }
};

// Helper function to find the nearest graph node to a given location
function findNearestNode(location) {
    let nearestNode = null;
    let minDistance = Infinity;

    for (const node in graphNodes) {
        const nodeLocation = graphNodes[node];
        const dist = calculateDistance(location, nodeLocation);
        if (dist < minDistance) {
            minDistance = dist;
            nearestNode = node;
        }
    }
    return nearestNode;
}

module.exports = { calculateDistance, calculateETA, findShortestPath, graph, graphNodes, findNearestNode };
