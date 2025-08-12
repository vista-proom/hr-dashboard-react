import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(db.listLocations());
});

router.post('/', requireRole('Manager'), (req, res) => {
  const { name, googleMapsUrl, latitude, longitude } = req.body || {};
  const loc = db.createLocation({ name, google_maps_url: googleMapsUrl, latitude, longitude });
  res.status(201).json(loc);
});

router.get('/analytics/:date', requireRole('Viewer', 'Manager'), (req, res) => {
  const date = req.params.date;
  const summary = db.listSchedulesForLocationByDay(date);
  res.json(summary);
});

router.get('/:id/employees/:date', requireRole('Viewer', 'Manager'), (req, res) => {
  const employees = db.listEmployeesForLocationByDay(Number(req.params.id), req.params.date);
  res.json(employees);
});

// Update location coordinates
router.put('/:id/coordinates', requireRole('Manager'), (req, res) => {
  const locationId = Number(req.params.id);
  const { latitude, longitude } = req.body || {};
  
  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }
  
  const location = db.updateLocationCoordinates(locationId, { latitude, longitude });
  if (!location) {
    return res.status(404).json({ error: 'Location not found' });
  }
  
  res.json(location);
});

export default router;