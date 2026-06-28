import { VisitStatus } from '../types/check-out.types';

interface VisitStatusBadgeProps {
  status: VisitStatus | string;
}

export function VisitStatusBadge({ status }: VisitStatusBadgeProps) {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-700';

  if (status === VisitStatus.INSIDE || status === 'ACTIVE') {
    bgColor = 'bg-blue-100';
    textColor = 'text-blue-700';
    status = 'INSIDE';
  } else if (status === VisitStatus.CHECKED_OUT) {
    bgColor = 'bg-green-100';
    textColor = 'text-green-700';
  } else if (status === VisitStatus.EXPIRED) {
    bgColor = 'bg-red-100';
    textColor = 'text-red-700';
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor} font-poppins`}>
      {status}
    </span>
  );
}
