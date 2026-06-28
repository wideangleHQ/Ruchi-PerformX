import { UseFormReturn } from 'react-hook-form';
import { SettingsFormValues } from '../schemas/settings.schema';
import { Input } from '@/components/ui/input';

export function SecuritySettingsCard({ form }: { form: UseFormReturn<SettingsFormValues> }) {
  const { register, formState: { errors } } = form;

  return (
    <div className="bg-white rounded-xl border p-6 font-poppins shadow-sm border-l-4 border-l-red-500">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Security & Access Limits</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Active Visits</label>
          <Input type="number" {...register('maxActiveVisits', { valueAsNumber: true })} className={errors.maxActiveVisits ? 'border-red-500' : ''} />
          {errors.maxActiveVisits && <p className="text-red-500 text-xs mt-1">{errors.maxActiveVisits.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Access Code Length</label>
          <Input type="number" {...register('accessCodeLength', { valueAsNumber: true })} className={errors.accessCodeLength ? 'border-red-500' : ''} />
          {errors.accessCodeLength && <p className="text-red-500 text-xs mt-1">{errors.accessCodeLength.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (Minutes)</label>
          <Input type="number" {...register('sessionTimeout', { valueAsNumber: true })} className={errors.sessionTimeout ? 'border-red-500' : ''} />
          {errors.sessionTimeout && <p className="text-red-500 text-xs mt-1">{errors.sessionTimeout.message}</p>}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <input 
            type="checkbox" 
            {...register('autoCheckOutAfterBusinessHours')} 
            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-600"
          />
          <span className="text-sm font-medium text-gray-700">Auto Check-Out after Business Hours</span>
        </label>
        <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <input 
            type="checkbox" 
            {...register('enableAuditLogging')} 
            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-600"
          />
          <span className="text-sm font-medium text-gray-700">Enable Strict Audit Logging</span>
        </label>
      </div>
    </div>
  );
}
