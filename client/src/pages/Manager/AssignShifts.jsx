import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../api';
import Card from '../../components/Card';

const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const shift = (day + 1) % 7; // Saturday=0
  const start = new Date(d);
  start.setDate(d.getDate() - shift);
  return start;
}

function formatDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return days[(d.getDay() + 1) % 7];
}

function to12h(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const am = h < 12;
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m ?? 0).padStart(2,'0')} ${am ? 'AM' : 'PM'}`;
}

function minutesBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60; // cross midnight
  return diff;
}

export default function AssignShifts() {
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ userId: '', date: '', startTime: '', endTime: '', hours: 0, locationId: '', kind: 'Work' });
  const [serverSchedules, setServerSchedules] = useState([]);
  const [pendingEntries, setPendingEntries] = useState([]);
  const [editingWeekKey, setEditingWeekKey] = useState(null);
  const [editingMap, setEditingMap] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [modalWeekKey, setModalWeekKey] = useState(null);
  const [draftByWeek, setDraftByWeek] = useState({});
  const [toast, setToast] = useState({ show: false, text: '' });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [newLocation, setNewLocation] = useState({ name: '', googleMapsUrl: '', latitude: '', longitude: '' });
  const modalContentRef = useRef(null);

  useEffect(() => {
    const run = async () => {
      const [u, l] = await Promise.all([api.get('/users'), api.get('/locations')]);
      const emps = u.data.filter((x) => x.role === 'Employee');
      setEmployees(emps);
      setLocations(l.data);
      if (emps.length && !form.userId) setForm((f) => ({ ...f, userId: String(emps[0].id) }));
    };
    run();
  }, []);

  const loadPreview = async (userId) => {
    if (!userId) return;
    const { data } = await api.get(`/schedules/user/${userId}`);
    setServerSchedules(data);
  };
  useEffect(() => { loadPreview(form.userId); }, [form.userId]);

  // auto-calc hours display
  const computedMinutes = useMemo(() => minutesBetween(form.startTime, form.endTime), [form.startTime, form.endTime]);
  const computedHoursLabel = useMemo(() => `${Math.floor(computedMinutes/60)}h ${computedMinutes%60}m`, [computedMinutes]);
  useEffect(() => {
    // store rounded hours for backend
    setForm((f) => ({ ...f, hours: Math.round(computedMinutes/60) }));
  }, [computedMinutes]);

  // load draft for current user & current week only
  useEffect(() => {
    const load = async () => {
      if (!form.userId) return;
      const todayKey = getWeekStart(new Date().toISOString().slice(0,10)).toISOString().slice(0,10);
      try {
        const { data } = await api.get(`/schedules/draft/${form.userId}/${todayKey}`);
        setDraftByWeek((m) => ({ ...m, [todayKey]: data }));
      } catch {}
    };
    load();
  }, [form.userId]);

  const clearCurrent = () => {
    setForm((f) => ({ ...f, date: '', startTime: '', endTime: '', locationId: '', kind: 'Work' }));
    setPendingEntries([]);
  };

  const showToast = (text) => {
    setToast({ show: true, text });
    setTimeout(() => setToast({ show: false, text: '' }), 10000);
  };

  const saveShift = async () => {
    if (!form.userId || !form.date) return;
    await api.post('/schedules', { userId: Number(form.userId), date: form.date, startTime: form.startTime, endTime: form.endTime, hours: Math.round(computedMinutes/60), locationId: form.locationId ? Number(form.locationId) : null, kind: form.kind });
    setPendingEntries([]);
    await loadPreview(form.userId);
    clearCurrent();
    showToast('Shift Added Successfully');
  };

  const saveDraftWeek = async (weekKey) => {
    const entries = draftByWeek[weekKey] || [];
    await api.post('/schedules/draft', { userId: Number(form.userId), weekStart: weekKey, entries });
  };

  const openSaveModal = () => {
    const todayKey = getWeekStart(new Date().toISOString().slice(0,10)).toISOString().slice(0,10);
    setModalWeekKey(todayKey);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setModalWeekKey(null); };

  const publishModalWeek = async () => {
    if (!modalWeekKey) return;
    await saveDraftWeek(modalWeekKey);
    await api.post('/schedules/finalize', { userId: Number(form.userId), weekStart: modalWeekKey });
    await loadPreview(form.userId);
    setDraftByWeek((m) => { const n = { ...m }; delete n[modalWeekKey]; return n; });
    closeModal();
    showToast('Schedule Confirmed and Published to Employee');
  };

  // live pending reflection
  useEffect(() => {
    if (!form.userId || !form.date) return;
    const entry = {
      id: `pending-${form.userId}-${form.date}-${form.startTime}-${form.endTime}-${form.locationId}-${form.kind}`,
      user_id: Number(form.userId),
      date: form.date,
      start_time: form.startTime || null,
      end_time: form.endTime || null,
      hours: Math.round(computedMinutes/60),
      location_id: form.locationId ? Number(form.locationId) : null,
      kind: form.kind,
      pending: true,
    };
    setPendingEntries([entry]);
  }, [form.userId, form.date, form.startTime, form.endTime, form.locationId, form.kind, computedMinutes]);

  // Get current week only
  const currentWeekKey = useMemo(() => {
    return getWeekStart(new Date().toISOString().slice(0,10)).toISOString().slice(0,10);
  }, []);

  // Week data - only current week
  const allForPreview = useMemo(() => {
    const base = serverSchedules.filter((s) => String(s.user_id) === String(form.userId));
    const pending = pendingEntries.filter((s) => String(s.user_id) === String(form.userId));
    return [...base, ...pending];
  }, [serverSchedules, pendingEntries, form.userId]);

  const currentWeekEntries = useMemo(() => {
    const filtered = allForPreview.filter((e) => {
      const entryWeekKey = getWeekStart(e.date).toISOString().slice(0,10);
      return entryWeekKey === currentWeekKey;
    });
    
    return filtered.sort((a, b) => {
      const da = (new Date(a.date + 'T00:00:00').getDay() + 1) % 7;
      const db = (new Date(b.date + 'T00:00:00').getDay() + 1) % 7;
      if (da !== db) return da - db;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
  }, [allForPreview, currentWeekKey]);

  // Live hours calculation
  const liveTotalHours = useMemo(() => {
    return currentWeekEntries.reduce((total, entry) => {
      if (entry.start_time && entry.end_time) {
        return total + minutesBetween(entry.start_time, entry.end_time);
      }
      return total;
    }, 0);
  }, [currentWeekEntries]);

  const liveLocationHours = useMemo(() => {
    const locationMap = new Map();
    currentWeekEntries.forEach(entry => {
      if (entry.start_time && entry.end_time && entry.location_id) {
        const minutes = minutesBetween(entry.start_time, entry.end_time);
        const current = locationMap.get(entry.location_id) || 0;
        locationMap.set(entry.location_id, current + minutes);
      }
    });
    return locationMap;
  }, [currentWeekEntries]);

  const getLocationName = (id) => locations.find((l) => l.id === id)?.name || '—';

  const removeEntry = async (entry) => {
    if (entry.pending) {
      setPendingEntries((p) => p.filter((e) => e.id !== entry.id));
    } else if (entry.is_draft === 1) {
      const wk = getWeekStart(entry.date).toISOString().slice(0,10);
      setDraftByWeek((m) => ({ ...m, [wk]: (m[wk] || []).filter((e) => e.tempId !== entry.tempId && !(e.date === entry.date && e.start_time === entry.start_time && e.end_time === entry.end_time && e.location_id === entry.location_id)) }));
      await saveDraftWeek(wk);
    } else {
      await api.delete(`/schedules/${entry.id}`);
      setServerSchedules((s) => s.filter((x) => x.id !== entry.id));
    }
  };

  const removeDay = async (day, entries) => {
    // for drafts
    const wk = entries[0] ? getWeekStart(entries[0].date).toISOString().slice(0,10) : null;
    if (wk && entries.some((e) => e.is_draft === 1)) {
      setDraftByWeek((m) => ({ ...m, [wk]: (m[wk] || []).filter((e) => formatDay(e.date) !== day) }));
      await saveDraftWeek(wk);
    }
    // for pending
    setPendingEntries((p) => p.filter((x) => formatDay(x.date) !== day));
    // for live
    if (entries.some((e) => !e.pending && e.is_draft !== 1)) {
      const date = entries.find((e) => !e.pending && e.is_draft !== 1)?.date;
      if (date) await api.delete(`/schedules/user/${form.userId}/day/${date}`);
      setServerSchedules((s) => s.filter((x) => formatDay(x.date) !== day));
    }
  };

  const totalMinutesForDay = (entries, date) => entries.filter((e) => e.date === date).reduce((sum, e) => sum + minutesBetween(e.start_time, e.end_time), 0);

  const startEditWeek = (weekKey) => {
    setEditingWeekKey(weekKey);
    const map = {};
    const entries = getWeekEntries(weekKey);
    for (const s of entries) {
      if (!s.pending) map[s.id || s.tempId || `${s.date}-${s.start_time}`] = { ...s };
    }
    setEditingMap(map);
  };

  const cancelEditWeek = () => { setEditingWeekKey(null); setEditingMap({}); };

  const submitEditWeek = async () => {
    for (const key of Object.keys(editingMap)) {
      const u = editingMap[key];
      if (u.is_draft === 1 && !u.id) {
        const wk = getWeekStart(u.date).toISOString().slice(0,10);
        setDraftByWeek((m) => ({ ...m, [wk]: (m[wk] || []).map((e) => (e.tempId === u.tempId ? u : e)) }));
        await saveDraftWeek(wk);
      } else if (u.id) {
        await api.put(`/schedules/${u.id}`, { date: u.date, startTime: u.start_time, endTime: u.end_time, hours: Math.round(minutesBetween(u.start_time, u.end_time)/60), locationId: u.location_id, kind: u.kind });
      }
    }
    setEditingWeekKey(null); setEditingMap({}); await loadPreview(form.userId);
  };

  const setEdit = (id, field, value) => { setEditingMap((m) => ({ ...m, [id]: { ...m[id], [field]: value } })); };

  const getWeekEntries = (weekKey) => {
    const serverEntries = currentWeekEntries.filter(e => getWeekStart(e.date).toISOString().slice(0,10) === weekKey);
    const draftEntries = draftByWeek[weekKey] || [];
    return [...serverEntries, ...draftEntries.map((e, idx) => ({ ...e, is_draft: 1, tempId: idx }))];
  };

  const downloadPDF = () => {
    if (!modalContentRef.current) return;
    const html = modalContentRef.current.innerHTML;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Schedule</title><style>body{font-family:sans-serif;padding:16px} table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #e5e7eb;padding:6px;text-align:left} .title{font-weight:600;margin-bottom:8px}</style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  // Location management
  const addLocation = async () => {
    if (!newLocation.name) return;
    
    try {
      const { data } = await api.post('/locations', {
        name: newLocation.name,
        googleMapsUrl: newLocation.googleMapsUrl,
        latitude: newLocation.latitude ? parseFloat(newLocation.latitude) : null,
        longitude: newLocation.longitude ? parseFloat(newLocation.longitude) : null
      });
      
      setLocations(prev => [...prev, data]);
      setNewLocation({ name: '', googleMapsUrl: '', latitude: '', longitude: '' });
      setShowLocationModal(false);
      showToast('Location Added Successfully');
    } catch (error) {
      showToast('Failed to add location');
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setNewLocation(prev => ({
            ...prev,
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6)
          }));
        },
        () => showToast('Unable to get current location'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  return (
    <div className="space-y-4">
      {toast.show && (
        <div className="fixed top-4 right-4 bg-green-100 text-gray-700 px-4 py-2 rounded shadow z-50">
          <div>{toast.text}</div>
          <div className="h-1 bg-green-500 mt-2 animate-[grow_10s_linear_forwards]" style={{ width: '100%' }} />
          <style>{`@keyframes grow{from{width:0}to{width:100%}}`}</style>
        </div>
      )}

      <Card title="Assign Shift" actions={
        <button 
          onClick={() => setShowLocationModal(true)}
          className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition-colors"
        >
          Add Location
        </button>
      }>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1">Employee</label>
            <select className="w-full border rounded px-3 py-2" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">Select employee</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.email})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Date</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Working Hours</label>
            <input className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600" value={computedHoursLabel} disabled readOnly />
          </div>
          <div>
            <label className="block text-sm mb-1">Start Time</label>
            <input type="time" className="w-full border rounded px-3 py-2" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">End Time</label>
            <input type="time" className="w-full border rounded px-3 py-2" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Location</label>
            <select className="w-full border rounded px-3 py-2" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
              <option value="">Select location</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Kind</label>
            <select className="w-full border rounded px-3 py-2" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="Work">Work</option>
              <option value="DayOff">Day Off</option>
              <option value="Annual">Annual</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={saveShift} className="bg-blue-600 text-white px-4 py-2 rounded">Save Shift</button>
          <button onClick={clearCurrent} className="bg-gray-600 text-white px-3 py-2 rounded">Clear</button>
        </div>
      </Card>

      <Card title="Schedule Preview - Current Week Only">
        <div className="text-sm text-gray-600 mb-2">Employee: {employees.find((e) => String(e.id) === String(form.userId))?.name || '—'}</div>
        
        {/* Live Hours Counter */}
        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-blue-800 mb-2">Live Weekly Summary</h4>
              <p className="text-sm text-blue-700">
                Total Working Hours: <span className="font-semibold">{Math.floor(liveTotalHours/60)}h {liveTotalHours%60}m</span>
              </p>
            </div>
            <div>
              <h4 className="font-medium text-blue-800 mb-2">Hours by Location</h4>
              {Array.from(liveLocationHours.entries()).map(([locationId, minutes]) => (
                <p key={locationId} className="text-sm text-blue-700">
                  {getLocationName(locationId)}: <span className="font-semibold">{Math.floor(minutes/60)}h {minutes%60}m</span>
                </p>
              ))}
              {liveLocationHours.size === 0 && (
                <p className="text-sm text-blue-700 italic">No locations assigned yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {currentWeekEntries.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-8">No scheduled items for this week.</div>
          ) : (
            <div className="border rounded p-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">Week of {new Date(currentWeekKey).toLocaleDateString()}</div>
                {editingWeekKey === currentWeekKey ? (
                  <div className="space-x-2">
                    <button onClick={submitEditWeek} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Submit</button>
                    <button onClick={cancelEditWeek} className="bg-gray-600 text-white px-3 py-1 rounded text-sm">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => startEditWeek(currentWeekKey)} className="text-sm text-blue-700">✎ Edit</button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {days.map((dayName) => {
                  const dayEntries = currentWeekEntries.filter((e) => formatDay(e.date) === dayName);
                  const totalMin = dayEntries.length ? totalMinutesForDay(dayEntries, dayEntries[0].date) : 0;
                  return (
                    <div key={dayName} className={`border rounded px-3 py-2 ${dayEntries.some((e) => e.pending || e.is_draft === 1) ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} ${editingWeekKey === currentWeekKey ? '' : 'opacity-70'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium">
                          {dayName} <span className="font-normal text-gray-600">{dayEntries[0] ? new Date(dayEntries[0].date).getDate()+'/'+(new Date(dayEntries[0].date).getMonth()+1) : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">{Math.floor(totalMin/60)}h {totalMin%60}m</span>
                          {editingWeekKey === currentWeekKey && (
                            <button className="text-red-600 text-sm" onClick={() => removeDay(dayName, dayEntries)}>x</button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        {dayEntries.map((s, idx) => (
                          <div key={`${dayName}-${idx}`} className="flex items-center justify-between">
                            {editingWeekKey === currentWeekKey && !s.pending ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input type="time" className="border rounded px-2 py-1 text-sm" value={editingMap[s.id || s.tempId]?.start_time || s.start_time || ''} onChange={(e) => setEdit(s.id || s.tempId, 'start_time', e.target.value)} />
                                <span className="text-xs text-gray-500">to</span>
                                <input type="time" className="border rounded px-2 py-1 text-sm" value={editingMap[s.id || s.tempId]?.end_time || s.end_time || ''} onChange={(e) => setEdit(s.id || s.tempId, 'end_time', e.target.value)} />
                                <select className="border rounded px-2 py-1 text-sm" value={editingMap[s.id || s.tempId]?.location_id || s.location_id || ''} onChange={(e) => setEdit(s.id || s.tempId, 'location_id', Number(e.target.value))}>
                                  <option value="">—</option>
                                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                                <select className="border rounded px-2 py-1 text-sm" value={editingMap[s.id || s.tempId]?.kind || s.kind || 'Work'} onChange={(e) => setEdit(s.id || s.tempId, 'kind', e.target.value)}>
                                  <option>Work</option>
                                  <option>DayOff</option>
                                  <option>Annual</option>
                                </select>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-700 flex-1">
                                <span className="font-medium">{to12h(s.start_time)} - {to12h(s.end_time)}</span>
                                <span className="text-xs text-gray-600 ml-2">{getLocationName(s.location_id)} • {s.kind}</span>
                                {/* Draft Indicator */}
                                {(s.pending || s.is_draft === 1) && (
                                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                                    Draft
                                  </span>
                                )}
                              </div>
                            )}
                            {editingWeekKey === currentWeekKey && (
                              <button className="text-red-600 ml-2" onClick={() => removeEntry(s)}>x</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={openSaveModal} className="bg-blue-600 text-white px-4 py-2 rounded">Save Schedule</button>
          <button onClick={() => { setPendingEntries([]); }} className="bg-gray-600 text-white px-3 py-2 rounded">Reset Schedule</button>
        </div>
      </Card>

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowLocationModal(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded shadow-xl w-full max-w-md">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="font-semibold">Add New Location</div>
                <button onClick={() => setShowLocationModal(false)} className="text-sm">Close</button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm mb-1">Location Name *</label>
                  <input 
                    type="text" 
                    className="w-full border rounded px-3 py-2" 
                    value={newLocation.name} 
                    onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                    placeholder="e.g., Main Office, Warehouse A"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Google Maps URL (optional)</label>
                  <input 
                    type="url" 
                    className="w-full border rounded px-3 py-2" 
                    value={newLocation.googleMapsUrl} 
                    onChange={(e) => setNewLocation({...newLocation, googleMapsUrl: e.target.value})}
                    placeholder="https://maps.google.com/..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1">Latitude</label>
                    <input 
                      type="number" 
                      step="any"
                      className="w-full border rounded px-3 py-2" 
                      value={newLocation.latitude} 
                      onChange={(e) => setNewLocation({...newLocation, latitude: e.target.value})}
                      placeholder="40.7128"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Longitude</label>
                    <input 
                      type="number" 
                      step="any"
                      className="w-full border rounded px-3 py-2" 
                      value={newLocation.longitude} 
                      onChange={(e) => setNewLocation({...newLocation, longitude: e.target.value})}
                      placeholder="-74.0060"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={getCurrentLocation}
                    className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition-colors"
                  >
                    Get Current Location
                  </button>
                  <button 
                    onClick={addLocation}
                    disabled={!newLocation.name}
                    className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed ml-auto"
                  >
                    Add Location
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded shadow-xl w-full max-w-4xl max-h-[85vh] overflow-auto">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="font-semibold">Confirm Schedule — Week of {modalWeekKey && new Date(modalWeekKey).toLocaleDateString()}</div>
                <button onClick={closeModal} className="text-sm">Close</button>
              </div>
              <div className="p-4 space-y-4" ref={modalContentRef}>
                <Card title="Week Summary">
                  {/* summary computed from entries of modal week */}
                  <div className="text-sm">Total hours: <span className="font-semibold">{(() => { const entries = getWeekEntries(modalWeekKey)||[]; const total = entries.reduce((sum,e)=> sum+minutesBetween(e.start_time,e.end_time),0); return `${Math.floor(total/60)}h ${total%60}m`; })()}</span></div>
                  <div className="mt-2 text-sm">
                    <div className="font-medium mb-1">By location</div>
                    <ul className="list-disc pl-5">
                      {(() => { const entries = getWeekEntries(modalWeekKey)||[]; const by = {}; entries.forEach(e=>{ const n=getLocationName(e.location_id); by[n]=(by[n]||0)+minutesBetween(e.start_time,e.end_time);}); const keys=Object.keys(by); return keys.length? keys.map(k=> <li key={k}>{k}: {Math.floor(by[k]/60)}h {by[k]%60}m</li>) : <li className="list-none text-gray-500">No locations</li>; })()}
                    </ul>
                  </div>
                </Card>
                <Card title="Schedule Table">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="py-2">Day</th>
                          <th>Time</th>
                          <th>Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {days.map((d) => (
                          <tr key={d} className="border-b last:border-0 align-top">
                            <td className="py-2 w-32">{d}</td>
                            <td className="w-64">
                              <div className="space-y-1">
                                {(() => { const dayEntries=(getWeekEntries(modalWeekKey)||[]).filter(e=> formatDay(e.date)===d).sort((a,b)=>(a.start_time||'').localeCompare(b.start_time||'')); return dayEntries.length? dayEntries.map((e,idx)=> <div key={idx}>{to12h(e.start_time)} - {to12h(e.end_time)}</div>): <span className="text-xs text-gray-500">—</span>; })()}
                              </div>
                            </td>
                            <td>
                              <div className="space-y-1">
                                {(() => { const dayEntries=(getWeekEntries(modalWeekKey)||[]).filter(e=> formatDay(e.date)===d).sort((a,b)=>(a.start_time||'').localeCompare(b.start_time||'')); return dayEntries.map((e,idx)=> <div key={idx} className="px-2 py-1 bg-gray-100 rounded inline-block">{getLocationName(e.location_id)||'—'}</div>); })()}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
              <div className="px-4 pb-4 flex items-center gap-3">
                <button onClick={publishModalWeek} className="bg-green-600 text-white px-4 py-2 rounded">Confirm / Submit</button>
                <button onClick={closeModal} className="bg-gray-600 text-white px-3 py-2 rounded">Cancel</button>
                <button onClick={downloadPDF} className="bg-gray-800 text-white px-3 py-2 rounded ml-auto">Download as PDF</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}