import { VisitorRequestResponse, VisitorRequestStatus } from '../types/request.types';
import { useUpdateRequest } from '../hooks/useUpdateRequest';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RequestStatusBadge } from './RequestStatusBadge';

interface RequestDetailsDialogProps {
  request: VisitorRequestResponse | null;
  onClose: () => void;
}

export function RequestDetailsDialog({ request, onClose }: RequestDetailsDialogProps) {
  const { mutateAsync: updateRequest, isPending } = useUpdateRequest();

  const handleApprove = async () => {
    if (!request) return;
    try {
      await updateRequest({ id: request.id, payload: { status: VisitorRequestStatus.APPROVED } });
      onClose();
    } catch (e) {
      console.error('Failed to approve request');
    }
  };

  const handleReject = async () => {
    if (!request) return;
    const reason = window.prompt('Please enter a rejection reason (optional):') || undefined;
    try {
      await updateRequest({ id: request.id, payload: { status: VisitorRequestStatus.REJECTED, rejectionReason: reason } });
      onClose();
    } catch (e) {
      console.error('Failed to reject request');
    }
  };

  if (!request) return null;

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] font-poppins">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center pr-8">
            <span>Request Details</span>
            <RequestStatusBadge status={request.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-y-4 gap-x-6 mt-4 text-sm">
          <div>
            <p className="text-gray-500 mb-1">Visitor Name</p>
            <p className="font-medium text-gray-900">{request.visitorName}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Mobile Number</p>
            <p className="font-medium text-gray-900">{request.mobileNumber}</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500 mb-1">Address</p>
            <p className="font-medium text-gray-900">{request.address || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Host Employee ID</p>
            <p className="font-medium text-gray-900">{request.hostEmployeeId}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Preferred Schedule</p>
            <p className="font-medium text-gray-900">
              {new Date(request.expectedArrival).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500 mb-1">Purpose</p>
            <p className="font-medium text-gray-900">{request.purpose}</p>
          </div>
          {request.remarks && (
            <div className="col-span-2">
              <p className="text-gray-500 mb-1">Remarks</p>
              <p className="font-medium text-gray-900">{request.remarks}</p>
            </div>
          )}
          {request.rejectionReason && (
            <div className="col-span-2 p-3 bg-red-50 rounded-md">
              <p className="text-red-700 font-medium mb-1">Rejection Reason</p>
              <p className="text-red-600">{request.rejectionReason}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t mt-4">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            Close
          </button>
          
          {request.status === VisitorRequestStatus.PENDING && (
            <>
              <button 
                type="button" 
                onClick={handleReject}
                disabled={isPending}
                className="px-4 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 font-medium disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
              <button 
                type="button" 
                onClick={handleApprove}
                disabled={isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium disabled:opacity-50 transition-colors"
              >
                Approve
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
