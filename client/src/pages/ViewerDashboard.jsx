import React, { useEffect, useState } from 'react';
import api from '../api';
import Card from '../components/Card';

export default function ViewerDashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const { data } = await api.get('/users');
      setData(data);
      setLoading(false);
    };
    run();
  }, []);

  if (loading) return <div>Loading…</div>;

  return (
    <div className="space-y-4">
      <Card title="All Employees">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Home Location</th>
                <th>Required Hours</th>
                <th>Tasks</th>
                <th>Last Login</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2">{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.homeLocation}</td>
                  <td>{u.requiredHours}</td>
                  <td>{u.tasks?.length ?? 0}</td>
                  <td>{u.locationHistory?.[0] ? new Date(u.locationHistory[0].timestamp).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}