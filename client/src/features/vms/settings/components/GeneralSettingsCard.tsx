import { UseFormReturn } from 'react-hook-form';
import { SettingsFormValues } from '../schemas/settings.schema';
import { Input } from '@/components/ui/input';

export function GeneralSettingsCard({ form }: { form: UseFormReturn<SettingsFormValues> }) {
  const { register, formState: { errors } } = form;

  return (
    <div className="bg-white rounded-xl border p-6 font-poppins shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">General Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
          <Input {...register('companyName')} className={errors.companyName ? 'border-red-500' : ''} />
          {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reception Name</label>
          <Input {...register('receptionName')} className={errors.receptionName ? 'border-red-500' : ''} />
          {errors.receptionName && <p className="text-red-500 text-xs mt-1">{errors.receptionName.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Time Zone</label>
          <select 
            {...register('defaultTimeZone')} 
            className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="Europe/London">London (GMT/BST)</option>
            <option value="Asia/Kolkata">India Standard Time (IST)</option>
            <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Visitor Pass Expiry (Minutes)</label>
          <Input 
            type="number" 
            {...register('visitorPassExpiryMinutes', { valueAsNumber: true })} 
            className={errors.visitorPassExpiryMinutes ? 'border-red-500' : ''} 
          />
          {errors.visitorPassExpiryMinutes && <p className="text-red-500 text-xs mt-1">{errors.visitorPassExpiryMinutes.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Hours Start</label>
          <Input type="time" {...register('businessHoursStart')} className={errors.businessHoursStart ? 'border-red-500' : ''} />
          {errors.businessHoursStart && <p className="text-red-500 text-xs mt-1">{errors.businessHoursStart.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Hours End</label>
          <Input type="time" {...register('businessHoursEnd')} className={errors.businessHoursEnd ? 'border-red-500' : ''} />
          {errors.businessHoursEnd && <p className="text-red-500 text-xs mt-1">{errors.businessHoursEnd.message}</p>}
        </div>
      </div>
    </div>
  );
}
