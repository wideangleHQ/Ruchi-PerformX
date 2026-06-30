interface VisitSummaryProps {
  visitorName?: string;
  hostName?: string;
  purpose?: string;
  peopleCount?: number;
}

export function VisitSummary({ visitorName, hostName, purpose, peopleCount = 1 }: VisitSummaryProps) {
  return (
    <div className="rounded-xl border bg-gray-50 p-6 shadow-sm space-y-4 font-poppins text-sm">
      <h3 className="font-semibold text-gray-900 text-base border-b pb-2">Visit Summary</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-gray-500 mb-1">Visitor</p>
          <p className="font-medium text-gray-900">{visitorName || 'Not selected'}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-1">Host Employee</p>
          <p className="font-medium text-gray-900">{hostName || 'Not selected'}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-1">Purpose</p>
          <p className="font-medium text-gray-900">{purpose || 'Not specified'}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-1">People Entering</p>
          <p className="font-medium text-gray-900">{peopleCount}</p>
        </div>
      </div>
    </div>
  );
}
