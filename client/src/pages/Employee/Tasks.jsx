import React, { useEffect, useState } from 'react';
import api from '../../api';
import Card from '../../components/Card';

const statuses = ['Assigned', 'In Progress', 'Done'];

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await api.get('/auth/me');
    setTasks(data?.tasks || []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  const updateStatus = async (taskId, status) => {
    await api.patch(`/tasks/${taskId}/status`, { status });
    await refresh();
  };

  if (loading) return <div>Loading…</div>;

  return (
    <Card title="My Tasks">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Description</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.task_id} className="border-b last:border-0">
                <td className="py-2">{t.name || t.description}</td>
                <td>{t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}</td>
                <td>
                  <select value={t.status} onChange={(e) => updateStatus(t.task_id, e.target.value)} className="border rounded px-2 py-1">
                    {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {!tasks.length && (
              <tr><td colSpan="3" className="py-4 text-center text-gray-500">No tasks assigned</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}