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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to Redis
// Connect to Redis
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Session setup with Redis store
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

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
test@test-VirtualBox:~/chat-app$ node server.js
/home/test/chat-app/server.js:10
const RedisStore = require('connect-redis')(session);  // Redis store for sessions
                                           ^

TypeError: require(...) is not a function
    at Object.<anonymous> (/home/test/chat-app/server.js:10:44)
    at Module._compile (node:internal/modules/cjs/loader:1364:14)
    at Module._extensions..js (node:internal/modules/cjs/loader:1422:10)
    at Module.load (node:internal/modules/cjs/loader:1203:32)
    at Module._load (node:internal/modules/cjs/loader:1019:12)
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:128:12)
    at node:internal/main/run_main_module:28:49

Node.js v18.20.4
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

