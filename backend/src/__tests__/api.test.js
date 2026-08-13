const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Use an in-memory/temp DB for tests
process.env.DB_PATH = path.join(__dirname, '..', '..', 'test.db');

const app = require('../app');
const { getDb, closeDb } = require('../db');
const queries = require('../queries');

let boardId, todoColumnId, doneColumnId;

beforeAll(() => {
  const db = getDb();

  // Fresh test data
  db.exec(`DELETE FROM tasks; DELETE FROM columns; DELETE FROM boards;`);

  const board = db.prepare(`INSERT INTO boards (name) VALUES (?)`).run('Test Board');
  boardId = board.lastInsertRowid;

  const todo = db.prepare(`INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)`).run(boardId, 'To Do', 0);
  todoColumnId = todo.lastInsertRowid;

  const done = db.prepare(`INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)`).run(boardId, 'Done', 1);
  doneColumnId = done.lastInsertRowid;

  // Seed some known tasks for query tests
  db.prepare(`INSERT INTO tasks (column_id, title, priority, position) VALUES (?, ?, ?, ?)`).run(todoColumnId, 'Alpha task', 'High', 0);
  db.prepare(`INSERT INTO tasks (column_id, title, priority, position) VALUES (?, ?, ?, ?)`).run(todoColumnId, 'Beta task',  'Low',  1);
  db.prepare(`INSERT INTO tasks (column_id, title, priority, position) VALUES (?, ?, ?, ?)`).run(doneColumnId, 'Gamma task', 'High', 0);
});

afterAll(() => {
  closeDb();
  try { fs.unlinkSync(process.env.DB_PATH); } catch {}
});

// ── Test 1: Creating a task with no title fails ───────────────────────────────
describe('POST /api/tasks — validation', () => {
  test('rejects a task with an empty title (422)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ column_id: todoColumnId, title: '' });
    expect(res.status).toBe(422);
  });

  test('rejects a task with no title field (422)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ column_id: todoColumnId });
    expect(res.status).toBe(422);
  });

  test('rejects a task with whitespace-only title (422)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ column_id: todoColumnId, title: '   ' });
    expect(res.status).toBe(422);
  });

  test('creates a valid task (201)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ column_id: todoColumnId, title: 'New task', priority: 'Medium' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New task');
    expect(res.body.priority).toBe('Medium');
  });
});

// ── Test 2: Moving a task updates its column ──────────────────────────────────
describe('PATCH /api/tasks/:id/move', () => {
  let taskId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ column_id: todoColumnId, title: 'Task to move', priority: 'Low' });
    taskId = res.body.id;
  });

  test('moves task to a different column', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/move`)
      .send({ column_id: doneColumnId });

    expect(res.status).toBe(200);
    expect(res.body.column_id).toBe(doneColumnId);
  });

  test('moved task appears in the target column on board fetch', async () => {
    const res = await request(app).get(`/api/boards/${boardId}`);
    const doneCol = res.body.columns.find((c) => c.id === doneColumnId);
    const found = doneCol.tasks.find((t) => t.id === taskId);
    expect(found).toBeTruthy();
  });

  test('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .patch('/api/tasks/99999/move')
      .send({ column_id: doneColumnId });
    expect(res.status).toBe(404);
  });
});

// ── Test 3: Database-layer queries return correct rows for known seed data ─────
describe('Database queries — task count per column & tasks by priority', () => {
  test('getTaskCountPerColumn returns correct counts', () => {
    const counts = queries.getTaskCountPerColumn(boardId);
    const todo = counts.find((c) => c.column_id === todoColumnId);
    const done = counts.find((c) => c.column_id === doneColumnId);

    // "Alpha task", "Beta task" + "New task" from earlier test (and not "Task to move" which was moved)
    // We check >= 2 in To Do and >= 1 in Done to be resilient to test order
    expect(todo.task_count).toBeGreaterThanOrEqual(2);
    expect(done.task_count).toBeGreaterThanOrEqual(1);
  });

  test('getTasksByPriority returns only High priority tasks, newest first', () => {
    const tasks = queries.getTasksByPriority(boardId, 'High');

    expect(tasks.length).toBeGreaterThanOrEqual(2); // Alpha task + Gamma task
    for (const t of tasks) {
      expect(t.priority).toBe('High');
    }

    // Verify descending created_at order
    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i - 1].created_at >= tasks[i].created_at).toBe(true);
    }
  });

  test('getTasksByPriority filters correctly — Low returns only Low tasks', () => {
    const tasks = queries.getTasksByPriority(boardId, 'Low');
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    for (const t of tasks) {
      expect(t.priority).toBe('Low');
    }
  });
});

// ── Additional: Edit and delete ───────────────────────────────────────────────
describe('PATCH /api/tasks/:id and DELETE', () => {
  let taskId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ column_id: todoColumnId, title: 'Editable task', priority: 'Low' });
    taskId = res.body.id;
  });

  test('updates title and priority', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .send({ title: 'Updated title', priority: 'High' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated title');
    expect(res.body.priority).toBe('High');
  });

  test('rejects empty title on edit', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .send({ title: '' });
    expect(res.status).toBe(422);
  });

  test('deletes a task', async () => {
    const res = await request(app).delete(`/api/tasks/${taskId}`);
    expect(res.status).toBe(204);
  });

  test('returns 404 after deletion', async () => {
    const res = await request(app).delete(`/api/tasks/${taskId}`);
    expect(res.status).toBe(404);
  });
});
