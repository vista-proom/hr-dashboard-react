import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api';
import Card from '../../components/Card';

const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function formatDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return days[d.getDay()];
}

export default function AssignShifts() {
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ userId: '', date: '', startTime: '', endTime: '', hours: 8, locationId: '', kind: 'Work' });
  const [newLocation, setNewLocation] = useState({ name: '', googleMapsUrl: '' });
  const [serverSchedules, setServerSchedules] = useState([]);
  const [pendingEntries, setPendingEntries] = useState([]); // unsaved shifts

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

  const saveShift = async () => {
    if (!form.userId || !form.date) return;
    await api.post('/schedules', { userId: Number(form.userId), date: form.date, startTime: form.startTime, endTime: form.endTime, hours: Number(form.hours), locationId: form.locationId ? Number(form.locationId) : null, kind: form.kind });
    // Clear pending that matches this entry
    setPendingEntries((p) => p.filter((e) => !(e.userId === form.userId && e.date === form.date && e.startTime === form.startTime && e.endTime === form.endTime && e.locationId === form.locationId)));
    await loadPreview(form.userId);
  };

  const clearCurrent = () => {
    setForm((f) => ({ ...f, date: '', startTime: '', endTime: '', hours: 8, locationId: '', kind: 'Work' }));
    setPendingEntries([]);
  };

  const saveSchedule = async () => {
    // iterate over pending entries and save all
    for (const e of pendingEntries) {
      await api.post('/schedules', { userId: e.user_id, date: e.date, startTime: e.start_time, endTime: e.end_time, hours: e.hours, locationId: e.location_id, kind: e.kind });
    }
    setPendingEntries([]);
    await loadPreview(form.userId);
  };

  const resetSchedule = async () => {
    // Clear pending and server-loaded for the selected user
    setPendingEntries([]);
    setServerSchedules([]);
  };

  // When the manager is composing an entry, reflect it immediately in preview
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

  const allForPreview = useMemo(() => {
    const base = serverSchedules.filter((s) => String(s.user_id) === String(form.userId));
    const pending = pendingEntries.filter((s) => String(s.user_id) === String(form.userId));
    return [...base, ...pending];
  }, [serverSchedules, pendingEntries, form.userId]);

  const getLocationName = (id) => locations.find((l) => l.id === id)?.name || '—';

  const weekGrouped = useMemo(() => {
    const map = new Map();
    for (const s of allForPreview) {
      const day = formatDay(s.date);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(s);
    }
    for (const day of map.keys()) {
      map.get(day).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    }
    return Array.from(map.entries());
  }, [allForPreview]);

  const removeEntry = async (entry) => {
    if (entry.pending) {
      setPendingEntries((p) => p.filter((e) => e.id !== entry.id));
    } else {
      // Persist delete to backend and update local state
      await api.delete(`/schedules/${entry.id}`);
      setServerSchedules((s) => s.filter((x) => x.id !== entry.id));
    }
  };

  const removeDay = async (day) => {
    const entries = weekGrouped.find(([d]) => d === day)?.[1] || [];
    // If any non-pending entries exist, delete them in backend for the given date
    const date = entries[0]?.date;
    if (date) await api.delete(`/schedules/user/${form.userId}/day/${date}`);
    // Remove from both local server list and pending
    setServerSchedules((s) => s.filter((x) => formatDay(x.date) !== day));
    setPendingEntries((p) => p.filter((x) => formatDay(x.date) !== day));
  };

  const addLocation = async () => {
    if (!newLocation.name) return;
    const { data } = await api.post('/locations', { name: newLocation.name, googleMapsUrl: newLocation.googleMapsUrl });
    setLocations((prev) => [...prev, data]);
    setNewLocation({ name: '', googleMapsUrl: '' });
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
        <div className="mt-4"><button onClick={addLocation} className="bg-gray-700 text-white px-4 py-2 rounded">Add Location</button></div>
      </Card>

      <Card title="Schedule Preview">
        <div className="text-sm text-gray-600 mb-2">Employee: {employees.find((e) => String(e.id) === String(form.userId))?.name || '—'}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {weekGrouped.length === 0 && (
            <div className="text-sm text-gray-500">No scheduled items this week.</div>
          )}
          {weekGrouped.map(([day, entries]) => (
            <div key={day} className="border rounded p-3 bg-white">
              <div className="font-semibold mb-2 flex items-center justify-between">
                <span>{day}</span>
                <button className="text-red-600 text-sm" onClick={() => removeDay(day)}>x</button>
              </div>
              <div className="space-y-2">
                {entries.map((s) => (
                  <div key={`${day}-${s.id}`} className={`flex items-center justify-between px-3 py-2 rounded border ${s.pending ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="text-sm">
                      <div className="font-medium">{(s.start_time || '—')} - {(s.end_time || '—')}</div>
                      <div className="text-xs text-gray-600">{getLocationName(s.location_id)} • {s.kind} • {new Date(s.date).toLocaleDateString()}</div>
                    </div>
                    <button className="text-red-600" onClick={() => removeEntry(s)}>x</button>
                  </div>
                ))}
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