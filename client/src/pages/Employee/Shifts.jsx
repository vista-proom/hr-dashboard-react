import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../../api';
import Card from '../../components/Card';
import { useAuth } from '../../context/AuthContext';

const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];

function formatDay(dateStr) { 
  const d = new Date(dateStr+'T00:00:00'); 
  return days[(d.getDay()+1)%7]; 
}

function to12h(t) { 
  if(!t) return '—'; 
  const [h,m] = t.split(':').map(Number); 
  const am = h < 12; 
  const hh = ((h+11)%12)+1; 
  return `${hh}:${String(m??0).padStart(2,'0')} ${am?'AM':'PM'}`; 
}

function getWeekStart(dateStr) { 
  const d = new Date(dateStr+'T00:00:00'); 
  const shift = (d.getDay()+1)%7; 
  const start = new Date(d); 
  start.setDate(d.getDate()-shift); 
  return start; 
}

function fmtDate(d) { 
  const dt = new Date(d); 
  return `${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()}`; 
}

function formatTime12h(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = ((hours + 11) % 12) + 1;
  return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function getGoogleMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function DeviceIcon({ deviceType }) {
  if (deviceType === 'mobile') {
    return (
      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm3 14a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
    </svg>
  );
}

export default function Shifts() {
  const { getCurrentLocation, getDeviceType } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const scheduleRef = useRef(null);

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
    setCheckingIn(true);
    
    try {
      const location = await getCurrentLocation();
      if (!location) {
        setError('Unable to get your location. Please ensure location permissions are enabled.');
        return;
      }
      
      const deviceType = getDeviceType();
      await api.post('/shifts/check-in', { location, deviceType });
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const checkOut = async () => {
    setError('');
    setCheckingOut(true);
    
    try {
      const location = await getCurrentLocation();
      if (!location) {
        setError('Unable to get your location. Please ensure location permissions are enabled.');
        return;
      }
      
      await api.post('/shifts/check-out', { location });
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || 'Check-out failed');
    } finally {
      setCheckingOut(false);
    }
  };

  const exportExcel = () => {
    if (shifts.length === 0) return;
    
    const exportData = shifts.map(shift => ({
      'Date': shift.check_in_date || '—',
      'Time': shift.check_in_time_12h || '—',
      'Check-out Date': shift.check_out_date || '—',
      'Check-out Time': shift.check_out_time_12h || '—',
      'Location': shift.check_in_location_name || 
                 (shift.check_in_lat && shift.check_in_lng ? 
                  `${shift.check_in_lat}, ${shift.check_in_lng}` : '—'),
      'Check-out Location': shift.check_out_location_name || 
                           (shift.check_out_lat && shift.check_out_lng ? 
                            `${shift.check_out_lat}, ${shift.check_out_lng}` : '—'),
      'Device Type': shift.device_type || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Login History');
    
    // Auto-size columns
    const colWidths = [];
    exportData.forEach(row => {
      Object.keys(row).forEach((key, index) => {
        colWidths[index] = Math.max(colWidths[index] || 0, key.length, String(row[key]).length);
      });
    });
    
    ws['!cols'] = colWidths.map(width => ({ width: Math.min(width + 2, 50) }));
    
    XLSX.writeFile(wb, `login_history_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportPDF = () => {
    if (!scheduleRef.current) return;
    const html = scheduleRef.current.innerHTML;
    const w = window.open('', '_blank'); 
    if (!w) return;
    w.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>My Schedule</title>
          <style>
            body { font-family: sans-serif; padding: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 6px; text-align: left; }
            th { background-color: #f9fafb; font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>My Schedule</h1>
          ${html}
        </body>
      </html>
    `);
    w.document.close(); 
    w.focus(); 
    w.print(); 
    w.close();
  };

  const weeks = useMemo(() => { 
    const map = new Map(); 
    for(const s of schedule) { 
      const wk = getWeekStart(s.date).toISOString().slice(0,10); 
      if(!map.has(wk)) map.set(wk,[]); 
      map.get(wk).push(s);
    } 
    const list = Array.from(map.entries()); 
    list.sort((a,b) => (a[0] < b[0] ? 1 : -1)); 
    return list; 
  }, [schedule]);

  if (loading) return <div className="flex justify-center items-center h-64"><div className="text-lg">Loading…</div></div>;

  return (
    <div className="space-y-6">
      <Card 
        title="Shift Actions" 
        actions={
          <div className="space-x-3">
            <button 
              className={`px-4 py-2 rounded font-medium transition-colors ${
                checkingIn 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`} 
              onClick={checkIn}
              disabled={checkingIn}
            >
              {checkingIn ? 'Checking In...' : 'Check-In'}
            </button>
            <button 
              className={`px-4 py-2 rounded font-medium transition-colors ${
                checkingOut 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-gray-700 text-white hover:bg-gray-800'
              }`} 
              onClick={checkOut}
              disabled={checkingOut}
            >
              {checkingOut ? 'Checking Out...' : 'Check-Out'}
            </button>
          </div>
        }
      >
        {error && <div className="text-red-600 text-sm mb-3 p-3 bg-red-50 rounded border border-red-200">{error}</div>}
        <div className="text-sm text-gray-600 space-y-2">
          <p>• Automatically captures your current date, time, and location</p>
          <p>• Uses high-accuracy GPS positioning</p>
          <p>• Detects if you're at a saved work location</p>
        </div>
      </Card>

      <Card 
        title="My Live Schedule" 
        actions={
          <div className="space-x-3">
            <button 
              onClick={exportExcel} 
              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition-colors"
            >
              Export to Excel
            </button>
            <button 
              onClick={exportPDF} 
              className="bg-gray-800 text-white px-3 py-2 rounded hover:bg-gray-900 transition-colors"
            >
              Export to PDF
            </button>
          </div>
        }
      >
        {weeks.length === 0 && <div className="text-sm text-gray-500 text-center py-8">No live schedules assigned.</div>}
        {weeks.slice(0,1).map(([weekKey, entries]) => (
          <div key={weekKey} className="space-y-4" ref={scheduleRef}>
            <div className="text-lg font-medium text-gray-800 border-b pb-2">
              Week of {new Date(weekKey).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b-2 border-gray-200">
                    <th className="py-3 px-2 font-semibold text-gray-700">Day</th>
                    <th className="py-3 px-2 font-semibold text-gray-700">Time</th>
                    <th className="py-3 px-2 font-semibold text-gray-700">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 w-32 font-medium text-gray-800">{d}</td>
                      <td className="py-3 px-2 w-64">
                        <div className="space-y-2">
                          {entries.filter(e => formatDay(e.date) === d).sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')).map((e,idx) => (
                            <div key={idx} className="text-gray-700">
                              {to12h(e.start_time)} - {to12h(e.end_time)}
                            </div>
                          ))}
                          {entries.filter(e => formatDay(e.date) === d).length === 0 && 
                            <span className="text-xs text-gray-400 italic">No shifts</span>
                          }
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="space-y-2">
                          {entries.filter(e => formatDay(e.date) === d).sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')).map((e,idx) => (
                            <div key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium inline-block">
                              {String(e.location_id || '—')}
                            </div>
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
              <tr className="text-left border-b-2 border-gray-200">
                <th className="py-3 px-2 font-semibold text-gray-700">Date</th>
                <th className="py-3 px-2 font-semibold text-gray-700">Time</th>
                <th className="py-3 px-2 font-semibold text-gray-700">Check-out Date</th>
                <th className="py-3 px-2 font-semibold text-gray-700">Check-out Time</th>
                <th className="py-3 px-2 font-semibold text-gray-700">Location</th>
                <th className="py-3 px-2 font-semibold text-gray-700">Device</th>
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500">
                    No login history available
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => (
                  <tr key={shift.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-800">
                      {shift.check_in_date || '—'}
                    </td>
                    <td className="py-3 px-2 text-gray-700">
                      {shift.check_in_time_12h || '—'}
                    </td>
                    <td className="py-3 px-2 font-medium text-gray-800">
                      {shift.check_out_date || '—'}
                    </td>
                    <td className="py-3 px-2 text-gray-700">
                      {shift.check_out_time_12h || '—'}
                    </td>
                    <td className="py-3 px-2">
                      <div className="space-y-1">
                        {shift.check_in_location_name ? (
                          <div className="text-blue-600 font-medium">{shift.check_in_location_name}</div>
                        ) : shift.check_in_lat && shift.check_in_lng ? (
                          <div>
                            <div className="text-gray-600 text-xs mb-1">Coordinates:</div>
                            <a 
                              href={getGoogleMapsUrl(shift.check_in_lat, shift.check_in_lng)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-xs underline"
                            >
                              View on Google Maps
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                        
                        {shift.check_out_time && (
                          shift.check_out_location_name ? (
                            <div className="text-green-600 font-medium text-xs">Out: {shift.check_out_location_name}</div>
                          ) : shift.check_out_lat && shift.check_out_lng ? (
                            <div className="text-xs">
                              <a 
                                href={getGoogleMapsUrl(shift.check_out_lat, shift.check_out_lng)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline"
                              >
                                View on Google Maps
                              </a>
                            </div>
                          ) : null
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-center">
                        <DeviceIcon deviceType={shift.device_type} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}