import { AuditStatus } from '../types/audit.types';

interface AuditStatusBadgeProps {
  status: AuditStatus | string;
}

export function AuditStatusBadge({ status }: AuditStatusBadgeProps) {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-700';

  switch (status) {
    case AuditStatus.SUCCESS:
    case 'Success':
      bgColor = 'bg-green-100';
      textColor = 'text-green-700';
      break;
    case AuditStatus.FAILED:
    case 'Failed':
      bgColor = 'bg-red-100';
      textColor = 'text-red-700';
      break;
    case AuditStatus.WARNING:
    case 'Warning':
      bgColor = 'bg-yellow-100';
      textColor = 'text-yellow-700';
      break;
    case AuditStatus.CANCELLED:
    case 'Cancelled':
      bgColor = 'bg-gray-100';
      textColor = 'text-gray-700';
      break;
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor} font-poppins`}>
      {status}
    </span>
  );
}
