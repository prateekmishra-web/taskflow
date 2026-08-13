const { initDb, closeDb } = require('./db');

function seed() {
  const db = initDb();

  // Clear existing data
  db.exec(`
    DELETE FROM tasks;
    DELETE FROM columns;
    DELETE FROM boards;
  `);

  // Create board
  const boardStmt = db.prepare(`INSERT INTO boards (name) VALUES (?)`);
  const board = boardStmt.run('My Team Board');
  const boardId = board.lastInsertRowid;

  // Create columns
  const colStmt = db.prepare(`INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)`);
  const todo   = colStmt.run(boardId, 'To Do',       0);
  const inProg = colStmt.run(boardId, 'In Progress', 1);
  const done   = colStmt.run(boardId, 'Done',        2);

  // Seed tasks
  const taskStmt = db.prepare(`
    INSERT INTO tasks (column_id, title, description, priority, position)
    VALUES (?, ?, ?, ?, ?)
  `);

  taskStmt.run(todo.lastInsertRowid,   'Set up CI/CD pipeline',          'Configure GitHub Actions for automated testing and deployment.', 'High',   0);
  taskStmt.run(todo.lastInsertRowid,   'Write API documentation',         'Document all REST endpoints using OpenAPI spec.',                'Medium', 1);
  taskStmt.run(todo.lastInsertRowid,   'Review accessibility audit',      null,                                                            'Low',    2);
  taskStmt.run(inProg.lastInsertRowid, 'Implement task drag-and-drop',    'Allow reordering tasks between columns.',                       'High',   0);
  taskStmt.run(inProg.lastInsertRowid, 'Design onboarding flow',          'Create wireframes and prototype for new user onboarding.',      'Medium', 1);
  taskStmt.run(done.lastInsertRowid,   'Initial project setup',           'Repo, linting, folder structure.',                             'High',   0);
  taskStmt.run(done.lastInsertRowid,   'Define data models',              'Schema design for boards, columns, tasks.',                    'High',   1);
  taskStmt.run(done.lastInsertRowid,   'Add login page skeleton',         null,                                                            'Low',    2);

  console.log(`✅ Seeded board "${board}" with 3 columns and 8 tasks.`);
  closeDb();
}

seed();
