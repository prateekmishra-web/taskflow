const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.errors?.[0]?.msg || data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  getBoard: (boardId, priority) => {
    const q = priority ? `?priority=${priority}` : '';
    return request(`/boards/${boardId}${q}`);
  },
  createTask: (payload) => request('/tasks', { method: 'POST', body: payload }),
  updateTask: (taskId, payload) => request(`/tasks/${taskId}`, { method: 'PATCH', body: payload }),
  moveTask: (taskId, columnId) => request(`/tasks/${taskId}/move`, { method: 'PATCH', body: { column_id: columnId } }),
  deleteTask: (taskId) => request(`/tasks/${taskId}`, { method: 'DELETE' }),
};
