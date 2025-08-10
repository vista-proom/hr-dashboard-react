import React, { useEffect, useState } from 'react';
import api from '../../api';
import Card from '../../components/Card';
import { useAuth } from '../../context/AuthContext';

export default function Shifts() {
  const { getCurrentLocation } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    const { data } = await api.get('/shifts/me');
    setShifts(data);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const checkIn = async () => {
    setError('');
    const location = await getCurrentLocation();
    try {
      await api.post('/shifts/check-in', { location });
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || 'Check-in failed');
    }
  };

  const checkOut = async () => {
    setError('');
    const location = await getCurrentLocation();
    try {
      await api.post('/shifts/check-out', { location });
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || 'Check-out failed');
    }
  };

  if (loading) return <div>Loading…</div>;

  return (
    <div className="space-y-4">
      <Card title="Shift Actions" actions={<div className="space-x-2"><button className="bg-green-600 text-white px-3 py-1 rounded" onClick={checkIn}>Check-In</button><button className="bg-gray-700 text-white px-3 py-1 rounded" onClick={checkOut}>Check-Out</button></div>}>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <div className="text-sm text-gray-600">Use the buttons above to check in/out with your current location.</div>
      </Card>

      <Card title="My Shifts">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Check-In</th>
                <th>Location</th>
                <th>Check-Out</th>
                <th>Location</th>
                <th>Maps</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2">{s.check_in_time ? new Date(s.check_in_time).toLocaleString() : '—'}</td>
                  <td>{s.check_in_lat ? `${s.check_in_lat.toFixed(4)}, ${s.check_in_lng.toFixed(4)}` : '—'}</td>
                  <td>{s.check_out_time ? new Date(s.check_out_time).toLocaleString() : '—'}</td>
                  <td>{s.check_out_lat ? `${s.check_out_lat.toFixed(4)}, ${s.check_out_lng.toFixed(4)}` : '—'}</td>
                  <td className="text-blue-600">
                    {s.check_in_lat && (
                      <a className="underline mr-2" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${s.check_in_lat},${s.check_in_lng}`}>In</a>
                    )}
                    {s.check_out_lat && (
                      <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${s.check_out_lat},${s.check_out_lng}`}>Out</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}