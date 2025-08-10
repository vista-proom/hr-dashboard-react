import React from 'react';
import Card from '../../components/Card';

export default function Dashboard() {
  return (
    <div className="space-y-4">
      <Card title="Manager Dashboard">
        <div className="text-sm text-gray-600">Use the sidebar to manage tasks, view shifts, and employees.</div>
      </Card>
    </div>
  );
}