const { getDb } = require('./db');

// ── Board queries ─────────────────────────────────────────────────────────────

function getBoard(boardId) {
  const db = getDb();
  return db.prepare(`SELECT * FROM boards WHERE id = ?`).get(boardId);
}

function getAllBoards() {
  const db = getDb();
  return db.prepare(`SELECT * FROM boards ORDER BY created_at DESC`).all();
}

// ── Column queries ────────────────────────────────────────────────────────────

function getColumnsForBoard(boardId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM columns
    WHERE board_id = ?
    ORDER BY position ASC
  `).all(boardId);
}

// ── Task queries ──────────────────────────────────────────────────────────────

function getTasksForColumn(columnId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM tasks
    WHERE column_id = ?
    ORDER BY position ASC, created_at ASC
  `).all(columnId);
}

// Required non-trivial query #1:
// Count of tasks per column for a given board, including columns with 0 tasks.
function getTaskCountPerColumn(boardId) {
  const db = getDb();
  return db.prepare(`
    SELECT
      c.id          AS column_id,
      c.name        AS column_name,
      c.position,
      COUNT(t.id)   AS task_count
    FROM columns c
    LEFT JOIN tasks t ON t.column_id = c.id
    WHERE c.board_id = ?
    GROUP BY c.id, c.name, c.position
    ORDER BY c.position ASC
  `).all(boardId);
}

// Required non-trivial query #2:
// Tasks filtered by priority for a board, newest first.
function getTasksByPriority(boardId, priority) {
  const db = getDb();
  return db.prepare(`
    SELECT
      t.*,
      c.name  AS column_name,
      c.board_id
    FROM tasks t
    JOIN columns c ON c.id = t.column_id
    WHERE c.board_id = ?
      AND t.priority  = ?
    ORDER BY t.created_at DESC
  `).all(boardId, priority);
}

function createTask({ columnId, title, description, priority, position }) {
  const db = getDb();
  const maxPos = db.prepare(`
    SELECT COALESCE(MAX(position), -1) AS max_pos FROM tasks WHERE column_id = ?
  `).get(columnId);

  const stmt = db.prepare(`
    INSERT INTO tasks (column_id, title, description, priority, position)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    columnId,
    title.trim(),
    description || null,
    priority || 'Medium',
    position !== undefined ? position : maxPos.max_pos + 1
  );
  return getTaskById(result.lastInsertRowid);
}

function updateTask(taskId, { title, description, priority }) {
  const db = getDb();
  db.prepare(`
    UPDATE tasks
    SET title       = COALESCE(?, title),
        description = ?,
        priority    = COALESCE(?, priority),
        updated_at  = datetime('now')
    WHERE id = ?
  `).run(
    title ? title.trim() : null,
    description !== undefined ? (description || null) : undefined,
    priority || null,
    taskId
  );
  return getTaskById(taskId);
}

function moveTask(taskId, targetColumnId) {
  const db = getDb();
  const maxPos = db.prepare(`
    SELECT COALESCE(MAX(position), -1) AS max_pos FROM tasks WHERE column_id = ?
  `).get(targetColumnId);

  db.prepare(`
    UPDATE tasks
    SET column_id  = ?,
        position   = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(targetColumnId, maxPos.max_pos + 1, taskId);

  return getTaskById(taskId);
}

function deleteTask(taskId) {
  const db = getDb();
  return db.prepare(`DELETE FROM tasks WHERE id = ?`).run(taskId);
}

function getTaskById(taskId) {
  const db = getDb();
  return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId);
}

module.exports = {
  getBoard,
  getAllBoards,
  getColumnsForBoard,
  getTasksForColumn,
  getTaskCountPerColumn,
  getTasksByPriority,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
  getTaskById,
};
