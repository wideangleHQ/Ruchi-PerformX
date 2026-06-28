import { UseFormReturn } from 'react-hook-form';
import { SettingsFormValues } from '../schemas/settings.schema';
import { Input } from '@/components/ui/input';

export function CameraSettingsCard({ form }: { form: UseFormReturn<SettingsFormValues> }) {
  const { register } = form;

  return (
    <div className="bg-white rounded-xl border p-6 font-poppins shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Camera Configuration</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Camera Device</label>
          <Input {...register('defaultCamera')} placeholder="e.g. Logitech C920" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resolution</label>
          <select 
            {...register('resolution')} 
            className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
          >
            <option value="1280x720">720p HD</option>
            <option value="1920x1080">1080p FHD</option>
            <option value="640x480">480p SD</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Image Quality</label>
          <select 
            {...register('imageQuality')} 
            className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
          >
            <option value="Low">Low (Fast Upload)</option>
            <option value="Medium">Medium (Balanced)</option>
            <option value="High">High (Best Detail)</option>
          </select>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <input 
            type="checkbox" 
            {...register('autoCapture')} 
            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-600"
          />
          <span className="text-sm font-medium text-gray-700">Enable Auto-Capture</span>
        </label>
        <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <input 
            type="checkbox" 
            {...register('mirrorPreview')} 
            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-600"
          />
          <span className="text-sm font-medium text-gray-700">Mirror Camera Preview</span>
        </label>
      </div>
    </div>
  );
}
