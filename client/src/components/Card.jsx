import React from 'react';

export default function Card({ title, children, actions }) {
  return (
    <div className="bg-white rounded shadow-sm border border-gray-200">
      {title && (
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}