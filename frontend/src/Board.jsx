import { useState, useEffect, useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { LayoutDashboard, Search, Filter } from 'lucide-react';
import Column from './components/Column';
import TaskModal from './components/TaskModal';
import { api } from './api';

const BOARD_ID = 1; // Single-board app — see README

export default function Board() {
  const [board, setBoard]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [modal, setModal]         = useState(null); // { task?, defaultColumnId }
  const [priority, setPriority]   = useState('');
  const [search, setSearch]       = useState('');

  const fetchBoard = useCallback(async () => {
    try {
      const data = await api.getBoard(BOARD_ID, priority || undefined);
      setBoard(data);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load board.');
    } finally {
      setLoading(false);
    }
  }, [priority]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  // Client-side title search on top of server-side priority filter
  const filteredBoard = board
    ? {
        ...board,
        columns: board.columns.map((col) => ({
          ...col,
          tasks: search
            ? col.tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
            : col.tasks,
        })),
      }
    : null;

  async function handleSaveTask(payload) {
    if (modal?.task) {
      await api.updateTask(modal.task.id, payload);
    } else {
      await api.createTask({ ...payload, column_id: payload.column_id || modal?.defaultColumnId });
    }
    fetchBoard();
  }

  async function handleDeleteTask(taskId) {
    await api.deleteTask(taskId);
    fetchBoard();
  }

  async function handleMoveTask(taskId, targetColumnId) {
    try {
      await api.moveTask(taskId, targetColumnId);
      fetchBoard();
    } catch (e) {
      alert(e.message || 'Failed to move task.');
    }
  }

  async function onDragEnd(result) {
    const { draggableId, destination } = result;
    if (!destination) return;

    const taskId = Number(draggableId);
    const targetColumnId = Number(destination.droppableId);

    // Find current column to avoid no-op moves
    let currentColumnId;
    for (const col of board.columns) {
      if (col.tasks.find((t) => t.id === taskId)) {
        currentColumnId = col.id;
        break;
      }
    }
    if (currentColumnId === targetColumnId) return;

    // Optimistic update
    setBoard((prev) => {
      const cols = prev.columns.map((col) => ({
        ...col,
        tasks: col.tasks.filter((t) => t.id !== taskId),
      }));
      const task = prev.columns.flatMap((c) => c.tasks).find((t) => t.id === taskId);
      const updated = { ...task, column_id: targetColumnId };
      return {
        ...prev,
        columns: cols.map((col) =>
          col.id === targetColumnId
            ? { ...col, tasks: [...col.tasks.slice(0, destination.index), updated, ...col.tasks.slice(destination.index)] }
            : col
        ),
      };
    });

    try {
      await api.moveTask(taskId, targetColumnId);
      fetchBoard();
    } catch (e) {
      alert(e.message || 'Failed to move task.');
      fetchBoard(); // revert on error
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <LayoutDashboard size={22} color="var(--accent)" />
          <span className="header__logo">TaskFlow</span>
          {board && <span className="header__board-name">{board.name}</span>}
        </div>

        <div className="header__controls">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-wrap">
            <Filter size={14} />
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="filter-select">
              <option value="">All priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>
            + New task
          </button>
        </div>
      </header>

      <main className="main">
        {loading && <p className="status-msg">Loading board…</p>}
        {error  && <p className="status-msg status-msg--error">{error} <button className="btn btn-ghost btn-sm" onClick={fetchBoard}>Retry</button></p>}

        {filteredBoard && (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="board">
              {filteredBoard.columns.map((col) => (
                <Column
                  key={col.id}
                  column={col}
                  columns={filteredBoard.columns}
                  onAddTask={(colId) => setModal({ defaultColumnId: colId })}
                  onEditTask={(task) => setModal({ task })}
                  onDeleteTask={handleDeleteTask}
                  onMoveTask={handleMoveTask}
                />
              ))}
            </div>
          </DragDropContext>
        )}
      </main>

      {modal !== null && (
        <TaskModal
          task={modal.task}
          columns={board?.columns}
          defaultColumnId={modal.defaultColumnId || board?.columns?.[0]?.id}
          onSave={handleSaveTask}
          onClose={() => setModal(null)}
        />
      )}

      <style>{`
        .app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px;
          height: 56px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          gap: 16px;
        }
        .header__brand { display: flex; align-items: center; gap: 10px; }
        .header__logo { font-size: 17px; font-weight: 700; letter-spacing: -.02em; }
        .header__board-name {
          font-size: 13px; color: var(--text-muted);
          padding-left: 10px; border-left: 1px solid var(--border);
        }
        .header__controls { display: flex; align-items: center; gap: 10px; }

        .search-wrap { position: relative; display: flex; align-items: center; }
        .search-icon { position: absolute; left: 10px; color: var(--text-muted); pointer-events: none; }
        .search-input {
          width: 200px; padding-left: 32px;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--radius-sm); color: var(--text); font-size: 13px;
          height: 34px;
        }
        .filter-wrap { display: flex; align-items: center; gap: 6px; color: var(--text-muted); }
        .filter-select {
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--radius-sm); color: var(--text);
          font-size: 13px; padding: 5px 10px; height: 34px; width: auto;
        }

        .main { flex: 1; overflow: auto; padding: 24px; }
        .board { display: flex; gap: 16px; align-items: flex-start; width: max-content; min-height: 100%; }

        .status-msg {
          text-align: center; color: var(--text-muted);
          padding: 48px; font-size: 15px;
          display: flex; align-items: center; justify-content: center; gap: 12px;
        }
        .status-msg--error { color: var(--danger); }
      `}</style>
    </div>
  );
}
