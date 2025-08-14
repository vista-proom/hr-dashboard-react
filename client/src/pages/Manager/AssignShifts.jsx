import React, { useState, useEffect } from 'react';
import api from '../../api';
import Card from '../../components/Card';
import LocationModal from '../../components/LocationModal';
import { useAuth } from '../../context/AuthContext';
import { 
  UserIcon, 
  CalendarIcon, 
  ClockIcon, 
  MapPinIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  PencilSquareIcon
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
  const [workingHours, setWorkingHours] = useState(0);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedKind, setSelectedKind] = useState('Work');

  // Success state
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Schedule preview state
  const [currentWeekShifts, setCurrentWeekShifts] = useState([]);
  const [totalWorkingHours, setTotalWorkingHours] = useState(0);
  const [hoursByLocation, setHoursByLocation] = useState({});

  // Location modal state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Draft shift state for real-time preview
  const [draftShift, setDraftShift] = useState(null);

  // NEW: local preview shifts that are not yet submitted to backend
  const [previewShifts, setPreviewShifts] = useState([]);

  // NEW: modal to show preview summary and table
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // NEW: inline editing state for preview shifts
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [editFields, setEditFields] = useState({ startTime: '', endTime: '', locationId: '', kind: 'Work' });

  const shiftKinds = ['Work', 'DayOff', 'Sick', 'Vacation', 'Training'];

  useEffect(() => {
    loadData();
  }, []);

  // Auto-calculate working hours when start/end times change
  useEffect(() => {
    calculateWorkingHours();
  }, [startTime, endTime]);

  // Update draft shift when form changes (kept for immediate visual feedback if needed)
  useEffect(() => {
    if (selectedEmployee && selectedDate && startTime && endTime && selectedLocation) {
      const employee = employees.find(e => e.id === Number(selectedEmployee));
      const location = locations.find(l => l.id === Number(selectedLocation));
      
      setDraftShift({
        id: 'draft',
        date: selectedDate,
        employee: employee?.name || '',
        employeeId: employee?.id || null,
        startTime: startTime,
        endTime: endTime,
        location: location?.name || '',
        locationId: location?.id || null,
        kind: selectedKind,
        status: 'draft',
        isPreview: true
      });
    } else {
      setDraftShift(null);
    }
  }, [selectedEmployee, selectedDate, startTime, endTime, selectedLocation, selectedKind, employees, locations]);

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
      
      // Load current week schedule
      loadCurrentWeekSchedule();
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentWeekSchedule = () => {
    // This would typically call an API to get the current week's schedule
    // For now, we'll create mock data to demonstrate the UI
    const mockShifts = [
      { id: 1, date: '2025-08-14', employee: 'Alice Employee', employeeId: 2, startTime: '09:00', endTime: '17:00', location: 'Main Office', locationId: 1, kind: 'Work', status: 'confirmed' },
      { id: 2, date: '2025-08-15', employee: 'Bob Employee', employeeId: 3, startTime: '08:00', endTime: '16:00', location: 'Warehouse A', locationId: 2, kind: 'Work', status: 'confirmed' },
    ];
    
    setCurrentWeekShifts(mockShifts);
    setTotalWorkingHours(16);
    setHoursByLocation({
      'Main Office': 8,
      'Warehouse A': 8
    });
  };

  const calculateWorkingHours = () => {
    if (startTime && endTime) {
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      const diffMs = end - start;
      const diffHours = diffMs / (1000 * 60 * 60);
      setWorkingHours(Math.max(0, diffHours));
    }
  };

  const formatWorkingHours = (hours) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (minutes === 0) {
      return `${wholeHours}h`;
    } else {
      return `${wholeHours}h ${minutes}m`;
    }
  };

  const validateForm = () => {
    if (!selectedEmployee || !selectedDate || !startTime || !endTime || !selectedLocation) {
      setError('Please fill in all required fields.');
      return false;
    }

    // Validate time format and logic
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    if (start >= end) {
      setError('End time must be after start time.');
      return false;
    }

    return true;
  };

  // Keep original submit logic for backend push; we will call similar API in preview submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    try {
      const employee = employees.find(e => e.id === Number(selectedEmployee));
      
      const shiftData = {
        date: selectedDate,
        startTime: startTime,
        endTime: endTime,
        locationId: Number(selectedLocation),
        locationName: locations.find(l => l.id === Number(selectedLocation))?.name || '',
        kind: selectedKind
      };

      await api.post('/employee-shifts/assign', {
        employeeId: employee.id,
        employeeName: employee.name,
        shiftData
      });

      // Show success message
      setSuccessMessage(`Successfully assigned shift to ${employee.name} for ${selectedDate}`);
      setShowSuccess(true);

      // Reset form
      setSelectedEmployee('');
      setSelectedDate(new Date().toISOString().slice(0, 10));
      setStartTime('');
      setEndTime('');
      setSelectedLocation('');
      setSelectedKind('Work');
      setWorkingHours(0);
      setDraftShift(null);

      // Reload current week schedule
      loadCurrentWeekSchedule();

      // Hide success message after 5 seconds
      setTimeout(() => setShowSuccess(false), 5000);

    } catch (error) {
      console.error('Error assigning shift:', error);
      setError('Failed to assign shift. Please try again.');
    }
  };

  // NEW: Save to local preview only
  const handleSaveToPreview = (e) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;

    const employee = employees.find(e => e.id === Number(selectedEmployee));
    const location = locations.find(l => l.id === Number(selectedLocation));

    const newPreviewShift = {
      id: `preview_${Date.now()}`,
      date: selectedDate,
      employee: employee?.name || '',
      employeeId: employee?.id,
      startTime,
      endTime,
      location: location?.name || '',
      locationId: location?.id,
      kind: selectedKind,
      status: 'draft',
      isPreview: true
    };

    setPreviewShifts(prev => [...prev, newPreviewShift]);

    // Brief success notification (local)
    setSuccessMessage('Shift added to preview. Open Preview Schedule to submit.');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const clearForm = () => {
    setSelectedEmployee('');
    setSelectedDate(new Date().toISOString().slice(0, 10));
    setStartTime('');
    setEndTime('');
    setSelectedLocation('');
    setSelectedKind('Work');
    setWorkingHours(0);
    setDraftShift(null);
    setError('');
  };

  const saveSchedule = () => {
    // This would typically save the entire week's schedule
    setSuccessMessage('Weekly schedule saved successfully!');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 5000);
  };

  const resetSchedule = () => {
    // NEW behavior: clear only local preview shifts
    setPreviewShifts([]);
    setSuccessMessage('Preview cleared. No changes were submitted.');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleSaveLocation = async (locationData) => {
    try {
      // Call the backend API to save the location
      const response = await api.post('/locations', locationData);
      
      // Add the new location to the local state
      setLocations(prev => [...prev, response.data]);
      
      // Show success message
      setSuccessMessage('Location saved successfully!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
      
    } catch (error) {
      console.error('Error saving location:', error);
      throw new Error('Failed to save location');
    }
  };

  const handleLocationAdded = () => {
    // Refresh locations if needed
    loadData();
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getDayName = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Week helpers (Saturday to Friday)
  const toDate = (s) => new Date(`${s}T00:00:00`);
  const toISO = (d) => d.toISOString().slice(0, 10);

  const getWeekStartSaturday = (s) => {
    const d = toDate(s);
    const offset = (d.getDay() + 1) % 7; // 0 for Sat, 1 for Sun, ... 6 for Fri
    const start = new Date(d);
    start.setDate(d.getDate() - offset - 1 + 1); // retain same expression, resolves to d - offset
    start.setHours(0,0,0,0);
    return start;
  };

  const getWeekDates = (s) => {
    const start = getWeekStartSaturday(s);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({ date: toISO(d), dateObj: d });
    }
    return days; // Saturday -> Friday
  };

  const getWeekNumber = (s) => {
    const d = toDate(s);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const startSaturday = getWeekStartSaturday(toISO(startOfYear));
    const diffDays = Math.floor((d - startSaturday) / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  };

  // Calculate hours for a single shift
  const getShiftHours = (shift) => {
    if (!shift.startTime || !shift.endTime) return 0;
    const start = new Date(`2000-01-01T${shift.startTime}`);
    const end = new Date(`2000-01-01T${shift.endTime}`);
    return Math.max(0, (end - start) / (1000 * 60 * 60));
  };

  // Filter shifts for selected employee including local preview
  const getFilteredShifts = () => {
    const all = [...currentWeekShifts, ...previewShifts];
    if (!selectedEmployee) return all;
    const employee = employees.find(e => e.id === Number(selectedEmployee));
    if (!employee) return all;
    return all.filter(s => s.employee === employee.name);
  };

  // Calculate total hours for filtered shifts (existing + preview)
  const getFilteredTotalHours = () => {
    const filteredShifts = getFilteredShifts();
    return filteredShifts.reduce((sum, s) => sum + getShiftHours(s), 0);
  };

  // Calculate hours by location for filtered shifts (existing + preview)
  const getFilteredHoursByLocation = () => {
    const filteredShifts = getFilteredShifts();
    const locationHours = {};
    filteredShifts.forEach(shift => {
      if (shift.startTime && shift.endTime && shift.location) {
        const hrs = getShiftHours(shift);
        locationHours[shift.location] = (locationHours[shift.location] || 0) + hrs;
      }
    });
    return locationHours;
  };

  // Group shifts by date for the selected week (Saturday -> Friday)
  const getWeekShiftsGrouped = () => {
    const days = getWeekDates(selectedDate);
    const byDate = {};
    days.forEach(d => { byDate[d.date] = []; });
    const filtered = getFilteredShifts();
    filtered.forEach(s => {
      if (byDate[s.date]) byDate[s.date].push(s);
    });
    // sort each day by startTime
    Object.values(byDate).forEach(arr => arr.sort((a,b) => (a.startTime||'') > (b.startTime||'') ? 1 : -1));
    return { days, byDate };
  };

  // Edit preview shift inline
  const beginEditShift = (shift) => {
    setEditingShiftId(shift.id);
    setEditFields({ startTime: shift.startTime, endTime: shift.endTime, locationId: shift.locationId, kind: shift.kind });
  };

  const cancelEditShift = () => {
    setEditingShiftId(null);
  };

  const saveEditShift = () => {
    setPreviewShifts(prev => prev.map(s => s.id === editingShiftId ? {
      ...s,
      startTime: editFields.startTime,
      endTime: editFields.endTime,
      locationId: Number(editFields.locationId),
      location: locations.find(l => l.id === Number(editFields.locationId))?.name || s.location,
      kind: editFields.kind
    } : s));
    setEditingShiftId(null);
  };

  const removePreviewShift = (id) => {
    setPreviewShifts(prev => prev.filter(s => s.id !== id));
  };

  // Delete location
  const handleDeleteLocation = async (id) => {
    try {
      await api.delete(`/locations/${id}`);
      setLocations(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      console.error('Delete location failed', err);
      setError('Failed to delete location.');
    }
  };

  // Submit all preview shifts to backend using existing API
  const submitPreviewShifts = async () => {
    try {
      const shiftsToSubmit = [...previewShifts];
      for (const preview of shiftsToSubmit) {
        await api.post('/employee-shifts/assign', {
          employeeId: preview.employeeId,
          employeeName: preview.employee,
          shiftData: {
            date: preview.date,
            startTime: preview.startTime,
            endTime: preview.endTime,
            locationId: preview.locationId,
            locationName: preview.location,
            kind: preview.kind
          }
        });
      }

      // Merge into currentWeekShifts and clear preview
      setCurrentWeekShifts(prev => [...prev, ...shiftsToSubmit.map(s => ({ ...s, status: 'confirmed' }))]);
      setPreviewShifts([]);
      setIsPreviewModalOpen(false);
      setSuccessMessage('Shifts submitted successfully.');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);

    } catch (err) {
      console.error('Error submitting shifts', err);
      setError('Failed to submit shifts.');
    }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Assign Shift</h1>
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

      {/* Assign Shift Form */}
      <Card
        title="Assign Shift"
        actions={
          <button
            type="button"
            onClick={() => setIsLocationModalOpen(true)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Location
          </button>
        }
      >
        <form onSubmit={handleSaveToPreview} className="space-y-6">
          {/* Row 1: Employee, Date, Working Hours */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Employee Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <UserIcon className="h-5 w-5 inline mr-2" />
                Employee
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
                    {employee.email} - {employee.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CalendarIcon className="h-5 w-5 inline mr-2" />
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Working Hours Display */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <ClockIcon className="h-5 w-5 inline mr-2" />
                Working Hours
              </label>
              <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                {formatWorkingHours(workingHours)}
              </div>
            </div>
          </div>

          {/* Row 2: Start Time, End Time, Location */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <ClockIcon className="h-5 w-5 inline mr-2" />
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <ClockIcon className="h-5 w-5 inline mr-2" />
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPinIcon className="h-5 w-5 inline mr-2" />
                Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
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

          {/* Row 3: Kind */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kind
              </label>
              <select
                value={selectedKind}
                onChange={(e) => setSelectedKind(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {shiftKinds.map(kind => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Form Buttons */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <CheckIcon className="h-4 w-4 mr-2" />
              Save Shift
            </button>
            <button
              type="button"
              onClick={clearForm}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <XMarkIcon className="h-4 w-4 mr-2" />
              Clear
            </button>
          </div>
        </form>
      </Card>

      {/* Schedule Preview - Current Week Only */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Schedule Preview - Current Week Only</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Employee: {selectedEmployee ? (employees.find(e => e.id === Number(selectedEmployee))?.name || '') : 'All employees'}
        </p>

        {/* Week Heading */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-600">Week #{getWeekNumber(selectedDate)}</div>
          <div className="text-xs text-gray-500">Saturday to Friday</div>
        </div>

        {/* Day Boxes: Saturday -> Friday */}
        {(() => { const { days, byDate } = getWeekShiftsGrouped(); return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {days.map(({ date, dateObj }) => {
              const dayShifts = byDate[date] || [];
              const totalHours = dayShifts.reduce((sum, s) => sum + getShiftHours(s), 0);
              return (
                <div key={date} className="bg-white border border-gray-200 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-500">{dateObj.toLocaleDateString()}</div>
                    <div className="text-xs font-medium text-gray-700">{formatWorkingHours(totalHours)}</div>
                  </div>
                  <div className="space-y-2">
                    {dayShifts.length === 0 && (
                      <div className="text-xs text-gray-400">No shifts</div>
                    )}
                    {dayShifts.map(shift => (
                      <div key={shift.id} className="border border-gray-200 rounded p-2 flex items-center justify-between">
                        {editingShiftId === shift.id ? (
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                            <input type="time" value={editFields.startTime} onChange={e => setEditFields(f => ({ ...f, startTime: e.target.value }))} className="px-2 py-1 border border-gray-300 rounded" />
                            <input type="time" value={editFields.endTime} onChange={e => setEditFields(f => ({ ...f, endTime: e.target.value }))} className="px-2 py-1 border border-gray-300 rounded" />
                            <select value={editFields.locationId || ''} onChange={e => setEditFields(f => ({ ...f, locationId: e.target.value }))} className="px-2 py-1 border border-gray-300 rounded">
                              <option value="">Select location...</option>
                              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                            <select value={editFields.kind} onChange={e => setEditFields(f => ({ ...f, kind: e.target.value }))} className="px-2 py-1 border border-gray-300 rounded">
                              {shiftKinds.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div className="flex-1">
                            <div className="text-sm text-gray-800">{formatTime(shift.startTime)} - {formatTime(shift.endTime)}</div>
                            <div className="text-xs text-gray-500">{shift.location} {shift.kind !== 'Work' && (<span className="ml-1 inline-block px-1 rounded bg-gray-100 text-gray-600">{shift.kind}</span>)}</div>
                          </div>
                        )}
                        <div className="ml-2 flex items-center space-x-2">
                          {shift.isPreview && editingShiftId !== shift.id && (
                            <button onClick={() => beginEditShift(shift)} className="p-1 rounded hover:bg-gray-100" title="Edit">
                              <PencilSquareIcon className="h-4 w-4 text-gray-600" />
                            </button>
                          )}
                          {editingShiftId === shift.id && (
                            <>
                              <button onClick={saveEditShift} className="p-1 rounded hover:bg-gray-100" title="Save">
                                <CheckIcon className="h-4 w-4 text-green-600" />
                              </button>
                              <button onClick={cancelEditShift} className="p-1 rounded hover:bg-gray-100" title="Cancel">
                                <XMarkIcon className="h-4 w-4 text-gray-600" />
                              </button>
                            </>
                          )}
                          {shift.isPreview && (
                            <button onClick={() => removePreviewShift(shift.id)} className="p-1 rounded hover:bg-gray-100" title="Delete">
                              <TrashIcon className="h-4 w-4 text-red-600" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ); })()}

        {/* Schedule Actions */}
        <div className="flex justify-end space-x-3 pt-6">
          <button
            type="button"
            onClick={() => setIsPreviewModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Preview Schedule
          </button>
          <button
            type="button"
            onClick={resetSchedule}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Reset Schedule
          </button>
        </div>
      </Card>

      {/* Locations List Section */}
      <Card title="Locations">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2">
              <div>
                <div className="text-sm font-medium text-gray-800">{loc.name}</div>
                {(loc.latitude && loc.longitude) ? (
                  <div className="text-xs text-gray-500">({loc.latitude}, {loc.longitude})</div>
                ) : (
                  <div className="text-xs text-gray-400">No coordinates</div>
                )}
              </div>
              <button onClick={() => handleDeleteLocation(loc.id)} className="p-2 rounded hover:bg-gray-100">
                <TrashIcon className="h-4 w-4 text-red-600" />
              </button>
            </div>
          ))}
          {locations.length === 0 && (
            <div className="text-sm text-gray-500">No locations yet.</div>
          )}
        </div>
      </Card>

      {/* Location Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSave={handleSaveLocation}
        onLocationAdded={handleLocationAdded}
      />

      {/* Preview Schedule Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsPreviewModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-4xl mx-4 rounded-md shadow-lg">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Preview Schedule</h3>
              <button onClick={() => setIsPreviewModalOpen(false)} className="p-1 rounded hover:bg-gray-100">
                <XMarkIcon className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            <div className="p-4 space-y-6">
              {/* Summary (moved to modal) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <div className="text-sm font-medium text-blue-900 mb-1">Live Weekly Summary</div>
                  <div className="text-2xl font-bold text-blue-900">{formatWorkingHours(getFilteredTotalHours())}</div>
                  <div className="text-sm text-blue-700">Total working hours this week</div>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                  <div className="text-sm font-medium text-green-900 mb-2">Hours by Location</div>
                  <div className="space-y-1">
                    {Object.entries(getFilteredHoursByLocation()).map(([loc, hrs]) => (
                      <div key={loc} className="flex justify-between text-sm">
                        <span className="text-green-700">{loc}</span>
                        <span className="font-medium text-green-900">{formatWorkingHours(hrs)}</span>
                      </div>
                    ))}
                    {Object.keys(getFilteredHoursByLocation()).length === 0 && (
                      <div className="text-sm text-green-700">No locations assigned yet</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">Week Overview</div>
                <div className="divide-y divide-gray-200">
                  {(() => { const { days, byDate } = getWeekShiftsGrouped(); return (
                    days.map(({ date, dateObj }) => {
                      const dayShifts = (byDate[date] || []).slice().sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
                      return (
                        <div key={date} className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900 mb-1">{dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                          {dayShifts.length === 0 ? (
                            <div className="text-xs text-gray-500">No shifts</div>
                          ) : (
                            <div className="space-y-1">
                              {dayShifts.map(s => (
                                <div key={s.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                                  <div className="text-gray-700">{formatTime(s.startTime)} → {formatTime(s.endTime)}</div>
                                  <div className="text-gray-600">{s.location}</div>
                                  <div className="text-gray-500">{s.kind}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ); })()}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={submitPreviewShifts}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Submit Shift
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}