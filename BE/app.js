const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
const connectDB = require('./src/config/database');
connectDB();

// Attach io to app for use in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API Routes
app.use('/api/v1/auth', require('./src/routes/auth'));
app.use('/api/v1/categories', require('./src/routes/categories'));
app.use('/api/v1/collections', require('./src/routes/collections'));
app.use('/api/v1/products', require('./src/routes/products'));
app.use('/api/v1/users', require('./src/routes/users'));
app.use('/api/v1/carts', require('./src/routes/carts'));
app.use('/api/v1/orders', require('./src/routes/orders'));
app.use('/api/v1/wishlist', require('./src/routes/wishlist'));
app.use('/api/v1/comments', require('./src/routes/comments'));
app.use('/api/v1/payments', require('./src/routes/payments'));
app.use('/api/v1/sizes', require('./src/routes/sizes'));
app.use('/api/v1/chats', require('./src/routes/chats'));
app.use('/api/v1/dashboard', require('./src/routes/dashboard'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error Handler
const { errorHandler } = require('./src/middleware/errorHandler');
app.use(errorHandler);

// Socket.IO Events
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Chat events
  socket.on('join-chat', (roomId) => {
    socket.join(roomId);
  });

  socket.on('send-message', (data) => {
    io.to(data.roomId).emit('receive-message', data);
  });

  socket.on('leave-chat', (roomId) => {
    socket.leave(roomId);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Client URL: ${process.env.CLIENT_URL}`);
});

module.exports = { app, io };
