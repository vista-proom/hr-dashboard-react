import React from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      <Card title={`Welcome, ${user?.name}`}> 
        <div className="text-sm text-gray-700">Role: {user?.role} • Home location: {user?.homeLocation} • Required hours: {user?.requiredHours}h</div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Shifts">
          <div className="text-sm text-gray-600">Use the Shifts tab to check in/out and view your history.</div>
        </Card>
        <Card title="Tasks">
          <div className="text-sm text-gray-600">View and update task status under Tasks.</div>
        </Card>
        <Card title="Requests">
          <div className="text-sm text-gray-600">Coming soon.</div>
        </Card>
      </div>
    </div>
  );
}