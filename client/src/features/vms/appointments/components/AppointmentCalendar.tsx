import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface AppointmentCalendarProps {
  onDateSelect: (date: string) => void;
}

export function AppointmentCalendar({ onDateSelect }: AppointmentCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const days = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const renderDays = () => {
    const daysArray = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      daysArray.push(<div key={`empty-${i}`} className="h-10 w-10"></div>);
    }
    for (let i = 1; i <= days; i++) {
      const isToday = new Date().getDate() === i && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
      
      const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

      daysArray.push(
        <button
          key={i}
          onClick={() => onDateSelect(dateString)}
          className={`h-10 w-10 flex items-center justify-center rounded-full text-sm font-medium transition-colors hover:bg-green-100 ${
            isToday ? 'bg-green-600 text-white hover:bg-green-700' : 'text-gray-700'
          }`}
        >
          {i}
        </button>
      );
    }
    return daysArray;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 font-poppins h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-2">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="text-xs font-semibold text-gray-400 py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 place-items-center">
        {renderDays()}
      </div>
    </div>
  );
}
