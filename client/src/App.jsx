import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import NavBar from './components/NavBar.jsx';
import Login from './pages/Login.jsx';
import ViewerDashboard from './pages/ViewerDashboard.jsx';

import EmployeeLayout from './pages/EmployeeLayout.jsx';
import EmployeeDashboard from './pages/Employee/Dashboard.jsx';
import EmployeeShifts from './pages/Employee/Shifts.jsx';
import EmployeeTasks from './pages/Employee/Tasks.jsx';
import EmployeeRequests from './pages/Employee/Requests.jsx';

import ManagerLayout from './pages/ManagerLayout.jsx';
import ManagerDashboard from './pages/Manager/Dashboard.jsx';
import ManagerShifts from './pages/Manager/Shifts.jsx';
import ManagerEmployees from './pages/Manager/Employees.jsx';
import ManagerAssignTasks from './pages/Manager/AssignTasks.jsx';

function Protected({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <div className="max-w-6xl mx-auto w-full p-4 flex-1">
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<Protected><Navigate to="/employee/dashboard" /></Protected>} />

            <Route path="/viewer" element={<Protected roles={["Viewer", "Manager"]}><ViewerDashboard /></Protected>} />

            <Route path="/employee" element={<Protected roles={["Employee"]}><EmployeeLayout /></Protected>}>
              <Route path="dashboard" element={<EmployeeDashboard />} />
              <Route path="shifts" element={<EmployeeShifts />} />
              <Route path="tasks" element={<EmployeeTasks />} />
              <Route path="requests" element={<EmployeeRequests />} />
            </Route>

            <Route path="/manager" element={<Protected roles={["Manager"]}><ManagerLayout /></Protected>}>
              <Route path="dashboard" element={<ManagerDashboard />} />
              <Route path="shifts" element={<ManagerShifts />} />
              <Route path="employees" element={<ManagerEmployees />} />
              <Route path="assign-tasks" element={<ManagerAssignTasks />} />
            </Route>
          </Routes>
        </div>
      </div>
    </AuthProvider>
  );
}