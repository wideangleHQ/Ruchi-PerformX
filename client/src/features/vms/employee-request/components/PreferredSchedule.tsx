import { UseFormReturn } from 'react-hook-form';
import { EmployeeRequestFormValues } from '../schemas/employee-request.schema';
import { Input } from '@/components/ui/input';

export function PreferredSchedule({ form }: { form: UseFormReturn<EmployeeRequestFormValues> }) {
  const { register, formState: { errors } } = form;

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Preferred Date *</label>
        <Input 
          type="date" 
          min={today}
          {...register('preferredDate')}
          className={errors.preferredDate ? 'border-red-500' : ''}
        />
        {errors.preferredDate && <p className="text-red-500 text-xs mt-1">{errors.preferredDate.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Preferred Time *</label>
        <Input 
          type="time" 
          {...register('preferredTime')}
          className={errors.preferredTime ? 'border-red-500' : ''}
        />
        {errors.preferredTime && <p className="text-red-500 text-xs mt-1">{errors.preferredTime.message}</p>}
      </div>
    </div>
  );
}
