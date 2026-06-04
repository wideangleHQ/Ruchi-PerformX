import { useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// Simple in-memory toast store
let toastId = 0;
const toastListeners: Set<(toast: Toast) => void> = new Set();

export const useToast = () => {
  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = String(++toastId);
    const toast: Toast = { id, message, type, duration };
    
    toastListeners.forEach(listener => listener(toast));
    
    if (duration) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    
    return id;
  }, []);

  return {
    success: (message: string, duration?: number) => showToast(message, 'success', duration),
    error: (message: string, duration?: number) => showToast(message, 'error', duration),
    info: (message: string, duration?: number) => showToast(message, 'info', duration),
    warning: (message: string, duration?: number) => showToast(message, 'warning', duration),
    show: showToast,
  };
};

export const removeToast = (id: string) => {
  // Implementation for removing toast
};

export const subscribeToToasts = (listener: (toast: Toast) => void) => {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
};
