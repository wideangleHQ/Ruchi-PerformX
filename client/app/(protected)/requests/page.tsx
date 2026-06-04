'use client';

import { Link as LinkIcon } from 'lucide-react';

export default function RequestsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Requests</h1>
      <p className="mt-2 text-gray-600">Request management page</p>
      
      <div className="mt-8 rounded-lg bg-gray-50 p-8 text-center">
        <LinkIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-4 text-gray-600">Request management features coming soon</p>
      </div>
    </div>
  );
}
