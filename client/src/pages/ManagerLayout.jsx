import React from 'react';
import WithSidebar from '../layouts/WithSidebar';
import { Outlet } from 'react-router-dom';

const items = [
  { to: '/manager/dashboard', label: 'Dashboard' },
  { to: '/manager/shifts', label: 'Shifts' },
  { to: '/manager/assign-tasks', label: 'Assign Tasks' },
  { to: '/manager/employees', label: 'Employees' },
  { to: '/manager/requests', label: 'Employee Requests' },
  { to: '/manager/directory', label: 'Directory' },
];

export default function ManagerLayout() {
  return (
    <WithSidebar items={items}>
      <Outlet />
    </WithSidebar>
  );
}