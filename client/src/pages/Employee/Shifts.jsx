import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
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
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function Shifts() {
  const { user, getCurrentLocation, getDeviceType } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [shiftsRes, loginHistoryRes, locationsRes] = await Promise.all([
        api.get('/employee-shifts/me'),
        api.get('/auth/login-history'),
        api.get('/locations')
      ]);
      setShifts(shiftsRes.data);
      setLoginHistory(loginHistoryRes.data);
      setLocations(locationsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkIn = async () => {
    try {
      setCheckingIn(true);
      const location = await getCurrentLocation();
      const deviceType = getDeviceType();
      
      const checkInData = {
        timestamp: new Date().toISOString(),
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        locationName: location?.name || null,
        deviceType: deviceType
      };

      await api.post('/shifts/check-in', checkInData);
      
      setSuccessMessage('Check-In Successfully');
      setShowSuccessPopup(true);
      
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
      const location = await getCurrentLocation();
      
      const checkOutData = {
        timestamp: new Date().toISOString(),
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        locationName: location?.name || null
      };

      await api.post('/shifts/check-out', checkOutData);
      
      setSuccessMessage('Check-Out Successfully');
      setShowSuccessPopup(true);
      
      // Hide success message after 6 seconds
      setTimeout(() => setShowSuccessPopup(false), 6000);
      
    } catch (error) {
      console.error('Error checking out:', error);
      setError('Failed to check out. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  const exportScheduleToPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const title = `My Live Schedule - ${user?.name || ''}`;
    doc.setFontSize(14);
    doc.text(title, 40, 40);

    const rows = shifts.map(shift => ([
      new Date(shift.date).toLocaleDateString('en-GB'),
      formatTime12h(shift.start_time),
      formatTime12h(shift.end_time),
      shift.location_name || '—'
    ]));

    doc.autoTable({
      startY: 60,
      head: [['Date', 'Start Time', 'End Time', 'Location']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 120 }, 2: { cellWidth: 120 }, 3: { cellWidth: 'auto' } }
    });

    doc.save(`my_live_schedule_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const exportLoginHistoryToExcel = () => {
    const loginHistoryData = loginHistory.map(login => ({
      'Login Date & Time': new Date(login.login_timestamp).toLocaleString('en-GB'),
      'Logout Date & Time': login.logout_timestamp ? new Date(login.logout_timestamp).toLocaleString('en-GB') : '—',
      'Device Info': login.device_info || '—',
      'IP Address': login.ip_address || '—',
      'User Agent': login.user_agent || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(loginHistoryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Login History');
    XLSX.writeFile(wb, `login_history_${user?.name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

  // Proximity helpers for Login History location rendering
  const distanceInKm = (lat1, lon1, lat2, lon2) => {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const nearestSavedLocation = (lat, lng) => {
    if (lat == null || lng == null) return null;
    let nearest = null;
    let minKm = Infinity;
    locations.forEach(loc => {
      if (loc.latitude != null && loc.longitude != null) {
        const d = distanceInKm(lat, lng, loc.latitude, loc.longitude);
        if (d < minKm) {
          minKm = d;
          nearest = { ...loc, distanceKm: d };
        }
      }
    });
    if (nearest && nearest.distanceKm <= 0.1) return nearest; // within 100m
    return null;
  };

  const googleMapsLink = (lat, lng) => `https://maps.google.com/?q=${lat},${lng}`;

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
            onClick={exportScheduleToPDF}
            className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            Export to PDF
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
          <button
            onClick={exportLoginHistoryToExcel}
            className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
          >
            Export to Excel
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Date & Time of Login</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Device / Browser Info</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">IP Address</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Logout Time</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">In Location</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Out Location</th>
              </tr>
            </thead>
            <tbody>
              {loginHistory.length === 0 ? (
                <tr className="border-b border-gray-100">
                  <td colSpan="6" className="py-8 px-4 text-center text-gray-500 italic">
                    No login history available
                  </td>
                </tr>
              ) : (
                loginHistory.map((login) => {
                  // try to find a shift on the same date for in/out coordinates
                  const loginDateISO = new Date(login.login_timestamp).toISOString().slice(0,10);
                  const relatedShift = shifts.find(s => s.check_in_date === loginDateISO || s.check_out_date === loginDateISO);
                  const inLat = relatedShift?.check_in_lat ?? null;
                  const inLng = relatedShift?.check_in_lng ?? null;
                  const outLat = relatedShift?.check_out_lat ?? null;
                  const outLng = relatedShift?.check_out_lng ?? null;
                  const nearIn = nearestSavedLocation(inLat, inLng);
                  const nearOut = nearestSavedLocation(outLat, outLng);
                  return (
                  <tr key={login.id} className="border-b border-gray-100">
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                        {new Date(login.login_timestamp).toLocaleString('en-GB')}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <ComputerDesktopIcon className="h-4 w-4 text-gray-400 mr-2" />
                        {login.device_info || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {login.ip_address || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {login.logout_timestamp ? (
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {new Date(login.logout_timestamp).toLocaleString('en-GB')}
                        </div>
                      ) : (
                        <span className="text-green-600 text-xs font-medium">Active Session</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {inLat != null && inLng != null ? (
                        nearIn ? (
                          <a className="text-blue-600 hover:underline" href={`https://maps.google.com/?q=${nearIn.latitude},${nearIn.longitude}`} target="_blank" rel="noreferrer">
                            {nearIn.name}
                          </a>
                        ) : (
                          <a className="text-blue-600 hover:underline" href={googleMapsLink(inLat, inLng)} target="_blank" rel="noreferrer">In Location</a>
                        )
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {outLat != null && outLng != null ? (
                        nearOut ? (
                          <a className="text-blue-600 hover:underline" href={`https://maps.google.com/?q=${nearOut.latitude},${nearOut.longitude}`} target="_blank" rel="noreferrer">
                            {nearOut.name}
                          </a>
                        ) : (
                          <a className="text-blue-600 hover:underline" href={googleMapsLink(outLat, outLng)} target="_blank" rel="noreferrer">Out Location</a>
                        )
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ); })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}