import { UseFormReturn } from 'react-hook-form';
import { EmployeeRequestFormValues } from '../schemas/employee-request.schema';

export function PurposeField({ form }: { form: UseFormReturn<EmployeeRequestFormValues> }) {
  const { register, formState: { errors } } = form;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">Purpose of Visit *</label>
      <textarea
        {...register('purpose')}
        rows={4}
        maxLength={500}
        placeholder="Briefly describe the purpose of the visit..."
        className={`w-full p-3 rounded-md border bg-background text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${errors.purpose ? 'border-red-500' : 'border-input'}`}
      />
      <div className="flex justify-between items-center mt-1">
        {errors.purpose ? (
          <p className="text-red-500 text-xs">{errors.purpose.message}</p>
        ) : (
          <span />
        )}
        <p className="text-xs text-gray-400 font-medium text-right">Max 500 characters</p>
      </div>
    </div>
  );
}
