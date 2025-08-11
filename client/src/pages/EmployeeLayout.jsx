import React from 'react';
import WithSidebar from '../layouts/WithSidebar';
import { Outlet } from 'react-router-dom';

const items = [
  { to: '/employee/dashboard', label: 'Dashboard' },
  { to: '/employee/shifts', label: 'Shifts' },
  { to: '/employee/tasks', label: 'Tasks' },
  { to: '/employee/requests', label: 'Requests' },
  { to: '/employee/profile', label: 'Profile' },
  { to: '/employee/directory', label: 'Directory' },
];

export default function EmployeeLayout() {
  return (
    <WithSidebar items={items}>
      <Outlet />
    </WithSidebar>
  );
}