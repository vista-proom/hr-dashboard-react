import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

const uploadDir = path.resolve('server/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `avatar_${req.user.id}${ext}`);
  },
});
const upload = multer({ storage });

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

// Upload avatar
router.post('/me/avatar', upload.single('avatar'), (req, res) => {
  const relPath = `/uploads/${path.basename(req.file.path)}`;
  const updated = db.updateUserProfile(req.user.id, { profile_url: relPath });
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

// Users listing
router.get('/', (req, res) => {
  if (req.user.role === 'Viewer' || req.user.role === 'Manager') {
    const data = db.getAllUserStats();
    return res.json(data);
  }
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