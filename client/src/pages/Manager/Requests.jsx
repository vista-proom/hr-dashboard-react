import React, { useEffect, useState } from 'react';
import api from '../../api';
import Card from '../../components/Card';

function HistoryModal({ userId, onClose }) {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get(`/users/${userId}`).then((r) => setItems(r.data.requests || [])); }, [userId]);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg w-full max-w-xl">
        <div className="px-4 py-3 border-b flex items-center justify-between"><div className="font-semibold">Leave History</div><button onClick={onClose}>Close</button></div>
        <div className="p-4 max-h-96 overflow-y-auto">
          <ul className="text-sm list-disc pl-4">
            {items.map((r) => <li key={r.id}>{r.subject || r.type} — {r.status} ({new Date(r.created_at).toLocaleString()})</li>)}
            {items.length === 0 && <li className="list-none text-gray-500">No history</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Requests() {
  const [pending, setPending] = useState([]);
  const [showHistory, setShowHistory] = useState(null);
  const refresh = async () => {
    const { data } = await api.get('/requests/pending');
    setPending(data);
  };
  useEffect(() => { refresh(); }, []);

  const decide = async (id, status) => {
    await api.put(`/requests/${id}/status`, { status });
    await refresh();
  };

  return (
    <div className="space-y-4">
      <Card title="Pending Requests">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Employee</th>
                <th>Subject / Type</th>
                <th>Submitted</th>
                <th>Balances</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">{r.user_name}</td>
                  <td>{r.subject || r.type}</td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>Annual: {r.annual_balance} • Casual: {r.casual_balance}</td>
                  <td className="space-x-2">
                    <button className="text-green-700" onClick={() => decide(r.id, 'Accepted')}>Accept</button>
                    <button className="text-red-700" onClick={() => decide(r.id, 'Refused')}>Refuse</button>
                    <button className="text-blue-700" onClick={() => setShowHistory(r.user_id)}>Leaves history</button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && <tr><td colSpan="5" className="py-4 text-center text-gray-500">No pending requests</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {showHistory && <HistoryModal userId={showHistory} onClose={() => setShowHistory(null)} />}
    </div>
  );
}