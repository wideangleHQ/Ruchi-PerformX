import { UseFormReturn } from 'react-hook-form';
import { SettingsFormValues } from '../schemas/settings.schema';

export function ReceptionSettingsCard({ form }: { form: UseFormReturn<SettingsFormValues> }) {
  const { register } = form;

  const toggles = [
    { name: 'enableWalkInVisitors', label: 'Enable Walk-In Visitors' },
    { name: 'enableEmployeeRequests', label: 'Enable Employee Requests' },
    { name: 'requireVisitorPhoto', label: 'Require Visitor Photo' },
    { name: 'requireMobileNumber', label: 'Require Mobile Number' },
    { name: 'requireAddress', label: 'Require Address' },
    { name: 'requirePurpose', label: 'Require Purpose' },
  ] as const;

  return (
    <div className="bg-white rounded-xl border p-6 font-poppins shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Reception Policy</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Check-In Status</label>
          <select 
            {...register('defaultCheckInStatus')} 
            className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
          >
            <option value="INSIDE">Inside</option>
            <option value="PENDING">Pending Approval</option>
          </select>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {toggles.map(toggle => (
          <label key={toggle.name} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
            <input 
              type="checkbox" 
              {...register(toggle.name)} 
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-600"
            />
            <span className="text-sm font-medium text-gray-700">{toggle.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
