import { VisitStatus } from '../types/appointment.types';

interface AppointmentStatusBadgeProps {
  status: VisitStatus;
}

export function AppointmentStatusBadge({ status }: AppointmentStatusBadgeProps) {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-700';

  switch (status) {
    case VisitStatus.SCHEDULED:
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-700';
      break;
    case VisitStatus.COMPLETED:
      bgColor = 'bg-green-100';
      textColor = 'text-green-700';
      break;
    case VisitStatus.CANCELLED:
      bgColor = 'bg-red-100';
      textColor = 'text-red-700';
      break;
    case VisitStatus.EXPIRED:
    case VisitStatus.NO_SHOW:
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
