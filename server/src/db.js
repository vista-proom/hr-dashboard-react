import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || './database.sqlite';

function createConnection() {
  const database = new Database(DB_PATH);
  database.pragma('journal_mode = WAL');
  return database;
}

function createSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Employee','Viewer','Manager')),
      home_location TEXT DEFAULT 'NYC'
    );

    CREATE TABLE IF NOT EXISTS tasks (
      task_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      assigned_by INTEGER,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(assigned_by) REFERENCES users(id)
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
  `);
}

function seed(database) {
  const userCount = database.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount > 0) return; // already seeded

  const hash = (pwd) => bcrypt.hashSync(pwd, 10);
  const insertUser = database.prepare(`
    INSERT INTO users (name, email, password_hash, role, home_location)
    VALUES (@name, @email, @password_hash, @role, @home_location)
  `);

  const managerInfo = { name: 'Manny Manager', email: 'manager@acme.com', password_hash: hash('Password123!'), role: 'Manager', home_location: 'NYC' };
  const viewerInfo = { name: 'Vera Viewer', email: 'viewer@acme.com', password_hash: hash('Password123!'), role: 'Viewer', home_location: 'SF' };
  const aliceInfo = { name: 'Alice Employee', email: 'alice@acme.com', password_hash: hash('Password123!'), role: 'Employee', home_location: 'NYC' };
  const bobInfo = { name: 'Bob Employee', email: 'bob@acme.com', password_hash: hash('Password123!'), role: 'Employee', home_location: 'SF' };

  const managerId = insertUser.run(managerInfo).lastInsertRowid;
  const viewerId = insertUser.run(viewerInfo).lastInsertRowid;
  const aliceId = insertUser.run(aliceInfo).lastInsertRowid;
  const bobId = insertUser.run(bobInfo).lastInsertRowid;

  // required hours per location
  const insertHours = database.prepare('INSERT INTO required_hours (location, hours) VALUES (?, ?)');
  insertHours.run('NYC', 8);
  insertHours.run('SF', 7);

  // tasks for Alice
  const insertTask = database.prepare(`
    INSERT INTO tasks (user_id, description, assigned_by, due_date, status, created_at)
    VALUES (@user_id, @description, @assigned_by, @due_date, @status, @created_at)
  `);
  insertTask.run({
    user_id: aliceId,
    description: 'Complete onboarding documents',
    assigned_by: managerId,
    due_date: new Date(Date.now() + 3*24*3600*1000).toISOString(),
    status: 'in_progress',
    created_at: new Date().toISOString(),
  });
  insertTask.run({
    user_id: aliceId,
    description: 'Security training module',
    assigned_by: managerId,
    due_date: new Date(Date.now() + 7*24*3600*1000).toISOString(),
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  // seed one location log for each
  const insertLog = database.prepare(`
    INSERT INTO location_logs (user_id, timestamp, latitude, longitude)
    VALUES (?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  insertLog.run(managerId, now, 40.7128, -74.0060);
  insertLog.run(viewerId, now, 37.7749, -122.4194);
  insertLog.run(aliceId, now, 40.7130, -74.0070);
  insertLog.run(bobId, now, 37.7750, -122.4190);
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
  getUserDetails(userId) {
    const user = this.database.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return null;
    const mapped = mapUserRow(user, this.database);
    const tasks = this.database.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    const logs = this.database.prepare('SELECT * FROM location_logs WHERE user_id = ? ORDER BY timestamp DESC').all(userId);
    return { ...mapped, tasks, locationHistory: logs };
  },
  getAllUserStats() {
    const users = this.database.prepare('SELECT * FROM users').all();
    const format = (u) => {
      const mapped = mapUserRow(u, this.database);
      const tasks = this.database.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(u.id);
      const logs = this.database.prepare('SELECT * FROM location_logs WHERE user_id = ? ORDER BY timestamp DESC').all(u.id);
      return { ...mapped, tasks, locationHistory: logs };
    };
    return users.map(format);
  },
  insertLocationLog(userId, { timestamp, latitude, longitude }) {
    this.database
      .prepare('INSERT INTO location_logs (user_id, timestamp, latitude, longitude) VALUES (?, ?, ?, ?)')
      .run(userId, timestamp, latitude, longitude);
  },
  listTasksForUser(userId) {
    return this.database.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  },
  createTask({ userId, description, assignedBy, dueDate }) {
    const result = this.database.prepare(`
      INSERT INTO tasks (user_id, description, assigned_by, due_date, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(userId, description, assignedBy, dueDate || null, new Date().toISOString());
    return this.database.prepare('SELECT * FROM tasks WHERE task_id = ?').get(result.lastInsertRowid);
  },
  updateTask(taskId, fields) {
    const original = this.database.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
    if (!original) return null;
    const updated = { ...original, ...fields };
    this.database.prepare(`
      UPDATE tasks SET
        description = @description,
        due_date = @due_date,
        status = @status
      WHERE task_id = @task_id
    `).run({
      task_id: taskId,
      description: updated.description,
      due_date: updated.due_date,
      status: updated.status,
    });
    return this.database.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
  },
  deleteTask(taskId) {
    this.database.prepare('DELETE FROM tasks WHERE task_id = ?').run(taskId);
  },
  getTask(taskId) {
    return this.database.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
  },
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
  }
};