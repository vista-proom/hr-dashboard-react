import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// List hours per location (Viewer/Manager)
router.get('/', requireRole('Viewer', 'Manager'), (req, res) => {
  const users = db.listUsers();
  // derive unique locations and their hours
  const set = new Map();
  for (const u of users) {
    const loc = u.homeLocation;
    const row = db.getRequiredHours(loc);
    set.set(loc, row ? row.hours : 8);
  }
  const data = Array.from(set.entries()).map(([location, hours]) => ({ location, hours }));
  res.json(data);
});

// Set hours for a location (Manager)
router.put('/:location', requireRole('Manager'), (req, res) => {
  const { location } = req.params;
  const { hours } = req.body || {};
  const parsed = Number(hours);
  if (!Number.isFinite(parsed) || parsed <= 0) return res.status(400).json({ error: 'hours must be positive number' });
  db.setRequiredHours(location, Math.floor(parsed));
  res.json({ location, hours: Math.floor(parsed) });
});

export default router;