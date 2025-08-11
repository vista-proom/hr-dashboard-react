import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api';
import Card from '../../components/Card';

const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  // Convert to Saturday=0..Friday=6
  const shift = (day + 1) % 7; // Sun->1, Sat->0
  const diff = shift; // days since Saturday
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  return start;
}

function formatDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  // Saturday first
  return days[(d.getDay() + 1) % 7];
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${formatDay(dateStr)} ${d.getDate()}/${d.getMonth()+1}`;
}

function to12h(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const am = h < 12;
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m ?? 0).padStart(2,'0')} ${am ? 'AM' : 'PM'}`;
}

export default function AssignShifts() {
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ userId: '', date: '', startTime: '', endTime: '', hours: 8, locationId: '', kind: 'Work' });
  const [newLocation, setNewLocation] = useState({ name: '', googleMapsUrl: '' });
  const [serverSchedules, setServerSchedules] = useState([]);
  const [pendingEntries, setPendingEntries] = useState([]);
  const [editingWeekKey, setEditingWeekKey] = useState(null);
  const [editingMap, setEditingMap] = useState({}); // id -> edited fields

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

  const clearCurrent = () => {
    setForm((f) => ({ ...f, date: '', startTime: '', endTime: '', hours: 8, locationId: '', kind: 'Work' }));
    setPendingEntries([]);
  };

  const saveShift = async () => {
    if (!form.userId || !form.date) return;
    await api.post('/schedules', { userId: Number(form.userId), date: form.date, startTime: form.startTime, endTime: form.endTime, hours: Number(form.hours), locationId: form.locationId ? Number(form.locationId) : null, kind: form.kind });
    setPendingEntries([]);
    await loadPreview(form.userId);
    clearCurrent();
  };

  const saveSchedule = async () => {
    // publish all drafts for the user
    await api.post(`/schedules/publish/${form.userId}`);
    await loadPreview(form.userId);
  };

  const resetSchedule = async () => {
    setPendingEntries([]);
    setServerSchedules([]);
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
      hours: Number(form.hours) || null,
      location_id: form.locationId ? Number(form.locationId) : null,
      kind: form.kind,
      pending: true,
    };
    setPendingEntries([entry]);
  }, [form.userId, form.date, form.startTime, form.endTime, form.hours, form.locationId, form.kind]);

  // month filter (current month, include overlapping weeks)
  const currentMonth = new Date().getMonth();
  const inCurrentMonth = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getMonth() === currentMonth;
  };

  const allForPreview = useMemo(() => {
    const base = serverSchedules.filter((s) => String(s.user_id) === String(form.userId));
    const pending = pendingEntries.filter((s) => String(s.user_id) === String(form.userId));
    return [...base, ...pending];
  }, [serverSchedules, pendingEntries, form.userId]);

  const weeks = useMemo(() => {
    // group by week start (Saturday)
    const map = new Map();
    for (const s of allForPreview) {
      const wkStart = getWeekStart(s.date);
      const key = wkStart.toISOString().slice(0,10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    // Only include weeks if any entry is in current month
    const filtered = Array.from(map.entries()).filter(([key, entries]) =>
      entries.some((e) => inCurrentMonth(e.date))
    );
    // sort weeks: newest first
    filtered.sort((a, b) => (a[0] < b[0] ? 1 : -1));
    // within week: sort days Saturday->Friday and time ascending
    return filtered.map(([key, entries]) => {
      const sorted = entries.slice().sort((a, b) => {
        const da = (new Date(a.date + 'T00:00:00').getDay() + 1) % 7;
        const db = (new Date(b.date + 'T00:00:00').getDay() + 1) % 7;
        if (da !== db) return da - db;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });
      return [key, sorted];
    });
  }, [allForPreview]);

  const getLocationName = (id) => locations.find((l) => l.id === id)?.name || '—';

  const removeEntry = async (entry) => {
    if (entry.pending) {
      setPendingEntries((p) => p.filter((e) => e.id !== entry.id));
    } else {
      await api.delete(`/schedules/${entry.id}`);
      setServerSchedules((s) => s.filter((x) => x.id !== entry.id));
    }
  };

  const removeDay = async (day, entries) => {
    const date = entries[0]?.date;
    if (date) await api.delete(`/schedules/user/${form.userId}/day/${date}`);
    setServerSchedules((s) => s.filter((x) => formatDay(x.date) !== day));
    setPendingEntries((p) => p.filter((x) => formatDay(x.date) !== day));
  };

  const totalHoursForDay = (entries, date) => entries.filter((e) => e.date === date).reduce((sum, e) => sum + (e.hours || 0), 0);

  const startEditWeek = (weekKey) => {
    setEditingWeekKey(weekKey);
    const map = {};
    for (const s of (weeks.find(([k]) => k === weekKey)?.[1] || [])) {
      if (!s.pending) map[s.id] = { ...s };
    }
    setEditingMap(map);
  };

  const cancelEditWeek = () => {
    setEditingWeekKey(null);
    setEditingMap({});
  };

  const submitEditWeek = async () => {
    const updates = Object.values(editingMap);
    for (const u of updates) {
      await api.put(`/schedules/${u.id}`, {
        date: u.date,
        startTime: u.start_time,
        endTime: u.end_time,
        hours: u.hours,
        locationId: u.location_id,
        kind: u.kind,
      });
    }
    setEditingWeekKey(null);
    setEditingMap({});
    await loadPreview(form.userId);
  };

  const setEdit = (id, field, value) => {
    setEditingMap((m) => ({ ...m, [id]: { ...m[id], [field]: value } }));
  };

  return (
    <div className="space-y-4">
      <Card title="Assign Shift">
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
            <input type="number" min={0} className="w-full border rounded px-3 py-2" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
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
          <button onClick={clearCurrent} className="bg-gray-600 text-white px-4 py-2 rounded">Clear</button>
        </div>
      </Card>

      <Card title="Add New Location">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1">Location Name</label>
            <input className="w-full border rounded px-3 py-2" value={newLocation.name} onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Google Maps URL</label>
            <input className="w-full border rounded px-3 py-2" value={newLocation.googleMapsUrl} onChange={(e) => setNewLocation({ ...newLocation, googleMapsUrl: e.target.value })} />
          </div>
        </div>
        <div className="mt-4"><button onClick={async () => {
          if (!newLocation.name) return;
          const { data } = await api.post('/locations', { name: newLocation.name, googleMapsUrl: newLocation.googleMapsUrl });
          setLocations((prev) => [...prev, data]);
          setNewLocation({ name: '', googleMapsUrl: '' });
        }} className="bg-gray-700 text-white px-4 py-2 rounded">Add Location</button></div>
      </Card>

      <Card title="Schedule Preview">
        <div className="text-sm text-gray-600 mb-2">Employee: {employees.find((e) => String(e.id) === String(form.userId))?.name || '—'}</div>
        <div className="space-y-4">
          {weeks.length === 0 && <div className="text-sm text-gray-500">No scheduled items this month.</div>}
          {weeks.map(([weekKey, entries]) => (
            <div key={weekKey} className="border rounded p-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">Week of {new Date(weekKey).toLocaleDateString()}</div>
                {editingWeekKey === weekKey ? (
                  <div className="space-x-2">
                    <button onClick={submitEditWeek} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Submit</button>
                    <button onClick={cancelEditWeek} className="bg-gray-600 text-white px-3 py-1 rounded text-sm">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => startEditWeek(weekKey)} className="text-sm text-blue-700">✎ Edit</button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {days.map((dayName) => {
                  const dayEntries = entries.filter((e) => formatDay(e.date) === dayName);
                  if (dayEntries.length === 0) return (
                    <div key={dayName} className="border rounded px-3 py-2 bg-gray-50 opacity-70">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm">{dayName}</div>
                        <span className="text-xs text-gray-500">0h</span>
                      </div>
                      <div className="text-xs text-gray-400">No shifts</div>
                    </div>
                  );
                  const anyPending = dayEntries.some((e) => e.pending);
                  const total = totalHoursForDay(entries, dayEntries[0].date);
                  return (
                    <div key={dayName} className={`border rounded px-3 py-2 ${anyPending ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} ${editingWeekKey === weekKey ? '' : 'opacity-70'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium">
                          {dayName} <span className="font-normal text-gray-600">{new Date(dayEntries[0].date).getDate()}/{new Date(dayEntries[0].date).getMonth()+1}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">{total}h</span>
                          <button className="text-red-600 text-sm" onClick={() => removeDay(dayName, dayEntries)}>x</button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {dayEntries.map((s) => (
                          <div key={`${dayName}-${s.id}`} className="flex items-center justify-between">
                            {editingWeekKey === weekKey && !s.pending ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input type="time" className="border rounded px-2 py-1 text-sm" value={editingMap[s.id]?.start_time || s.start_time || ''} onChange={(e) => setEdit(s.id, 'start_time', e.target.value)} />
                                <span className="text-xs text-gray-500">to</span>
                                <input type="time" className="border rounded px-2 py-1 text-sm" value={editingMap[s.id]?.end_time || s.end_time || ''} onChange={(e) => setEdit(s.id, 'end_time', e.target.value)} />
                                <select className="border rounded px-2 py-1 text-sm" value={editingMap[s.id]?.location_id || s.location_id || ''} onChange={(e) => setEdit(s.id, 'location_id', Number(e.target.value))}>
                                  <option value="">—</option>
                                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                                <input type="number" min={0} className="border rounded px-2 py-1 text-sm w-20" value={editingMap[s.id]?.hours ?? s.hours ?? 0} onChange={(e) => setEdit(s.id, 'hours', Number(e.target.value))} />
                                <select className="border rounded px-2 py-1 text-sm" value={editingMap[s.id]?.kind || s.kind || 'Work'} onChange={(e) => setEdit(s.id, 'kind', e.target.value)}>
                                  <option>Work</option>
                                  <option>DayOff</option>
                                  <option>Annual</option>
                                </select>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-700 flex-1">
                                <span className="font-medium">{to12h(s.start_time)} - {to12h(s.end_time)}</span>
                                <span className="text-xs text-gray-600 ml-2">{getLocationName(s.location_id)} • {s.kind}</span>
                              </div>
                            )}
                            <button className="text-red-600 ml-2" onClick={() => removeEntry(s)}>x</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveSchedule} className="bg-blue-600 text-white px-4 py-2 rounded">Save Schedule</button>
          <button onClick={resetSchedule} className="bg-gray-600 text-white px-4 py-2 rounded">Reset Schedule</button>
        </div>
      </Card>
    </div>
  );
}