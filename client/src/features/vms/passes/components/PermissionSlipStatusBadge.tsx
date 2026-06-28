import { PassStatus } from '../types/pass.types';

interface PermissionSlipStatusBadgeProps {
  status: string;
}

export function PermissionSlipStatusBadge({ status }: PermissionSlipStatusBadgeProps) {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-700';

  switch (status) {
    case PassStatus.GENERATED:
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-700';
      break;
    case PassStatus.PRINTED:
    case PassStatus.CHECKED_OUT:
      bgColor = 'bg-green-100';
      textColor = 'text-green-700';
      break;
    case PassStatus.CANCELLED:
      bgColor = 'bg-red-100';
      textColor = 'text-red-700';
      break;
    case PassStatus.EXPIRED:
      bgColor = 'bg-orange-100';
      textColor = 'text-orange-700';
      break;
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor} font-poppins`}>
      {status.replace('_', ' ')}
    </span>
  );
}
