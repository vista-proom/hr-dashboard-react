import React from 'react';
import Sidebar from '../components/Sidebar';

export default function WithSidebar({ items, children }) {
  return (
    <div className="flex gap-4">
      <Sidebar items={items} />
      <div className="flex-1 space-y-4">{children}</div>
    </div>
  );
}