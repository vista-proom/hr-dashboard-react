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
  XMarkIcon
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

  const shiftKinds = ['Work', 'DayOff', 'Sick', 'Vacation', 'Training'];

  useEffect(() => {
    loadData();
  }, []);

  // Auto-calculate working hours when start/end times change
  useEffect(() => {
    calculateWorkingHours();
  }, [startTime, endTime]);

  // Update draft shift when form changes
  useEffect(() => {
    if (selectedEmployee && selectedDate && startTime && endTime && selectedLocation) {
      const employee = employees.find(e => e.id === Number(selectedEmployee));
      const location = locations.find(l => l.id === Number(selectedLocation));
      
      setDraftShift({
        id: 'draft',
        date: selectedDate,
        employee: employee?.name || '',
        startTime: startTime,
        endTime: endTime,
        location: location?.name || '',
        kind: selectedKind,
        status: 'draft'
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
      { id: 1, date: '2025-08-14', employee: 'Alice Employee', startTime: '09:00', endTime: '17:00', location: 'Main Office', kind: 'Work', status: 'confirmed' },
      { id: 2, date: '2025-08-15', employee: 'Bob Employee', startTime: '08:00', endTime: '16:00', location: 'Warehouse A', kind: 'Work', status: 'draft' },
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
    // This would typically reset the entire week's schedule
    loadCurrentWeekSchedule();
    setSuccessMessage('Weekly schedule reset successfully!');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 5000);
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

  // Filter shifts for selected employee
  const getFilteredShifts = () => {
    if (!selectedEmployee) {
      return currentWeekShifts;
    }
    
    const employee = employees.find(e => e.id === Number(selectedEmployee));
    if (!employee) return currentWeekShifts;
    
    // Filter existing shifts for the selected employee
    const employeeShifts = currentWeekShifts.filter(shift => 
      shift.employee === employee.name
    );
    
    // Add draft shift if it exists and matches the selected employee
    if (draftShift && draftShift.employee === employee.name) {
      return [...employeeShifts, draftShift];
    }
    
    return employeeShifts;
  };

  // Calculate total hours for filtered shifts
  const getFilteredTotalHours = () => {
    const filteredShifts = getFilteredShifts();
    let total = 0;
    
    filteredShifts.forEach(shift => {
      if (shift.startTime && shift.endTime) {
        const start = new Date(`2000-01-01T${shift.startTime}`);
        const end = new Date(`2000-01-01T${shift.endTime}`);
        const diffMs = end - start;
        const diffHours = diffMs / (1000 * 60 * 60);
        total += diffHours;
      }
    });
    
    return total;
  };

  // Calculate hours by location for filtered shifts
  const getFilteredHoursByLocation = () => {
    const filteredShifts = getFilteredShifts();
    const locationHours = {};
    
    filteredShifts.forEach(shift => {
      if (shift.startTime && shift.endTime && shift.location) {
        const start = new Date(`2000-01-01T${shift.startTime}`);
        const end = new Date(`2000-01-01T${shift.endTime}`);
        const diffMs = end - start;
        const diffHours = diffMs / (1000 * 60 * 60);
        
        locationHours[shift.location] = (locationHours[shift.location] || 0) + diffHours;
      }
    });
    
    return locationHours;
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
        <button
          type="button"
          onClick={() => setIsLocationModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Location
        </button>
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
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Assign Shift</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            {/* Kind */}
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
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={clearForm}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <XMarkIcon className="h-4 w-4 mr-2" />
              Clear
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <CheckIcon className="h-4 w-4 mr-2" />
              Save Shift
            </button>
          </div>
        </form>
      </Card>

      {/* Schedule Preview - Current Week Only */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Schedule Preview - Current Week Only
          {selectedEmployee && (
            <span className="text-sm font-normal text-gray-600 ml-2">
              (Filtered for {employees.find(e => e.id === Number(selectedEmployee))?.name})
            </span>
          )}
        </h2>
        
        {/* Summary Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Live Weekly Summary */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Live Weekly Summary</h3>
            <div className="text-2xl font-bold text-blue-900">
              {formatWorkingHours(getFilteredTotalHours())}
            </div>
            <div className="text-sm text-blue-700">Total working hours this week</div>
          </div>

          {/* Hours by Location */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-green-900 mb-2">Hours by Location</h3>
            <div className="space-y-2">
              {Object.entries(getFilteredHoursByLocation()).map(([location, hours]) => (
                <div key={location} className="flex justify-between text-sm">
                  <span className="text-green-700">{location}</span>
                  <span className="font-medium text-green-900">{formatWorkingHours(hours)}</span>
                </div>
              ))}
              {Object.keys(getFilteredHoursByLocation()).length === 0 && (
                <div className="text-sm text-green-600">No shifts assigned</div>
              )}
            </div>
          </div>
        </div>

        {/* Week View */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">Week View</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {getFilteredShifts().map((shift) => (
              <div key={shift.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-sm font-medium text-gray-900 w-20">
                    {getDayName(shift.date)}
                  </div>
                  <div className="text-sm text-gray-600 w-32">
                    {shift.employee}
                  </div>
                  <div className="text-sm text-gray-600 w-24">
                    {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                  </div>
                  <div className="text-sm text-gray-600 w-32">
                    {shift.location}
                  </div>
                  <div className="text-sm text-gray-600 w-20">
                    {shift.kind}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {shift.status === 'draft' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Draft
                    </span>
                  )}
                  {shift.status === 'confirmed' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Confirmed
                    </span>
                  )}
                </div>
              </div>
            ))}
            {getFilteredShifts().length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500">
                {selectedEmployee ? 'No shifts assigned to this employee this week.' : 'No shifts assigned this week.'}
              </div>
            )}
          </div>
        </div>

        {/* Schedule Actions */}
        <div className="flex justify-end space-x-3 pt-6">
          <button
            type="button"
            onClick={resetSchedule}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Reset Schedule
          </button>
          <button
            type="button"
            onClick={saveSchedule}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Schedule
          </button>
        </div>
      </Card>

      {/* Location Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSave={handleSaveLocation}
        onLocationAdded={handleLocationAdded}
      />
    </div>
  );
}