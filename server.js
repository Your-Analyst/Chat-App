// server.js
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3001;

// Read SSL certificate and key
const options = {
  key: fs.readFileSync(path.join(__dirname, 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'server.cert')),
};

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Create HTTPS server
const server = https.createServer(options, app);
const io = new Server(server);

io.on('connection', (socket) => {
  console.log('A user connected');
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

//Listen on Provided PORT
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on ${PORT}`);
});
