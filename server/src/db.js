import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

function createConnection() {
  return new Database('database.sqlite');
}

function columnExists(database, table, column) {
  try {
    const result = database.prepare(`PRAGMA table_info(${table})`).all();
    return result.some(col => col.name === column);
  } catch {
    return false;
  }
}

function createSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Employee',
      home_location TEXT DEFAULT 'NYC',
      profile_url TEXT,
      linkedin_url TEXT,
      whatsapp TEXT,
      annual_balance INTEGER DEFAULT 21,
      casual_balance INTEGER DEFAULT 6,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT,
      description TEXT NOT NULL,
      assigned_by INTEGER,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at TEXT NOT NULL,
      last_status_modified_at TEXT,
      modified_by INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS location_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS required_hours (
      location TEXT PRIMARY KEY,
      hours INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      check_in_time TEXT,
      check_in_lat REAL,
      check_in_lng REAL,
      check_in_location_name TEXT,
      check_out_time TEXT,
      check_out_lat REAL,
      check_out_lng REAL,
      check_out_location_name TEXT,
      device_type TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      manager_id INTEGER,
      subject TEXT,
      type TEXT,
      body TEXT,
      status TEXT NOT NULL DEFAULT 'Under Review',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(manager_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      type TEXT,
      created_at TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      google_maps_url TEXT,
      latitude REAL,
      longitude REAL
    );
  `);

  // Safe migrations
  if (!columnExists(database, 'users', 'linkedin_url')) database.exec(`ALTER TABLE users ADD COLUMN linkedin_url TEXT`);
  if (!columnExists(database, 'users', 'whatsapp')) database.exec(`ALTER TABLE users ADD COLUMN whatsapp TEXT`);
  if (!columnExists(database, 'users', 'annual_balance')) database.exec(`ALTER TABLE users ADD COLUMN annual_balance INTEGER DEFAULT 21`);
  if (!columnExists(database, 'users', 'casual_balance')) database.exec(`ALTER TABLE users ADD COLUMN casual_balance INTEGER DEFAULT 6`);
  if (!columnExists(database, 'tasks', 'name')) database.exec(`ALTER TABLE tasks ADD COLUMN name TEXT`);
  if (!columnExists(database, 'tasks', 'last_status_modified_at')) database.exec(`ALTER TABLE tasks ADD COLUMN last_status_modified_at TEXT`);
  if (!columnExists(database, 'tasks', 'modified_by')) database.exec(`ALTER TABLE tasks ADD COLUMN modified_by INTEGER`);
  if (!columnExists(database, 'locations', 'latitude')) database.exec(`ALTER TABLE locations ADD COLUMN latitude REAL`);
  if (!columnExists(database, 'locations', 'longitude')) database.exec(`ALTER TABLE locations ADD COLUMN longitude REAL`);
  if (!columnExists(database, 'shifts', 'check_in_location_name')) database.exec(`ALTER TABLE shifts ADD COLUMN check_in_location_name TEXT`);
  if (!columnExists(database, 'shifts', 'check_out_location_name')) database.exec(`ALTER TABLE shifts ADD COLUMN check_out_location_name TEXT`);
  if (!columnExists(database, 'shifts', 'device_type')) database.exec(`ALTER TABLE shifts ADD COLUMN device_type TEXT`);
}

function seed(database) {
  const hash = (password) => bcrypt.hashSync(password, 10);
  const avatar = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

  // seed users
  const insertUser = database.prepare(`
    INSERT INTO users (name, email, password_hash, role, home_location, profile_url, linkedin_url, whatsapp, annual_balance, casual_balance, created_at, updated_at)
    VALUES (@name, @email, @password_hash, @role, @home_location, @profile_url, @linkedin_url, @whatsapp, @annual_balance, @casual_balance, @created_at, @updated_at)
  `);

  const now = new Date().toISOString();
  const managerInfo = { name: 'Manny Manager', email: 'manager@acme.com', password_hash: hash('Password123!'), role: 'Manager', home_location: 'NYC', profile_url: avatar('Manny Manager'), linkedin_url: '', whatsapp: '', annual_balance: 21, casual_balance: 6, created_at: now, updated_at: now };
  const viewerInfo = { name: 'Vera Viewer', email: 'viewer@acme.com', password_hash: hash('Password123!'), role: 'Viewer', home_location: 'SF', profile_url: avatar('Vera Viewer'), linkedin_url: '', whatsapp: '', annual_balance: 21, casual_balance: 6, created_at: now, updated_at: now };
  const aliceInfo = { name: 'Alice Employee', email: 'alice@acme.com', password_hash: hash('Password123!'), role: 'Employee', home_location: 'NYC', profile_url: avatar('Alice Employee'), linkedin_url: '', whatsapp: '', annual_balance: 21, casual_balance: 6, created_at: now, updated_at: now };
  const bobInfo = { name: 'Bob Employee', email: 'bob@acme.com', password_hash: hash('Password123!'), role: 'Employee', home_location: 'SF', profile_url: avatar('Bob Employee'), linkedin_url: '', whatsapp: '', annual_balance: 21, casual_balance: 6, created_at: now, updated_at: now };

  insertUser.run(managerInfo);
  insertUser.run(viewerInfo);
  insertUser.run(aliceInfo);
  insertUser.run(bobInfo);

  // required hours per location
  const insertHours = database.prepare('INSERT INTO required_hours (location, hours) VALUES (?, ?)');
  insertHours.run('NYC', 40);
  insertHours.run('SF', 40);

  // seed locations
  const insertLocation = database.prepare('INSERT INTO locations (name, google_maps_url) VALUES (?, ?)');
  insertLocation.run('Main Office', 'https://maps.google.com/?q=40.7128,-74.0060');
  insertLocation.run('Warehouse A', 'https://maps.google.com/?q=37.7749,-122.4194');
  insertLocation.run('Branch Office', 'https://maps.google.com/?q=34.0522,-118.2437');
  insertLocation.run('Remote Location', 'https://maps.google.com/?q=51.5074,-0.1278');

  // seed tasks
  const insertTask = database.prepare(`
    INSERT INTO tasks (user_id, name, description, assigned_by, due_date, status, created_at, last_status_modified_at, modified_by)
    VALUES (@user_id, @name, @description, @assigned_by, @due_date, @status, @created_at, @last_status_modified_at, @modified_by)
  `);

  const alice = database.prepare('SELECT id FROM users WHERE email = ?').get('alice@acme.com');
  const bob = database.prepare('SELECT id FROM users WHERE email = ?').get('bob@acme.com');
  const manager = database.prepare('SELECT id FROM users WHERE email = ?').get('manager@acme.com');

  insertTask.run({
    user_id: alice.id,
    name: 'Complete onboarding documents',
    description: 'Fill out all required onboarding forms and submit to HR',
    assigned_by: manager.id,
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: 'Pending',
    created_at: now,
    last_status_modified_at: now,
    modified_by: manager.id
  });

  insertTask.run({
    user_id: bob.id,
    name: 'Security training module',
    description: 'Complete the mandatory security awareness training',
    assigned_by: manager.id,
    due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: 'In Progress',
    created_at: now,
    last_status_modified_at: now,
    modified_by: manager.id
  });
}

function mapUserRow(row, database) {
  const hoursRow = database.prepare('SELECT hours FROM required_hours WHERE location = ?').get(row.home_location);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    homeLocation: row.home_location,
    profileUrl: row.profile_url,
    linkedinUrl: row.linkedin_url,
    whatsapp: row.whatsapp,
    annualBalance: row.annual_balance,
    casualBalance: row.casual_balance,
    requiredHours: hoursRow ? hoursRow.hours : 40,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const db = {
  database: null,

  init() {
    this.database = createConnection();
    createSchema(this.database);
    
    // Check if we need to seed
    const userCount = this.database.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
      seed(this.database);
    }
  },

  // Users
  listUsers() {
    const rows = this.database.prepare('SELECT * FROM users ORDER BY name').all();
    return rows.map(row => mapUserRow(row, this.database));
  },

  getUserById(id) {
    const row = this.database.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row ? mapUserRow(row, this.database) : null;
  },

  getUserByEmail(email) {
    const row = this.database.prepare('SELECT * FROM users WHERE email = ?').get(email);
    return row ? mapUserRow(row, this.database) : null;
  },

  getUserByEmailForAuth(email) {
    const row = this.database.prepare('SELECT * FROM users WHERE email = ?').get(email);
    return row;
  },

  getUserDetails(id) {
    const row = this.database.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row ? mapUserRow(row, this.database) : null;
  },

  createUser({ name, email, password, role, homeLocation }) {
    const passwordHash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();
    const r = this.database.prepare(`
      INSERT INTO users (name, email, password_hash, role, home_location, profile_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, email, passwordHash, role, homeLocation, `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`, now, now);
    return this.getUserById(r.lastInsertRowid);
  },

  updateUser(id, fields) {
    const current = this.getUserById(id);
    if (!current) return null;
    const updated = { ...current, ...fields };
    const now = new Date().toISOString();
    this.database.prepare(`
      UPDATE users SET name=@name, home_location=@homeLocation, linkedin_url=@linkedinUrl, whatsapp=@whatsapp, annual_balance=@annualBalance, casual_balance=@casualBalance, updated_at=@updated_at WHERE id=@id
    `).run({
      id,
      name: updated.name,
      homeLocation: updated.homeLocation,
      linkedinUrl: updated.linkedinUrl,
      whatsapp: updated.whatsapp,
      annualBalance: updated.annualBalance,
      casualBalance: updated.casualBalance,
      updated_at: now,
    });
    return this.getUserById(id);
  },

  deleteUser(id) {
    this.database.prepare('DELETE FROM users WHERE id = ?').run(id);
  },

  // Tasks
  listTasksForUser(userId) {
    const rows = this.database.prepare(`
      SELECT t.*, u.name as assigned_by_name 
      FROM tasks t 
      LEFT JOIN users u ON t.assigned_by = u.id 
      WHERE t.user_id = ? 
      ORDER BY t.created_at DESC
    `).all(userId);
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      assignedBy: row.assigned_by,
      assignedByName: row.assigned_by_name,
      dueDate: row.due_date,
      status: row.status,
      createdAt: row.created_at,
      lastStatusModifiedAt: row.last_status_modified_at,
      modifiedBy: row.modified_by
    }));
  },

  listTasksAssignedByUser(userId) {
    const rows = this.database.prepare(`
      SELECT t.*, u.name as user_name 
      FROM tasks t 
      LEFT JOIN users u ON t.user_id = u.id 
      WHERE t.assigned_by = ? 
      ORDER BY t.created_at DESC
    `).all(userId);
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      name: row.name,
      description: row.description,
      assignedBy: row.assigned_by,
      dueDate: row.due_date,
      status: row.status,
      createdAt: row.created_at,
      lastStatusModifiedAt: row.last_status_modified_at,
      modifiedBy: row.modified_by
    }));
  },

  createTask({ userId, name, description, assignedBy, dueDate }) {
    const now = new Date().toISOString();
    const r = this.database.prepare(`
      INSERT INTO tasks (user_id, name, description, assigned_by, due_date, status, created_at, last_status_modified_at, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, name || null, description, assignedBy, dueDate || null, 'Pending', now, now, assignedBy);
    return this.database.prepare('SELECT * FROM tasks WHERE id = ?').get(r.lastInsertRowid);
  },

  updateTask(id, fields) {
    const current = this.database.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!current) return null;
    const updated = { ...current, ...fields };
    const now = new Date().toISOString();
    this.database.prepare(`
      UPDATE tasks SET name=@name, description=@description, due_date=@due_date, status=@status, last_status_modified_at=@last_status_modified_at, modified_by=@modified_by WHERE id=@id
    `).run({
      id,
      name: updated.name,
      description: updated.description,
      due_date: updated.due_date,
      status: updated.status,
      last_status_modified_at: now,
      modified_by: updated.modified_by,
    });
    return this.database.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  },

  deleteTask(id) {
    this.database.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  },

  // Required Hours
  getRequiredHours(location) {
    return this.database.prepare('SELECT * FROM required_hours WHERE location = ?').get(location);
  },

  setRequiredHours(location, hours) {
    const existing = this.getRequiredHours(location);
    if (existing) {
      this.database.prepare('UPDATE required_hours SET hours = ? WHERE location = ?').run(hours, location);
    } else {
      this.database.prepare('INSERT INTO required_hours (location, hours) VALUES (?, ?)').run(location, hours);
    }
  },

  // Shifts (Check-in/Check-out)
  createShiftCheckIn(userId, { timestamp, latitude, longitude, locationName, deviceType }) {
    const r = this.database.prepare(`
      INSERT INTO shifts (user_id, check_in_time, check_in_lat, check_in_lng, check_in_location_name, device_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, timestamp, latitude ?? null, longitude ?? null, locationName ?? null, deviceType ?? null);
    return this.database.prepare('SELECT * FROM shifts WHERE id = ?').get(r.lastInsertRowid);
  },

  checkOutShift(userId, { timestamp, latitude, longitude, locationName }) {
    const open = this.getOpenShiftForUser(userId);
    if (!open) return null;
    
    this.database.prepare(`
      UPDATE shifts SET check_out_time = ?, check_out_lat = ?, check_out_lng = ?, check_out_location_name = ?
      WHERE id = ?
    `).run(timestamp, latitude ?? null, longitude ?? null, locationName ?? null, open.id);
    
    return this.database.prepare('SELECT * FROM shifts WHERE id = ?').get(open.id);
  },

  getOpenShiftForUser(userId) {
    return this.database.prepare('SELECT * FROM shifts WHERE user_id = ? AND check_out_time IS NULL').get(userId);
  },

  listShiftsForUserWithLocations(userId) {
    const shifts = this.database.prepare(`
      SELECT * FROM shifts WHERE user_id = ? ORDER BY check_in_time DESC
    `).all(userId);
    
    return shifts.map(shift => ({
      id: shift.id,
      user_id: shift.user_id,
      check_in_time: shift.check_in_time,
      check_in_time_12h: this.formatTime12h(shift.check_in_time),
      check_in_date: shift.check_in_time ? new Date(shift.check_in_time).toISOString().slice(0, 10) : null,
      check_in_lat: shift.check_in_lat,
      check_in_lng: shift.check_in_lng,
      check_in_location_name: shift.check_in_location_name,
      check_out_time: shift.check_out_time,
      check_out_time_12h: shift.check_out_time ? this.formatTime12h(shift.check_out_time) : null,
      check_out_date: shift.check_out_time ? new Date(shift.check_out_time).toISOString().slice(0, 10) : null,
      check_out_lat: shift.check_out_lat,
      check_out_lng: shift.check_out_lng,
      check_out_location_name: shift.check_out_location_name,
      device_type: shift.device_type
    }));
  },

  formatTime12h(timestamp) {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = ((hours + 11) % 12) + 1;
    return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  },

  // Location History (legacy)
  insertLocationLog(userId, { timestamp, latitude, longitude }) {
    const r = this.database
      .prepare('INSERT INTO location_logs (user_id, timestamp, latitude, longitude) VALUES (?, ?, ?, ?)')
      .run(userId, timestamp, latitude ?? null, longitude ?? null);
    return this.database.prepare('SELECT * FROM location_logs WHERE id = ?').get(r.lastInsertRowid);
  },

  // Employee Shifts - New System
  createEmployeeShiftTable(employeeId, employeeName) {
    const tableName = `employee_shifts_${employeeId}`;
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        location_id INTEGER,
        location_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(location_id) REFERENCES locations(id)
      )
    `);
    return tableName;
  },

  assignShiftToEmployee(employeeId, employeeName, shiftData) {
    const tableName = this.createEmployeeShiftTable(employeeId, employeeName);
    const now = new Date().toISOString();
    
    const r = this.database.prepare(`
      INSERT INTO ${tableName} (date, start_time, end_time, location_id, location_name, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      shiftData.date,
      shiftData.startTime,
      shiftData.endTime,
      shiftData.locationId,
      shiftData.locationName,
      now,
      now
    );
    
    return this.database.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(r.lastInsertRowid);
  },

  getEmployeeShifts(employeeId) {
    const tableName = `employee_shifts_${employeeId}`;
    
    // Check if table exists
    const tableExists = this.database.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name=?
    `).get(tableName);
    
    if (!tableExists) {
      return [];
    }
    
    return this.database.prepare(`
      SELECT s.*, l.name as location_name 
      FROM ${tableName} s 
      LEFT JOIN locations l ON s.location_id = l.id 
      ORDER BY s.date ASC, s.start_time ASC
    `).all();
  },

  deleteEmployeeShift(employeeId, shiftId) {
    const tableName = `employee_shifts_${employeeId}`;
    this.database.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(shiftId);
  },

  updateEmployeeShift(employeeId, shiftId, shiftData) {
    const tableName = `employee_shifts_${employeeId}`;
    const now = new Date().toISOString();
    
    this.database.prepare(`
      UPDATE ${tableName} 
      SET date = ?, start_time = ?, end_time = ?, location_id = ?, location_name = ?, updated_at = ?
      WHERE id = ?
    `).run(
      shiftData.date,
      shiftData.startTime,
      shiftData.endTime,
      shiftData.locationId,
      shiftData.locationName,
      now,
      shiftId
    );
    
    return this.database.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(shiftId);
  },

  // Locations
  listLocations() {
    return this.database.prepare('SELECT * FROM locations ORDER BY name').all();
  },

  createLocation({ name, google_maps_url, latitude, longitude }) {
    const r = this.database.prepare('INSERT INTO locations (name, google_maps_url, latitude, longitude) VALUES (?, ?, ?, ?)').run(name, google_maps_url || null, latitude || null, longitude || null);
    return this.database.prepare('SELECT * FROM locations WHERE id = ?').get(r.lastInsertRowid);
  },

  updateLocationCoordinates(locationId, { latitude, longitude }) {
    const location = this.database.prepare('SELECT * FROM locations WHERE id = ?').get(locationId);
    if (!location) return null;
    
    this.database.prepare('UPDATE locations SET latitude = ?, longitude = ? WHERE id = ?').run(latitude, longitude, locationId);
    return this.database.prepare('SELECT * FROM locations WHERE id = ?').get(locationId);
  },

  deleteLocation(locationId) {
    const location = this.database.prepare('SELECT * FROM locations WHERE id = ?').get(locationId);
    if (!location) return null;
    
    this.database.prepare('DELETE FROM locations WHERE id = ?').run(locationId);
    return location;
  },

  findNearbyLocation(latitude, longitude, maxDistance = 0.1) {
    // maxDistance in kilometers (0.1 km = 100 meters)
    const locations = this.database.prepare('SELECT * FROM locations WHERE latitude IS NOT NULL AND longitude IS NOT NULL').all();
    
    for (const location of locations) {
      const distance = this.calculateDistance(latitude, longitude, location.latitude, location.longitude);
      if (distance <= maxDistance) {
        return location;
      }
    }
    return null;
  },

  calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula to calculate distance between two coordinates
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  // Requests
  listRequestsForUser(userId) {
    return this.database.prepare(`
      SELECT r.*, u.name as manager_name 
      FROM requests r 
      LEFT JOIN users u ON r.manager_id = u.id 
      WHERE r.user_id = ? 
      ORDER BY r.created_at DESC
    `).all(userId);
  },

  listRequestsForManager(managerId) {
    return this.database.prepare(`
      SELECT r.*, u.name as user_name 
      FROM requests r 
      LEFT JOIN users u ON r.user_id = u.id 
      WHERE r.manager_id = ? 
      ORDER BY r.created_at DESC
    `).all(managerId);
  },

  createRequest({ userId, subject, type, body, managerId }) {
    const now = new Date().toISOString();
    const r = this.database.prepare(`
      INSERT INTO requests (user_id, manager_id, subject, type, body, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, managerId, subject, type, body, 'Under Review', now, now);
    return this.database.prepare('SELECT * FROM requests WHERE id = ?').get(r.lastInsertRowid);
  },

  updateRequestStatus(id, status, managerId) {
    const now = new Date().toISOString();
    this.database.prepare(`
      UPDATE requests SET status = ?, manager_id = ?, updated_at = ? WHERE id = ?
    `).run(status, managerId, now, id);
    return this.database.prepare('SELECT * FROM requests WHERE id = ?').get(id);
  },

  // Notifications
  listNotificationsForUser(userId) {
    return this.database.prepare(`
      SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId);
  },

  createNotification({ userId, message, type }) {
    const now = new Date().toISOString();
    const r = this.database.prepare(`
      INSERT INTO notifications (user_id, message, type, created_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, message, type, now);
    return this.database.prepare('SELECT * FROM notifications WHERE id = ?').get(r.lastInsertRowid);
  },

  markNotificationAsRead(id) {
    this.database.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
  },

  // User Profile
  getUserProfile(userId) {
    const user = this.getUserById(userId);
    if (!user) return null;
    
    const tasks = this.listTasksForUser(userId);
    const shifts = this.listShiftsForUserWithLocations(userId);
    const requests = this.listRequestsForUser(userId);
    const notifications = this.listNotificationsForUser(userId);
    
    return {
      ...user,
      tasks,
      shifts,
      requests,
      notifications
    };
  },

  // Manager Dashboard
  getManagerDashboard(managerId) {
    const employees = this.database.prepare(`
      SELECT * FROM users WHERE role = 'Employee' ORDER BY name
    `).all();
    
    const employeeData = employees.map(emp => ({
      ...emp,
      tasks: this.listTasksForUser(emp.id),
      requests: this.listRequestsForUser(emp.id)
    }));
    
    const pendingRequests = this.database.prepare(`
      SELECT COUNT(*) as count FROM requests WHERE status = 'Under Review'
    `).get();
    
    return {
      employees: employeeData,
      pendingRequests: pendingRequests.count,
      totalEmployees: employees.length
    };
  },

  // Get all user stats for Viewer/Manager
  getAllUserStats() {
    const users = this.listUsers();
    return users.map(user => ({
      ...user,
      tasks: this.listTasksForUser(user.id),
      requests: this.listRequestsForUser(user.id)
    }));
  }
};