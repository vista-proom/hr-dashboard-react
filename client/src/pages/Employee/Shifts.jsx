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
    const onAssignedShiftDeleted = ({ id }) => {
      // Refresh assigned shifts when one is deleted
      loadData();
    };

    socket.on('shift-created', onCreated);
    socket.on('shift-updated', onUpdated);
    socket.on('shift-deleted', onDeleted);
    socket.on('locations-updated', onLocationsUpdated);
    socket.on('assigned-shift-deleted', onAssignedShiftDeleted);

    return () => {
      socket.off('shift-created', onCreated);
      socket.off('shift-updated', onUpdated);
      socket.off('shift-deleted', onDeleted);
      socket.off('locations-updated', onLocationsUpdated);
      socket.off('assigned-shift-deleted', onAssignedShiftDeleted);
    };
  }, [socket, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [assignedRes, loginHistoryRes, locationsRes, sessionsRes] = await Promise.all([
        api.get('/employee-shifts/me'),
        api.get('/shifts/login-history'),
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
      
      // Find nearby saved location if within 100 meters
      let locationName = null;
      if (location?.latitude && location?.longitude) {
        const nearbyLocation = nearestSavedLocation(location.latitude, location.longitude);
        if (nearbyLocation) {
          locationName = nearbyLocation.name;
        }
      }
      
      const checkInData = {
        timestamp: new Date().toISOString(),
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        locationName: locationName,
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
      const deviceType = getDeviceType();
      
      // Find nearby saved location if within 100 meters
      let locationName = null;
      if (location?.latitude && location?.longitude) {
        const nearbyLocation = nearestSavedLocation(location.latitude, location.longitude);
        if (nearbyLocation) {
          locationName = nearbyLocation.name;
        }
      }
      
      const checkOutData = {
        timestamp: new Date().toISOString(),
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        locationName: locationName,
        deviceType: deviceType
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

    // Group shifts by date for PDF export
    const groupedShifts = groupShiftsByDate(shifts);
    
    const rows = groupedShifts.map(dayGroup => {
      const shiftsText = dayGroup.shifts.map(shift => 
        `${formatTime12h(shift.start_time)} – ${formatTime12h(shift.end_time)}`
      ).join('\n');
      
      const totalHours = dayGroup.shifts.reduce((sum, shift) => {
        const start = new Date(`${dayGroup.date}T${shift.start_time}`);
        const end = new Date(`${dayGroup.date}T${shift.end_time}`);
        return sum + Math.max(0, (end - start) / (1000*60*60));
      }, 0);
      
      const locationsText = dayGroup.shifts.map(shift => 
        shift.location_name || '—'
      ).join('\n');
      
      return [
        new Date(dayGroup.date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        dayGroup.dayName,
        shiftsText,
        `${totalHours.toFixed(1)}h`,
        locationsText
      ];
    });

    doc.autoTable({
      startY: 60,
      head: [['Date', 'Day', 'Shifts', 'Total Hours', 'Locations']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: { 
        0: { cellWidth: 80 }, 
        1: { cellWidth: 60 }, 
        2: { cellWidth: 120 }, 
        3: { cellWidth: 60 },
        4: { cellWidth: 'auto' }
      }
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

  const googleMapsLink = (lat, lng) => `https://maps.google.com/?q=${lat},${lng}`;

  // Group shifts by date for the new table format
  const groupShiftsByDate = (shifts) => {
    const grouped = {};
    
    shifts.forEach(shift => {
      if (!grouped[shift.date]) {
        const date = new Date(shift.date);
        grouped[shift.date] = {
          date: shift.date,
          dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
          shifts: []
        };
      }
      grouped[shift.date].shifts.push(shift);
    });
    
    // Sort shifts within each day by start time
    Object.values(grouped).forEach(dayGroup => {
      dayGroup.shifts.sort((a, b) => a.start_time.localeCompare(b.start_time));
    });
    
    // Convert to array and sort by date
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  };

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

  // --- Login History table data (from /api/shifts/login-history) ---
  const formatDateDDMMYYYY = (isoDate) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    if (!y || !m || !d) return '';
    return `${d}/${m}/${y}`;
  };

  const formattedLoginHistory = useMemo(() => {
    return (loginHistory || []).map((item, idx) => {
      const inHasCoords = item.checkInLat != null && item.checkInLon != null;
      const outHasCoords = item.checkOutLat != null && item.checkOutLon != null;
      const inLabel = item.checkInResolvedLocation ? `#${item.checkInResolvedLocation}` : (inHasCoords ? 'UN-KNOWN' : '');
      const outLabel = item.checkOutResolvedLocation ? `#${item.checkOutResolvedLocation}` : (outHasCoords ? 'UN-KNOWN' : '');
      return {
        id: `${item.date}-${idx}`,
        date: formatDateDDMMYYYY(item.date),
        inTime: item.checkInTime || '',
        outTime: item.checkOutTime || '',
        inLink: inHasCoords ? googleMapsLink(item.checkInLat, item.checkInLon) : null,
        outLink: outHasCoords ? googleMapsLink(item.checkOutLat, item.checkOutLon) : null,
        inLabel,
        outLabel,
        deviceDisplay: `${item.checkInDevice || ''} | ${item.checkOutDevice || ''}`
      };
    });
  }, [loginHistory]);

  // Responsive table row renderer
  const LoginRow = ({ row, index }) => {
    return (
      <tr className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100`}>
        <td className="py-3 px-4">{row.date}</td>
        <td className="py-3 px-4">{row.inTime}</td>
        <td className="py-3 px-4">
          {row.inLink && row.inLabel ? (
            <a href={row.inLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{row.inLabel}</a>
          ) : (
            <span className="text-gray-400"></span>
          )}
        </td>
        <td className="py-3 px-4">{row.outTime}</td>
        <td className="py-3 px-4">
          {row.outLink && row.outLabel ? (
            <a href={row.outLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{row.outLabel}</a>
          ) : (
            <span className="text-gray-400"></span>
          )}
        </td>
        <td className="py-3 px-4">
          <div className="text-gray-700 text-sm">{row.deviceDisplay}</div>
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
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={()=>toggleSort('date')}>Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors" onClick={()=>toggleSort('date')}>Day</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Shifts (start time – end time)</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Total Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Locations</th>
                </tr>
              </thead>
              <tbody>
                {groupShiftsByDate(filteredSortedShifts).map((dayGroup) => {
                  const isToday = dayGroup.date === new Date().toISOString().slice(0, 10);
                  const isWeekend = ['Saturday', 'Sunday'].includes(dayGroup.dayName);
                  const totalHours = dayGroup.shifts.reduce((sum, shift) => {
                    const start = new Date(`${shift.date}T${shift.start_time}`);
                    const end = new Date(`${shift.date}T${shift.end_time}`);
                    return sum + Math.max(0, (end - start) / (1000*60*60));
                  }, 0);
                  
                  return (
                    <tr key={dayGroup.date} className={`border-b border-gray-100 ${
                      isToday ? 'bg-blue-50' : 
                      isWeekend ? 'bg-gray-50' : 
                      'hover:bg-gray-50'
                    }`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {new Date(dayGroup.date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-medium ${isWeekend ? 'text-orange-600' : 'text-gray-700'}`}>
                          {dayGroup.dayName}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {dayGroup.shifts.map((shift, index) => (
                            <div key={shift.id} className="flex items-center text-sm">
                              <ClockIcon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                              <span className="font-medium">{formatTime12h(shift.start_time)}</span>
                              <span className="mx-2 text-gray-400">–</span>
                              <span className="font-medium">{formatTime12h(shift.end_time)}</span>
                              {index < dayGroup.shifts.length - 1 && (
                                <div className="ml-2 w-px h-4 bg-gray-300"></div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-gray-900">
                          {totalHours.toFixed(1)}h
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {dayGroup.shifts.map((shift, index) => {
                            const location = shift.location_name || '—';
                            const hasCoordinates = shift.latitude != null && shift.longitude != null;
                            const nearbyLocation = hasCoordinates ? nearestSavedLocation(shift.latitude, shift.longitude) : null;
                            
                            return (
                              <div key={shift.id} className="flex items-center text-sm">
                                <MapPinIcon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                                {hasCoordinates ? (
                                  <a 
                                    href={googleMapsLink(shift.latitude, shift.longitude)} 
                                    className="text-blue-600 hover:underline hover:text-blue-800 transition-colors" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                  >
                                    {nearbyLocation ? `#${nearbyLocation.name}` : location}
                                  </a>
                                ) : (
                                  <span className="text-gray-600">{location}</span>
                                )}
                                {index < dayGroup.shifts.length - 1 && (
                                  <div className="ml-2 w-px h-4 bg-gray-300"></div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Mobile cards */}
        <div className="md:hidden space-y-3 mt-4">
          {groupShiftsByDate(filteredSortedShifts).map((dayGroup) => {
            const isToday = dayGroup.date === new Date().toISOString().slice(0, 10);
            const isWeekend = ['Saturday', 'Sunday'].includes(dayGroup.dayName);
            const totalHours = dayGroup.shifts.reduce((sum, shift) => {
              const start = new Date(`${shift.date}T${shift.start_time}`);
              const end = new Date(`${shift.date}T${shift.end_time}`);
              return sum + Math.max(0, (end - start) / (1000*60*60));
            }, 0);
            
            return (
              <div key={dayGroup.date} className={`border rounded-lg p-4 ${
                isToday ? 'bg-blue-50 border-blue-200' : 
                isWeekend ? 'bg-gray-50 border-gray-200' : 
                'bg-white border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <div className="font-semibold text-gray-900">
                        {new Date(dayGroup.date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                      <div className={`text-sm ${isWeekend ? 'text-orange-600' : 'text-gray-600'}`}>
                        {dayGroup.dayName}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {totalHours.toFixed(1)}h
                    </div>
                    <div className="text-xs text-gray-500">Total</div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {dayGroup.shifts.map((shift, index) => (
                    <div key={shift.id} className="border-l-2 border-blue-200 pl-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center text-sm">
                          <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="font-medium">{formatTime12h(shift.start_time)}</span>
                          <span className="mx-2 text-gray-400">–</span>
                          <span className="font-medium">{formatTime12h(shift.end_time)}</span>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPinIcon className="h-4 w-4 text-gray-400 mr-2" />
                        {shift.latitude != null && shift.longitude != null ? (
                          <a 
                            href={googleMapsLink(shift.latitude, shift.longitude)} 
                            className="text-blue-600 hover:underline hover:text-blue-800" 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            {nearestSavedLocation(shift.latitude, shift.longitude) 
                              ? `#${nearestSavedLocation(shift.latitude, shift.longitude).name}` 
                              : (shift.location_name || 'Open in Maps')}
                          </a>
                        ) : (
                          <span>{shift.location_name || '—'}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
              {formattedLoginHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 px-4 text-center text-gray-500 italic">No history available</td>
                </tr>
              ) : (
                formattedLoginHistory.map((row, idx) => (
                  <LoginRow key={row.id} row={row} index={idx} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {formattedLoginHistory.length === 0 ? (
            <div className="py-4 text-center text-gray-500 italic">No history available</div>
          ) : (
            formattedLoginHistory.map((row) => {
              return (
                <div key={row.id} className="border rounded-lg p-4 bg-white">
                  <div className="text-sm text-gray-900 font-medium">Date: {row.date}</div>
                  <div className="text-sm text-gray-700 mt-1">
                    Check-In: {row.inTime} {row.inLink && row.inLabel ? (
                      <>at <a href={row.inLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{row.inLabel}</a></>
                    ) : null}
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    Check-Out: {row.outTime} {row.outLink && row.outLabel ? (
                      <>at <a href={row.outLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{row.outLabel}</a></>
                    ) : null}
                  </div>
                  <div className="text-gray-700 mt-2 text-sm">Device: {row.deviceDisplay}</div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}