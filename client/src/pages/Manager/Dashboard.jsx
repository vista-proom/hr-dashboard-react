import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import api from '../../api';

export default function Dashboard() {
  const [me, setMe] = useState(null);
  useEffect(() => {
    const load = async () => { const r = await api.get('/auth/me'); setMe(r.data); };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-4">
      <Card title="Manager Dashboard">
        <div className="text-sm text-gray-600">Use the sidebar to manage tasks, view shifts, and employees.</div>
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
            {(me?.requests || []).slice(0,5).map((r) => (
              <li key={r.id}>{r.subject || r.type} — {r.status}</li>
            ))}
            {(!me?.requests || me.requests.length === 0) && <li className="list-none text-gray-500">No requests</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}