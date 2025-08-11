import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Employee: Check-in (creates a new shift if none open)
router.post('/check-in', (req, res) => {
  const userId = req.user.id;
  const { location } = req.body || {};
  const timestamp = new Date().toISOString();
  const latitude = location && Number.isFinite(location.latitude) ? location.latitude : null;
  const longitude = location && Number.isFinite(location.longitude) ? location.longitude : null;

  const open = db.getOpenShiftForUser(userId);
  if (open) return res.status(400).json({ error: 'Open shift already exists. Please check out first.' });
  const shift = db.createShiftCheckIn(userId, { timestamp, latitude, longitude });
  res.status(201).json(shift);
});

// Employee: Check-out (closes the latest open shift)
router.post('/check-out', (req, res) => {
  const userId = req.user.id;
  const { location } = req.body || {};
  const timestamp = new Date().toISOString();
  const latitude = location && Number.isFinite(location.latitude) ? location.latitude : null;
  const longitude = location && Number.isFinite(location.longitude) ? location.longitude : null;

  const shift = db.checkOutShift(userId, { timestamp, latitude, longitude });
  if (!shift) return res.status(400).json({ error: 'No open shift to check out.' });
  res.json(shift);
});

// Employee: List own shifts
router.get('/me', (req, res) => {
  const userId = req.user.id;
  const shifts = db.listShiftsForUser(userId);
  res.json(shifts);
});

// Manager/Viewer: List shifts for a user
router.get('/user/:id', requireRole('Viewer', 'Manager'), (req, res) => {
  const userId = Number(req.params.id);
  const shifts = db.listShiftsForUser(userId);
  res.json(shifts);
});

export default router;