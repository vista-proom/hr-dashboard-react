import React, { useEffect, useState } from 'react';
import api from '../../api';
import Card from '../../components/Card';
import { useAuth } from '../../context/AuthContext';

const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
function formatDay(dateStr) { const d=new Date(dateStr+'T00:00:00'); return days[(d.getDay()+1)%7]; }
function to12h(t){ if(!t) return '—'; const [h,m]=t.split(':').map(Number); const am=h<12; const hh=((h+11)%12)+1; return `${hh}:${String(m??0).padStart(2,'0')} ${am?'AM':'PM'}`; }
function getWeekStart(dateStr){ const d=new Date(dateStr+'T00:00:00'); const shift=(d.getDay()+1)%7; const start=new Date(d); start.setDate(d.getDate()-shift); return start; }

export default function Shifts() {
  const { getCurrentLocation } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    const [s, live] = await Promise.all([
      api.get('/shifts/me'),
      api.get('/schedules/me'),
    ]);
    setShifts(s.data);
    setSchedule(live.data);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const checkIn = async () => {
    setError('');
    const location = await getCurrentLocation();
    try { await api.post('/shifts/check-in', { location }); await refresh(); } catch (e) { setError(e?.response?.data?.error || 'Check-in failed'); }
  };
  const checkOut = async () => {
    setError('');
    const location = await getCurrentLocation();
    try { await api.post('/shifts/check-out', { location }); await refresh(); } catch (e) { setError(e?.response?.data?.error || 'Check-out failed'); }
  };

  const weeks = (() => {
    const map = new Map();
    for (const s of schedule) {
      const wk = getWeekStart(s.date).toISOString().slice(0,10);
      if (!map.has(wk)) map.set(wk, []);
      map.get(wk).push(s);
    }
    const list = Array.from(map.entries());
    list.sort((a,b)=> (a[0]<b[0]?1:-1));
    return list;
  })();

  if (loading) return <div>Loading…</div>;

  return (
    <div className="space-y-4">
      <Card title="Shift Actions" actions={<div className="space-x-2"><button className="bg-green-600 text-white px-3 py-1 rounded" onClick={checkIn}>Check-In</button><button className="bg-gray-700 text-white px-3 py-1 rounded" onClick={checkOut}>Check-Out</button></div>}>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <div className="text-sm text-gray-600">Use the buttons above to check in/out with your current location.</div>
      </Card>

      <Card title="My Live Schedule">
        {weeks.length === 0 && <div className="text-sm text-gray-500">No live schedules.</div>}
        {weeks.slice(0,1).map(([weekKey, entries]) => (
          <div key={weekKey} className="space-y-3">
            <div className="text-sm text-gray-600">Week of {new Date(weekKey).toLocaleDateString()}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b"><th className="py-2">Day</th><th>Time</th><th>Location</th></tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d} className="border-b last:border-0 align-top">
                      <td className="py-2 w-32">{d}</td>
                      <td className="w-64">
                        <div className="space-y-1">
                          {entries.filter(e=> formatDay(e.date)===d).sort((a,b)=>(a.start_time||'').localeCompare(b.start_time||'')).map((e,idx)=> (
                            <div key={idx}>{to12h(e.start_time)} - {to12h(e.end_time)}</div>
                          ))}
                          {entries.filter(e=> formatDay(e.date)===d).length===0 && <span className="text-xs text-gray-500">—</span>}
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          {entries.filter(e=> formatDay(e.date)===d).sort((a,b)=>(a.start_time||'').localeCompare(b.start_time||'')).map((e,idx)=> (
                            <div key={idx} className="px-2 py-1 bg-gray-100 rounded inline-block">{e.location_id || '—'}</div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </Card>

      <Card title="Login History">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b"><th className="py-2">Timestamp</th><th>Latitude</th><th>Longitude</th></tr>
            </thead>
            <tbody>
              {shifts.map((l) => (
                <tr key={l.id} className="border-b last:border-0"><td className="py-2">{new Date(l.timestamp).toLocaleString()}</td><td>{l.latitude ?? '—'}</td><td>{l.longitude ?? '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}