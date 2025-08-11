import React, { useEffect, useState } from 'react';
import api from '../../api';
import Card from '../../components/Card';

export default function Directory() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get('/users').then((r) => setUsers(r.data));
  }, []);

  const filtered = users.filter((u) =>
    [u.name, u.email, String(u.id)].some((v) => v?.toLowerCase?.().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <Card title="Employee Directory">
        <div className="mb-3">
          <input placeholder="Search by name, email, ID" className="border rounded px-3 py-2 w-full" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filtered.map((u) => (
            <div key={u.id} className="border rounded p-3 bg-white">
              <div className="flex items-center gap-3">
                <img src={u.avatarUrl} alt="avatar" className="w-10 h-10 rounded-full border" />
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                  <div className="text-xs text-gray-400">ID: {u.id}</div>
                  {u.linkedinUrl && <a className="text-xs text-blue-700" href={u.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a>}
                  {u.whatsapp && <div className="text-xs text-gray-600">WhatsApp: {u.whatsapp}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}