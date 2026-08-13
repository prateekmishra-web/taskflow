const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const queries = require('./queries');

const router = express.Router();

// Helper: return 422 with validation errors
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

// ── GET /boards ───────────────────────────────────────────────────────────────
router.get('/boards', (req, res) => {
  const boards = queries.getAllBoards();
  res.json(boards);
});

// ── GET /boards/:boardId ──────────────────────────────────────────────────────
// Returns board + columns + tasks, optionally filtered by priority
router.get(
  '/boards/:boardId',
  [param('boardId').isInt({ min: 1 }), query('priority').optional().isIn(['Low', 'Medium', 'High'])],
  validate,
  (req, res) => {
    const { boardId } = req.params;
    const { priority } = req.query;

    const board = queries.getBoard(boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const columns = queries.getColumnsForBoard(boardId);
    const taskCounts = queries.getTaskCountPerColumn(boardId);

    const taskCountMap = {};
    for (const row of taskCounts) {
      taskCountMap[row.column_id] = row.task_count;
    }

    const columnsWithTasks = columns.map((col) => {
      let tasks = queries.getTasksForColumn(col.id);
      if (priority) {
        tasks = tasks.filter((t) => t.priority === priority);
      }
      return {
        ...col,
        task_count: taskCountMap[col.id] || 0,
        tasks,
      };
    });

    res.json({ ...board, columns: columnsWithTasks });
  }
);

// ── GET /boards/:boardId/tasks ─────────────────────────────────────────────────
// Tasks by priority, newest first (demonstrates the second required query)
router.get(
  '/boards/:boardId/tasks',
  [
    param('boardId').isInt({ min: 1 }),
    query('priority').optional().isIn(['Low', 'Medium', 'High']),
    query('search').optional().isString().trim(),
  ],
  validate,
  (req, res) => {
    const { boardId } = req.params;
    const { priority, search } = req.query;

    const board = queries.getBoard(boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    let tasks;
    if (priority) {
      tasks = queries.getTasksByPriority(boardId, priority);
    } else {
      // All tasks, newest first
      const { getDb } = require('./db');
      tasks = getDb().prepare(`
        SELECT t.*, c.name AS column_name
        FROM tasks t
        JOIN columns c ON c.id = t.column_id
        WHERE c.board_id = ?
        ORDER BY t.created_at DESC
      `).all(boardId);
    }

    if (search) {
      const lower = search.toLowerCase();
      tasks = tasks.filter((t) => t.title.toLowerCase().includes(lower));
    }

    res.json(tasks);
  }
);

// ── POST /tasks ────────────────────────────────────────────────────────────────
router.post(
  '/tasks',
  [
    body('column_id').isInt({ min: 1 }).withMessage('column_id must be a positive integer'),
    body('title')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Title is required and cannot be empty'),
    body('description').optional({ nullable: true }).isString(),
    body('priority').optional().isIn(['Low', 'Medium', 'High']).withMessage('Priority must be Low, Medium, or High'),
  ],
  validate,
  (req, res) => {
    const { column_id, title, description, priority } = req.body;
    try {
      const task = queries.createTask({ columnId: column_id, title, description, priority });
      res.status(201).json(task);
    } catch (err) {
      if (err.message && err.message.includes('CHECK constraint')) {
        return res.status(422).json({ error: 'Title cannot be empty' });
      }
      throw err;
    }
  }
);

// ── PATCH /tasks/:taskId ──────────────────────────────────────────────────────
router.patch(
  '/tasks/:taskId',
  [
    param('taskId').isInt({ min: 1 }),
    body('title').optional().isString().trim().notEmpty().withMessage('Title cannot be empty'),
    body('description').optional({ nullable: true }).isString(),
    body('priority').optional().isIn(['Low', 'Medium', 'High']),
  ],
  validate,
  (req, res) => {
    const { taskId } = req.params;
    const { title, description, priority } = req.body;

    const existing = queries.getTaskById(taskId);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const task = queries.updateTask(taskId, { title, description, priority });
    res.json(task);
  }
);

// ── PATCH /tasks/:taskId/move ─────────────────────────────────────────────────
router.patch(
  '/tasks/:taskId/move',
  [
    param('taskId').isInt({ min: 1 }),
    body('column_id').isInt({ min: 1 }).withMessage('column_id is required'),
  ],
  validate,
  (req, res) => {
    const { taskId } = req.params;
    const { column_id } = req.body;

    const existing = queries.getTaskById(taskId);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const task = queries.moveTask(taskId, column_id);
    res.json(task);
  }
);

// ── DELETE /tasks/:taskId ─────────────────────────────────────────────────────
router.delete(
  '/tasks/:taskId',
  [param('taskId').isInt({ min: 1 })],
  validate,
  (req, res) => {
    const { taskId } = req.params;

    const existing = queries.getTaskById(taskId);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    queries.deleteTask(taskId);
    res.status(204).end();
  }
);

module.exports = router;
