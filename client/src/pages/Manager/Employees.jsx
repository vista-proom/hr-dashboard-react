import React, { useEffect, useState } from 'react';
import api from '../../api';
import Card from '../../components/Card';

function EmployeeModal({ employee, onClose }) {
  const [shifts, setShifts] = useState([]);
  useEffect(() => {
    if (employee) {
      api.get(`/shifts/user/${employee.id}`).then((res) => setShifts(res.data));
    }
  }, [employee]);

  if (!employee) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg w-full max-w-2xl">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold">{employee.name}</div>
          <button onClick={onClose} className="text-sm">Close</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <img src={employee.avatarUrl} alt="avatar" className="w-14 h-14 rounded-full border" />
            <div className="text-sm">
              <div>{employee.name}</div>
              <div className="text-gray-500">{employee.email}</div>
              <div className="text-gray-400">ID: {employee.id}</div>
            </div>
          </div>
          <Card title="Shifts">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Check-In</th>
                    <th>In Location</th>
                    <th>Check-Out</th>
                    <th>Out Location</th>
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
      </div>
    </div>
  );
}

export default function Employees() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/users').then((res) => setUsers(res.data.filter((u) => u.role === 'Employee')));
  }, []);

  return (
    <div className="space-y-4">
      <Card title="Employees">
        <div className="divide-y">
          {users.map((u) => (
            <div key={u.id} className="py-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={u.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full border" />
                <div>
                  <button className="text-blue-700 underline" onClick={() => setSelected(u)}>{u.name}</button>
                  <div className="text-xs text-gray-500">ID: {u.id}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {selected && <EmployeeModal employee={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}