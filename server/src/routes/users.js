import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Current user's details
router.get('/me', (req, res) => {
  const details = db.getUserDetails(req.user.id);
  res.json(details);
});

// All users stats (Viewer and Manager)
router.get('/', requireRole('Viewer', 'Manager'), (req, res) => {
  const data = db.getAllUserStats();
  res.json(data);
});

// Specific user details (Viewer and Manager)
router.get('/:id', requireRole('Viewer', 'Manager'), (req, res) => {
  const userId = Number(req.params.id);
  const details = db.getUserDetails(userId);
  if (!details) return res.status(404).json({ error: 'Not found' });
  res.json(details);
});

export default router;