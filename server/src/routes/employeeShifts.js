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
router.delete('/:id', requireRole('Manager'), (req, res) => {
  try {
    const { employeeId } = req.body;
    const shiftId = Number(req.params.id);
    
    if (!employeeId) {
      return res.status(400).json({ error: 'Missing employee ID' });
    }
    
    db.deleteEmployeeShift(employeeId, shiftId);
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting shift:', error);
    res.status(500).json({ error: 'Failed to delete shift' });
  }
});

export default router;