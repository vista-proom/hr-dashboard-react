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
  try {
    const { managerId, subject, type, body } = req.body || {};
    
    // Validate required fields
    if (!subject || !type || !body) {
      return res.status(400).json({ 
        error: 'Missing required fields. Please provide subject, type, and body.' 
      });
    }
    
    // Validate that user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Create request with proper parameter structure
    const created = db.createRequest({ 
      userId: req.user.id, 
      managerId, 
      subject, 
      type, 
      body 
    });
    
    if (!created) {
      return res.status(500).json({ error: 'Failed to create request' });
    }
    
    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('request-created', created);
    }
    
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Internal server error while creating request' });
  }
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
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const updated = db.updateRequestStatus(id, status, req.user.id);
    if (!updated) return res.status(404).json({ error: 'Request not found' });
    
    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('request-status-updated', updated);
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ error: 'Internal server error while updating request status' });
  }
});

export default router;