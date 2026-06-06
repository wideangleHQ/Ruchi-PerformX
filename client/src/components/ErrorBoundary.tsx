'use client';

import { ReactNode, useState, useEffect } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleError = (event: ErrorEvent) => {
      console.error('Uncaught error:', event.error);
      setError(event.error);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      setError(new Error(event.reason));
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-red-50 p-4">
        <div className="rounded-xl border border-red-200 bg-white p-8 max-w-md">
          <h1 className="text-xl font-bold text-red-700 mb-2">Something went wrong</h1>
          <p className="text-sm text-red-600 mb-4">{error.message}</p>
          <button
            onClick={() => {
              setError(null);
              window.location.href = '/login';
            }}
            className="w-full rounded-lg bg-red-600 text-white px-4 py-2 font-medium hover:bg-red-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
