import { memo } from 'react';
import { EmployeeInfo } from '../types/employee-request.types';
import { User, Briefcase, MapPin, Building } from 'lucide-react';

export const EmployeeInfoCard = memo(function EmployeeInfoCard({ employee }: { employee: EmployeeInfo }) {
  return (
    <div className="bg-gray-50 border rounded-xl p-5 mb-8">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Requesting As</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-start gap-2">
          <User className="w-4 h-4 text-gray-400 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">Employee Name</p>
            <p className="font-medium text-sm text-gray-900">{employee.fullName}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Building className="w-4 h-4 text-gray-400 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">Department</p>
            <p className="font-medium text-sm text-gray-900">{employee.department}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Briefcase className="w-4 h-4 text-gray-400 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">Designation</p>
            <p className="font-medium text-sm text-gray-900">{employee.designation}</p>
          </div>
        </div>
        {employee.location && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Location</p>
              <p className="font-medium text-sm text-gray-900">{employee.location}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
