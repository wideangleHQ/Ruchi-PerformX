import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PrintPortalProps {
  children: ReactNode;
  paperSize?: 'a5' | 'a4' | 'thermal';
}

export function PrintPortal({ children, paperSize = 'a5' }: PrintPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  
  const containerClass = `
    print-only
    ${paperSize === 'a5' ? 'w-[148mm] max-w-[148mm] p-3 mx-0' : ''}
    ${paperSize === 'a4' ? 'w-full max-w-3xl p-8 mx-auto' : ''}
    ${paperSize === 'thermal' ? 'w-[80mm] max-w-[80mm] p-2 mx-0' : ''}
    print:w-full print:max-w-none print:p-0 print:m-0
    print:fixed print:top-0 print:left-0 print:z-[9999] print:bg-white
  `.trim();
  
  return createPortal(
    <div className={containerClass}>
      {children}
    </div>,
    document.body
  );
}

