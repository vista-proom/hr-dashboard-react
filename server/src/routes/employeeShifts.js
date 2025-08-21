import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Get shifts for the logged-in employee (same as /me)
router.get('/', (req, res) => {
  try {
    const shifts = db.getEmployeeShifts(req.user.id);
    res.json(shifts);
  } catch (error) {
    console.error('Error fetching employee shifts:', error);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// Get shifts for the logged-in employee
router.get('/me', (req, res) => {
  try {
    const shifts = db.getEmployeeShifts(req.user.id);
    res.json(shifts);
  } catch (error) {
    console.error('Error fetching employee shifts:', error);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// Manager assigns shift to employee
router.post('/assign', requireRole('Manager'), (req, res) => {
  try {
    const { employeeId, employeeName, shiftData } = req.body;
    
    if (!employeeId || !employeeName || !shiftData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const assignedShift = db.assignShiftToEmployee(employeeId, employeeName, shiftData);
    res.status(201).json(assignedShift);
  } catch (error) {
    console.error('Error assigning shift:', error);
    res.status(500).json({ error: 'Failed to assign shift' });
  }
});

// Manager gets shifts for a specific employee
router.get('/employee/:id', requireRole('Manager'), (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    const shifts = db.getEmployeeShifts(employeeId);
    res.json(shifts);
  } catch (error) {
    console.error('Error fetching employee shifts:', error);
    res.status(500).json({ error: 'Failed to fetch employee shifts' });
  }
});

// Manager updates a shift
router.put('/:id', requireRole('Manager'), (req, res) => {
  try {
    const { employeeId, shiftData } = req.body;
    const shiftId = Number(req.params.id);
    
    if (!employeeId || !shiftData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const updatedShift = db.updateEmployeeShift(employeeId, shiftId, shiftData);
    if (!updatedShift) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    
    res.json(updatedShift);
  } catch (error) {
    console.error('Error updating shift:', error);
    res.status(500).json({ error: 'Failed to update shift' });
  }
});

// Manager deletes a shift
router.delete('/:employeeId/:shiftId', requireRole('Manager'), (req, res) => {
  const employeeId = Number(req.params.employeeId);
  const shiftId = Number(req.params.shiftId);
  
  console.log('Delete request received:', { employeeId, shiftId, user: req.user.id });
  
  try {
    // Check if the shift exists before deleting
    const shifts = db.getEmployeeShifts(employeeId);
    console.log('Found shifts for employee:', shifts.length);
    
    const shiftExists = shifts.find(s => s.id === shiftId);
    console.log('Shift exists check:', { shiftId, found: !!shiftExists });
    
    if (!shiftExists) {
      console.log('Shift not found, returning 404');
      return res.status(404).json({ error: 'Shift not found' });
    }
    
    // Delete the shift
    const deletedShift = db.deleteEmployeeShift(employeeId, shiftId);
    console.log('Delete result:', deletedShift);
    
    // Emit to the employee's room for real-time update
    const io = req.app.get('io');
    io.to(`user-${employeeId}`).emit('assigned-shift-deleted', { id: shiftId });
    
    res.json({ message: 'Shift deleted successfully', deletedShiftId: shiftId, deletedShift });
  } catch (error) {
    console.error('Error deleting employee shift:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;