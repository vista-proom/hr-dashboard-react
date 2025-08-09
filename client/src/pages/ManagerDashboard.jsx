import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import Card from '../components/Card';

export default function ManagerDashboard() {
  const [users, setUsers] = useState([]);
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [u, h] = await Promise.all([
      api.get('/users'),
      api.get('/hours'),
    ]);
    setUsers(u.data);
    setHours(h.data);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  const createTask = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const userId = Number(form.get('userId'));
    const description = form.get('description');
    const dueDate = form.get('dueDate') || null;
    await api.post('/tasks', { userId, description, dueDate });
    e.currentTarget.reset();
    await refresh();
  };

  const updateTask = async (taskId, fields) => {
    await api.put(`/tasks/${taskId}`, fields);
    await refresh();
  };

  const deleteTask = async (taskId) => {
    await api.delete(`/tasks/${taskId}`);
    await refresh();
  };

  const setLocationHours = async (location, hoursVal) => {
    await api.put(`/hours/${encodeURIComponent(location)}`, { hours: Number(hoursVal) });
    await refresh();
  };

  if (loading) return <div>Loading…</div>;

  return (
    <div className="space-y-4">
      <Card title="Assign Task">
        <form onSubmit={createTask} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm mb-1">Employee</label>
            <select name="userId" required className="border rounded px-3 py-2 min-w-[200px]">
              {users.filter(u => u.role === 'Employee').map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="block text-sm mb-1">Description</label>
            <input name="description" required className="w-full border rounded px-3 py-2" placeholder="Enter task description" />
          </div>
          <div>
            <label className="block text-sm mb-1">Due date</label>
            <input name="dueDate" type="date" className="border rounded px-3 py-2" />
          </div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded">Create</button>
        </form>
      </Card>

      <Card title="Employees & Tasks">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Employee</th>
                <th>Tasks</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 align-top">
                  <td className="py-2">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-gray-500">{u.email} • {u.role}</div>
                  </td>
                  <td>
                    <div className="space-y-2">
                      {(u.tasks || []).map((t) => (
                        <div key={t.task_id} className="flex items-center gap-2">
                          <input defaultValue={t.description} onBlur={(e) => updateTask(t.task_id, { description: e.target.value })} className="border rounded px-2 py-1 flex-1" />
                          <input type="date" defaultValue={t.due_date ? t.due_date.substring(0,10) : ''} onChange={(e) => updateTask(t.task_id, { dueDate: e.target.value })} className="border rounded px-2 py-1" />
                          <select defaultValue={t.status} onChange={(e) => updateTask(t.task_id, { status: e.target.value })} className="border rounded px-2 py-1">
                            <option value="pending">pending</option>
                            <option value="in_progress">in_progress</option>
                            <option value="done">done</option>
                          </select>
                          <button onClick={() => deleteTask(t.task_id)} className="text-red-600">Delete</button>
                        </div>
                      ))}
                      {!u.tasks?.length && <div className="text-xs text-gray-500">No tasks</div>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Required Hours by Location">
        <div className="space-y-2">
          {hours.map((h) => (
            <div key={h.location} className="flex items-center gap-3">
              <div className="w-48 font-medium">{h.location}</div>
              <input type="number" defaultValue={h.hours} min={1} className="border rounded px-2 py-1 w-24" onBlur={(e) => setLocationHours(h.location, e.target.value)} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}