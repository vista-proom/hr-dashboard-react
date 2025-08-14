import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// List tasks for current user
router.get('/', (req, res) => {
  const tasks = db.listTasksForUser(req.user.id);
  res.json(tasks);
});

// List tasks assigned by current manager
router.get('/assigned-by/me', requireRole('Manager'), (req, res) => {
  const allUsers = db.getAllUserStats();
  const tasks = [];
  for (const u of allUsers) {
    for (const t of u.tasks || []) {
      if (t.assigned_by === req.user.id) tasks.push({ ...t, assignee: { id: u.id, name: u.name, email: u.email } });
    }
  }
  res.json(tasks.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
});

// Create task (Manager)
router.post('/', requireRole('Manager'), (req, res) => {
  const { userId, name, description, dueDate } = req.body || {};
  if (!userId || !description) return res.status(400).json({ error: 'userId and description are required' });
  const task = db.createTask({ userId, name, description, assignedBy: req.user.id, dueDate });
  // notify assignee
  db.createNotification(userId, { message: `New task assigned: ${name || description}` , type: 'task' });
  res.status(201).json(task);
});

// Update task (Manager)
router.put('/:taskId', requireRole('Manager'), (req, res) => {
  const taskId = Number(req.params.taskId);
  const { name, description, dueDate, status } = req.body || {};
  const task = db.updateTask(taskId, { name, description, due_date: dueDate, status, modified_by: req.user.id });
  if (!task) return res.status(404).json({ error: 'Not found' });
  if (task.user_id) db.createNotification(task.user_id, { message: `Task updated: ${task.name || task.description}`, type: 'task' });
  res.json(task);
});

// Delete task (Manager)
router.delete('/:taskId', requireRole('Manager'), (req, res) => {
  const taskId = Number(req.params.taskId);
  const existing = db.getTask(taskId);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.deleteTask(taskId);
  if (existing.user_id) db.createNotification(existing.user_id, { message: `Task deleted: ${existing.name || existing.description}`, type: 'task' });
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
  const updated = db.updateTask(taskId, { status, modified_by: req.user.id });
  if (task.user_id) db.createNotification(task.user_id, { message: `Task status changed to ${status}`, type: 'task' });
  res.json(updated);
});

export default router;