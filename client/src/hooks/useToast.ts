import { useMemo } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

/**
 * A module-level store rather than context, so a toast can be raised from a
 * mutation callback that has no component above it. `<Toaster />` in the root
 * layout is the only subscriber and the only thing that renders one.
 *
 * ponytail: an array and a Set, no dependency. Reach for a library if toasts
 * ever need stacking rules, actions, or per-toast persistence.
 */
let toastId = 0;
let toasts: Toast[] = [];
const listeners = new Set<(current: Toast[]) => void>();

const DEFAULT_DURATION = 4000;

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function removeToast(id: string) {
  const next = toasts.filter((toast) => toast.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

function showToast(message: string, type: ToastType, duration = DEFAULT_DURATION) {
  const id = String((toastId += 1));
  toasts = [...toasts, { id, message, type, duration }];
  emit();

  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
  return id;
}

/**
 * `useSyncExternalStore` needs a stable reference for an unchanged store, so
 * this returns the live array rather than a copy. Never mutate it in place;
 * every write above replaces it.
 */
export function getToasts(): Toast[] {
  return toasts;
}

/** Nothing is queued during SSR, and the reference has to be stable. */
const EMPTY: Toast[] = [];
export function getServerToasts(): Toast[] {
  return EMPTY;
}

export function subscribeToToasts(listener: (current: Toast[]) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useToast = () =>
  useMemo(
    () => ({
      success: (message: string, duration?: number) =>
        showToast(message, 'success', duration),
      error: (message: string, duration?: number) => showToast(message, 'error', duration),
      info: (message: string, duration?: number) => showToast(message, 'info', duration),
      warning: (message: string, duration?: number) =>
        showToast(message, 'warning', duration),
      show: showToast,
    }),
    [],
  );
