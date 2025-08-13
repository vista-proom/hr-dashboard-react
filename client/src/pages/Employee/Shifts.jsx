import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../../api';
import Card from '../../components/Card';
import { useAuth } from '../../context/AuthContext';

const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];

function formatDay(dateStr) { 
  const d = new Date(dateStr+'T00:00:00'); 
  return days[(d.getDay()+1)%7]; 
}

function to12h(t) { 
  if(!t) return '—'; 
  const [h,m] = t.split(':').map(Number); 
  const am = h < 12; 
  const hh = ((h+11)%12)+1; 
  return `${hh}:${String(m??0).padStart(2,'0')} ${am?'AM':'PM'}`; 
}

function getWeekStart(dateStr) { 
  const d = new Date(dateStr+'T00:00:00'); 
  const shift = (d.getDay()+1)%7; 
  const start = new Date(d); 
  start.setDate(d.getDate()-shift); 
  return start; 
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

function formatTime12h(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = ((hours + 11) % 12) + 1;
  return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function getGoogleMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function DeviceIcon({ deviceType }) {
  if (deviceType === 'mobile') {
    return (
      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm3 14a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
    </svg>
  );
}

function SuccessPopup({ message, isVisible, onClose }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (isVisible) {
      setProgress(100);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev <= 0) {
            clearInterval(interval);
            onClose();
            return 0;
          }
          return prev - (100 / 60); // 6 seconds = 60 * 100ms
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg min-w-80">
      <div className="flex items-center space-x-3">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        <span className="font-medium">{message}</span>
      </div>
      <div className="mt-3 bg-green-400 rounded-full h-2">
        <div 
          className="bg-white h-2 rounded-full transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function WeekSelectionPopup({ isVisible, onClose, onWeekSelect, selectedWeeks }) {
  const [selected, setSelected] = useState(selectedWeeks || []);
  const currentYear = new Date().getFullYear();
  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

  const handleDone = () => {
    onWeekSelect(selected);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Select Weeks to View</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Week Numbers ({currentYear})
          </label>
          <select
            multiple
            value={selected}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => Number(option.value));
              setSelected(values);
            }}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            size="8"
          >
            {weeks.map(week => (
              <option key={week} value={week}>Week {week}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple weeks</p>
        </div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function WeekSchedule({ week, entries, isExpanded, onToggle }) {
  const currentDay = new Date().getDay();
  const adjustedCurrentDay = (currentDay + 1) % 7; // Adjust for Saturday start

  return (
    <div className="border border-gray-200 rounded-lg mb-4">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
      >
        <span className="font-medium text-gray-800">Week {week}</span>
        <svg 
          className={`w-5 h-5 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b-2 border-gray-200">
                  <th className="py-3 px-2 font-semibold text-gray-700">Day</th>
                  <th className="py-3 px-2 font-semibold text-gray-700">Time</th>
                  <th className="py-3 px-2 font-semibold text-gray-700">Location</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d, index) => (
                  <tr 
                    key={d} 
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      index === adjustedCurrentDay ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <td className="py-3 px-2 w-32 font-medium text-gray-800">
                      {d}
                      {index === adjustedCurrentDay && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Today
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 w-64">
                      <div className="space-y-2">
                        {entries.filter(e => formatDay(e.date) === d).sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')).map((e,idx) => (
                          <div key={idx} className="text-gray-700">
                            {to12h(e.start_time)} - {to12h(e.end_time)}
                          </div>
                        ))}
                        {entries.filter(e => formatDay(e.date) === d).length === 0 && 
                          <span className="text-xs text-gray-400 italic">No shifts</span>
                        }
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="space-y-2">
                        {entries.filter(e => formatDay(e.date) === d).sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')).map((e,idx) => (
                          <div key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium inline-block">
                            {String(e.location_id || '—')}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Shifts() {
  const { getCurrentLocation, getDeviceType } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showWeekSelection, setShowWeekSelection] = useState(false);
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  const [expandedWeeks, setExpandedWeeks] = useState([]);
  const scheduleRef = useRef(null);

  const refresh = async () => {
    const [s, live] = await Promise.all([
      api.get('/shifts/me'),
      api.get('/schedules/me'), // This already filters out drafts (includeDraft: false)
    ]);
    setShifts(s.data);
    setSchedule(live.data);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const checkIn = async () => {
    setError('');
    setCheckingIn(true);
    
    try {
      const location = await getCurrentLocation();
      if (!location) {
        setError('Unable to get your location. Please ensure location permissions are enabled.');
        return;
      }
      
      const deviceType = getDeviceType();
      await api.post('/shifts/check-in', { location, deviceType });
      await refresh();
      
      setSuccessMessage('Check-In Successfully');
      setShowSuccessPopup(true);
    } catch (e) {
      setError(e?.response?.data?.error || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const checkOut = async () => {
    setError('');
    setCheckingOut(true);
    
    try {
      const location = await getCurrentLocation();
      if (!location) {
        setError('Unable to get your location. Please ensure location permissions are enabled.');
        return;
      }
      
      await api.post('/shifts/check-out', { location });
      await refresh();
      
      setSuccessMessage('Check-Out Successfully');
      setShowSuccessPopup(true);
    } catch (e) {
      setError(e?.response?.data?.error || 'Check-out failed');
    } finally {
      setCheckingOut(false);
    }
  };

  const exportExcel = () => {
    if (shifts.length === 0) return;
    
    const exportData = shifts.map(shift => ({
      'Date': shift.check_in_date || '—',
      'In Time': shift.check_in_time_12h || '—',
      'In Location': shift.check_in_location_name || 
                    (shift.check_in_lat && shift.check_in_lng ? 
                     `${shift.check_in_lat}, ${shift.check_in_lng}` : '—'),
      'Out Time': shift.check_out_time_12h || '—',
      'Out Location': shift.check_out_location_name || 
                     (shift.check_out_lat && shift.check_out_lng ? 
                      `${shift.check_out_lat}, ${shift.check_out_lng}` : '—'),
      'Device Type': shift.device_type || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Login History');
    
    // Auto-size columns
    const colWidths = [];
    exportData.forEach(row => {
      Object.keys(row).forEach((key, index) => {
        colWidths[index] = Math.max(colWidths[index] || 0, key.length, String(row[key]).length);
      });
    });
    
    ws['!cols'] = colWidths.map(width => ({ width: Math.min(width + 2, 50) }));
    
    XLSX.writeFile(wb, `login_history_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportPDF = () => {
    if (!scheduleRef.current) return;
    const html = scheduleRef.current.innerHTML;
    const w = window.open('', '_blank'); 
    if (!w) return;
    w.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>My Schedule</title>
          <style>
            body { font-family: sans-serif; padding: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 6px; text-align: left; }
            th { background-color: #f9fafb; font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>My Schedule</h1>
          ${html}
        </body>
      </html>
    `);
    w.document.close(); 
    w.focus(); 
    w.print(); 
    w.close();
  };

  const handleWeekSelect = (weeks) => {
    setSelectedWeeks(weeks);
    setExpandedWeeks([]);
  };

  const toggleWeekExpansion = (week) => {
    setExpandedWeeks(prev => 
      prev.includes(week) 
        ? prev.filter(w => w !== week)
        : [...prev, week]
    );
  };

  // Get current week's schedule (only confirmed schedules)
  const currentWeekSchedule = useMemo(() => {
    const now = new Date();
    const weekStart = getWeekStart(now.toISOString().slice(0, 10));
    const weekKey = weekStart.toISOString().slice(0, 10);
    
    const weekEntries = schedule.filter(s => {
      const entryWeekStart = getWeekStart(s.date);
      return entryWeekStart.toISOString().slice(0, 10) === weekKey;
    });
    
    return weekEntries;
  }, [schedule]);

  // Calculate total hours for current week
  const currentWeekHours = useMemo(() => {
    return currentWeekSchedule.reduce((total, entry) => {
      if (entry.start_time && entry.end_time) {
        const start = new Date(`2000-01-01T${entry.start_time}`);
        const end = new Date(`2000-01-01T${entry.end_time}`);
        const hours = (end - start) / (1000 * 60 * 60);
        return total + hours;
      }
      return total;
    }, 0);
  }, [currentWeekSchedule]);

  // Calculate hours per location for current week
  const locationHours = useMemo(() => {
    const locationMap = new Map();
    currentWeekSchedule.forEach(entry => {
      if (entry.start_time && entry.end_time && entry.location_id) {
        const start = new Date(`2000-01-01T${entry.start_time}`);
        const end = new Date(`2000-01-01T${entry.end_time}`);
        const hours = (end - start) / (1000 * 60 * 60);
        const current = locationMap.get(entry.location_id) || 0;
        locationMap.set(entry.location_id, current + hours);
      }
    });
    return locationMap;
  }, [currentWeekSchedule]);

  // Group schedule by weeks for selected weeks (only confirmed schedules)
  const selectedWeeksSchedule = useMemo(() => {
    if (selectedWeeks.length === 0) return [];
    
    const weekMap = new Map();
    schedule.forEach(entry => {
      const weekNum = getWeekNumber(entry.date);
      if (selectedWeeks.includes(weekNum)) {
        if (!weekMap.has(weekNum)) {
          weekMap.set(weekNum, []);
        }
        weekMap.get(weekNum).push(entry);
      }
    });
    
    return Array.from(weekMap.entries()).sort((a, b) => a[0] - b[0]);
  }, [schedule, selectedWeeks]);

  if (loading) return <div className="flex justify-center items-center h-64"><div className="text-lg">Loading…</div></div>;

  return (
    <div className="space-y-6">
      {/* Success Popup */}
      <SuccessPopup 
        message={successMessage}
        isVisible={showSuccessPopup}
        onClose={() => setShowSuccessPopup(false)}
      />

      {/* Week Selection Popup */}
      <WeekSelectionPopup
        isVisible={showWeekSelection}
        onClose={() => setShowWeekSelection(false)}
        onWeekSelect={handleWeekSelect}
        selectedWeeks={selectedWeeks}
      />

      <Card 
        title="Shift Actions" 
        actions={
          <div className="space-x-3">
            <button 
              className={`px-4 py-2 rounded font-medium transition-colors ${
                checkingIn 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`} 
              onClick={checkIn}
              disabled={checkingIn}
            >
              {checkingIn ? 'Checking In...' : 'Check-In'}
            </button>
            <button 
              className={`px-4 py-2 rounded font-medium transition-colors ${
                checkingOut 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-gray-700 text-white hover:bg-gray-800'
              }`} 
              onClick={checkOut}
              disabled={checkingOut}
            >
              {checkingOut ? 'Checking Out...' : 'Check-Out'}
            </button>
          </div>
        }
      >
        {error && <div className="text-red-600 text-sm mb-3 p-3 bg-red-50 rounded border border-red-200">{error}</div>}
        <div className="text-sm text-gray-600 space-y-2">
          <p>• Automatically captures your current date, time, and location</p>
          <p>• Uses high-accuracy GPS positioning</p>
        </div>
      </Card>

      <Card 
        title="My Live Schedule" 
        actions={
          <div className="space-x-3">
            <button 
              onClick={exportExcel} 
              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition-colors"
            >
              Export to Excel
            </button>
            <button 
              onClick={exportPDF} 
              className="bg-gray-800 text-white px-3 py-2 rounded hover:bg-gray-900 transition-colors"
            >
              Export to PDF
            </button>
          </div>
        }
      >
        {currentWeekSchedule.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">No confirmed schedules for this week.</div>
        ) : (
          <div className="space-y-4" ref={scheduleRef}>
            {/* Summary Information */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">Weekly Summary</h4>
                  <p className="text-sm text-blue-700">
                    Total Working Hours: <span className="font-semibold">{currentWeekHours.toFixed(1)} hours</span>
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">Hours by Location</h4>
                  {Array.from(locationHours.entries()).map(([locationId, hours]) => (
                    <p key={locationId} className="text-sm text-blue-700">
                      Location {locationId}: <span className="font-semibold">{hours.toFixed(1)} hours</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Current Week Schedule */}
            <div className="text-lg font-medium text-gray-800 border-b pb-2">
              Current Week Schedule
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b-2 border-gray-200">
                    <th className="py-3 px-2 font-semibold text-gray-700">Day</th>
                    <th className="py-3 px-2 font-semibold text-gray-700">Time</th>
                    <th className="py-3 px-2 font-semibold text-gray-700">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d, index) => {
                    const currentDay = new Date().getDay();
                    const adjustedCurrentDay = (currentDay + 1) % 7;
                    const isToday = index === adjustedCurrentDay;
                    
                    return (
                      <tr 
                        key={d} 
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          isToday ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                        }`}
                      >
                        <td className="py-3 px-2 w-32 font-medium text-gray-800">
                          {d}
                          {isToday && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              Today
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 w-64">
                          <div className="space-y-2">
                            {currentWeekSchedule.filter(e => formatDay(e.date) === d).sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')).map((e,idx) => (
                              <div key={idx} className="text-gray-700">
                                {to12h(e.start_time)} - {to12h(e.end_time)}
                              </div>
                            ))}
                            {currentWeekSchedule.filter(e => formatDay(e.date) === d).length === 0 && 
                              <span className="text-xs text-gray-400 italic">No shifts</span>
                            }
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="space-y-2">
                            {currentWeekSchedule.filter(e => formatDay(e.date) === d).sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')).map((e,idx) => (
                              <div key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium inline-block">
                                {String(e.location_id || '—')}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Show More Link */}
            <div className="text-center pt-4">
              <button
                onClick={() => setShowWeekSelection(true)}
                className="text-blue-600 hover:text-blue-800 underline text-sm font-medium"
              >
                Show More
              </button>
            </div>

            {/* Selected Weeks Schedule */}
            {selectedWeeks.length > 0 && (
              <div className="mt-6">
                <div className="text-lg font-medium text-gray-800 border-b pb-2 mb-4">
                  Additional Weeks
                </div>
                {selectedWeeksSchedule.map(([week, entries]) => (
                  <WeekSchedule
                    key={week}
                    week={week}
                    entries={entries}
                    isExpanded={expandedWeeks.includes(week)}
                    onToggle={() => toggleWeekExpansion(week)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Login History">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b-2 border-gray-200">
                <th className="py-3 px-2 font-semibold text-gray-700">Date</th>
                <th className="py-3 px-2 font-semibold text-gray-700">In Time</th>
                <th className="py-3 px-2 font-semibold text-gray-700">In Location</th>
                <th className="py-3 px-2 font-semibold text-gray-700">Out Time</th>
                <th className="py-3 px-2 font-semibold text-gray-700">Out Location</th>
                <th className="py-3 px-2 font-semibold text-gray-700">Device</th>
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500">
                    No login history available
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => (
                  <tr key={shift.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-800">
                      {shift.check_in_date || '—'}
                    </td>
                    <td className="py-3 px-2 text-gray-700">
                      {shift.check_in_time_12h || '—'}
                    </td>
                    <td className="py-3 px-2">
                      {shift.check_in_location_name ? (
                        <div className="text-blue-600 font-medium">{shift.check_in_location_name}</div>
                      ) : shift.check_in_lat && shift.check_in_lng ? (
                        <a 
                          href={getGoogleMapsUrl(shift.check_in_lat, shift.check_in_lng)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-xs underline"
                        >
                          View on Google Maps
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-gray-700">
                      {shift.check_out_time_12h || '—'}
                    </td>
                    <td className="py-3 px-2">
                      {shift.check_out_location_name ? (
                        <div className="text-green-600 font-medium">{shift.check_out_location_name}</div>
                      ) : shift.check_out_lat && shift.check_out_lng ? (
                        <a 
                          href={getGoogleMapsUrl(shift.check_out_lat, shift.check_out_lng)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-xs underline"
                        >
                          View on Google Maps
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-center">
                        <DeviceIcon deviceType={shift.device_type} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}