import React, { useState, useEffect } from 'react';
import api from '../../api';
import Card from '../../components/Card';
import { useAuth } from '../../context/AuthContext';
import { 
  UserIcon, 
  CalendarIcon, 
  ClockIcon, 
  MapPinIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

export default function AssignShifts() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [shifts, setShifts] = useState([
    { id: 1, startTime: '', endTime: '', locationId: '', locationName: '' }
  ]);

  // Success state
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeesRes, locationsRes] = await Promise.all([
        api.get('/users'),
        api.get('/locations')
      ]);
      
      setEmployees(employeesRes.data.filter(u => u.role === 'Employee'));
      setLocations(locationsRes.data);
      
      // Set default date to today
      const today = new Date().toISOString().slice(0, 10);
      setSelectedDate(today);
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addShift = () => {
    const newId = Math.max(...shifts.map(s => s.id), 0) + 1;
    setShifts([...shifts, { 
      id: newId, 
      startTime: '', 
      endTime: '', 
      locationId: '', 
      locationName: '' 
    }]);
  };

  const removeShift = (id) => {
    if (shifts.length > 1) {
      setShifts(shifts.filter(s => s.id !== id));
    }
  };

  const updateShift = (id, field, value) => {
    setShifts(shifts.map(shift => {
      if (shift.id === id) {
        const updated = { ...shift, [field]: value };
        
        // Update location name when location ID changes
        if (field === 'locationId') {
          const location = locations.find(l => l.id === Number(value));
          updated.locationName = location ? location.name : '';
        }
        
        return updated;
      }
      return shift;
    }));
  };

  const validateForm = () => {
    if (!selectedEmployee || !selectedDate) {
      setError('Please select an employee and date.');
      return false;
    }

    for (const shift of shifts) {
      if (!shift.startTime || !shift.endTime || !shift.locationId) {
        setError('Please fill in all shift details.');
        return false;
      }

      // Validate time format and logic
      const start = new Date(`2000-01-01T${shift.startTime}`);
      const end = new Date(`2000-01-01T${shift.endTime}`);
      
      if (start >= end) {
        setError('End time must be after start time.');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    try {
      const employee = employees.find(e => e.id === Number(selectedEmployee));
      
      // Assign each shift to the employee
      for (const shift of shifts) {
        const shiftData = {
          date: selectedDate,
          startTime: shift.startTime,
          endTime: shift.endTime,
          locationId: Number(shift.locationId),
          locationName: shift.locationName
        };

        await api.post('/employee-shifts/assign', {
          employeeId: employee.id,
          employeeName: employee.name,
          shiftData
        });
      }

      // Show success message
      setSuccessMessage(`Successfully assigned ${shifts.length} shift(s) to ${employee.name} for ${selectedDate}`);
      setShowSuccess(true);

      // Reset form
      setShifts([{ id: 1, startTime: '', endTime: '', locationId: '', locationName: '' }]);
      setSelectedEmployee('');
      setSelectedDate(new Date().toISOString().slice(0, 10));

      // Hide success message after 5 seconds
      setTimeout(() => setShowSuccess(false), 5000);

    } catch (error) {
      console.error('Error assigning shifts:', error);
      setError('Failed to assign shifts. Please try again.');
    }
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Assign Shifts</h1>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <CheckIcon className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <UserIcon className="h-5 w-5 inline mr-2" />
              Select Employee
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Choose an employee...</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.email})
                </option>
              ))}
            </select>
          </div>

          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarIcon className="h-5 w-5 inline mr-2" />
              Shift Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Shifts */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                <ClockIcon className="h-5 w-5 inline mr-2" />
                Shift Details
              </label>
              <button
                type="button"
                onClick={addShift}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Shift
              </button>
            </div>

            <div className="space-y-4">
              {shifts.map((shift, index) => (
                <div key={shift.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Shift {index + 1}</h4>
                    {shifts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeShift(shift.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Start Time */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={shift.startTime}
                        onChange={(e) => updateShift(shift.id, 'startTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                      {shift.startTime && (
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTime(shift.startTime)}
                        </p>
                      )}
                    </div>

                    {/* End Time */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={shift.endTime}
                        onChange={(e) => updateShift(shift.id, 'endTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                      {shift.endTime && (
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTime(shift.endTime)}
                        </p>
                      )}
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        <MapPinIcon className="h-4 w-4 inline mr-1" />
                        Location
                      </label>
                      <select
                        value={shift.locationId}
                        onChange={(e) => updateShift(shift.id, 'locationId', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select location...</option>
                        {locations.map(location => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <CheckIcon className="h-5 w-5 mr-2" />
              Confirm Assignment
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}