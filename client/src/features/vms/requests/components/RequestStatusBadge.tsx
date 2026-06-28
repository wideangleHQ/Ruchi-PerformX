import { VisitorRequestStatus } from '../types/request.types';

interface RequestStatusBadgeProps {
  status: VisitorRequestStatus;
}

export function RequestStatusBadge({ status }: RequestStatusBadgeProps) {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-700';

  if (status === VisitorRequestStatus.APPROVED) {
    bgColor = 'bg-green-100';
    textColor = 'text-green-700';
  } else if (status === VisitorRequestStatus.REJECTED || status === VisitorRequestStatus.CANCELLED) {
    bgColor = 'bg-red-100';
    textColor = 'text-red-700';
  } else if (status === VisitorRequestStatus.PENDING) {
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-700';
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor} font-poppins`}>
      {status}
    </span>
  );
}
