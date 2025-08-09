import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { user, logout } = useAuth();
  return (
    <div className="w-full bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="text-lg font-semibold">HR Dashboard</div>
        <div className="flex items-center gap-4">
          {user && (
            <div className="text-sm text-gray-700">
              <span className="font-medium">{user.name}</span>
              <span className="mx-2">•</span>
              <span className="uppercase text-xs bg-gray-100 px-2 py-1 rounded">{user.role}</span>
            </div>
          )}
          <button onClick={logout} className="text-sm text-red-600 hover:text-red-700">Logout</button>
        </div>
      </div>
    </div>
  );
}