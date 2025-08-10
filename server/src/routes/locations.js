import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(db.listLocations());
});

router.post('/', requireRole('Manager'), (req, res) => {
  const { name, googleMapsUrl } = req.body || {};
  const loc = db.createLocation({ name, google_maps_url: googleMapsUrl });
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

export default router;