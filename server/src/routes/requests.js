import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// List requests for current user (same as /me)
router.get('/', (req, res) => {
  const data = db.listRequestsForUser(req.user.id);
  res.json(data);
});

// Employee: create a request
router.post('/', (req, res) => {
  const { managerId, subject, type, body } = req.body || {};
  const created = db.createRequest(req.user.id, { managerId, subject, type, body });
  res.status(201).json(created);
});

// Employee: list my requests
router.get('/me', (req, res) => {
  const data = db.listRequestsForUser(req.user.id);
  res.json(data);
});

// Manager: list pending requests
router.get('/pending', requireRole('Manager'), (req, res) => {
  const data = db.listPendingRequests();
  res.json(data);
});

// Manager: update request status
router.put('/:id/status', requireRole('Manager'), (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  const updated = db.updateRequestStatus(id, { status, approverId: req.user.id });
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

export default router;