'use client';

import { useSyncExternalStore } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import {
  getServerToasts,
  getToasts,
  removeToast,
  subscribeToToasts,
  type ToastType,
} from '@/hooks/useToast';

const tone: Record<ToastType, { ring: string; icon: string; Icon: typeof Info }> = {
  success: { ring: 'ring-green-200', icon: 'text-green-600', Icon: CheckCircle2 },
  error: { ring: 'ring-rose-200', icon: 'text-rose-600', Icon: AlertCircle },
  warning: { ring: 'ring-amber-200', icon: 'text-amber-600', Icon: AlertTriangle },
  info: { ring: 'ring-slate-200', icon: 'text-slate-500', Icon: Info },
};

/**
 * The only subscriber to the toast store, mounted once in the root layout.
 *
 * Without this every `toast.success(...)` in the app was a no-op: the store had
 * listeners and nothing ever registered one, so ten screens reported success
 * and failure to nobody.
 *
 * `role="status"` with `aria-live="polite"` announces a toast without stealing
 * focus, which is right for a confirmation. An error the user must act on
 * belongs inline on the form, not here.
 */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToToasts, getToasts, getServerToasts);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
    >
      {toasts.map((toast) => {
        const { ring, icon, Icon } = tone[toast.type];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-white p-4 shadow-lg ring-1 ${ring}`}
          >
            <Icon size={18} className={`mt-0.5 shrink-0 ${icon}`} />
            <p className="min-w-0 flex-1 text-sm text-slate-700">{toast.message}</p>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
