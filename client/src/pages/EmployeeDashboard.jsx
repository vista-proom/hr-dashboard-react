import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Card from '../components/Card';

export default function EmployeeDashboard() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, [setUser]);

  const markDone = async (taskId) => {
    await api.patch(`/tasks/${taskId}/status`, { status: 'done' });
    const { data } = await api.get('/auth/me');
    setUser(data);
  };

  if (loading || !user) return <div>Loading…</div>;

  return (
    <div className="space-y-4">
      <Card title={`Welcome, ${user.name}`}> 
        <div className="text-sm text-gray-700">Role: {user.role} • Home location: {user.homeLocation} • Required hours: {user.requiredHours}h</div>
      </Card>

      <Card title="Tasks">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Description</th>
                <th>Due</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {user.tasks?.map((t) => (
                <tr key={t.task_id} className="border-b last:border-0">
                  <td className="py-2">{t.description}</td>
                  <td>{t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}</td>
                  <td>{t.status}</td>
                  <td className="text-right">
                    {t.status !== 'done' && (
                      <button onClick={() => markDone(t.task_id)} className="text-blue-600 hover:underline">Mark done</button>
                    )}
                  </td>
                </tr>
              ))}
              {!user.tasks?.length && (
                <tr><td colSpan="4" className="py-4 text-center text-gray-500">No tasks assigned</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Login History">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Timestamp</th>
                <th>Latitude</th>
                <th>Longitude</th>
              </tr>
            </thead>
            <tbody>
              {user.locationHistory?.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2">{new Date(l.timestamp).toLocaleString()}</td>
                  <td>{l.latitude ?? '—'}</td>
                  <td>{l.longitude ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}