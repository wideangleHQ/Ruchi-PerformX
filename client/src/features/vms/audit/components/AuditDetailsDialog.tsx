import { AuditLog } from '../types/audit.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AuditStatusBadge } from './AuditStatusBadge';
import { Button } from '@/components/ui/button';

interface AuditDetailsDialogProps {
  log: AuditLog | null;
  onClose: () => void;
}

export function AuditDetailsDialog({ log, onClose }: AuditDetailsDialogProps) {
  if (!log) return null;

  return (
    <Dialog open={!!log} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl font-poppins max-h-[90vh] flex flex-col bg-gray-50">
        <DialogHeader className="bg-white p-4 border-b rounded-t-lg shrink-0">
          <DialogTitle className="flex justify-between items-center pr-6">
            <span>Audit Record Details</span>
            <AuditStatusBadge status={log.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-lg border shadow-sm text-sm">
            <div>
              <p className="text-gray-500 mb-1 text-xs uppercase tracking-wide">Timestamp</p>
              <p className="font-medium">{new Date(log.timestamp).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1 text-xs uppercase tracking-wide">Module</p>
              <p className="font-medium">{log.module}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1 text-xs uppercase tracking-wide">Action</p>
              <p className="font-medium">{log.action}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1 text-xs uppercase tracking-wide">Reference No</p>
              <p className="font-mono text-xs bg-gray-100 p-1 rounded break-all">{log.referenceNumber}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500 mb-1 text-xs uppercase tracking-wide">Description</p>
              <p className="font-medium text-gray-700">{log.description || 'No additional description provided.'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-lg border shadow-sm text-sm">
            <div>
              <p className="text-gray-500 mb-1 text-xs uppercase tracking-wide">Performed By</p>
              <p className="font-medium">{log.performedBy}</p>
            </div>
            {log.visitor && (
              <div>
                <p className="text-gray-500 mb-1 text-xs uppercase tracking-wide">Visitor Subject</p>
                <p className="font-medium">{log.visitor}</p>
              </div>
            )}
            {log.employee && (
              <div>
                <p className="text-gray-500 mb-1 text-xs uppercase tracking-wide">Employee Subject</p>
                <p className="font-medium">{log.employee}</p>
              </div>
            )}
          </div>

          {(log.requestPayload || log.responseSummary) && (
            <div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">
              {log.requestPayload && (
                <div>
                  <p className="text-gray-500 mb-2 text-xs uppercase tracking-wide">Request Payload</p>
                  <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto font-mono whitespace-pre-wrap break-words">
                    {log.requestPayload}
                  </pre>
                </div>
              )}
              {log.responseSummary && (
                <div>
                  <p className="text-gray-500 mb-2 text-xs uppercase tracking-wide">Response Summary</p>
                  <pre className="bg-gray-900 text-gray-300 p-3 rounded text-xs overflow-x-auto font-mono whitespace-pre-wrap break-words">
                    {log.responseSummary}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white p-4 border-t rounded-b-lg flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose} className="font-poppins">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
