import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function PrintPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  
  return createPortal(
    <div className="print-only w-full print:fixed print:top-0 print:left-0 print:z-[9999] print:bg-white print:m-0 print:p-0">
      {children}
    </div>,
    document.body
  );
}

