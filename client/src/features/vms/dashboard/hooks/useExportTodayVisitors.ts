import { useMutation } from '@tanstack/react-query';
import { exportTodayVisitors } from '../api/export-today-visitors';

export function useExportTodayVisitors() {
  return useMutation({
    mutationFn: exportTodayVisitors,
    onError: (error: Error) => {
      console.error('Export failed:', error);
      alert(error.message || 'Failed to export visitors');
    },
  });
}
