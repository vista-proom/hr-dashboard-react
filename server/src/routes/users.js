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
  
  // Get comprehensive details including shifts and tasks
  const comprehensiveDetails = db.getUserProfile(userId);
  res.json(comprehensiveDetails);
});

// Comprehensive employee details with shifts, tasks, and hours (Viewer and Manager)
router.get('/:id/comprehensive', requireRole('Viewer', 'Manager'), (req, res) => {
  const userId = Number(req.params.id);
  const details = db.getUserDetails(userId);
  if (!details) return res.status(404).json({ error: 'Not found' });
  
  try {
    // Get comprehensive details including shifts, tasks, and calculated hours
    const comprehensiveDetails = db.getUserProfile(userId);
    
    // Calculate current month hours
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyShifts = comprehensiveDetails.shifts.filter(shift => {
      if (!shift.check_in_time) return false;
      const shiftDate = new Date(shift.check_in_time);
      return shiftDate.getMonth() === currentMonth && shiftDate.getFullYear() === currentYear;
    });
    
    const totalHoursScheduled = monthlyShifts.length * 8; // Assuming 8 hours per shift
    const totalHoursWorked = monthlyShifts.reduce((total, shift) => {
      if (shift.check_in_time && shift.check_out_time) {
        const checkIn = new Date(shift.check_in_time);
        const checkOut = new Date(shift.check_out_time);
        const hours = (checkOut - checkIn) / (1000 * 60 * 60);
        return total + hours;
      }
      return total;
    }, 0);
    
    // Get current status
    const currentShift = db.getOpenShiftForUser(userId);
    const currentStatus = currentShift ? 'In' : 'Out';
    const currentLocation = currentShift?.check_in_location_name || 'N/A';
    const lastCheckIn = currentShift?.check_in_time || null;
    
    // Get assigned shifts (from employee-shifts table) for the Assigned Shifts section
    const assignedShifts = db.getEmployeeShifts(userId);
    
    const result = {
      ...comprehensiveDetails,
      currentStatus,
      currentLocation,
      lastCheckIn,
      totalHoursScheduled: Math.round(totalHoursScheduled * 100) / 100,
      totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
      monthlyShifts,
      assignedShifts // This will populate the Assigned Shifts section
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error getting comprehensive employee details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;