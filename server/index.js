import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { db } from './src/db.js';
import authRouter from './src/routes/auth.js';
import usersRouter from './src/routes/users.js';
import tasksRouter from './src/routes/tasks.js';
import hoursRouter from './src/routes/hours.js';
import shiftsRouter from './src/routes/shifts.js';
import requestsRouter from './src/routes/requests.js';
import notificationsRouter from './src/routes/notifications.js';
import locationsRouter from './src/routes/locations.js';
import employeeShiftsRouter from './src/routes/employeeShifts.js';
import { authenticateJWT } from './src/middleware/auth.js';

dotenv.config();

const app = express();
const server = createServer(app);

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true
  }
});

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// static for uploads
app.use('/uploads', express.static(path.resolve('server/uploads')));

// Initialize DB (creates tables and seeds if needed)
db.init();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);

// Authenticated routes
app.use('/api', authenticateJWT);
app.use('/api/users', usersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/hours', hoursRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/employee-shifts', employeeShiftsRouter);

// Path to client build output
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// SPA fallback route
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Join user to their personal room
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined room user-${userId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});