import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

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

  const getCurrentLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ 
        latitude: pos.coords.latitude, 
        longitude: pos.coords.longitude, 
        timestamp: new Date().toISOString() 
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });

  const getDeviceType = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  };

  const value = useMemo(() => ({ user, token, login, logout, setUser, getCurrentLocation, getDeviceType }), [user, token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}