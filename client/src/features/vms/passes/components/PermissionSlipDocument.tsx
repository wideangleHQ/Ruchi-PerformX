import { PassResponse } from '../types/pass.types';

interface PermissionSlipDocumentProps {
  slip: PassResponse | null;
  paperSize?: 'a5' | 'a4' | 'thermal';
}

export function PermissionSlipDocument({ slip, paperSize = 'a5' }: PermissionSlipDocumentProps) {
  if (!slip) return null;

  // Dynamic classes based on paper size
  const isA5 = paperSize === 'a5';
  const isA4 = paperSize === 'a4';
  const isThermal = paperSize === 'thermal';

  // Container classes
  const containerClass = `
    bg-white border-0 font-sans shadow-none text-black
    ${isA5 ? 'w-[148mm] max-w-[148mm] p-3 mx-0' : ''}
    ${isA4 ? 'w-full max-w-3xl p-8 mx-auto' : ''}
    ${isThermal ? 'w-[80mm] max-w-[80mm] p-2 mx-0 text-[10px]' : ''}
    print:w-full print:max-w-none print:p-0 print:m-0 print:fixed print:top-0 print:left-0 print:z-[9999] print:bg-white
  `.trim();

  // Text sizing
  const titleClass = `
    ${isA5 ? 'text-base' : ''}
    ${isA4 ? 'text-xl' : ''}
    ${isThermal ? 'text-xs' : ''}
    font-bold uppercase tracking-wider print:text-lg
  `;

  const subtitleClass = `
    ${isA5 ? 'text-sm' : ''}
    ${isA4 ? 'text-base' : ''}
    ${isThermal ? 'text-[10px]' : ''}
    font-semibold mt-0.5 uppercase print:text-sm
  `;

  const labelClass = `
    ${isA5 ? 'text-[10px]' : ''}
    ${isA4 ? 'text-xs' : ''}
    ${isThermal ? 'text-[8px]' : ''}
  `;

  const valueClass = `
    ${isA5 ? 'text-[10px]' : ''}
    ${isA4 ? 'text-xs' : ''}
    ${isThermal ? 'text-[8px]' : ''}
    border-b border-gray-300 pb-0.5 mt-0.5
  `;

  const sectionTitleClass = `
    font-bold border-b border-gray-400 pb-0.5 mb-1 uppercase
    ${isA5 ? 'text-[10px]' : ''}
    ${isA4 ? 'text-xs' : ''}
    ${isThermal ? 'text-[8px]' : ''}
    tracking-widest
  `;

  const photoSize = isThermal ? 'w-12 h-14' : isA5 ? 'w-16 h-20' : 'w-24 h-28';
  const gapClass = isThermal ? 'gap-1' : isA5 ? 'gap-2' : 'gap-4';
  const spaceClass = isThermal ? 'space-y-0.5' : isA5 ? 'space-y-1' : 'space-y-1.5';
  const marginBottom = isThermal ? 'mb-1' : isA5 ? 'mb-2' : 'mb-3';
  const signatureGap = isThermal ? 'gap-0.5 text-[8px]' : isA5 ? 'gap-1 text-[10px]' : 'gap-2 text-xs';

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className={`text-center border-b-2 border-black pb-2 ${marginBottom}`}>
        <h1 className={titleClass}>RUCHI INDUSTRIES LTD</h1>
        <h2 className={subtitleClass}>VISITOR PERMISSION SLIP</h2>
        <div className={`flex justify-between items-center mt-2 ${labelClass} font-medium`}>
          <div className="text-left">
            <div>Issue Date: {new Date().toLocaleDateString()}</div>
            <div>Issue Time: {new Date().toLocaleTimeString([], { timeStyle: 'short' })}</div>
          </div>
          <div className={`${isThermal ? 'text-[10px]' : 'text-sm'} text-right`}>
            <div>Visit No: <span className="font-bold">{slip.passNumber}</span></div>
          </div>
        </div>
      </div>

      {/* Visitor Info */}
      <div className={`grid ${isThermal ? 'grid-cols-1' : 'grid-cols-3'} ${gapClass} ${marginBottom}`}>
        <div className={`${isThermal ? '' : 'col-span-2'} ${spaceClass}`}>
          <h3 className={sectionTitleClass}>Visitor Information</h3>
          {!isThermal && (
            <>
              <div className="grid grid-cols-3">
                <span className={`font-semibold ${labelClass}`}>Visitor Name:</span>
                <span className={`col-span-2 uppercase ${labelClass}`}>{slip.visitor.fullName}</span>
              </div>
              <div className="grid grid-cols-3">
                <span className={`font-semibold ${labelClass}`}>Visitor ID:</span>
                <span className={`col-span-2 uppercase ${labelClass}`}>{slip.visitor.id.split('-')[0]}</span>
              </div>
              <div className="grid grid-cols-3">
                <span className={`font-semibold ${labelClass}`}>Mobile:</span>
                <span className={`col-span-2 ${labelClass}`}>{slip.visitor.mobileNumber || 'N/A'}</span>
              </div>
              <div className="grid grid-cols-3">
                <span className={`font-semibold ${labelClass}`}>Company:</span>
                <span className={`col-span-2 uppercase ${labelClass}`}>{slip.visitor.company || 'N/A'}</span>
              </div>
            </>
          )}
          <div className="grid grid-cols-3">
            <span className={`font-semibold ${labelClass}`}>Mobile:</span>
            <span className={`col-span-2 ${labelClass}`}>{slip.visitor.mobileNumber || 'N/A'}</span>
          </div>
          {!isThermal && (
            <>
              <div className="grid grid-cols-3">
                <span className={`font-semibold ${labelClass}`}>Email:</span>
                <span className={`col-span-2 ${labelClass}`}>{slip.visitor.email || 'N/A'}</span>
              </div>
              <div className="grid grid-cols-3">
                <span className={`font-semibold ${labelClass}`}>Address:</span>
                <span className={`col-span-2 uppercase ${labelClass}`}>{slip.visitor.address || 'N/A'}</span>
              </div>
            </>
          )}
        </div>
        {!isThermal && (
          <div className={`col-span-1 flex flex-col items-center justify-start border-l border-gray-300 ${isA5 ? 'pl-1' : 'pl-2'}`}>
            <div className={`${photoSize} border border-gray-400 flex items-center justify-center text-xs text-gray-500 bg-gray-50 mb-1 overflow-hidden`}>
              {slip.visitor.profileImage ? (
                <img src={slip.visitor.profileImage} alt="Visitor" className="w-full h-full object-cover" />
              ) : (
                <span className="text-center px-0.5 text-[8px]">No Photo</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Visit Info */}
      <div className={`${spaceClass} ${marginBottom}`}>
        <h3 className={sectionTitleClass}>Visit Information</h3>
        <div className={`grid ${isThermal ? 'grid-cols-1' : 'grid-cols-2'} gap-x-2 gap-y-1`}>
          <div className="flex flex-col">
            <span className={`font-semibold ${labelClass}`}>Meeting With:</span>
            <span className={`uppercase ${valueClass}`}>{slip.employee.full_name}</span>
          </div>
          {!isThermal && (
            <>
              <div className="flex flex-col">
                <span className={`font-semibold ${labelClass}`}>Employee Code:</span>
                <span className={`uppercase ${valueClass}`}>{slip.employee.id.split('-')[0]}</span>
              </div>
              <div className="flex flex-col">
                <span className={`font-semibold ${labelClass}`}>Department:</span>
                <span className={`uppercase ${valueClass}`}>{slip.employee.department || 'N/A'}</span>
              </div>
            </>
          )}
          <div className="flex flex-col">
            <span className={`font-semibold ${labelClass}`}>Purpose:</span>
            <span className={`uppercase ${valueClass}`}>{slip.purpose || 'N/A'}</span>
          </div>
          {!isThermal && (
            <div className="flex flex-col">
              <span className={`font-semibold ${labelClass}`}>Number of Persons:</span>
              <span className={`uppercase ${valueClass}`}>{slip.peopleCount || 1}</span>
            </div>
          )}
          <div className="flex flex-col">
            <span className={`font-semibold ${labelClass}`}>Visit Date:</span>
            <span className={valueClass}>
              {slip.checkInTime ? new Date(slip.checkInTime).toLocaleDateString() : new Date().toLocaleDateString()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className={`font-semibold ${labelClass}`}>Status:</span>
            <span className={`uppercase ${valueClass}`}>{slip.status}</span>
          </div>
          <div className="flex flex-col">
            <span className={`font-semibold ${labelClass}`}>Check-In:</span>
            <span className={`${valueClass} font-bold`}>
              {slip.checkInTime ? new Date(slip.checkInTime).toLocaleTimeString([], { timeStyle: 'short' }) : '___:___'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className={`font-semibold ${labelClass}`}>Check-Out:</span>
            <span className={valueClass}>
              {slip.checkOutTime ? new Date(slip.checkOutTime).toLocaleTimeString([], { timeStyle: 'short' }) : '___:___'}
            </span>
          </div>
        </div>
      </div>

      {/* Security Info */}
      {!isThermal && (
        <div className={`${spaceClass} ${marginBottom}`}>
          <h3 className={sectionTitleClass}>Security Information</h3>
          <div className={`grid grid-cols-2 gap-2 ${labelClass}`}>
            <div><span className="font-semibold">Receptionist:</span> {slip.printedBy || 'Reception Desk'}</div>
            <div><span className="font-semibold">Slip No:</span> {slip.passNumber}</div>
          </div>
        </div>
      )}

      {/* Signatures */}
      <div className={`grid grid-cols-4 gap-1 mt-2 pt-1 text-center font-semibold uppercase ${signatureGap}`}>
        <div className="border-t border-black pt-0.5">Visitor<br/>Sign</div>
        <div className="border-t border-black pt-0.5">Reception<br/>Sign</div>
        <div className="border-t border-black pt-0.5">Security<br/>Sign</div>
        <div className="border-t border-black pt-0.5">Authorized<br/>Sign</div>
      </div>
      
      {/* Footer */}
      <div className={`text-center border-t-2 border-black mt-1 pt-0.5 ${isThermal ? 'text-[8px]' : 'text-[10px]'} font-medium`}>
        <p className={isThermal ? 'text-[7px]' : 'text-[10px]'}>Valid only for specified visit. Return pass while leaving.</p>
        <p className="font-bold mt-0.5">Ruchi Industries Ltd.</p>
      </div>
    </div>
  );
}