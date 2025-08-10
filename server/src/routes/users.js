import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Current user's details
router.get('/me', (req, res) => {
  const details = db.getUserDetails(req.user.id);
  res.json(details);
});

// Update current profile (name, avatar, socials)
router.put('/me', (req, res) => {
  const { name, avatarUrl, linkedinUrl, whatsapp } = req.body || {};
  const updated = db.updateUserProfile(req.user.id, {
    name,
    profile_url: avatarUrl,
    linkedin_url: linkedinUrl,
    whatsapp,
  });
  res.json(updated);
});

// Change password
router.put('/me/password', (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword) return res.status(400).json({ error: 'New password required' });
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (currentPassword && !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Current password incorrect' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.changeUserPassword(req.user.id, hash);
  res.json({ ok: true });
});

// All users stats (Viewer and Manager) and Employees can view basic profiles
router.get('/', (req, res) => {
  const data = db.listUsers();
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