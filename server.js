require('dotenv').config();  // Load environment variables
const fs = require('fs');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const bcrypt = require('bcrypt');
const session = require('express-session');
const redis = require('redis');  // Redis client
const RedisStore = require('connect-redis').default;  // New way for v6 and above

const app = express();
const PORT = process.env.PORT || 3001;

console.log('REDIS_HOST:', process.env.REDIS_HOST);
console.log('REDIS_PORT:', process.env.REDIS_PORT);
console.log('SESSION_SECRET:', process.env.SESSION_SECRET);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (like index.html, CSS, JS) from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Connect to Redis
const redisClient = redis.createClient({
  url: `redis://:${process.env.REDIS_PASSWORD || '1234$$1234'}@${process.env.REDIS_HOST || '172.20.71.113'}:${process.env.REDIS_PORT || 6379}`
});

// Use async/await for Redis connection, as Redis 4.4 uses Promises
redisClient.connect().then(() => {
  console.log('Connected to Redis');
}).catch((err) => {
  console.error('Redis connection error:', err);
});

// Create Redis store for sessions
const store = new RedisStore({
  client: redisClient,  // Pass in the Redis client
});

// Session setup using Redis as the session store
const sessionMiddleware = session({
  store: store,
  secret: process.env.SESSION_SECRET || 'fallback-random-secret', // Use .env or fallback to something secure
  resave: false,
  saveUninitialized: true,
});

// Apply session middleware in Express
app.use(sessionMiddleware);

// Redis key to store user information
const USER_PREFIX = 'user:';

// Helper function to save user in Redis
const saveUserInRedis = async (username, password) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  await redisClient.hSet(`${USER_PREFIX}${username}`, { username, password: hashedPassword });
};

// Helper function to get user from Redis
const getUserFromRedis = async (username) => {
  const user = await redisClient.hGetAll(`${USER_PREFIX}${username}`);
  if (Object.keys(user).length === 0) {
    return null;  // Return null if the user is not found
  }
  return user;
};

// Registration route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await getUserFromRedis(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    await saveUserInRedis(username, password);
    req.session.userId = username;  // Use username as the session ID
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await getUserFromRedis(username);
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    req.session.userId = username;  // Use username as the session ID
    res.json({ message: 'Login successful' });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
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
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Log out route
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully' });
  });
});

// Create HTTP server and integrate with Express
const server = http.createServer(app);
const io = new Server(server);

// Wrap express-session middleware for Socket.IO to share sessions
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

// Authenticate socket connections using session data
io.use((socket, next) => {
  const session = socket.request.session;
  if (session && session.userId) {
    next();
  } else {
    next(new Error('Unauthorized'));
  }
});

// Socket.IO connection handler
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

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

