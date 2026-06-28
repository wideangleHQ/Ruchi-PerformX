import { useEffect, useState } from 'react';

interface VisitDurationCardProps {
  checkInTime: string;
}

export function VisitDurationCard({ checkInTime }: VisitDurationCardProps) {
  const [durationStr, setDurationStr] = useState('');

  useEffect(() => {
    const updateDuration = () => {
      const start = new Date(checkInTime).getTime();
      const now = new Date().getTime();
      const diffMs = now - start;

      if (diffMs < 0) {
        setDurationStr('0m');
        return;
      }

      const diffMins = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;

      if (hours > 0) {
        setDurationStr(`${hours}h ${mins}m`);
      } else {
        setDurationStr(`${mins}m`);
      }
    };

    updateDuration();
    const interval = setInterval(updateDuration, 60000);
    return () => clearInterval(interval);
  }, [checkInTime]);

  return (
    <div className="bg-gray-50 border rounded-lg px-3 py-1 text-center inline-block">
      <span className="text-sm font-semibold text-gray-700 font-poppins">
        {durationStr}
      </span>
    </div>
  );
}
