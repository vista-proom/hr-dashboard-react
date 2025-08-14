import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../../api';
import Card from '../../components/Card';
import { useAuth } from '../../context/AuthContext';
import { 
  ClockIcon, 
  MapPinIcon, 
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  ComputerDesktopIcon,
  CalendarIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

export default function Shifts() {
  const { user, getCurrentLocation, getDeviceType } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/employee-shifts/me');
      setShifts(response.data);
    } catch (error) {
      console.error('Error loading shifts:', error);
      setError('Failed to load shifts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  };

  // Check if employee is within allowed range of their assigned shift location
  const validateLocationForShift = async (currentLat, currentLon) => {
    try {
      // Get today's shifts to check location
      const today = new Date().toISOString().slice(0, 10);
      const todayShifts = shifts.filter(shift => shift.date === today);
      
      if (todayShifts.length === 0) {
        return { valid: false, message: 'No shift scheduled for today.' };
      }

      // Check if any of today's shifts have a location that matches current position
      for (const shift of todayShifts) {
        if (shift.location_name && shift.latitude && shift.longitude) {
          const distance = calculateDistance(
            currentLat, 
            currentLon, 
            shift.latitude, 
            shift.longitude
          );
          
          // Convert to meters (100 meters = 0.1 km)
          const distanceInMeters = distance * 1000;
          
          if (distanceInMeters <= 100) {
            return { 
              valid: true, 
              locationName: shift.location_name,
              message: `Check-in successful at ${shift.location_name}`
            };
          }
        }
      }

      return { 
        valid: false, 
        message: 'You are not within the allowed check-in range for this location. Please move closer to your assigned work location.'
      };
    } catch (error) {
      console.error('Error validating location:', error);
      return { valid: false, message: 'Error validating location. Please try again.' };
    }
  };

  const checkIn = async () => {
    try {
      setCheckingIn(true);
      setLocationError('');
      setError('');
      
      const location = await getCurrentLocation();
      if (!location) {
        setError('Unable to get your current location. Please enable location services and try again.');
        return;
      }

      // Validate location against assigned shift
      const locationValidation = await validateLocationForShift(location.latitude, location.longitude);
      
      if (!locationValidation.valid) {
        setLocationError(locationValidation.message);
        return;
      }

      const deviceType = getDeviceType();
      
      const checkInData = {
        timestamp: new Date().toISOString(),
        latitude: location.latitude,
        longitude: location.longitude,
        locationName: locationValidation.locationName,
        deviceType: deviceType
      };

      await api.post('/shifts/check-in', checkInData);
      
      setSuccessMessage(`Check-In Successfully at ${locationValidation.locationName}`);
      setShowSuccessPopup(true);
      
      // Reload shifts to show updated status
      await loadShifts();
      
      // Hide success message after 6 seconds
      setTimeout(() => setShowSuccessPopup(false), 6000);
      
    } catch (error) {
      console.error('Error checking in:', error);
      setError('Failed to check in. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  const checkOut = async () => {
    try {
      setCheckingOut(true);
      setLocationError('');
      setError('');
      
      const location = await getCurrentLocation();
      if (!location) {
        setError('Unable to get your current location. Please enable location services and try again.');
        return;
      }

      // For check-out, we'll be more lenient with location validation
      // but still check if they're reasonably close to any work location
      const today = new Date().toISOString().slice(0, 10);
      const todayShifts = shifts.filter(shift => shift.date === today);
      
      let locationName = 'Unknown Location';
      if (todayShifts.length > 0 && todayShifts[0].location_name) {
        locationName = todayShifts[0].location_name;
      }
      
      const checkOutData = {
        timestamp: new Date().toISOString(),
        latitude: location.latitude,
        longitude: location.longitude,
        locationName: locationName
      };

      await api.post('/shifts/check-out', checkOutData);
      
      setSuccessMessage(`Check-Out Successfully from ${locationName}`);
      setShowSuccessPopup(true);
      
      // Reload shifts to show updated status
      await loadShifts();
      
      // Hide success message after 6 seconds
      setTimeout(() => setShowSuccessPopup(false), 6000);
      
    } catch (error) {
      console.error('Error checking out:', error);
      setError('Failed to check out. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  const exportToExcel = () => {
    const shiftsData = shifts.map(shift => ({
      Date: new Date(shift.date).toLocaleDateString('en-GB'),
      'Start Time': formatTime12h(shift.start_time),
      'End Time': formatTime12h(shift.end_time),
      Location: shift.location_name || '—',
      'Created At': new Date(shift.created_at).toLocaleDateString('en-GB')
    }));

    const ws = XLSX.utils.json_to_sheet(shiftsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shifts');
    XLSX.writeFile(wb, `shifts_${user?.name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const formatTime12h = (time) => {
    if (!time) return '—';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType) {
      case 'mobile':
        return <DevicePhoneMobileIcon className="h-5 w-5 text-blue-600" />;
      case 'tablet':
        return <DeviceTabletIcon className="h-5 w-5 text-green-600" />;
      case 'desktop':
      default:
        return <ComputerDesktopIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTodayShifts = () => {
    const today = new Date().toISOString().slice(0, 10);
    return shifts.filter(shift => shift.date === today);
  };

  const todayShifts = getTodayShifts();

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
        <h1 className="text-2xl font-bold text-gray-900">My Shifts</h1>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-md p-4 shadow-lg">
          <div className="flex items-center">
            <CheckIcon className="h-5 w-5 text-green-400 mr-2" />
            <p className="text-sm font-medium text-green-800">{successMessage}</p>
            <button
              onClick={() => setShowSuccessPopup(false)}
              className="ml-4 text-green-400 hover:text-green-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="mt-2 w-full bg-green-200 rounded-full h-1">
            <div className="bg-green-500 h-1 rounded-full animate-[shrink_6s_linear_forwards]"></div>
          </div>
          <style>{`
            @keyframes shrink {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}</style>
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

      {/* Location Error Message */}
      {locationError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">{locationError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Shift Actions */}
      <Card title="Shift Actions">
        <div className="space-y-4">
          <div className="flex gap-4">
            <button
              onClick={checkIn}
              disabled={checkingIn}
              className="flex-1 bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors"
            >
              {checkingIn ? 'Checking In...' : 'Check-In'}
            </button>
            <button
              onClick={checkOut}
              disabled={checkingOut}
              className="flex-1 bg-red-600 text-white px-4 py-3 rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
            >
              {checkingOut ? 'Checking Out...' : 'Check-Out'}
            </button>
          </div>
          
          <div className="text-sm text-gray-600 space-y-1">
            <p>• Automatically captures your current date, time, and location</p>
            <p>• Uses high-accuracy GPS positioning</p>
            <p>• Check-in only allowed within 100 meters of your assigned work location</p>
          </div>

          {/* Today's Shift Snippet */}
          {todayShifts.length > 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">Today's Shift</h4>
              {todayShifts.map((shift, index) => (
                <div key={shift.id} className="text-sm text-blue-700">
                  <p>
                    <ClockIcon className="h-4 w-4 inline mr-1" />
                    {formatTime12h(shift.start_time)} - {formatTime12h(shift.end_time)}
                  </p>
                  <p>
                    <MapPinIcon className="h-4 w-4 inline mr-1" />
                    {shift.location_name || 'Location not specified'}
                  </p>
                  {shift.latitude && shift.longitude && (
                    <p className="text-xs text-blue-600">
                      GPS: {shift.latitude.toFixed(6)}, {shift.longitude.toFixed(6)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 italic">No shift scheduled for today</p>
            </div>
          )}
        </div>
      </Card>

      {/* My Live Schedule */}
      <Card 
        title="My Live Schedule" 
        actions={
          <button
            onClick={exportToExcel}
            className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
          >
            Export to Excel
          </button>
        }
      >
        {shifts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No confirmed schedules this week</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Start Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">End Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Location</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift, index) => {
                  const isToday = shift.date === new Date().toISOString().slice(0, 10);
                  return (
                    <tr 
                      key={shift.id} 
                      className={`border-b border-gray-100 ${isToday ? 'bg-blue-50' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {new Date(shift.date).toLocaleDateString('en-GB')}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {formatTime12h(shift.start_time)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {formatTime12h(shift.end_time)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <MapPinIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {shift.location_name || '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Login History */}
      <Card 
        title="Login History"
        actions={
          <div className="flex gap-2">
            <button
              onClick={exportToExcel}
              className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
            >
              Export to Excel
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">In Time</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">In Location</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Out Time</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Out Location</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Device</th>
              </tr>
            </thead>
            <tbody>
              {/* This would be populated with actual check-in/check-out data */}
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-500 italic">No login history available</td>
                <td className="py-3 px-4"></td>
                <td className="py-3 px-4"></td>
                <td className="py-3 px-4"></td>
                <td className="py-3 px-4"></td>
                <td className="py-3 px-4"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}