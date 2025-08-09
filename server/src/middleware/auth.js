import jwt from 'jsonwebtoken';
import { db } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '12h' });
}

export function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
  const parts = authHeader.split(' ');
  const token = parts.length === 2 ? parts[1] : null;
  if (!token) return res.status(401).json({ error: 'Invalid Authorization header' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.getUserById(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = { id: user.id, role: user.role, name: user.name, email: user.email, homeLocation: user.home_location };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid/expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}