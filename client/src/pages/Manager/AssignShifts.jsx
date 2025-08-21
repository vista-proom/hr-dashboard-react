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

  // NEW: Locations search text
  const [locationQuery, setLocationQuery] = useState('');

  const shiftKinds = ['Work', 'DayOff', 'Sick', 'Vacation', 'Training'];

  // --- Date helpers (UTC to avoid off-by-one) ---
  const parseIsoToUTCDate = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };

  const toIsoUTC = (date) => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getSaturdayOfWeekUTC = (iso) => {
    const d = parseIsoToUTCDate(iso);
    const day = d.getUTCDay(); // 0=Sun..6=Sat
    const offset = (day + 1) % 7; // days since Saturday
    const start = new Date(d);
    start.setUTCDate(d.getUTCDate() - offset);
    start.setUTCHours(0,0,0,0);
    return start;
  };

  const getUpcomingSaturdayUTC = () => {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = todayUTC.getUTCDay();
    const daysUntilSaturday = (6 - day + 7) % 7;
    const nextSat = new Date(todayUTC);
    nextSat.setUTCDate(todayUTC.getUTCDate() + (daysUntilSaturday === 0 ? 7 : daysUntilSaturday));
    return nextSat;
  };

  const getWeekDatesUTC = (iso) => {
    const start = getSaturdayOfWeekUTC(iso);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      days.push({ date: toIsoUTC(d), dateObj: d });
    }
    return days; // Saturday -> Friday
  };

  const getWeekNumberUTC = (iso) => {
    const d = parseIsoToUTCDate(iso);
    const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const startSaturday = getSaturdayOfWeekUTC(toIsoUTC(startOfYear));
    const diffDays = Math.floor((d - startSaturday) / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  };

  const formatDisplayDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const formatDisplayDay = (d) => d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // listen for global locations updates
    if (!window.__socketInitAssigned) {
      window.__socketInitAssigned = true;
    }
    const cleanup = [];
    try {
      // Access socket via context
      const { socket } = require('../../context/AuthContext');
    } catch {}
    return () => cleanup.forEach(fn => fn && fn());
  }, []);

  // Auto-calculate working hours when start/end times change
  useEffect(() => {
    calculateWorkingHours();
  }, [startTime, endTime]);

  // Update draft shift when form changes (keep for immediate feedback if needed)
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
      
      // Default date: Saturday of the next week not yet started
      const nextSat = getUpcomingSaturdayUTC();
      setSelectedDate(toIsoUTC(nextSat));
      
      // Load current week schedule (mock/demo)
      loadCurrentWeekSchedule();
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentWeekSchedule = () => {
    const mockShifts = [
      { id: 1, date: '2025-08-14', employee: 'Alice Employee', employeeId: 2, startTime: '09:00', endTime: '17:00', location: 'Main Office', locationId: 1, kind: 'Work', status: 'confirmed' },
      { id: 2, date: '2025-08-15', employee: 'Alice Employee', employeeId: 2, startTime: '12:00', endTime: '20:00', location: 'Warehouse A', locationId: 2, kind: 'Work', status: 'draft', isPreview: true },
    ];
    
    setCurrentWeekShifts(mockShifts);
    setTotalWorkingHours(16);
    setHoursByLocation({ 'Main Office': 8, 'Warehouse A': 8 });
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
    if (minutes === 0) return `${wholeHours}h`;
    return `${wholeHours}h ${minutes}m`;
  };

  const validateForm = () => {
    if (!selectedEmployee || !selectedDate || !startTime || !endTime || !selectedLocation) {
      setError('Please fill in all required fields.');
      return false;
    }
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    if (start >= end) {
      setError('End time must be after start time.');
      return false;
    }
    return true;
  };

  // Keep original backend submit (not used on Save Shift in preview flow)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
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
      await api.post('/employee-shifts/assign', { employeeId: employee.id, employeeName: employee.name, shiftData });
      setSuccessMessage(`Successfully assigned shift to ${employee.name} for ${selectedDate}`);
      setShowSuccess(true);
      setSelectedEmployee('');
      setSelectedDate(toIsoUTC(getUpcomingSaturdayUTC()));
      setStartTime(''); setEndTime(''); setSelectedLocation(''); setSelectedKind('Work'); setWorkingHours(0); setDraftShift(null);
      loadCurrentWeekSchedule();
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error) {
      console.error('Error assigning shift:', error);
      setError('Failed to assign shift. Please try again.');
    }
  };

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
    setSuccessMessage('Shift added to preview. Open Preview Schedule to submit.');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    // Clear inputs after adding to preview
    setSelectedEmployee('');
    setSelectedDate(toIsoUTC(getUpcomingSaturdayUTC()));
    setStartTime(''); setEndTime(''); setSelectedLocation(''); setSelectedKind('Work');
    setWorkingHours(0); setDraftShift(null);
  };

  const clearForm = () => {
    setSelectedEmployee('');
    setSelectedDate(toIsoUTC(getUpcomingSaturdayUTC()));
    setStartTime(''); setEndTime(''); setSelectedLocation(''); setSelectedKind('Work');
    setWorkingHours(0); setDraftShift(null); setError('');
  };

  const resetSchedule = () => {
    if (!window.confirm('Clear all preview shifts? This will not submit any changes.')) return;
    setPreviewShifts([]);
    setSuccessMessage('Preview cleared. No changes were submitted.');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleSaveLocation = async (locationData) => {
    try {
      const response = await api.post('/locations', locationData);
      setLocations(prev => [...prev, response.data]);
      setSuccessMessage('Location saved successfully!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error) {
      console.error('Error saving location:', error);
      throw new Error('Failed to save location');
    }
  };

  const handleLocationAdded = () => { loadData(); };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
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

  // Calculate totals
  const getFilteredTotalHours = () => getFilteredShifts().reduce((sum, s) => sum + getShiftHours(s), 0);
  const getFilteredHoursByLocation = () => {
    const map = {};
    getFilteredShifts().forEach(s => {
      if (s.location) { map[s.location] = (map[s.location] || 0) + getShiftHours(s); }
    });
    return map;
  };

  // Group shifts by date (Saturday -> Friday)
  const getWeekShiftsGrouped = () => {
    const days = getWeekDatesUTC(selectedDate);
    const byDate = {}; days.forEach(d => byDate[d.date] = []);
    const filtered = getFilteredShifts();
    filtered.forEach(s => { if (byDate[s.date]) byDate[s.date].push(s); });
    Object.values(byDate).forEach(arr => arr.sort((a,b) => (a.startTime||'').localeCompare(b.startTime||'')));
    return { days, byDate };
  };

  // Inline edit for preview shifts
  const beginEditShift = (shift) => { setEditingShiftId(shift.id); setEditFields({ startTime: shift.startTime, endTime: shift.endTime, locationId: shift.locationId, kind: shift.kind }); };
  const cancelEditShift = () => setEditingShiftId(null);
  const saveEditShift = () => {
    setPreviewShifts(prev => prev.map(s => s.id === editingShiftId ? { ...s, startTime: editFields.startTime, endTime: editFields.endTime, locationId: Number(editFields.locationId), location: locations.find(l => l.id === Number(editFields.locationId))?.name || s.location, kind: editFields.kind } : s));
    setEditingShiftId(null);
  };
  const removePreviewShift = (id) => setPreviewShifts(prev => prev.filter(s => s.id !== id));

  // NEW: Submit preview shifts to backend, use API response IDs for state
  const submitPreviewShifts = async () => {
    try {
      const shiftsToSubmit = [...previewShifts];
      const created = [];
      for (const preview of shiftsToSubmit) {
        const resp = await api.post('/employee-shifts/assign', { employeeId: preview.employeeId, employeeName: preview.employee, shiftData: { date: preview.date, startTime: preview.startTime, endTime: preview.endTime, locationId: preview.locationId, locationName: preview.location, kind: preview.kind } });
        const s = resp.data; // expect: { id, date, start_time, end_time, location_name }
        created.push({
          id: s.id,
          date: s.date,
          employee: preview.employee,
          employeeId: preview.employeeId,
          startTime: s.start_time,
          endTime: s.end_time,
          location: s.location_name,
          locationId: preview.locationId,
          kind: preview.kind,
          status: 'confirmed',
          isPreview: false
        });
      }
      setCurrentWeekShifts(prev => [...prev, ...created]);
      setPreviewShifts([]); setIsPreviewModalOpen(false);
      setSuccessMessage('Shifts submitted successfully.'); setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err) { console.error('Error submitting shifts', err); setError('Failed to submit shifts.'); }
  };

  // NEW: Delete confirmed assigned shift from backend and update UI immediately
  const deleteAssignedShift = async (employeeId, shiftId) => {
    if (!window.confirm('Are you sure you want to delete this shift?')) return;
    try {
      await api.delete(`/employee-shifts/${employeeId}/${shiftId}`);
      setCurrentWeekShifts(prev => prev.filter(s => s.id !== shiftId));
      setSuccessMessage('Shift deleted successfully');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Error deleting shift:', err);
      const msg = err.response?.data?.error || 'Failed to delete shift. Please try again.';
      setError(msg);
    }
  };

  // Totals for preview-only (exclude existing confirmed shifts)
  const getPreviewFilteredShifts = () => {
    if (!selectedEmployee) return previewShifts;
    const employee = employees.find(e => e.id === Number(selectedEmployee));
    if (!employee) return previewShifts;
    return previewShifts.filter(s => s.employee === employee.name);
  };
  const getPreviewTotalHours = () => getPreviewFilteredShifts().reduce((sum, s) => sum + getShiftHours(s), 0);
  const getPreviewHoursByLocation = () => {
    const map = {};
    getPreviewFilteredShifts().forEach(s => { if (s.location) map[s.location] = (map[s.location] || 0) + getShiftHours(s); });
    return map;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const { days, byDate } = getWeekShiftsGrouped();
  const weekNumber = getWeekNumberUTC(selectedDate);
  const weekStart = days[0]?.dateObj; const weekEnd = days[6]?.dateObj;

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
      <Card title="Assign Shift">
        <form onSubmit={handleSaveToPreview} className="space-y-6">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              <div className="relative">
                <UserIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required>
                  <option value="">Choose an employee...</option>
                  {employees.map(employee => (<option key={employee.id} value={employee.id}>{employee.email} - {employee.name}</option>))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <div className="relative">
                <CalendarIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Working Hours</label>
              <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">{formatWorkingHours(workingHours)}</div>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <div className="relative">
                <ClockIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
              </div>
            </div>
            <div>
              <label className="block text_sm font-medium text-gray-700 mb-1">End Time</label>
              <div className="relative">
                <ClockIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w_full pl-9 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline_none focus:ring-blue-500 focus:border-blue-500" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <div className="flex gap-2">
                <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required>
                  <option value="">Select location...</option>
                  {locations.map(location => (<option key={location.id} value={location.id}>{location.name}</option>))}
                </select>
                <button type="button" onClick={() => setIsLocationModalOpen(true)} className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                  <PlusIcon className="h-4 w-4 mr-1" /> Add
                </button>
              </div>
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kind</label>
              <select value={selectedKind} onChange={(e) => setSelectedKind(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required>
                {shiftKinds.map(kind => (<option key={kind} value={kind}>{kind}</option>))}
              </select>
            </div>
          </div>

          {/* Form Buttons */}
          <div className="flex items-center space-x-3 pt-2">
            <button type="submit" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline_none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <CheckIcon className="h-4 w-4 mr-2" /> Save Shift
            </button>
            <button type="button" onClick={clearForm} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline_none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <XMarkIcon className="h-4 w-4 mr-2" /> Clear
            </button>
          </div>
        </form>
      </Card>

      {/* Schedule Preview - Current Week Only */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Schedule Preview - Current Week Only</h2>
        </div>
        <p className="text-sm text-gray-600 mb-1">Employee: {selectedEmployee ? (employees.find(e => e.id === Number(selectedEmployee))?.name || '') : 'All employees'}</p>
        <p className="text-xs text-gray-500 mb-4">Week {weekNumber} – {formatDisplayDate(weekStart)} to {formatDisplayDate(weekEnd)}</p>

        {/* Day cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {days.map(({ date, dateObj }) => {
            const dayShifts = byDate[date] || [];
            const totalHours = dayShifts.reduce((sum, s) => sum + getShiftHours(s), 0);
            const hoursColor = totalHours < 8 ? 'bg-green-100 text-green-800' : totalHours <= 10 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
            return (
              <div key={date} className="relative bg-white border border-gray-200 rounded-md p-3">
                <span className={`absolute top-2 left-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${hoursColor}`}>{formatWorkingHours(totalHours)}</span>
                <div className="text-sm font-semibold text-gray-900 pl-20">{formatDisplayDay(dateObj)} – {dateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'UTC' })}</div>
                <div className="mt-3 space-y-2">
                  {dayShifts.length === 0 && (<div className="text-xs text-gray-400">No shifts</div>)}
                  {dayShifts.map((shift, idx) => (
                    <div key={shift.id} className={`${idx % 2 === 0 ? 'bg-gray-50' : 'bg-gray-100'} border border-gray-200 rounded p-2 flex items-center justify-between`}>
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
                          <div className="text-xs text-gray-500">{shift.location} {shift.kind !== 'Work' && (<span className="ml-1 inline-block px-1 rounded bg-gray-200 text-gray-700">{shift.kind}</span>)}</div>
                        </div>
                      )}
                      <div className="ml-2 flex items-center space-x-2">
                        {shift.isPreview && editingShiftId !== shift.id && (
                          <button onClick={() => beginEditShift(shift)} className="p-1 rounded hover:bg-gray-200" title="Edit">
                            <PencilSquareIcon className="h-4 w-4 text-gray-600" />
                          </button>
                        )}
                        {editingShiftId === shift.id && (
                          <>
                            <button onClick={saveEditShift} className="p-1 rounded hover:bg-gray-200" title="Save">
                              <CheckIcon className="h-4 w-4 text-green-600" />
                            </button>
                            <button onClick={cancelEditShift} className="p-1 rounded hover:bg-gray-200" title="Cancel">
                              <XMarkIcon className="h-4 w-4 text-gray-600" />
                            </button>
                          </>
                        )}
                        {/* Always show delete; for preview remove locally, for confirmed call backend */}
                        <button onClick={() => (shift.isPreview ? removePreviewShift(shift.id) : deleteAssignedShift(shift.employeeId, shift.id))} className="p-1 rounded hover:bg-gray-200" title="Delete">
                          <TrashIcon className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Schedule Actions */}
        <div className="flex justify-end space-x-3 pt-6">
          <button type="button" onClick={() => setIsPreviewModalOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Preview Schedule</button>
          <button type="button" onClick={resetSchedule} className="inline-flex items-center px-4 py-2 border border-red-500 text-sm font-medium rounded-md text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">Reset Schedule</button>
        </div>
      </Card>

      {/* Locations List Section */}
      <Card title="Locations">
        <div className="mb-3 flex items-center gap-2">
          <input value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} placeholder="Search locations..." className="w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Location Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Coordinates</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.filter(l => l.name.toLowerCase().includes(locationQuery.toLowerCase())).map(loc => (
                <tr key={loc.id} className="border-b border-gray-100">
                  <td className="py-3 px-4">{loc.name}</td>
                  <td className="py-3 px-4">
                    {(loc.latitude != null && loc.longitude != null) ? (
                      <a href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <MapPinIcon className="h-4 w-4" /> {loc.latitude}, {loc.longitude}
                      </a>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">No Coordinates</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <button onClick={() => handleDeleteLocation(loc.id)} className="text-red-600 hover:text-red-700">Delete</button>
                  </td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr><td colSpan="3" className="py-6 text-center text-gray-500">No locations yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Location Modal */}
      <LocationModal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} onSave={handleSaveLocation} onLocationAdded={handleLocationAdded} />

      {/* Preview Schedule Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items_center justify_center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsPreviewModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-4xl mx-4 rounded-md shadow-lg">
            <div className="px-4 py-3 border-b border-gray-200 flex items_center justify_between">
              <h3 className="text-base font-semibold text-gray-900">Preview Schedule</h3>
              <button onClick={() => setIsPreviewModalOpen(false)} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5 text-gray-600" /></button>
            </div>
            <div className="p-4 space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <div className="text-sm font-medium text-blue-900 mb-1">Live Weekly Summary</div>
                  <div className="text-2xl font-bold text-blue-900">{formatWorkingHours(getPreviewTotalHours())}</div>
                  <div className="text-sm text-blue-700">Total working hours this week (preview only)</div>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                  <div className="text-sm font-medium text-green-900 mb-2">Hours by Location</div>
                  <div className="space-y-1">
                    {Object.entries(getPreviewHoursByLocation()).map(([loc, hrs]) => (
                      <div key={loc} className="flex justify-between text-sm"><span className="text-green-700">{loc}</span><span className="font-medium text-green-900">{formatWorkingHours(hrs)}</span></div>
                    ))}
                    {Object.keys(getPreviewHoursByLocation()).length === 0 && (<div className="text-sm text-green-700">No locations assigned yet</div>)}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">Week Overview</div>
                <div className="divide-y divide-gray-200">
                  {getWeekDatesUTC(selectedDate).map(({ date, dateObj }) => {
                    const dayShifts = (byDate[date] || []).slice().sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
                    return (
                      <div key={date} className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 mb-1">{dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}</div>
                        {dayShifts.length === 0 ? (<div className="text-xs text-gray-500">No shifts</div>) : (
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
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button type="button" onClick={submitPreviewShifts} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Submit Shift</button>
                <button type="button" onClick={() => setIsPreviewModalOpen(false)} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}