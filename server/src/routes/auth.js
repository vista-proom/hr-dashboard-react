import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, authenticateJWT } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = db.getUserByEmailForAuth(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  // Create login history record
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  const deviceInfo = req.get('User-Agent') ? 'Web Browser' : 'Unknown';
  
  db.createLoginRecord({
    userId: user.id,
    ipAddress,
    deviceInfo,
    userAgent
  });

  const token = signToken(user);
  const me = db.getUserDetails(user.id);
  res.json({ token, user: me });
});

router.get('/me', authenticateJWT, (req, res) => {
  const details = db.getUserProfile(req.user.id);
  res.json(details);
});

router.get('/login-history', authenticateJWT, (req, res) => {
  try {
    const loginHistory = db.getLoginHistoryForUser(req.user.id);
    res.json(loginHistory);
  } catch (error) {
    console.error('Error fetching login history:', error);
    res.status(500).json({ error: 'Failed to fetch login history' });
  }
});

router.post('/logout', authenticateJWT, (req, res) => {
  try {
    // Update the current login session with logout timestamp
    const currentSession = db.getCurrentLoginSession(req.user.id);
    if (currentSession) {
      db.updateLogoutRecord(currentSession.id);
    }
    
    // Clear the JWT cookie
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

export default router;