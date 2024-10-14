require('dotenv').config();  // Load environment variables
const fs = require('fs');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const User = require('./models/User');  // Assuming User.js is defined
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB using Mongoose
mongoose.connect(process.env.DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB using Mongoose');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Serve static files (CSS, JS, images) from the current directory
app.use(express.static(__dirname));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',  // Store secret in .env
  resave: false,
  saveUninitialized: true
}));

// Registration route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = new User({ username, password });
    await user.save();
    req.session.userId = user._id; // Start session
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    if (err.code === 11000) {  // Handle duplicate username error
      res.status(400).json({ message: 'Username already exists' });
    } else {
      res.status(400).json({ message: 'Registration failed', error: err.message });
    }
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && await user.comparePassword(password)) {
      req.session.userId = user._id; // Start session
      res.json({ message: 'Login successful' });
    } else {
      res.status(400).json({ message: 'Invalid username or password' });
    }
  } catch (err) {
    res.status(400).json({ message: 'Login failed', error: err.message });
  }
});

// Middleware to protect chat route
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ message: 'Please log in to access this page' });
  }
};

// Serve chat page only if authenticated
app.get('/chat', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Log out route
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully' });
  });
});

// Create HTTP server
const server = http.createServer(app);
const io = new Server(server);

// Authenticate socket connections
io.use((socket, next) => {
  const session = socket.request.session;
  if (session && session.userId) {
    next();
  } else {
    next(new Error('Unauthorized'));
  }
});

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

