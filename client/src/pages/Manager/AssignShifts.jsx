import React, { useEffect, useState } from 'react';
import api from '../../api';
import Card from '../../components/Card';

export default function AssignShifts() {
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ userId: '', date: '', startTime: '', endTime: '', hours: 8, locationId: '', kind: 'Work' });
  const [newLocation, setNewLocation] = useState({ name: '', googleMapsUrl: '' });

  useEffect(() => {
    const run = async () => {
      const [u, l] = await Promise.all([api.get('/users'), api.get('/locations')]);
      setEmployees(u.data.filter((x) => x.role === 'Employee'));
      setLocations(l.data);
    };
    run();
  }, []);

  const save = async () => {
    await api.post('/schedules', { userId: Number(form.userId), date: form.date, startTime: form.startTime, endTime: form.endTime, hours: Number(form.hours), locationId: form.locationId ? Number(form.locationId) : null, kind: form.kind });
    alert('Schedule saved');
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
    </div>
  );
}