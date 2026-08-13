import { useState } from 'react';
import { Pencil, Trash2, ArrowRight } from 'lucide-react';

const PRIORITY_COLOR = { High: '#e05c7a', Medium: '#f0a050', Low: '#4caf86' };

export default function TaskCard({ task, columns, onEdit, onDelete, onMove, dragHandleProps }) {
  const [showMove, setShowMove] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const otherColumns = columns.filter((c) => c.id !== task.column_id);

  async function handleDelete() {
    if (!confirm('Delete this task?')) return;
    setDeleting(true);
    try { await onDelete(task.id); }
    catch (e) { alert(e.message); setDeleting(false); }
  }

  function handleMove(colId) {
    setShowMove(false);
    onMove(task.id, Number(colId));
  }

  const date = new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="task-card" style={{ opacity: deleting ? 0.4 : 1 }}>
      <div className="task-card__drag" {...dragHandleProps} />

      <div className="task-card__body">
        <div className="task-card__header">
          <span
            className="task-card__priority"
            style={{ background: PRIORITY_COLOR[task.priority] + '22', color: PRIORITY_COLOR[task.priority] }}
          >
            {task.priority}
          </span>
          <span className="task-card__date">{date}</span>
        </div>

        <p className="task-card__title">{task.title}</p>
        {task.description && <p className="task-card__desc">{task.description}</p>}
      </div>

      <div className="task-card__actions">
        <button className="icon-btn" title="Edit" onClick={() => onEdit(task)}><Pencil size={13} /></button>

        {otherColumns.length > 0 && (
          <div className="move-wrap">
            <button className="icon-btn" title="Move to…" onClick={() => setShowMove((s) => !s)}>
              <ArrowRight size={13} />
            </button>
            {showMove && (
              <div className="move-dropdown">
                {otherColumns.map((c) => (
                  <button key={c.id} onClick={() => handleMove(c.id)}>{c.name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        <button className="icon-btn icon-btn--danger" title="Delete" onClick={handleDelete}><Trash2 size={13} /></button>
      </div>

      <style>{`
        .task-card {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          position: relative;
          transition: box-shadow .15s;
        }
        .task-card:hover { box-shadow: 0 2px 12px rgba(108,99,255,.18); border-color: var(--accent-dim); }
        .task-card__drag { cursor: grab; height: 4px; background: var(--border); border-radius: 2px; margin-bottom: 4px; }
        .task-card__drag:active { cursor: grabbing; }
        .task-card__header { display: flex; align-items: center; justify-content: space-between; }
        .task-card__priority {
          font-size: 11px; font-weight: 600; letter-spacing: .04em;
          padding: 2px 7px; border-radius: 20px;
        }
        .task-card__date { font-size: 11px; color: var(--text-muted); }
        .task-card__title { font-size: 14px; font-weight: 500; line-height: 1.4; }
        .task-card__desc { font-size: 12px; color: var(--text-muted); line-height: 1.5; }
        .task-card__actions { display: flex; gap: 4px; }
        .icon-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: var(--radius-sm);
          color: var(--text-muted); transition: background .12s, color .12s;
        }
        .icon-btn:hover { background: var(--border); color: var(--text); }
        .icon-btn--danger:hover { background: #e05c7a22; color: var(--danger); }
        .move-wrap { position: relative; }
        .move-dropdown {
          position: absolute; bottom: 30px; left: 0;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-sm); box-shadow: var(--shadow);
          z-index: 10; min-width: 120px; overflow: hidden;
        }
        .move-dropdown button {
          display: block; width: 100%; text-align: left;
          padding: 8px 12px; font-size: 13px; color: var(--text);
          transition: background .1s;
        }
        .move-dropdown button:hover { background: var(--border); }
      `}</style>
    </div>
  );
}
