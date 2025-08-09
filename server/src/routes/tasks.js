import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Create task (Manager)
router.post('/', requireRole('Manager'), (req, res) => {
  const { userId, description, dueDate } = req.body || {};
  if (!userId || !description) return res.status(400).json({ error: 'userId and description are required' });
  const task = db.createTask({ userId, description, assignedBy: req.user.id, dueDate });
  res.status(201).json(task);
});

// Update task (Manager)
router.put('/:taskId', requireRole('Manager'), (req, res) => {
  const taskId = Number(req.params.taskId);
  const { description, dueDate, status } = req.body || {};
  const task = db.updateTask(taskId, { description, due_date: dueDate, status });
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(task);
});

// Delete task (Manager)
router.delete('/:taskId', requireRole('Manager'), (req, res) => {
  const taskId = Number(req.params.taskId);
  const existing = db.getTask(taskId);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.deleteTask(taskId);
  res.status(204).end();
});

// Update status (Employee can update own tasks; Manager can update any)
router.patch('/:taskId/status', (req, res) => {
  const taskId = Number(req.params.taskId);
  const { status } = req.body || {};
  const task = db.getTask(taskId);
  if (!task) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'Manager' && task.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const updated = db.updateTask(taskId, { status });
  res.json(updated);
});

export default router;