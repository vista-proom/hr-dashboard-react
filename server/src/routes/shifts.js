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

  // Emit to this user's room for real-time update
  const io = req.app.get('io');
  io.to(`user-${userId}`).emit('shift-created', shift);

  res.status(201).json(shift);
});

// Employee: Check-out (closes the latest open shift)
router.post('/check-out', (req, res) => {
  const userId = req.user.id;
  const { location, deviceType } = req.body || {};
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

  const shift = db.checkOutShift(userId, { timestamp, latitude, longitude, locationName, deviceType });
  if (!shift) return res.status(400).json({ error: 'No open shift to check out.' });

  // Emit to this user's room for real-time update
  const io = req.app.get('io');
  io.to(`user-${userId}`).emit('shift-updated', shift);

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

  // Notify the employee immediately
  const io = req.app.get('io');
  if (shift.user_id) {
    io.to(`user-${shift.user_id}`).emit('shift-deleted', { id: shiftId });
  }

  res.status(204).end();
});

export default router;

// New: Login History endpoint with structured response
router.get('/login-history', (req, res) => {
  try {
    const userId = req.user.id;
    const sessions = db.listShiftsForUserWithLocations(userId);
    const result = sessions.map(s => ({
      date: (s.check_in_date || s.check_out_date) || null,
      checkInTime: s.check_in_time_12h || null,
      checkInLat: s.check_in_lat ?? null,
      checkInLon: s.check_in_lng ?? null,
      checkInDevice: (s.device_type ? (s.device_type.toLowerCase() === 'mobile' ? 'Mobile' : s.device_type.toLowerCase() === 'tablet' ? 'Tablet' : 'PC') : 'PC'),
      checkOutTime: s.check_out_time_12h || null,
      checkOutLat: s.check_out_lat ?? null,
      checkOutLon: s.check_out_lng ?? null,
      checkOutDevice: (s.check_out_device_type ? (s.check_out_device_type.toLowerCase() === 'mobile' ? 'Mobile' : s.check_out_device_type.toLowerCase() === 'tablet' ? 'Tablet' : 'PC') : null),
      checkInResolvedLocation: s.check_in_location_name || null,
      checkOutResolvedLocation: s.check_out_location_name || null
    }));

    res.json(result);
  } catch (err) {
    console.error('Error building login history:', err);
    res.status(500).json({ error: 'Failed to fetch login history' });
  }
});