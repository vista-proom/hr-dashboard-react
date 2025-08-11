import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const data = db.listNotifications(req.user.id);
  res.json(data);
});

router.post('/:id/read', (req, res) => {
  const id = Number(req.params.id);
  db.markNotificationRead(req.user.id, id);
  res.json({ ok: true });
});

export default router;