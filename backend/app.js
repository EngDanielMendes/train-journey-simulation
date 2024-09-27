const WebSocket = require('ws');
const fs = require('fs');
const { JSONRPCServer } = require('json-rpc-2.0');

const server = new WebSocket.Server({ port: 8080 });
console.log('WebSocket server is listening on port 8080');
const rpcServer = new JSONRPCServer();

let connections = [];
let journeyData = [];
let replaySpeed = 1; // Default play speed
let delay = 0; // Default play delay in seconds
let isJourneyRunning = false;
let isPaused = false;
let currentIndex = 0; // Track the current position in the journey

// Parse NMEA file to extract GPS data
function parseNMEAFile(filePath) {
  const gpsData = [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  lines.forEach((line) => {
    if (line.startsWith('$GPGGA')) {
      const parts = line.split(',');
      const lat = convertToDecimal(parts[2], parts[3]);
      const lng = convertToDecimal(parts[4], parts[5]);
      if (lat && lng) gpsData.push({ lat, lng });
    }
  });

  return gpsData;
}

function convertToDecimal(coordinate, direction) {
  const degreesLength = direction === 'N' || direction === 'S' ? 2 : 3;
  const degrees = parseInt(coordinate.slice(0, degreesLength), 10);
  const minutes = parseFloat(coordinate.slice(degreesLength));
  let decimal = degrees + minutes / 60;
  return direction === 'S' || direction === 'W' ? -decimal : decimal;
}

// Load NMEA file and parse coordinates
journeyData = parseNMEAFile('./leixoes_campanha.txt');

// Handle WebSocket connections
server.on('connection', (ws) => {
  console.log('New client connected');

  // Close previous connections
  connections.forEach((conn) => conn.close());
  connections = [ws]; // Only store the new connection

  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);

    const request = JSON.parse(message);
    rpcServer.receive(request).then((response) => {
      if (response) ws.send(JSON.stringify(response));
    });
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    connections = connections.filter((conn) => conn !== ws);
  });
});

// Broadcast location to all connected clients
function broadcastLocation(index) {
  if (isPaused || index >= journeyData.length) return;

  const location = journeyData[index];
  currentIndex = index;
  connections.forEach((ws) => ws.send(JSON.stringify(location)));

  setTimeout(() => broadcastLocation(index + 1), 1000 / replaySpeed);
}

// JSON-RPC methods for controlling the simulation
rpcServer.addMethod('startJourney', ({ delaySeconds }) => {
  if (!isJourneyRunning) {
    // Only start if the journey isn't already running
    isJourneyRunning = true;
    isPaused = false;
    currentIndex = 0;
    setTimeout(
      () => broadcastLocation(currentIndex),
      delaySeconds * 1000 || delay * 1000
    );
    return 'Journey started';
  }
  return 'Journey is already running';
});

rpcServer.addMethod('stopJourney', () => {
  if (isJourneyRunning && !isPaused) {
    isPaused = true; // Pause the journey
    return 'Journey stopped';
  }
  return 'Journey is not running or already stopped';
});

rpcServer.addMethod('resetJourney', () => {
  isPaused = true;
  isJourneyRunning = false;
  currentIndex = 0;
  return 'Journey reset';
});

rpcServer.addMethod('continueJourney', () => {
  if (isJourneyRunning && isPaused) {
    isPaused = false;
    broadcastLocation(currentIndex);
    return 'Journey resumed';
  }
  return 'Journey is not paused or not running';
});

rpcServer.addMethod('setReplaySpeed', ({ speed }) => {
  replaySpeed = speed;
  return 'Speed updated';
});

console.log('Server is starting...');
