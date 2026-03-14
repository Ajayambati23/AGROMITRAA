const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowAllOrigins = configuredOrigins.length === 0 || configuredOrigins.includes('*');
const corsOrigin = allowAllOrigins ? true : configuredOrigins;

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: allowAllOrigins ? '*' : configuredOrigins,
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: corsOrigin,
  credentials: false,
}));
app.options('*', cors({ origin: corsOrigin }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting – higher limits for smoother refresh and normal usage
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute per IP
  message: { message: 'Too many requests, please slow down' },
});
app.use(limiter);

// Lightweight observability: request IDs + structured logs + in-memory metrics
const metrics = {
  startedAt: new Date().toISOString(),
  requestsTotal: 0,
  errorsTotal: 0,
  byRoute: {}
};

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  req._startAt = process.hrtime.bigint();
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - req._startAt) / 1e6;
    const routeKey = `${req.method} ${req.baseUrl || ''}${req.route?.path || req.path || 'unknown'}`;

    metrics.requestsTotal += 1;
    if (res.statusCode >= 500) metrics.errorsTotal += 1;
    if (!metrics.byRoute[routeKey]) {
      metrics.byRoute[routeKey] = {
        count: 0,
        errors: 0,
        totalLatencyMs: 0,
        minLatencyMs: Number.MAX_VALUE,
        maxLatencyMs: 0
      };
    }

    const entry = metrics.byRoute[routeKey];
    entry.count += 1;
    if (res.statusCode >= 500) entry.errors += 1;
    entry.totalLatencyMs += elapsedMs;
    entry.minLatencyMs = Math.min(entry.minLatencyMs, elapsedMs);
    entry.maxLatencyMs = Math.max(entry.maxLatencyMs, elapsedMs);

    console.log(JSON.stringify({
      level: 'info',
      type: 'http_request',
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(elapsedMs.toFixed(2)),
      ip: req.ip,
      timestamp: new Date().toISOString()
    }));
  });

  next();
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agromitra');

// Import routes
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const cropRoutes = require('./routes/crops');
const calendarRoutes = require('./routes/calendar');
const voiceRoutes = require('./routes/voice');
const trainingRoutes = require('./routes/training');
const marketplaceRoutes = require('./routes/marketplace');
const weatherRoutes = require('./routes/weather');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const { router: buyerAuthRoutes } = require('./routes/buyerAuth');
const ordersRoutes = require('./routes/orders');
const { updateStatusHandler } = require('./routes/orders');
const NotificationService = require('./services/notificationService');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/buyer-auth', buyerAuthRoutes);
// Explicit order status update (must be before /api/orders mount so it matches first)
app.patch('/api/orders/:id/status', updateStatusHandler);
app.put('/api/orders/:id/status', updateStatusHandler);
app.use('/api/orders', ordersRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/crops', cropRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Minimal metrics endpoint for operations dashboards
app.get('/api/metrics', (req, res) => {
  const byRoute = Object.fromEntries(
    Object.entries(metrics.byRoute).map(([key, value]) => [
      key,
      {
        count: value.count,
        errors: value.errors,
        avgLatencyMs: value.count ? Number((value.totalLatencyMs / value.count).toFixed(2)) : 0,
        minLatencyMs: value.minLatencyMs === Number.MAX_VALUE ? 0 : Number(value.minLatencyMs.toFixed(2)),
        maxLatencyMs: Number(value.maxLatencyMs.toFixed(2))
      }
    ])
  );

  res.json({
    startedAt: metrics.startedAt,
    uptimeSec: Number(process.uptime().toFixed(0)),
    requestsTotal: metrics.requestsTotal,
    errorsTotal: metrics.errorsTotal,
    byRoute
  });
});

// Serve static files
app.use(express.static('public'));

// Socket.io for real-time communication
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room ${room}`);
  });
  
  socket.on('chat-message', (data) => {
    socket.to(data.room).emit('chat-message', data);
  });
  
  socket.on('voice-message', (data) => {
    socket.to(data.room).emit('voice-message', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Initialize market prices from Agmarknet API on startup
const initializeMarketPrices = async () => {
  try {
    const { refreshAllPrices } = require('./services/marketPriceService');
    console.log('Initializing market prices from Agmarknet API...');
    
    const updated = await refreshAllPrices();
    console.log(`Market prices initialized: ${updated} records`);
  } catch (error) {
    console.error('Market price initialization error:', error);
    console.log('Will use cached prices or mock data as fallback');
  }
};

// Wait for MongoDB to connect before initializing prices
setTimeout(() => {
  if (mongoose.connection.readyState === 1) {
    initializeMarketPrices();
  }
}, 2000);

// Start notification reminder scheduler
const notificationService = new NotificationService();
notificationService.scheduleReminderChecks();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`AgroMitra server running on port ${PORT}`);
});
