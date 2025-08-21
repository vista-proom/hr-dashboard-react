import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { io as socketIOClient } from 'socket.io-client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  // Initialize socket connection for real-time updates
  useEffect(() => {
    if (!user || !token) {
      if (socket) {
        try { socket.disconnect(); } catch {}
      }
      setSocket(null);
      return;
    }

    // Prefer explicit env, else infer server URL (fallback to same origin)
    const envUrl = import.meta?.env?.VITE_SOCKET_URL;
    let url = envUrl || '';
    if (!url) {
      const { protocol, hostname } = window.location;
      url = `${protocol}//${hostname}${window.location.port ? ':' + window.location.port : ''}`;
    }

    const s = socketIOClient(url, {
      withCredentials: true,
    });

    s.on('connect', () => {
      s.emit('join-user', user.id);
    });

    setSocket(s);

    return () => {
      try { s.disconnect(); } catch {}
    };
  }, [user, token]);

  const login = async (email, password) => {
    const resp = await api.post('/auth/login', { email, password });
    setToken(resp.data.token);
    setUser(resp.data.user);
    return resp.data.user;
  };

  const logout = async () => {
    try {
      // Call backend logout endpoint to record logout time
      if (token) {
        await api.post('/auth/logout');
      }
    } catch (error) {
      console.error('Error during logout:', error);
      // Continue with logout even if backend call fails
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  const getCurrentLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation is not supported by this browser.'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ 
        latitude: pos.coords.latitude, 
        longitude: pos.coords.longitude, 
        timestamp: new Date().toISOString() 
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  const getDeviceType = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  };

  const value = useMemo(() => ({ user, token, login, logout, setUser, getCurrentLocation, getDeviceType, socket }), [user, token, socket]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}