import { UseFormReturn } from 'react-hook-form';
import { EmployeeRequestFormValues } from '../schemas/employee-request.schema';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PurposeField } from './PurposeField';
import { PreferredSchedule } from './PreferredSchedule';
import { Loader2 } from 'lucide-react';

interface VisitorRequestFormProps {
  form: UseFormReturn<EmployeeRequestFormValues>;
  onSubmit: (values: EmployeeRequestFormValues) => void;
  isPending: boolean;
}

export function VisitorRequestForm({ form, onSubmit, isPending }: VisitorRequestFormProps) {
  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Visitor Name *</label>
          <Input {...register('visitorName')} className={errors.visitorName ? 'border-red-500' : ''} />
          {errors.visitorName && <p className="text-red-500 text-xs mt-1">{errors.visitorName.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Mobile Number *</label>
          <Input {...register('mobileNumber')} className={errors.mobileNumber ? 'border-red-500' : ''} />
          {errors.mobileNumber && <p className="text-red-500 text-xs mt-1">{errors.mobileNumber.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Company *</label>
          <Input {...register('company')} className={errors.company ? 'border-red-500' : ''} />
          {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Address *</label>
          <Input {...register('address')} className={errors.address ? 'border-red-500' : ''} />
          {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
        </div>
      </div>

      <PreferredSchedule form={form} />

      <PurposeField form={form} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Remarks (Optional)</label>
        <Input {...register('remarks')} />
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => form.reset()}
          disabled={isPending}
        >
          Reset
        </Button>
        <Button 
          type="submit" 
          disabled={isPending}
          className="bg-green-600 hover:bg-green-700 text-white min-w-[140px]"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Submit Request
        </Button>
      </div>
    </form>
  );
}
