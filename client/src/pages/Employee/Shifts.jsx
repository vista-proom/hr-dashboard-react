import React, { useEffect, useState, useMemo } from 'react';
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
  const { user, getCurrentLocation, getDeviceType, socket } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // New: check-in/out sessions
  const [sessions, setSessions] = useState([]);

  // New: sorting/filtering for My Live Schedule
  const [scheduleQuery, setScheduleQuery] = useState('');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    loadData();
  }, []);

  const reloadSessions = async () => {
    try {
      const sessionsRes = await api.get('/shifts');
      setSessions(sessionsRes.data || []);
    } catch (e) {
      // ignore
    }
  };

  const reloadLocations = async () => {
    try {
      const locationsRes = await api.get('/locations');
      setLocations(locationsRes.data || []);
    } catch (e) {
      // ignore
    }
  };

  // Real-time updates via socket
  useEffect(() => {
    if (!socket || !user) return;

    const onCreated = (shift) => {
      setSessions((prev) => [shift, ...prev]);
    };
    const onUpdated = (shift) => {
      setSessions((prev) => prev.map((s) => (s.id === shift.id ? { ...s, ...shift } : s)));
    };
    const onDeleted = ({ id }) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    };
    const onLocationsUpdated = () => {
      reloadLocations();
    };

    socket.on('shift-created', onCreated);
    socket.on('shift-updated', onUpdated);
    socket.on('shift-deleted', onDeleted);
    socket.on('locations-updated', onLocationsUpdated);

    return () => {
      socket.off('shift-created', onCreated);
      socket.off('shift-updated', onUpdated);
      socket.off('shift-deleted', onDeleted);
      socket.off('locations-updated', onLocationsUpdated);
    };
  }, [socket, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [assignedRes, loginHistoryRes, locationsRes, sessionsRes] = await Promise.all([
        api.get('/employee-shifts/me'),
        api.get('/auth/login-history'),
        api.get('/locations'),
        api.get('/shifts')
      ]);
      setShifts(assignedRes.data);
      setLoginHistory(loginHistoryRes.data);
      setLocations(locationsRes.data || []);
      setSessions(sessionsRes.data || []);
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
      setTimeout(() => setShowSuccessPopup(false), 6000);
      // Refresh live data
      await reloadSessions();
      
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
      setTimeout(() => setShowSuccessPopup(false), 6000);
      // Refresh live data
      await reloadSessions();
      
    } catch (error) {
      console.error('Error checking out:', error);
      setError('Failed to check out. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  // Week number helper (Saturday-based)
  const weekNumberFromISO = (iso) => {
    const [y,m,d] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(y, m-1, d));
    const startOfYear = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    // move to Saturday of that week
    const day = date.getUTCDay();
    const saturday = new Date(date); saturday.setUTCDate(date.getUTCDate() - ((day + 1) % 7));
    const satYear0 = new Date(startOfYear); satYear0.setUTCDate(startOfYear.getUTCDate() - ((startOfYear.getUTCDay()+1)%7));
    const diffDays = Math.floor((saturday - satYear0) / (1000*60*60*24));
    return Math.floor(diffDays/7) + 1;
  };

  const exportScheduleToPDF = () => {
    if (!shifts || shifts.length === 0) {
      alert('No schedule data available to export.');
      return;
    }
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const todayIso = new Date().toISOString().slice(0,10);
    const week = weekNumberFromISO(todayIso);
    const title = `My Live Schedule - ${user?.name || ''} (Week ${week})`;
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

    doc.save(`shifts_${(user?.name || 'me').replace(/\s+/g,'_')}_${week}.pdf`);
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

  const getDeviceLabel = (deviceType) => {
    switch ((deviceType || '').toLowerCase()) {
      case 'mobile':
        return { label: 'Mobile', icon: <DevicePhoneMobileIcon className="h-5 w-5" /> };
      case 'tablet':
        return { label: 'Tablet', icon: <DeviceTabletIcon className="h-5 w-5" /> };
      default:
        return { label: 'PC', icon: <ComputerDesktopIcon className="h-5 w-5" /> };
    }
  };

  // Proximity helpers for Login History location rendering
  const distanceInKm = (lat1, lon1, lat2, lon2) => {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const nearestSavedLocation = (lat, lng) => {
    if (lat == null || lng == null) return null;
    let nearest = null;
    let minDistance = Infinity;
    for (const loc of locations) {
      if (loc.latitude == null || loc.longitude == null) continue;
      const d = distanceInKm(lat, lng, loc.latitude, loc.longitude);
      if (d < minDistance) {
        minDistance = d;
        nearest = loc;
      }
    }
    return minDistance <= 0.1 ? nearest : null; // within 100 meters
  };

  const googleMapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

  const getTodayShifts = () => {
    const today = new Date().toISOString().slice(0, 10);
    return shifts.filter(shift => shift.date === today);
  };

  const todayShifts = getTodayShifts();

  // Determine open session (for disabling buttons)
  const openSession = useMemo(() => (sessions || []).find(s => !s.check_out_time), [sessions]);
  const lastSession = useMemo(() => (sessions || [])[0] || null, [sessions]);

  // Derived schedule grid with filtering and sorting
  const filteredSortedShifts = useMemo(() => {
    const q = scheduleQuery.trim().toLowerCase();
    const data = (shifts || []).filter(s => (
      !q || new Date(s.date).toLocaleDateString('en-GB').toLowerCase().includes(q) ||
      (s.location_name || '').toLowerCase().includes(q)
    ));
    const compare = (a, b) => {
      let av, bv;
      switch (sortKey) {
        case 'date': av = a.date; bv = b.date; break;
        case 'start_time': av = a.start_time; bv = b.start_time; break;
        case 'end_time': av = a.end_time; bv = b.end_time; break;
        case 'location_name': av = a.location_name || ''; bv = b.location_name || ''; break;
        case 'status': {
          const sa = scheduleStatus(a); const sb = scheduleStatus(b); av = sa; bv = sb; break;
        }
        default: av = a.date; bv = b.date;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    };
    return data.slice().sort(compare);
  }, [shifts, scheduleQuery, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const scheduleStatus = (s) => {
    // Determine Upcoming / Ongoing / Completed based on current time
    const now = new Date();
    const start = new Date(`${s.date}T${s.start_time}`);
    const end = new Date(`${s.date}T${s.end_time}`);
    if (now < start) return 'Upcoming';
    if (now >= start && now <= end) return 'Ongoing';
    return 'Completed';
  };

  // Total hours for today
  const todayTotalHours = useMemo(() => {
    return todayShifts.reduce((sum, s) => {
      const start = new Date(`${s.date}T${s.start_time}`);
      const end = new Date(`${s.date}T${s.end_time}`);
      return sum + Math.max(0, (end - start) / (1000*60*60));
    }, 0);
  }, [todayShifts]);

  // --- Redesigned Login History (using sessions/shifts) ---
  const formattedSessions = useMemo(() => {
    return (sessions || []).map(s => {
      const date = s.check_in_date || s.check_out_date || (s.check_in_time ? new Date(s.check_in_time).toISOString().slice(0,10) : null);
      const inLoc = s.check_in_lat != null && s.check_in_lng != null ? { lat: s.check_in_lat, lng: s.check_in_lng } : null;
      const outLoc = s.check_out_lat != null && s.check_out_lng != null ? { lat: s.check_out_lat, lng: s.check_out_lng } : null;
      const nearIn = inLoc ? nearestSavedLocation(inLoc.lat, inLoc.lng) : null;
      const nearOut = outLoc ? nearestSavedLocation(outLoc.lat, outLoc.lng) : null;
      return {
        id: s.id,
        date: date ? new Date(date).toLocaleDateString('en-GB') : '—',
        inTime: s.check_in_time_12h || '—',
        outTime: s.check_out_time_12h || '—',
        inLink: inLoc ? googleMapsLink(inLoc.lat, inLoc.lng) : null,
        outLink: outLoc ? googleMapsLink(outLoc.lat, outLoc.lng) : null,
        inLabel: nearIn ? `#${nearIn.name}` : (inLoc ? 'Open in Maps' : 'Location Unavailable'),
        outLabel: nearOut ? `#${nearOut.name}` : (outLoc ? 'Open in Maps' : 'Location Unavailable'),
        device: s.device_type || 'desktop'
      };
    });
  }, [sessions, locations]);

  // Responsive table row renderer
  const LoginRow = ({ row, index }) => {
    const { label, icon } = getDeviceLabel(row.device);
    return (
      <tr className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100`}>
        <td className="py-3 px-4">{row.date}</td>
        <td className="py-3 px-4">{row.inTime}</td>
        <td className="py-3 px-4">
          {row.inLink ? (
            <a href={row.inLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{row.inLabel}</a>
          ) : (
            <span className="text-gray-400">Location Unavailable</span>
          )}
        </td>
        <td className="py-3 px-4">{row.outTime}</td>
        <td className="py-3 px-4">
          {row.outLink ? (
            <a href={row.outLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{row.outLabel}</a>
          ) : (
            <span className="text-gray-400">Location Unavailable</span>
          )}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2 text-gray-700">
            {icon}
            <span className="text-sm">{label}</span>
          </div>
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Shifts</h1>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-md p-4 shadow-lg">
          <div className="flex items-center">
            <CheckIcon className="h-5 w-5 text-green-400 mr-2" />
            <p className="text-sm font-medium text-green-800">{successMessage}</p>
            <button onClick={() => setShowSuccessPopup(false)} className="ml-4 text-green-400 hover:text-green-600">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 w-full bg-green-200 rounded-full h-1">
            <div className="bg-green-500 h-1 rounded-full animate-[shrink_6s_linear_forwards]"></div>
          </div>
          <style>{`
            @keyframes shrink { from { width: 100%; } to { width: 0%; } }
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
          <div className="flex gap-4 items-center">
            <button
              onClick={checkIn}
              disabled={checkingIn || !!openSession}
              title={openSession ? 'You are already checked in' : ''}
              className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
            >
              {checkingIn ? 'Checking In...' : 'Check-In'}
            </button>
            <button
              onClick={checkOut}
              disabled={checkingOut || !openSession}
              title={!openSession ? 'No open session to check out' : ''}
              className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed"
            >
              {checkingOut ? 'Checking Out...' : 'Check-Out'}
            </button>
            {openSession && (
              <span className="ml-2 inline-flex items-center text-green-700 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500 mr-1"></span> Active session
              </span>
            )}
          </div>
          {lastSession && (
            <div className="text-xs text-gray-600">
              <div>Last Check-In: {lastSession.check_in_time ? new Date(lastSession.check_in_time).toLocaleString('en-GB') : '—'}</div>
              <div>Last Check-Out: {lastSession.check_out_time ? new Date(lastSession.check_out_time).toLocaleString('en-GB') : '—'}</div>
            </div>
          )}

          {/* Today's Shift Snippet */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-blue-800">Today's Shift</h4>
              <span className="text-xs text-blue-800">Total: {todayTotalHours.toFixed(1)}h</span>
            </div>
            {todayShifts.length > 0 ? (
              <div className="grid gap-2">
                {todayShifts.map((shift) => {
                  const status = scheduleStatus(shift);
                  const badge = status === 'Ongoing' ? 'bg-green-100 text-green-800' : status === 'Upcoming' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700';
                  return (
                    <div key={shift.id} className="rounded-md bg-white border border-blue-100 p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm"><span className="mr-1">🕒</span>{formatTime12h(shift.start_time)} - {formatTime12h(shift.end_time)}</div>
                        <div className="text-xs text-gray-600"><span className="mr-1">📍</span>{shift.location_name || 'Location not specified'}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${badge}`}>{status}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-600 italic">No shift scheduled for today</p>
            )}
          </div>
        </div>
      </Card>

      {/* My Live Schedule */}
      <Card title="My Live Schedule" actions={
        <div className="flex items-center gap-2">
          <button onClick={exportScheduleToPDF} className="border border-blue-600 text-blue-600 px-2 py-1 rounded text-xs hover:bg-blue-50">Export to PDF</button>
        </div>
      }>
        <div className="mb-2 flex items-center gap-2">
          <input value={scheduleQuery} onChange={(e)=>setScheduleQuery(e.target.value)} placeholder="Filter by date or location..." className="w-full px-3 py-2 border border-gray-300 rounded-md" />
        </div>
        {filteredSortedShifts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No confirmed schedules</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer" onClick={()=>toggleSort('date')}>Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer" onClick={()=>toggleSort('start_time')}>Start Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer" onClick={()=>toggleSort('end_time')}>End Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer" onClick={()=>toggleSort('location_name')}>Location</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer" onClick={()=>toggleSort('status')}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSortedShifts.map((shift) => {
                  const isToday = shift.date === new Date().toISOString().slice(0, 10);
                  const status = scheduleStatus(shift);
                  return (
                    <tr key={shift.id} className={`border-b border-gray-100 ${isToday ? 'bg-blue-50' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {new Date(shift.date).toLocaleDateString('en-GB')}
                        </div>
                      </td>
                      <td className="py-3 px-4"><div className="flex items-center"><ClockIcon className="h-4 w-4 text-gray-400 mr-2" />{formatTime12h(shift.start_time)}</div></td>
                      <td className="py-3 px-4"><div className="flex items-center"><ClockIcon className="h-4 w-4 text-gray-400 mr-2" />{formatTime12h(shift.end_time)}</div></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <MapPinIcon className="h-4 w-4 text-gray-400" />
                          {shift.latitude != null && shift.longitude != null ? (
                            <a href={googleMapsLink(shift.latitude, shift.longitude)} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">{shift.location_name || '—'}</a>
                          ) : (
                            <span>{shift.location_name || '—'}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded ${status==='Ongoing'?'bg-green-100 text-green-800':status==='Upcoming'?'bg-blue-100 text-blue-800':'bg-gray-100 text-gray-700'}`}>{status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Login History - Redesigned */}
      <Card title="Login History" actions={
        <button onClick={exportLoginHistoryToExcel} className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors text-sm">Export to Excel</button>
      }>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Check-In Time</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Check-In Location</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Check-Out Time</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Check-Out Location</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Device</th>
              </tr>
            </thead>
            <tbody>
              {formattedSessions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 px-4 text-center text-gray-500 italic">No history available</td>
                </tr>
              ) : (
                formattedSessions.map((row, idx) => (
                  <LoginRow key={row.id} row={row} index={idx} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {formattedSessions.length === 0 ? (
            <div className="py-4 text-center text-gray-500 italic">No history available</div>
          ) : (
            formattedSessions.map((row) => {
              const { label, icon } = getDeviceLabel(row.device);
              return (
                <div key={row.id} className="border rounded-lg p-4 bg-white">
                  <div className="text-sm text-gray-900 font-medium">Date: {row.date}</div>
                  <div className="text-sm text-gray-700 mt-1">
                    Check-In: {row.inTime} at {row.inLink ? (
                      <a href={row.inLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{row.inLabel}</a>
                    ) : (
                      <span className="text-gray-400">Location Unavailable</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    Check-Out: {row.outTime} at {row.outLink ? (
                      <a href={row.outLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{row.outLabel}</a>
                    ) : (
                      <span className="text-gray-400">Location Unavailable</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-gray-700 mt-2">
                    {icon}
                    <span className="text-sm">Device: {label}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}