import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import NavBar from './components/NavBar.jsx';
import Login from './pages/Login.jsx';
import EmployeeDashboard from './pages/EmployeeDashboard.jsx';
import ViewerDashboard from './pages/ViewerDashboard.jsx';
import ManagerDashboard from './pages/ManagerDashboard.jsx';

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
            <Route
              path="/"
              element={
                <Protected>
                  <EmployeeDashboard />
                </Protected>
              }
            />
            <Route
              path="/viewer"
              element={
                <Protected roles={["Viewer", "Manager"]}>
                  <ViewerDashboard />
                </Protected>
              }
            />
            <Route
              path="/manager"
              element={
                <Protected roles={["Manager"]}>
                  <ManagerDashboard />
                </Protected>
              }
            />
          </Routes>
        </div>
      </div>
    </AuthProvider>
  );
}