import { useMutation } from '@tanstack/react-query';
import { exportReport } from '../api/report.api';
import { ExportReportRequest } from '../types/report.types';

export const useExportReport = () => {
  return useMutation<Blob, Error, ExportReportRequest>({
    mutationFn: exportReport,
  });
};
