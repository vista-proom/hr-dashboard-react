import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { db } from './src/db.js';
import authRouter from './src/routes/auth.js';
import usersRouter from './src/routes/users.js';
import tasksRouter from './src/routes/tasks.js';
import hoursRouter from './src/routes/hours.js';
import shiftsRouter from './src/routes/shifts.js';
import requestsRouter from './src/routes/requests.js';
import notificationsRouter from './src/routes/notifications.js';
import locationsRouter from './src/routes/locations.js';
import schedulesRouter from './src/routes/schedules.js';
import { authenticateJWT } from './src/middleware/auth.js';

dotenv.config();

const app = express();

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

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
app.use('/api/schedules', schedulesRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});