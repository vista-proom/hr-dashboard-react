import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/me', (req, res) => {
  res.json(db.listSchedulesForUser(req.user.id));
});

router.get('/user/:id', requireRole('Viewer', 'Manager'), (req, res) => {
  const userId = Number(req.params.id);
  res.json(db.listSchedulesForUser(userId));
});

router.post('/', requireRole('Manager'), (req, res) => {
  const { userId, date, startTime, endTime, hours, locationId, kind } = req.body || {};
  const created = db.createSchedule({ userId, date, start_time: startTime, end_time: endTime, hours, location_id: locationId, kind, is_draft: 1 });
  res.status(201).json(created);
});

router.put('/:id', requireRole('Manager'), (req, res) => {
  const id = Number(req.params.id);
  const updated = db.updateSchedule(id, {
    date: req.body.date,
    start_time: req.body.startTime,
    end_time: req.body.endTime,
    hours: req.body.hours,
    location_id: req.body.locationId,
    kind: req.body.kind,
  });
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

router.post('/publish/:userId', requireRole('Manager'), (req, res) => {
  const userId = Number(req.params.userId);
  db.publishDraftsForUser(userId);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('Manager'), (req, res) => {
  db.deleteScheduleById(Number(req.params.id));
  res.status(204).end();
});

router.delete('/user/:id/day/:date', requireRole('Manager'), (req, res) => {
  db.deleteSchedulesByUserAndDate(Number(req.params.id), req.params.date);
  res.status(204).end();
});

export default router;