import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function NavBar() {
  const { user, logout } = useAuth();
  return (
    <div className="w-full bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="text-lg font-semibold"><Link to={user?.role === 'Manager' ? '/manager/dashboard' : '/employee/dashboard'}>HR Dashboard</Link></div>
        <div className="flex items-center gap-4">
          {user && (
            <div className="text-sm text-gray-700 flex items-center gap-2">
              <img src={user.avatarUrl || 'https://via.placeholder.com/32'} alt="avatar" className="w-6 h-6 rounded-full border" />
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