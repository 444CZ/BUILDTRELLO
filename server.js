const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4173;
const dbPath = path.join(__dirname, 'data', 'realizaceboard.db');
const db = new Database(dbPath);

const ROLES = [
  'Projektový manažer',
  'Obchodní manažer',
  'Designér',
  'Business support',
  'Vedení',
  'Marketing',
  'Office manager',
];

const PROJECT_STATUSES = ['Nová', 'V přípravě', 'Realizace', 'Dokončeno'];
const TASK_STATUSES = ['K vyřízení', 'Rozpracováno', 'Čeká na klienta', 'Hotovo'];

function initDb() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      client TEXT NOT NULL,
      estimated_price REAL NOT NULL,
      address TEXT NOT NULL,
      status TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY(project_id, user_id),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      assignee_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(assignee_id) REFERENCES users(id)
    );
  `);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return token;
}

function auth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chybí přihlášení.' });

  const session = db
    .prepare('SELECT s.token, s.user_id, s.expires_at, u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?')
    .get(token);

  if (!session) return res.status(401).json({ error: 'Neplatná session.' });
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return res.status(401).json({ error: 'Session vypršela.' });
  }

  req.user = sanitizeUser(session);
  req.token = token;
  next();
}

function getProjectMembers(projectId) {
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?
       ORDER BY u.name`
    )
    .all(projectId);
}

function getProjectTasks(projectId) {
  return db
    .prepare(
      `SELECT t.id, t.title, t.description, t.status, t.assignee_id as assigneeId,
              u.name as assigneeName, t.created_at as createdAt, t.updated_at as updatedAt
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = ?
       ORDER BY t.id DESC`
    )
    .all(projectId);
}

function formatProject(projectRow) {
  return {
    id: projectRow.id,
    title: projectRow.title,
    description: projectRow.description,
    client: projectRow.client,
    estimatedPrice: projectRow.estimated_price,
    address: projectRow.address,
    status: projectRow.status,
    createdBy: projectRow.created_by,
    createdByName: projectRow.createdByName,
    createdAt: projectRow.created_at,
    updatedAt: projectRow.updated_at,
    members: getProjectMembers(projectRow.id),
    tasks: getProjectTasks(projectRow.id),
  };
}

initDb();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/meta', (_req, res) => {
  res.json({ roles: ROLES, projectStatuses: PROJECT_STATUSES, taskStatuses: TASK_STATUSES });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, role, password } = req.body || {};
  if (!name || !email || !role || !password) {
    return res.status(400).json({ error: 'Vyplňte všechna pole.' });
  }
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Neplatná role.' });
  if (password.length < 8) return res.status(400).json({ error: 'Heslo musí mít alespoň 8 znaků.' });

  try {
    const result = db
      .prepare('INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)')
      .run(name.trim(), email.trim().toLowerCase(), role, hashPassword(password));
    const token = createSession(result.lastInsertRowid);
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch {
    return res.status(409).json({ error: 'Účet s tímto e-mailem již existuje.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Zadejte e-mail a heslo.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Neplatný e-mail nebo heslo.' });
  }

  const token = createSession(user.id);
  return res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/logout', auth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
  res.status(204).end();
});

app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));
app.get('/api/users', auth, (_req, res) => {
  const users = db.prepare('SELECT id, name, email, role FROM users ORDER BY name').all();
  res.json({ users });
});

app.get('/api/projects', auth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, u.name as createdByName
       FROM projects p
       JOIN users u ON u.id = p.created_by
       ORDER BY p.updated_at DESC`
    )
    .all();
  res.json({ projects: rows.map(formatProject) });
});

app.post('/api/projects', auth, (req, res) => {
  const { title, description, client, estimatedPrice, address, status, memberIds = [] } = req.body || {};
  if (!title || !description || !client || !address || !status) {
    return res.status(400).json({ error: 'Vyplňte všechna povinná pole zakázky.' });
  }
  if (!PROJECT_STATUSES.includes(status)) return res.status(400).json({ error: 'Neplatný stav zakázky.' });

  const insert = db
    .prepare(
      `INSERT INTO projects (title, description, client, estimated_price, address, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(title.trim(), description.trim(), client.trim(), Number(estimatedPrice || 0), address.trim(), status, req.user.id);

  const projectId = insert.lastInsertRowid;
  const addMember = db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)');
  addMember.run(projectId, req.user.id);
  memberIds.forEach((id) => addMember.run(projectId, id));

  const row = db
    .prepare('SELECT p.*, u.name as createdByName FROM projects p JOIN users u ON u.id = p.created_by WHERE p.id = ?')
    .get(projectId);
  return res.status(201).json({ project: formatProject(row) });
});

app.put('/api/projects/:id', auth, (req, res) => {
  const projectId = Number(req.params.id);
  const { title, description, client, estimatedPrice, address, status, memberIds = [] } = req.body || {};
  if (!title || !description || !client || !address || !status) {
    return res.status(400).json({ error: 'Vyplňte všechna povinná pole.' });
  }

  const exists = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!exists) return res.status(404).json({ error: 'Zakázka nenalezena.' });

  db.prepare(
    `UPDATE projects
     SET title = ?, description = ?, client = ?, estimated_price = ?, address = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(title.trim(), description.trim(), client.trim(), Number(estimatedPrice || 0), address.trim(), status, projectId);

  db.prepare('DELETE FROM project_members WHERE project_id = ?').run(projectId);
  const addMember = db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)');
  const uniqueIds = [...new Set([req.user.id, ...memberIds.map(Number)])];
  uniqueIds.forEach((id) => addMember.run(projectId, id));

  const row = db
    .prepare('SELECT p.*, u.name as createdByName FROM projects p JOIN users u ON u.id = p.created_by WHERE p.id = ?')
    .get(projectId);
  return res.json({ project: formatProject(row) });
});

app.delete('/api/projects/:id', auth, (req, res) => {
  const projectId = Number(req.params.id);
  const found = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!found) return res.status(404).json({ error: 'Zakázka nenalezena.' });

  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  return res.status(204).end();
});

app.post('/api/projects/:id/tasks', auth, (req, res) => {
  const projectId = Number(req.params.id);
  const { title, description = '', status, assigneeId = null } = req.body || {};
  if (!title || !status) return res.status(400).json({ error: 'Název a stav úkolu jsou povinné.' });
  if (!TASK_STATUSES.includes(status)) return res.status(400).json({ error: 'Neplatný stav úkolu.' });

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Zakázka nenalezena.' });

  const insert = db
    .prepare('INSERT INTO tasks (project_id, title, description, status, assignee_id) VALUES (?, ?, ?, ?, ?)')
    .run(projectId, title.trim(), description.trim(), status, assigneeId || null);

  const task = db
    .prepare(
      `SELECT t.id, t.title, t.description, t.status, t.assignee_id as assigneeId,
              u.name as assigneeName, t.created_at as createdAt, t.updated_at as updatedAt
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.id = ?`
    )
    .get(insert.lastInsertRowid);

  db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(projectId);
  res.status(201).json({ task });
});

app.put('/api/tasks/:id', auth, (req, res) => {
  const taskId = Number(req.params.id);
  const { title, description = '', status, assigneeId = null } = req.body || {};
  if (!title || !status) return res.status(400).json({ error: 'Název a stav úkolu jsou povinné.' });

  const task = db.prepare('SELECT id, project_id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Úkol nenalezen.' });

  db.prepare(
    `UPDATE tasks
     SET title = ?, description = ?, status = ?, assignee_id = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(title.trim(), description.trim(), status, assigneeId || null, taskId);

  db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(task.project_id);

  const updated = db
    .prepare(
      `SELECT t.id, t.title, t.description, t.status, t.assignee_id as assigneeId,
              u.name as assigneeName, t.created_at as createdAt, t.updated_at as updatedAt
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.id = ?`
    )
    .get(taskId);
  res.json({ task: updated, projectId: task.project_id });
});

app.delete('/api/tasks/:id', auth, (req, res) => {
  const taskId = Number(req.params.id);
  const task = db.prepare('SELECT id, project_id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Úkol nenalezen.' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(task.project_id);
  return res.status(204).end();
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`RealizaceBoard běží na http://localhost:${PORT}`);
});
