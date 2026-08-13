import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import TaskCard from './TaskCard';

export default function Column({ column, columns, onAddTask, onEditTask, onDeleteTask, onMoveTask }) {
  return (
    <div className="column">
      <div className="column__header">
        <div className="column__title-row">
          <h3 className="column__name">{column.name}</h3>
          <span className="column__count">{column.tasks.length}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => onAddTask(column.id)} title="Add task">
          <Plus size={14} /> Add
        </button>
      </div>

      <Droppable droppableId={String(column.id)}>
        {(provided, snapshot) => (
          <div
            className={`column__tasks${snapshot.isDraggingOver ? ' column__tasks--over' : ''}`}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {column.tasks.length === 0 && !snapshot.isDraggingOver && (
              <p className="column__empty">No tasks here yet.</p>
            )}
            {column.tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                {(prov, snap) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.draggableProps}
                    style={{
                      ...prov.draggableProps.style,
                      opacity: snap.isDragging ? 0.85 : 1,
                    }}
                  >
                    <TaskCard
                      task={task}
                      columns={columns}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      onMove={onMoveTask}
                      dragHandleProps={prov.dragHandleProps}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <style>{`
        .column {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          display: flex;
          flex-direction: column;
          min-width: 280px;
          width: 280px;
          flex-shrink: 0;
          max-height: calc(100vh - 120px);
        }
        .column__header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 14px 10px;
          border-bottom: 1px solid var(--border);
        }
        .column__title-row { display: flex; align-items: center; gap: 8px; }
        .column__name { font-size: 15px; font-weight: 600; }
        .column__count {
          font-size: 12px; background: var(--border);
          color: var(--text-muted); border-radius: 20px; padding: 1px 7px;
        }
        .column__tasks {
          flex: 1; overflow-y: auto; padding: 10px;
          display: flex; flex-direction: column; gap: 8px;
          min-height: 80px;
          border-radius: 0 0 var(--radius) var(--radius);
          transition: background .15s;
        }
        .column__tasks--over { background: rgba(108,99,255,.06); }
        .column__empty {
          text-align: center; color: var(--text-muted);
          font-size: 13px; padding: 20px 0;
        }
      `}</style>
    </div>
  );
}
