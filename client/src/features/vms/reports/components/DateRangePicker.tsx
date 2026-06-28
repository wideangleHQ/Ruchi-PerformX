import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface DateRangePickerProps {
  onDateChange: (from?: string, to?: string) => void;
}

export function DateRangePicker({ onDateChange }: DateRangePickerProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const handleBlur = () => {
    onDateChange(from || undefined, to || undefined);
  };

  return (
    <div className="flex gap-2 items-center font-poppins">
      <Input
        type="date"
        className="h-9 text-sm w-[140px]"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        onBlur={handleBlur}
      />
      <span className="text-gray-500 text-sm">to</span>
      <Input
        type="date"
        className="h-9 text-sm w-[140px]"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        onBlur={handleBlur}
      />
    </div>
  );
}
