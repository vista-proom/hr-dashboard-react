import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

export default function Dashboard() {
  const { user } = useAuth();
  const [me, setMe] = useState(null);

  useEffect(() => {
    api.get('/auth/me').then((r) => setMe(r.data));
  }, []);

  return (
    <div className="space-y-4">
      <Card title={`Welcome, ${user?.name}`}> 
        <div className="text-sm text-gray-700">Role: {user?.role} • Home location: {user?.homeLocation} • Required hours: {user?.requiredHours}h</div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Recent Tasks">
          <ul className="text-sm list-disc pl-4">
            {me?.tasks?.slice(0,5).map((t) => (
              <li key={t.task_id}>{t.name || t.description} — {t.status}</li>
            ))}
            {(!me?.tasks || me.tasks.length === 0) && <li className="list-none text-gray-500">No tasks</li>}
          </ul>
        </Card>
        <Card title="Recent Shifts">
          <ul className="text-sm list-disc pl-4">
            {me?.shifts?.slice(0,5).map((s) => (
              <li key={s.id}>{s.check_in_time ? new Date(s.check_in_time).toLocaleString() : '—'} → {s.check_out_time ? new Date(s.check_out_time).toLocaleString() : '—'}</li>
            ))}
            {(!me?.shifts || me.shifts.length === 0) && <li className="list-none text-gray-500">No shifts</li>}
          </ul>
        </Card>
        <Card title="Recent Requests">
          <ul className="text-sm list-disc pl-4">
            {me?.requests?.slice(0,5).map((r) => (
              <li key={r.id}>{r.subject || r.type} — {r.status}</li>
            ))}
            {(!me?.requests || me.requests.length === 0) && <li className="list-none text-gray-500">No requests</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}