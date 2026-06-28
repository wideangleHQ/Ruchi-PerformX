import axiosClient from '@/api/client';
import { ReportFilter, ReportData, ExportReportRequest } from '../types/report.types';

export const getReports = async (params: ReportFilter): Promise<ReportData> => {
  const { data } = await axiosClient.get<{ data: ReportData }>('/vms/reports', { params });
  return data.data;
};

export const exportReport = async (payload: ExportReportRequest): Promise<Blob> => {
  const { data } = await axiosClient.post('/vms/reports/export', payload, {
    responseType: 'blob'
  });
  return data;
};
