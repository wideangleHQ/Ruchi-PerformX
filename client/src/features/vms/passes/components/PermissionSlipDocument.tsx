import { PassResponse } from '../types/pass.types';

interface PermissionSlipDocumentProps {
  slip: PassResponse | null;
}

export function PermissionSlipDocument({ slip }: PermissionSlipDocumentProps) {
  if (!slip) return null;

  return (
    <div className="bg-white border-0 w-full max-w-3xl mx-auto p-8 font-sans shadow-none text-black print:w-full print:max-w-none print:p-0">
      <div className="text-center border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wider">RUCHI INDUSTRIES LTD</h1>
        <h2 className="text-lg font-semibold mt-1 uppercase">VISITOR PERMISSION SLIP</h2>
        <div className="flex justify-between items-center mt-4 text-sm font-medium">
          <div className="text-left">
            <div>Issue Date: {new Date().toLocaleDateString()}</div>
            <div>Issue Time: {new Date().toLocaleTimeString([], { timeStyle: 'short' })}</div>
          </div>
          <div className="text-lg text-right">
            <div>Visit No: <span className="font-bold">{slip.passNumber}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 space-y-3">
          <h3 className="font-bold border-b border-gray-400 pb-1 mb-2 uppercase text-sm tracking-widest">Visitor Information</h3>
          <div className="grid grid-cols-3">
            <span className="font-semibold text-sm">Visitor Name:</span>
            <span className="col-span-2 uppercase">{slip.visitor.fullName}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="font-semibold text-sm">Visitor ID:</span>
            <span className="col-span-2 uppercase">{slip.visitor.id.split('-')[0]}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="font-semibold text-sm">Mobile:</span>
            <span className="col-span-2">{slip.visitor.mobileNumber || 'N/A'}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="font-semibold text-sm">Company:</span>
            <span className="col-span-2 uppercase">{slip.visitor.company || 'N/A'}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="font-semibold text-sm">Email:</span>
            <span className="col-span-2">{slip.visitor.email || 'N/A'}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="font-semibold text-sm">Address:</span>
            <span className="col-span-2 uppercase">{slip.visitor.address || 'N/A'}</span>
          </div>
        </div>
        <div className="col-span-1 flex flex-col items-center justify-start border-l border-gray-300 pl-4">
          <div className="w-32 h-40 border border-gray-400 flex items-center justify-center text-xs text-gray-500 bg-gray-50 mb-4 overflow-hidden">
            {slip.visitor.profileImage ? (
              <img src={slip.visitor.profileImage} alt="Visitor" className="w-full h-full object-cover" />
            ) : (
              <span className="text-center px-2">No Photo<br/>Available</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        <h3 className="font-bold border-b border-gray-400 pb-1 mb-2 uppercase text-sm tracking-widest">Visit Information</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Meeting With:</span>
            <span className="uppercase border-b border-gray-300 pb-1 mt-1">{slip.employee.full_name}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Employee Code:</span>
            <span className="uppercase border-b border-gray-300 pb-1 mt-1">{slip.employee.id.split('-')[0]}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Department:</span>
            <span className="uppercase border-b border-gray-300 pb-1 mt-1">{slip.employee.department || 'N/A'}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Purpose:</span>
            <span className="uppercase border-b border-gray-300 pb-1 mt-1">{slip.purpose || 'N/A'}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Visit Date:</span>
            <span className="border-b border-gray-300 pb-1 mt-1">
              {slip.checkInTime ? new Date(slip.checkInTime).toLocaleDateString() : new Date().toLocaleDateString()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Visit Status:</span>
            <span className="uppercase border-b border-gray-300 pb-1 mt-1">{slip.status}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Check-In Time:</span>
            <span className="border-b border-gray-300 pb-1 mt-1 font-bold">
              {slip.checkInTime ? new Date(slip.checkInTime).toLocaleTimeString([], { timeStyle: 'short' }) : '___:___'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Expected Check-Out:</span>
            <span className="border-b border-gray-300 pb-1 mt-1">
              {/* Could be dynamically calculated based on purpose, but blank line works */}
              ___:___
            </span>
          </div>
          <div className="flex flex-col col-span-2">
            <span className="font-semibold text-sm">Actual Check-Out Time:</span>
            <span className="border-b border-gray-300 pb-1 mt-1 w-1/2">
              {slip.checkOutTime ? new Date(slip.checkOutTime).toLocaleTimeString([], { timeStyle: 'short' }) : '___:___'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-12">
        <h3 className="font-bold border-b border-gray-400 pb-1 mb-2 uppercase text-sm tracking-widest">Security Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="font-semibold">Receptionist Name:</span> {slip.printedBy || 'Reception Desk'}</div>
          <div><span className="font-semibold">Permission Slip No:</span> {slip.passNumber}</div>
          <div className="col-span-2"><span className="font-semibold">Generated Timestamp:</span> {new Date().toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mt-20 pt-4 text-center text-xs font-semibold uppercase">
        <div className="border-t border-black pt-2">Visitor<br/>Signature</div>
        <div className="border-t border-black pt-2">Reception<br/>Signature</div>
        <div className="border-t border-black pt-2">Security<br/>Signature</div>
        <div className="border-t border-black pt-2">Authorized<br/>Official</div>
      </div>
      
      <div className="text-center text-xs font-medium border-t-2 border-black mt-8 pt-4 pb-2 space-y-1">
        <p>This pass is valid only for the specified visit.</p>
        <p>Visitor must return this pass while leaving the premises.</p>
        <p className="font-bold mt-2">Ruchi Industries Ltd.</p>
      </div>
    </div>
  );
}
