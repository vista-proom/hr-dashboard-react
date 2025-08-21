import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(db.listLocations());
});

router.post('/', requireRole('Manager'), (req, res) => {
  const { name, googleMapsUrl, latitude, longitude } = req.body || {};
  const loc = db.createLocation({ name, google_maps_url: googleMapsUrl, latitude, longitude });

  // Broadcast that locations changed
  const io = req.app.get('io');
  io.emit('locations-updated');

  res.status(201).json(loc);
});

router.get('/analytics/:date', requireRole('Viewer', 'Manager'), (req, res) => {
  const date = req.params.date;
  const summary = db.listSchedulesForLocationByDay(date);
  res.json(summary);
});

router.get('/:id/employees/:date', requireRole('Viewer', 'Manager'), (req, res) => {
  const employees = db.listEmployeesForLocationByDay(Number(req.params.id), req.params.date);
  res.json(employees);
});

// Update location coordinates
router.put('/:id/coordinates', requireRole('Manager'), (req, res) => {
  const locationId = Number(req.params.id);
  const { latitude, longitude } = req.body || {};
  
  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }
  
  const location = db.updateLocationCoordinates(locationId, { latitude, longitude });
  if (!location) {
    return res.status(404).json({ error: 'Location not found' });
  }

  // Broadcast that locations changed
  const io = req.app.get('io');
  io.emit('locations-updated');
  
  res.json(location);
});

router.delete('/:id', requireRole('Manager'), (req, res) => {
  const locationId = Number(req.params.id);
  
  try {
    // Check if location exists
    const location = db.database.prepare('SELECT * FROM locations WHERE id = ?').get(locationId);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    // Check if location has references
    const hasReferences = db.checkLocationReferences(locationId);
    
    // Delete the location (this will also handle references)
    const deletedLocation = db.deleteLocation(locationId);
    
    if (!deletedLocation) {
      return res.status(500).json({ error: 'Failed to delete location' });
    }
    
    // Broadcast that locations changed
    const io = req.app.get('io');
    io.emit('locations-updated');
    
    res.json({ 
      message: 'Location deleted successfully', 
      deletedLocation,
      hadReferences: hasReferences,
      note: hasReferences ? 'Related records were also updated' : 'No related records found'
    });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ error: 'Internal server error while deleting location' });
  }
});

export default router;