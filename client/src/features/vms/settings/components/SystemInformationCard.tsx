import { VMSSettings } from '../types/settings.types';
import { CheckCircle, Clock, Server, Shield } from 'lucide-react';

export function SystemInformationCard({ settings }: { settings: VMSSettings | undefined }) {
  const defaultPlaceholder = '--';

  return (
    <div className="bg-gray-50 rounded-xl border p-6 font-poppins shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <Server className="w-5 h-5 text-gray-500" />
        System Information
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Frontend App Version</p>
          <p className="font-medium font-mono text-sm">{settings?.applicationVersion || 'v1.0.0-rc1'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Backend Core Version</p>
          <p className="font-medium font-mono text-sm">{settings?.backendVersion || defaultPlaceholder}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Environment</p>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-600" />
            <p className="font-medium font-mono text-sm">{settings?.environment || 'Production'}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Database Status</p>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <p className="font-medium font-mono text-sm text-green-700">{settings?.databaseStatus || 'Connected'}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Last Sync</p>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <p className="font-medium text-sm">
              {settings?.lastSync ? new Date(settings.lastSync).toLocaleString() : 'Just now'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
