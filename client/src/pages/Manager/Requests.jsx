import React, { useEffect, useState } from 'react';
import api from '../../api';
import Card from '../../components/Card';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';

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

function RequestInfoModal({ request, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Request Details</h3>
            <p className="text-sm text-gray-600">Submitted by {request.user_name}</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <p className="text-gray-900">{request.subject || '—'}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <p className="text-gray-900">{request.type || '—'}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <div className="bg-gray-50 rounded-md p-4 max-h-64 overflow-y-auto">
              <p className="text-gray-900 whitespace-pre-wrap">{request.body || 'No description provided'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                request.status === 'Under Review' ? 'bg-yellow-100 text-yellow-800' :
                request.status === 'Accepted' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {request.status}
              </span>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Submitted</label>
              <p className="text-gray-900">{new Date(request.created_at).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Requests() {
  const { socket } = useAuth();
  const [pending, setPending] = useState([]);
  const [showHistory, setShowHistory] = useState(null);
  const [showInfo, setShowInfo] = useState(null);
  
  const refresh = async () => {
    const { data } = await api.get('/requests/pending');
    setPending(data);
  };
  
  useEffect(() => { 
    refresh(); 
  }, []);
  
  // Real-time updates for new requests
  useEffect(() => {
    if (!socket) return;
    
    const onRequestCreated = (newRequest) => {
      setPending(prev => [newRequest, ...prev]);
    };
    
    socket.on('request-created', onRequestCreated);
    
    return () => {
      socket.off('request-created', onRequestCreated);
    };
  }, [socket]);

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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2">{r.user_name}</td>
                  <td>{r.subject || r.type}</td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>Annual: {r.annual_balance} • Casual: {r.casual_balance}</td>
                  <td className="space-x-2">
                    <button className="text-green-700 hover:text-green-800 transition-colors" onClick={() => decide(r.id, 'Accepted')}>Accept</button>
                    <button className="text-red-700 hover:text-red-800 transition-colors" onClick={() => decide(r.id, 'Refused')}>Refuse</button>
                    <button className="text-blue-700 hover:text-blue-800 transition-colors" onClick={() => setShowHistory(r.user_id)}>Leaves history</button>
                  </td>
                  <td className="py-2">
                    <button 
                      onClick={() => setShowInfo(r)}
                      className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded-full hover:bg-blue-50"
                      title="View request details"
                    >
                      <InformationCircleIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && <tr><td colSpan="6" className="py-4 text-center text-gray-500">No pending requests</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      
      {showHistory && <HistoryModal userId={showHistory} onClose={() => setShowHistory(null)} />}
      {showInfo && <RequestInfoModal request={showInfo} onClose={() => setShowInfo(null)} />}
    </div>
  );
}