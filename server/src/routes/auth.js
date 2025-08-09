import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, authenticateJWT } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password, location } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = db.getUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  // Record login location and timestamp
  const timestamp = (location && location.timestamp) || new Date().toISOString();
  const latitude = location && Number.isFinite(location.latitude) ? location.latitude : null;
  const longitude = location && Number.isFinite(location.longitude) ? location.longitude : null;
  db.insertLocationLog(user.id, { timestamp, latitude, longitude });

  const token = signToken(user);
  const me = db.getUserDetails(user.id);
  res.json({ token, user: me });
});

router.get('/me', authenticateJWT, (req, res) => {
  const details = db.getUserDetails(req.user.id);
  res.json(details);
});

export default router;