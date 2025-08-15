import React, { useEffect, useState } from 'react';
import api from '../../api';
import Card from '../../components/Card';

function EmployeeModal({ employee, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/users/${employee.id}/comprehensive`);
      setDetails(res.data);
    } catch (err) {
      console.error('Error fetching employee details:', err);
      setError('Failed to load employee details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employee) {
      refresh();
    }
  }, [employee]);

  const updateTask = async (taskId, fields) => {
    try {
      await api.put(`/tasks/${taskId}`, fields);
      setHasChanges(true);
      await refresh();
    } catch (err) {
      console.error('Error updating task:', err);
      alert('Failed to update task. Please try again.');
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await api.delete(`/tasks/${taskId}`);
      setHasChanges(true);
      await refresh();
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('Failed to delete task. Please try again.');
    }
  };

  const deleteShift = async (shiftId) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;
    
    try {
      await api.delete(`/shifts/${shiftId}`);
      setHasChanges(true);
      await refresh();
    } catch (err) {
      console.error('Error deleting shift:', err);
      alert('Failed to delete shift. Please try again.');
    }
  };

  const exportToExcel = () => {
    if (!details) return;
    
    // Create CSV content for login history
    const csvContent = [
      ['Employee', 'Date', 'Check In', 'Check Out', 'Location'],
      ...details.shifts.map(shift => [
        details.name,
        shift.check_in_date || 'N/A',
        shift.check_in_time_12h || 'N/A',
        shift.check_out_time_12h || 'N/A',
        shift.check_in_location_name || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${details.name}_${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}_login_history.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!hasChanges) return;
    
    try {
      // Refresh to get latest data
      await refresh();
      setHasChanges(false);
      alert('Changes saved successfully!');
    } catch (err) {
      console.error('Error saving changes:', err);
      alert('Failed to save changes. Please try again.');
    }
  };

  const handleClickOutside = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!employee) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleClickOutside}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg">
          <div className="flex items-center gap-3">
            <img 
              src={details?.profileUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.name)}&background=random`} 
              alt="avatar" 
              className="w-12 h-12 rounded-full border-2 border-gray-200" 
            />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{employee.name}</h2>
              <p className="text-sm text-gray-600">ID: {employee.id}</p>
            </div>
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

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading employee details...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                  <button 
                    onClick={refresh}
                    className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {details && !loading && (
            <>
              {/* Current Status */}
              <Card title="Current Status">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${details.currentStatus === 'In' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="font-medium">
                      {details.currentStatus} - {details.currentLocation}
                    </span>
                  </div>
                  {details.lastCheckIn && (
                    <span className="text-sm text-gray-600">
                      Since: {new Date(details.lastCheckIn).toLocaleString()}
                    </span>
                  )}
                </div>
              </Card>

              {/* Hours Summary */}
              <Card title="Hours This Month">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{details.totalHoursScheduled}</div>
                    <div className="text-sm text-blue-800">Hours Scheduled</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{details.totalHoursWorked}</div>
                    <div className="text-sm text-green-800">Hours Worked</div>
                  </div>
                </div>
                <button 
                  onClick={exportToExcel}
                  className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Export to Excel - {details.name} {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </button>
              </Card>

              {/* Tasks */}
              <Card title="Assigned Tasks">
                <div className="space-y-3">
                  {details.tasks && details.tasks.length > 0 ? (
                    details.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <input 
                          defaultValue={task.name || ''} 
                          onBlur={(e) => updateTask(task.id, { name: e.target.value })} 
                          className="border rounded px-3 py-2 w-48 text-sm" 
                          placeholder="Task name" 
                        />
                        <input 
                          defaultValue={task.description} 
                          onBlur={(e) => updateTask(task.id, { description: e.target.value })} 
                          className="border rounded px-3 py-2 flex-1 text-sm" 
                          placeholder="Description"
                        />
                        <input 
                          type="date" 
                          defaultValue={task.dueDate ? task.dueDate.substring(0,10) : ''} 
                          onChange={(e) => updateTask(task.id, { dueDate: e.target.value })} 
                          className="border rounded px-3 py-2 text-sm" 
                        />
                        <select 
                          defaultValue={task.status} 
                          className="border rounded px-3 py-2 text-sm" 
                          onChange={(e) => updateTask(task.id, { status: e.target.value })}
                        >
                          <option>Assigned</option>
                          <option>In Progress</option>
                          <option>Done</option>
                        </select>
                        <button 
                          onClick={() => deleteTask(task.id)} 
                          className="text-red-600 hover:text-red-800 p-2"
                          title="Delete task"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">No tasks assigned</div>
                  )}
                </div>
              </Card>

              {/* Shifts */}
              <Card title="Assigned Shifts">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-gray-200">
                        <th className="py-3 px-2 font-medium text-gray-700">Date</th>
                        <th className="py-3 px-2 font-medium text-gray-700">Check In</th>
                        <th className="py-3 px-2 font-medium text-gray-700">Check Out</th>
                        <th className="py-3 px-2 font-medium text-gray-700">Location</th>
                        <th className="py-3 px-2 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.shifts && details.shifts.length > 0 ? (
                        details.shifts.map((shift) => (
                          <tr key={shift.id} className="border-b border-gray-100 last:border-0">
                            <td className="py-3 px-2">{shift.check_in_date || 'N/A'}</td>
                            <td className="py-3 px-2">{shift.check_in_time_12h || 'N/A'}</td>
                            <td className="py-3 px-2">{shift.check_out_time_12h || 'N/A'}</td>
                            <td className="py-3 px-2">{shift.check_in_location_name || 'N/A'}</td>
                            <td className="py-3 px-2">
                              <div className="flex gap-2">
                                <button 
                                  className="text-blue-600 hover:text-blue-800 p-1"
                                  title="Edit shift"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => deleteShift(shift.id)} 
                                  className="text-red-600 hover:text-red-800 p-1"
                                  title="Delete shift"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="py-4 text-center text-gray-500">No shifts found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!hasChanges}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              hasChanges 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Submit Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Employees() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const refresh = async () => {
      const res = await api.get('/users');
      setUsers(res.data.filter((u) => u.role === 'Employee'));
    };
    refresh();
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