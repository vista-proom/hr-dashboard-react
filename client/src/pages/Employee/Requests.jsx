import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

const subjects = ['Leave', 'Special Shift', 'Other'];
const types = ['Annual', 'Casual', 'Special Shift Request', 'Other'];

export default function Requests() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [managers, setManagers] = useState([]);
  const [form, setForm] = useState({ managerId: '', subject: '', type: '', body: '' });

  const refresh = async () => {
    const [h, users] = await Promise.all([api.get('/requests/me'), api.get('/users')]);
    setHistory(h.data);
    setManagers(users.data.filter((u) => u.role === 'Manager'));
  };
  useEffect(() => { refresh(); }, []);

  const send = async () => {
    await api.post('/requests', form);
    setForm({ managerId: '', subject: '', type: '', body: '' });
    await refresh();
  };

  return (
    <div className="space-y-4">
      <Card title="Leave Balances">
        <div className="text-sm text-gray-700">Annual: {user?.annualBalance} days • Casual: {user?.casualBalance} days</div>
      </Card>

      <Card title="Send Request">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Manager</label>
            <select className="w-full border rounded px-3 py-2" value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
              <option value="">Select a manager</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Subject</label>
            <select className="w-full border rounded px-3 py-2" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
              <option value="">Select</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Type</label>
            <select className="w-full border rounded px-3 py-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="">Select</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Details</label>
            <textarea className="w-full border rounded px-3 py-2" rows="4" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
        </div>
        <div className="mt-3">
          <button onClick={send} className="bg-blue-600 text-white px-4 py-2 rounded">Send</button>
        </div>
      </Card>

      <Card title="My Requests">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Subject / Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">{r.subject || r.type}</td>
                  <td>{r.status}</td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{new Date(r.updated_at).toLocaleString()}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan="4" className="py-4 text-center text-gray-500">No requests</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}