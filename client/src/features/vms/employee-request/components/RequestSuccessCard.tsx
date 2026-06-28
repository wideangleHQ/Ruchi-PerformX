import { VisitorRequestResponse } from '../types/employee-request.types';
import { CheckCircle2, Calendar, Clock, User, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RequestSuccessCardProps {
  request: VisitorRequestResponse;
  onReset: () => void;
}

export function RequestSuccessCard({ request, onReset }: RequestSuccessCardProps) {
  return (
    <div className="bg-white rounded-2xl p-8 border shadow-sm max-w-lg w-full text-center font-poppins">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>
      
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted</h2>
      <p className="text-gray-500 mb-8">
        Your visitor request has been sent to Reception for approval.
      </p>

      <div className="bg-gray-50 rounded-xl p-6 text-left space-y-4 mb-8">
        <div className="flex items-center gap-3">
          <Hash className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Request Number</p>
            <p className="font-semibold text-gray-900 font-mono">{request.requestNumber}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <User className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Visitor Name</p>
            <p className="font-medium text-gray-900">{request.visitorName}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Date</p>
              <p className="font-medium text-gray-900">{new Date(request.preferredDate).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Time</p>
              <p className="font-medium text-gray-900">{request.preferredTime}</p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            {request.status}
          </span>
        </div>
      </div>

      <Button onClick={onReset} className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-xl">
        Create Another Request
      </Button>
    </div>
  );
}
