import { UseFormReturn } from 'react-hook-form';
import { SettingsFormValues } from '../schemas/settings.schema';
import { Input } from '@/components/ui/input';

export function PrinterSettingsCard({ form }: { form: UseFormReturn<SettingsFormValues> }) {
  const { register } = form;

  return (
    <div className="bg-white rounded-xl border p-6 font-poppins shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Printer Configuration</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Printer Name</label>
          <Input {...register('defaultPrinter')} placeholder="e.g. Epson TM-T88VI" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Paper Size</label>
          <select 
            {...register('paperSize')} 
            className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
          >
            <option value="A4">A4 Standard</option>
            <option value="80mm Thermal">80mm Thermal</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Print Copies per Check-In</label>
          <Input type="number" {...register('printCopies', { valueAsNumber: true })} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <input 
            type="checkbox" 
            {...register('autoPrintAfterCheckIn')} 
            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-600"
          />
          <span className="text-sm font-medium text-gray-700">Auto Print After Check-In</span>
        </label>
        <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <input 
            type="checkbox" 
            {...register('enableReprintConfirmation')} 
            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-600"
          />
          <span className="text-sm font-medium text-gray-700">Require Confirmation on Reprint</span>
        </label>
      </div>
    </div>
  );
}
