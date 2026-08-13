# TaskFlow

A lightweight task board for small teams — built for the TaskFlow take-home assignment.

---

## Quick start

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### 1. Clone and install

```bash
git clone <your-repo-url>
cd taskflow

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Seed the database

```bash
cd backend
npm run seed
```

This creates `backend/taskflow.db` with one board, three columns (To Do / In Progress / Done), and eight sample tasks.

### 3. Start the backend

```bash
cd backend
npm run dev       # hot-reloads with nodemon
# or
npm start         # plain node
```

API runs at **http://localhost:3001**.

### 4. Start the frontend

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Running tests

```bash
cd backend
npm test
```

14 tests covering:
- Task creation validation (empty title rejected on API layer and DB CHECK constraint)
- Moving a task updates its column, and the board reflects the change
- `getTaskCountPerColumn` — direct DB query test with known seed data
- `getTasksByPriority` — verifies correct filtering and descending date order
- Edit, delete, 404 handling

---

## Schema

See [`backend/schema.sql`](backend/schema.sql) for the full schema. Key design decisions:

```sql
CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id   INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL CHECK(length(trim(title)) > 0),
  description TEXT,
  priority    TEXT    NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High')),
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

- `NOT NULL` on required fields; `CHECK` constraint enforces non-empty title even at the DB level
- Foreign keys with `ON DELETE CASCADE` — deleting a column removes its tasks
- `CHECK` constraint on `priority` prevents invalid values at the DB level
- WAL mode enabled for better concurrent read performance

### The two required non-trivial queries

**Task count per column (including empty columns):**
```sql
SELECT
  c.id        AS column_id,
  c.name      AS column_name,
  c.position,
  COUNT(t.id) AS task_count
FROM columns c
LEFT JOIN tasks t ON t.column_id = c.id
WHERE c.board_id = ?
GROUP BY c.id, c.name, c.position
ORDER BY c.position ASC
```

**Tasks by priority, newest first:**
```sql
SELECT
  t.*,
  c.name    AS column_name,
  c.board_id
FROM tasks t
JOIN columns c ON c.id = t.column_id
WHERE c.board_id = ?
  AND t.priority = ?
ORDER BY t.created_at DESC
```

Both queries live in [`backend/src/queries.js`](backend/src/queries.js) and are tested at the DB layer in `api.test.js`.

---

## Project structure

```
taskflow/
├── backend/
│   ├── schema.sql            ← DB schema (readable standalone)
│   ├── taskflow.db           ← created after npm run seed
│   └── src/
│       ├── app.js            ← Express app (middleware, routes)
│       ├── server.js         ← HTTP listen
│       ├── db.js             ← DB connection + init
│       ├── queries.js        ← All SQL queries
│       ├── routes.js         ← REST endpoints + validation
│       ├── seed.js           ← Seed script
│       └── __tests__/
│           └── api.test.js
└── frontend/
    └── src/
        ├── api.js            ← fetch wrapper
        ├── Board.jsx         ← Main page + state
        └── components/
            ├── Column.jsx    ← Droppable column
            ├── TaskCard.jsx  ← Draggable task + actions
            └── TaskModal.jsx ← Create/edit dialog
```

---

## Decisions and assumptions

**Single board.** The schema supports multiple boards (and the API has a `GET /boards` endpoint), but the frontend is wired to board ID 1. The assignment describes "a board" not "multiple boards," and adding board switching would have been scope creep without adding signal.

**Drag-and-drop + dropdown fallback.** Both are implemented. The drag handle (grey bar at the top of each card) enables DnD; the arrow icon on each card gives a dropdown for mouse users who prefer precision. This felt like the right UX rather than a compromise.

**Priority filter is server-side; title search is client-side.** Priority filtering hits the `getTasksByPriority` query directly so the database does the work. Title search is client-side because it's a stretch goal and doing it client-side after a priority filter made the UX feel faster without meaningful data-scale concerns for a team task board.

**SQLite over Postgres.** The assignment explicitly blessed SQLite and it removes a dependency for reviewers running this locally. WAL mode is enabled so concurrent reads don't block writes.

**Optimistic drag-and-drop.** The board updates immediately on drag end, then a PATCH request confirms with the server. On failure, the board re-fetches and the user sees an alert. This avoids the card snapping back visually during the network round-trip.

**No ORM.** All SQL is written explicitly in `queries.js`. This was deliberate — the assignment asked to see real queries, and using raw `better-sqlite3` statements is clearer than query-builder abstractions for a codebase this size.

---

## What I'd improve with more time

- **Drag to reorder within a column** — currently moving within a column is a no-op. The `position` column is there; implementing reordering would need a position-update endpoint.
- **Optimistic updates for edit/delete** — only DnD is optimistic right now; edits and deletes re-fetch.
- **Multiple boards** — the schema and API support it; just needs a boards list page and routing.
- **Pagination or virtualization** — for large boards with hundreds of tasks per column.
- **Deploy with Docker Compose** — a `docker-compose.yml` would make the "works on any machine" story even stronger.

---

## Time spent

Approximately **5–6 hours**: ~2h backend (schema, queries, routes, tests), ~2.5h frontend (components, DnD, styling), ~1h README and polish.

---

## One thing I found interesting

`better-sqlite3`'s synchronous API was a deliberate choice by its author — SQLite is fast enough that async overhead often costs more than the query itself, and synchronous code in Node is dramatically simpler to reason about in a route handler. I'd always reached for async DB clients by default, so spending a few minutes reading the library author's reasoning on this was a genuine "huh, that makes sense" moment.
