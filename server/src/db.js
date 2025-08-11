import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || './database.sqlite';

function createConnection() {
  const database = new Database(DB_PATH);
  database.pragma('journal_mode = WAL');
  return database;
}

function columnExists(database, table, column) {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

function createSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Employee','Viewer','Manager')),
      home_location TEXT DEFAULT 'NYC',
      profile_url TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      task_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT,
      description TEXT NOT NULL,
      assigned_by INTEGER,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'Assigned',
      created_at TEXT NOT NULL,
      last_status_modified_at TEXT,
      modified_by INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(assigned_by) REFERENCES users(id),
      FOREIGN KEY(modified_by) REFERENCES users(id)
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
      check_out_time TEXT,
      check_out_lat REAL,
      check_out_lng REAL,
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
      google_maps_url TEXT
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      hours INTEGER,
      location_id INTEGER,
      kind TEXT DEFAULT 'Work', -- Work, DayOff, Annual
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(location_id) REFERENCES locations(id)
    );
  `);

  // Safe migrations for added columns
  if (!columnExists(database, 'users', 'linkedin_url')) {
    database.exec(`ALTER TABLE users ADD COLUMN linkedin_url TEXT`);
  }
  if (!columnExists(database, 'users', 'whatsapp')) {
    database.exec(`ALTER TABLE users ADD COLUMN whatsapp TEXT`);
  }
  if (!columnExists(database, 'users', 'annual_balance')) {
    database.exec(`ALTER TABLE users ADD COLUMN annual_balance INTEGER DEFAULT 21`);
  }
  if (!columnExists(database, 'users', 'casual_balance')) {
    database.exec(`ALTER TABLE users ADD COLUMN casual_balance INTEGER DEFAULT 6`);
  }
  if (!columnExists(database, 'tasks', 'name')) {
    database.exec(`ALTER TABLE tasks ADD COLUMN name TEXT`);
  }
  if (!columnExists(database, 'tasks', 'last_status_modified_at')) {
    database.exec(`ALTER TABLE tasks ADD COLUMN last_status_modified_at TEXT`);
  }
  if (!columnExists(database, 'tasks', 'modified_by')) {
    database.exec(`ALTER TABLE tasks ADD COLUMN modified_by INTEGER`);
  }
}

function seed(database) {
  const userCount = database.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const firstSeed = userCount === 0;

  const hash = (pwd) => bcrypt.hashSync(pwd, 10);
  const avatar = (name) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

  if (firstSeed) {
    const insertUser = database.prepare(`
      INSERT INTO users (name, email, password_hash, role, home_location, profile_url, linkedin_url, whatsapp, annual_balance, casual_balance)
      VALUES (@name, @email, @password_hash, @role, @home_location, @profile_url, @linkedin_url, @whatsapp, @annual_balance, @casual_balance)
    `);

    const managerInfo = { name: 'Manny Manager', email: 'manager@acme.com', password_hash: hash('Password123!'), role: 'Manager', home_location: 'NYC', profile_url: avatar('Manny Manager'), linkedin_url: '', whatsapp: '', annual_balance: 21, casual_balance: 6 };
    const viewerInfo = { name: 'Vera Viewer', email: 'viewer@acme.com', password_hash: hash('Password123!'), role: 'Viewer', home_location: 'SF', profile_url: avatar('Vera Viewer'), linkedin_url: '', whatsapp: '', annual_balance: 21, casual_balance: 6 };
    const aliceInfo = { name: 'Alice Employee', email: 'alice@acme.com', password_hash: hash('Password123!'), role: 'Employee', home_location: 'NYC', profile_url: avatar('Alice Employee'), linkedin_url: '', whatsapp: '', annual_balance: 21, casual_balance: 6 };
    const bobInfo = { name: 'Bob Employee', email: 'bob@acme.com', password_hash: hash('Password123!'), role: 'Employee', home_location: 'SF', profile_url: avatar('Bob Employee'), linkedin_url: '', whatsapp: '', annual_balance: 21, casual_balance: 6 };

    const managerId = insertUser.run(managerInfo).lastInsertRowid;
    const viewerId = insertUser.run(viewerInfo).lastInsertRowid;
    const aliceId = insertUser.run(aliceInfo).lastInsertRowid;
    const bobId = insertUser.run(bobInfo).lastInsertRowid;

    // required hours per location
    const insertHours = database.prepare('INSERT INTO required_hours (location, hours) VALUES (?, ?)');
    insertHours.run('NYC', 8);
    insertHours.run('SF', 7);

    // seed locations
    const insertLocation = database.prepare('INSERT INTO locations (name, google_maps_url) VALUES (?, ?)');
    insertLocation.run('Location A', 'https://maps.google.com/?q=40.7128,-74.0060');
    insertLocation.run('Location B', 'https://maps.google.com/?q=37.7749,-122.4194');
    insertLocation.run('Location C', 'https://maps.google.com/?q=34.0522,-118.2437');
    insertLocation.run('Location D', 'https://maps.google.com/?q=51.5074,-0.1278');

    // tasks for Alice
    const insertTask = database.prepare(`
      INSERT INTO tasks (user_id, name, description, assigned_by, due_date, status, created_at, last_status_modified_at, modified_by)
      VALUES (@user_id, @name, @description, @assigned_by, @due_date, @status, @created_at, @last_status_modified_at, @modified_by)
    `);
    insertTask.run({
      user_id: aliceId,
      name: 'Onboarding Docs',
      description: 'Complete onboarding documents',
      assigned_by: managerId,
      due_date: new Date(Date.now() + 3*24*3600*1000).toISOString(),
      status: 'In Progress',
      created_at: new Date().toISOString(),
      last_status_modified_at: new Date().toISOString(),
      modified_by: managerId,
    });
    insertTask.run({
      user_id: aliceId,
      name: 'Security Training',
      description: 'Security training module',
      assigned_by: managerId,
      due_date: new Date(Date.now() + 7*24*3600*1000).toISOString(),
      status: 'Assigned',
      created_at: new Date().toISOString(),
      last_status_modified_at: new Date().toISOString(),
      modified_by: managerId,
    });

    // seed a sample shift for each
    const insertShift = database.prepare(`
      INSERT INTO shifts (user_id, check_in_time, check_in_lat, check_in_lng, check_out_time, check_out_lat, check_out_lng)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date();
    const earlier = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    insertShift.run(managerId, earlier.toISOString(), 40.7128, -74.0060, now.toISOString(), 40.7138, -74.0050);
    insertShift.run(viewerId, earlier.toISOString(), 37.7749, -122.4194, now.toISOString(), 37.7759, -122.4184);
    insertShift.run(aliceId, earlier.toISOString(), 40.7130, -74.0070, null, null, null);
    insertShift.run(bobId, earlier.toISOString(), 37.7750, -122.4190, now.toISOString(), 37.7755, -122.4185);
  }
}

function mapUserRow(row, database) {
  if (!row) return null;
  const hoursRow = database.prepare('SELECT hours FROM required_hours WHERE location = ?').get(row.home_location);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    homeLocation: row.home_location,
    requiredHours: hoursRow ? hoursRow.hours : 8,
    avatarUrl: row.profile_url || null,
    linkedinUrl: row.linkedin_url || '',
    whatsapp: row.whatsapp || '',
    annualBalance: row.annual_balance ?? 21,
    casualBalance: row.casual_balance ?? 6,
  };
}

export const db = {
  database: null,
  init() {
    if (!this.database) {
      this.database = createConnection();
      createSchema(this.database);
      seed(this.database);
    }
  },
  // Users
  getUserByEmail(email) {
    const row = this.database.prepare('SELECT * FROM users WHERE email = ?').get(email);
    return row;
  },
  getUserById(id) {
    return this.database.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },
  listUsers() {
    const rows = this.database.prepare('SELECT * FROM users').all();
    return rows.map((r) => mapUserRow(r, this.database));
  },
  updateUserProfile(userId, { name, profile_url, linkedin_url, whatsapp }) {
    const current = this.getUserById(userId);
    if (!current) return null;
    const updated = {
      name: name ?? current.name,
      profile_url: profile_url ?? current.profile_url,
      linkedin_url: linkedin_url ?? current.linkedin_url,
      whatsapp: whatsapp ?? current.whatsapp,
    };
    this.database.prepare(`UPDATE users SET name=@name, profile_url=@profile_url, linkedin_url=@linkedin_url, whatsapp=@whatsapp WHERE id=@id`).run({ ...updated, id: userId });
    return mapUserRow(this.getUserById(userId), this.database);
  },
  changeUserPassword(userId, newPasswordHash) {
    this.database.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, userId);
  },

  // Details
  getUserDetails(userId) {
    const user = this.database.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return null;
    const mapped = mapUserRow(user, this.database);
    const tasks = this.database.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    const logs = this.database.prepare('SELECT * FROM location_logs WHERE user_id = ? ORDER BY timestamp DESC').all(userId);
    const shifts = this.database.prepare('SELECT * FROM shifts WHERE user_id = ? ORDER BY id DESC').all(userId);
    const requests = this.database.prepare('SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    return { ...mapped, tasks, locationHistory: logs, shifts, requests };
  },
  getAllUserStats() {
    const users = this.database.prepare('SELECT * FROM users').all();
    const format = (u) => {
      const mapped = mapUserRow(u, this.database);
      const tasks = this.database.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(u.id);
      const logs = this.database.prepare('SELECT * FROM location_logs WHERE user_id = ? ORDER BY timestamp DESC').all(u.id);
      const shifts = this.database.prepare('SELECT * FROM shifts WHERE user_id = ? ORDER BY id DESC').all(u.id);
      const requests = this.database.prepare('SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC').all(u.id);
      return { ...mapped, tasks, locationHistory: logs, shifts, requests };
    };
    return users.map(format);
  },

  // Location history (legacy)
  insertLocationLog(userId, { timestamp, latitude, longitude }) {
    this.database
      .prepare('INSERT INTO location_logs (user_id, timestamp, latitude, longitude) VALUES (?, ?, ?, ?)')
      .run(userId, timestamp, latitude, longitude);
  },

  // Tasks
  listTasksForUser(userId) {
    return this.database.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  },
  createTask({ userId, name, description, assignedBy, dueDate }) {
    const now = new Date().toISOString();
    const result = this.database.prepare(`
      INSERT INTO tasks (user_id, name, description, assigned_by, due_date, status, created_at, last_status_modified_at, modified_by)
      VALUES (?, ?, ?, ?, ?, 'Assigned', ?, ?, ?)
    `).run(userId, name || null, description, assignedBy, dueDate || null, now, now, assignedBy);
    return this.database.prepare('SELECT * FROM tasks WHERE task_id = ?').get(result.lastInsertRowid);
  },
  updateTask(taskId, fields) {
    const original = this.database.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
    if (!original) return null;
    const updated = { ...original, ...fields };
    this.database.prepare(`
      UPDATE tasks SET
        name = @name,
        description = @description,
        due_date = @due_date,
        status = @status,
        last_status_modified_at = @last_status_modified_at,
        modified_by = @modified_by
      WHERE task_id = @task_id
    `).run({
      task_id: taskId,
      name: updated.name,
      description: updated.description,
      due_date: updated.due_date,
      status: updated.status,
      last_status_modified_at: fields.status ? new Date().toISOString() : updated.last_status_modified_at,
      modified_by: fields.status ? fields.modified_by : updated.modified_by,
    });
    return this.database.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
  },
  deleteTask(taskId) {
    this.database.prepare('DELETE FROM tasks WHERE task_id = ?').run(taskId);
  },
  getTask(taskId) {
    return this.database.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
  },

  // Required hours
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

  // Shifts
  createShiftCheckIn(userId, { timestamp, latitude, longitude }) {
    const result = this.database.prepare(`
      INSERT INTO shifts (user_id, check_in_time, check_in_lat, check_in_lng)
      VALUES (?, ?, ?, ?)
    `).run(userId, timestamp, latitude ?? null, longitude ?? null);
    return this.database.prepare('SELECT * FROM shifts WHERE id = ?').get(result.lastInsertRowid);
  },
  getOpenShiftForUser(userId) {
    return this.database.prepare('SELECT * FROM shifts WHERE user_id = ? AND check_out_time IS NULL ORDER BY id DESC LIMIT 1').get(userId);
  },
  checkOutShift(userId, { timestamp, latitude, longitude }) {
    const open = this.getOpenShiftForUser(userId);
    if (!open) return null;
    this.database.prepare(`
      UPDATE shifts SET check_out_time = ?, check_out_lat = ?, check_out_lng = ?
      WHERE id = ?
    `).run(timestamp, latitude ?? null, longitude ?? null, open.id);
    return this.database.prepare('SELECT * FROM shifts WHERE id = ?').get(open.id);
  },
  listShiftsForUser(userId) {
    return this.database.prepare('SELECT * FROM shifts WHERE user_id = ? ORDER BY id DESC').all(userId);
  },

  // Requests
  createRequest(userId, { managerId, subject, type, body }) {
    const now = new Date().toISOString();
    const result = this.database.prepare(`
      INSERT INTO requests (user_id, manager_id, subject, type, body, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'Under Review', ?, ?)
    `).run(userId, managerId || null, subject || null, type || null, body || null, now, now);
    return this.database.prepare('SELECT * FROM requests WHERE id = ?').get(result.lastInsertRowid);
  },
  listRequestsForUser(userId) {
    return this.database.prepare('SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  },
  listPendingRequests() {
    return this.database.prepare(`SELECT r.*, u.name as user_name, u.annual_balance, u.casual_balance FROM requests r JOIN users u ON u.id = r.user_id WHERE r.status = 'Under Review' ORDER BY r.created_at DESC`).all();
  },
  updateRequestStatus(requestId, { status, approverId }) {
    const req = this.database.prepare('SELECT * FROM requests WHERE id = ?').get(requestId);
    if (!req) return null;
    const now = new Date().toISOString();
    this.database.prepare('UPDATE requests SET status = ?, updated_at = ?, manager_id = COALESCE(manager_id, ?) WHERE id = ?').run(status, now, approverId || null, requestId);
    // Deduct balance if approved and type is Annual or Casual
    if (status === 'Accepted') {
      if (req.type === 'Annual') {
        this.database.prepare('UPDATE users SET annual_balance = MAX(annual_balance - 1, 0) WHERE id = ?').run(req.user_id);
      } else if (req.type === 'Casual') {
        this.database.prepare('UPDATE users SET casual_balance = MAX(casual_balance - 1, 0) WHERE id = ?').run(req.user_id);
      }
    }
    return this.database.prepare('SELECT * FROM requests WHERE id = ?').get(requestId);
  },

  // Notifications
  createNotification(userId, { message, type }) {
    const now = new Date().toISOString();
    const r = this.database.prepare('INSERT INTO notifications (user_id, message, type, created_at, read) VALUES (?, ?, ?, ?, 0)').run(userId, message, type || null, now);
    return this.database.prepare('SELECT * FROM notifications WHERE id = ?').get(r.lastInsertRowid);
  },
  listNotifications(userId) {
    return this.database.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  },
  markNotificationRead(userId, notificationId) {
    this.database.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(notificationId, userId);
  },

  // Locations
  listLocations() {
    return this.database.prepare('SELECT * FROM locations ORDER BY name ASC').all();
  },
  createLocation({ name, google_maps_url }) {
    const r = this.database.prepare('INSERT INTO locations (name, google_maps_url) VALUES (?, ?)').run(name, google_maps_url || null);
    return this.database.prepare('SELECT * FROM locations WHERE id = ?').get(r.lastInsertRowid);
  },

  // Schedules
  listSchedulesForUser(userId) {
    return this.database.prepare('SELECT * FROM schedules WHERE user_id = ? ORDER BY date DESC').all(userId);
  },
  createSchedule({ userId, date, start_time, end_time, hours, location_id, kind }) {
    const now = new Date().toISOString();
    const r = this.database.prepare(`INSERT INTO schedules (user_id, date, start_time, end_time, hours, location_id, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).
      run(userId, date, start_time || null, end_time || null, hours || null, location_id || null, kind || 'Work', now, now);
    return this.database.prepare('SELECT * FROM schedules WHERE id = ?').get(r.lastInsertRowid);
  },
  listSchedulesForLocationByDay(date) {
    // aggregate hours per location for a specific date
    return this.database.prepare(`SELECT l.id, l.name, l.google_maps_url, SUM(s.hours) as total_hours FROM schedules s JOIN locations l ON l.id = s.location_id WHERE s.date = ? GROUP BY l.id ORDER BY l.name`).all(date);
  },
  listEmployeesForLocationByDay(locationId, date) {
    return this.database.prepare(`SELECT u.id as user_id, u.name, s.hours FROM schedules s JOIN users u ON u.id = s.user_id WHERE s.location_id = ? AND s.date = ? ORDER BY u.name`).all(locationId, date);
  },
  deleteScheduleById(id) {
    this.database.prepare('DELETE FROM schedules WHERE id = ?').run(id);
  },
  deleteSchedulesByUserAndDate(userId, date) {
    this.database.prepare('DELETE FROM schedules WHERE user_id = ? AND date = ?').run(userId, date);
  },
};