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
  const [previewUserId, setPreviewUserId] = useState('');
  const [serverSchedules, setServerSchedules] = useState([]);
  const [pendingEntries, setPendingEntries] = useState([]); // unsaved shifts

  useEffect(() => {
    const run = async () => {
      const [u, l] = await Promise.all([api.get('/users'), api.get('/locations')]);
      const emps = u.data.filter((x) => x.role === 'Employee');
      setEmployees(emps);
      setLocations(l.data);
      if (emps.length && !previewUserId) setPreviewUserId(String(emps[0].id));
    };
    run();
  }, []);

  const loadPreview = async (userId) => {
    if (!userId) return;
    const { data } = await api.get(`/schedules/user/${userId}`);
    setServerSchedules(data);
  };

  useEffect(() => { loadPreview(previewUserId); }, [previewUserId]);

  const save = async () => {
    if (!form.userId || !form.date) return;
    const created = await api.post('/schedules', { userId: Number(form.userId), date: form.date, startTime: form.startTime, endTime: form.endTime, hours: Number(form.hours), locationId: form.locationId ? Number(form.locationId) : null, kind: form.kind });
    // Clear pending that matches this entry
    setPendingEntries((p) => p.filter((e) => !(e.userId === form.userId && e.date === form.date && e.startTime === form.startTime && e.endTime === form.endTime && e.locationId === form.locationId)));
    await loadPreview(form.userId);
    alert('Schedule saved');
  };

  const addLocation = async () => {
    if (!newLocation.name) return;
    const { data } = await api.post('/locations', { name: newLocation.name, googleMapsUrl: newLocation.googleMapsUrl });
    setLocations((prev) => [...prev, data]);
    setNewLocation({ name: '', googleMapsUrl: '' });
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
    const base = serverSchedules.filter((s) => String(s.user_id) === String(previewUserId));
    const pending = pendingEntries.filter((s) => String(s.user_id) === String(previewUserId));
    return [...base, ...pending];
  }, [serverSchedules, pendingEntries, previewUserId]);

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
          <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded">Save Schedule</button>
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

      <Card title="Schedule Preview" actions={
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Employee</span>
          <select className="border rounded px-2 py-1" value={previewUserId} onChange={(e) => setPreviewUserId(e.target.value)}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      }>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {weekGrouped.length === 0 && (
            <div className="text-sm text-gray-500">No scheduled items this week.</div>
          )}
          {weekGrouped.map(([day, entries]) => (
            <div key={day} className="border rounded p-3 bg-white">
              <div className="font-semibold mb-2">{day}</div>
              <div className="space-y-2">
                {entries.map((s) => (
                  <div key={`${day}-${s.id}`} className={`flex items-center justify-between px-3 py-2 rounded border ${s.pending ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="text-sm">
                      <div className="font-medium">{(s.start_time || '—')} - {(s.end_time || '—')}</div>
                      <div className="text-xs text-gray-600">{getLocationName(s.location_id)} • {s.kind}</div>
                    </div>
                    {s.pending && <span className="text-xs text-blue-700">Pending</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}