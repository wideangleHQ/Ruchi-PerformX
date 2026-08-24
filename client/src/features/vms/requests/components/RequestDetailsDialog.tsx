import { useState } from 'react';
import { VisitorRequestResponse, VisitorRequestStatus } from '../types/request.types';
import {
  useApproveRequest,
  useCreateVisitFromRequest,
  useRejectRequest,
} from '../hooks/useUpdateRequest';
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

/** The API message if there is one, rather than a console line nobody sees. */
function readError(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? fallback;
}

export function RequestDetailsDialog({ request, onClose }: RequestDetailsDialogProps) {
  const approve = useApproveRequest();
  const reject = useRejectRequest();
  const createVisit = useCreateVisitFromRequest();
  const [error, setError] = useState<string | null>(null);

  const isPending = approve.isPending || reject.isPending || createVisit.isPending;

  const handleApprove = async () => {
    if (!request) return;
    setError(null);
    try {
      await approve.mutateAsync(request.id);
      onClose();
    } catch (e) {
      setError(readError(e, 'Could not approve this request.'));
    }
  };

  const handleReject = async () => {
    if (!request) return;
    setError(null);
    const reason = window.prompt('Please enter a rejection reason (optional):') || undefined;
    try {
      await reject.mutateAsync({ id: request.id, reason });
      onClose();
    } catch (e) {
      setError(readError(e, 'Could not reject this request.'));
    }
  };

  // An approved request is not a visit until this runs, and nothing called it,
  // so an approval used to be where the flow stopped.
  const handleCreateVisit = async () => {
    if (!request) return;
    setError(null);
    try {
      await createVisit.mutateAsync(request.id);
      onClose();
    } catch (e) {
      setError(readError(e, 'Could not create a visit from this request.'));
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

        {error && (
          <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

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

          {request.status === VisitorRequestStatus.APPROVED && (
            <button
              type="button"
              onClick={handleCreateVisit}
              disabled={isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium disabled:opacity-50 transition-colors"
            >
              Create Visit
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
