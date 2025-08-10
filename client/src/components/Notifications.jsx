import React, { useEffect, useState } from 'react';
import api from '../api';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    const { data } = await api.get('/notifications');
    setItems(data);
  };

  useEffect(() => { refresh(); }, []);

  const unread = items.filter((n) => !n.read).length;
  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`);
    await refresh();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative">
        <span className="inline-block w-5 h-5">🔔</span>
        {unread > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] px-1 rounded">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded shadow-lg z-50">
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && <div className="p-3 text-sm text-gray-500">No notifications</div>}
            {items.map((n) => (
              <div key={n.id} className="p-3 border-b last:border-0">
                <div className="text-sm">{n.message}</div>
                <div className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString()}</div>
                {!n.read && <button className="text-xs text-blue-600 mt-1" onClick={() => markRead(n.id)}>Mark read</button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}