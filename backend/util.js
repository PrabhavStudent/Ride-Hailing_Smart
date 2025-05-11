function calculateDistance(loc1, loc2) {
  const dx = loc1.x - loc2.x;
  const dy = loc1.y - loc2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function calculateETA(distance, speed) {
  return distance / speed;
}

// Dijkstra's Algorithm Implementation
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

module.exports = { calculateDistance, calculateETA, findShortestPath };