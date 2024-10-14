const fs = require('fs');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3001;

// Read SSL certificate and key (commented out for now)
// const options = {
//   key: fs.readFileSync(path.join(__dirname, 'server.key')),
//   cert: fs.readFileSync(path.join(__dirname, 'server.cert')),
// };

// Serve static files (CSS, JS, images) from the current directory
app.use(express.static(__dirname));

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Create HTTP server
const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
  console.log('A user connected');
  
  socket.on('chat message', ({ user, message }) => {
    // Create a timestamp for the message
    const timestamp = new Date().toLocaleTimeString();
    io.emit('chat message', { user, message, timestamp });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

