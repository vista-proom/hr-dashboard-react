import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ items }) {
  const { user } = useAuth();
  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-56px)] p-4 sticky top-14">
      <div className="flex items-center gap-3 mb-6">
        <img src={user?.avatarUrl || 'https://via.placeholder.com/64'} alt="avatar" className="w-12 h-12 rounded-full border" />
        <div>
          <div className="font-semibold">{user?.name}</div>
          <div className="text-xs text-gray-500">{user?.email}</div>
          <div className="text-xs text-gray-400">ID: {user?.id}</div>
        </div>
      </div>
      <nav className="space-y-1">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded text-sm ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`
            }
          >
            {it.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}