import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// List shifts for current user (same as /me)
router.get('/', (req, res) => {
  const userId = req.user.id;
  const shifts = db.listShiftsForUserWithLocations(userId);
  res.json(shifts);
});

// Employee: Check-in (creates a new shift if none open)
router.post('/check-in', (req, res) => {
  const userId = req.user.id;
  const { location, deviceType } = req.body || {};
  const timestamp = new Date().toISOString();
  const latitude = location && Number.isFinite(location.latitude) ? location.latitude : null;
  const longitude = location && Number.isFinite(location.longitude) ? location.longitude : null;

  const open = db.getOpenShiftForUser(userId);
  if (open) return res.status(400).json({ error: 'Open shift already exists. Please check out first.' });
  
  // Check if location is near a saved location
  let locationName = null;
  if (latitude && longitude) {
    const nearbyLocation = db.findNearbyLocation(latitude, longitude);
    if (nearbyLocation) {
      locationName = nearbyLocation.name;
    }
  }
  
  const shift = db.createShiftCheckIn(userId, { timestamp, latitude, longitude, locationName, deviceType });
  res.status(201).json(shift);
});

// Employee: Check-out (closes the latest open shift)
router.post('/check-out', (req, res) => {
  const userId = req.user.id;
  const { location } = req.body || {};
  const timestamp = new Date().toISOString();
  const latitude = location && Number.isFinite(location.latitude) ? location.latitude : null;
  const longitude = location && Number.isFinite(location.longitude) ? location.longitude : null;

  // Check if location is near a saved location
  let locationName = null;
  if (latitude && longitude) {
    const nearbyLocation = db.findNearbyLocation(latitude, longitude);
    if (nearbyLocation) {
      locationName = nearbyLocation.name;
    }
  }

  const shift = db.checkOutShift(userId, { timestamp, latitude, longitude, locationName });
  if (!shift) return res.status(400).json({ error: 'No open shift to check out.' });
  res.json(shift);
});

// Employee: List own shifts
router.get('/me', (req, res) => {
  const userId = req.user.id;
  const shifts = db.listShiftsForUserWithLocations(userId);
  res.json(shifts);
});

// Manager/Viewer: List shifts for a user
router.get('/user/:id', requireRole('Viewer', 'Manager'), (req, res) => {
  const userId = Number(req.params.id);
  const shifts = db.listShiftsForUserWithLocations(userId);
  res.json(shifts);
});

// Export shifts to Excel
router.get('/export/:userId', requireRole('Viewer', 'Manager'), (req, res) => {
  const userId = Number(req.params.userId);
  const shifts = db.listShiftsForUserWithLocations(userId);
  
  // Set headers for Excel download
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=shifts_${userId}_${new Date().toISOString().split('T')[0]}.xlsx`);
  
  // For now, return JSON - the client will handle Excel conversion
  res.json(shifts);
});

// Delete shift (Manager only)
router.delete('/:shiftId', requireRole('Manager'), (req, res) => {
  const shiftId = Number(req.params.shiftId);
  const shift = db.getShiftById(shiftId);
  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  
  db.deleteShift(shiftId);
  res.status(204).end();
});

export default router;