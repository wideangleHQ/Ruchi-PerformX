import axiosClient from '@/api/client';

export async function exportTodayVisitors(): Promise<void> {
  try {
    const response = await axiosClient.get('/vms/dashboard/today/export', {
      responseType: 'blob',
    });

    // Create blob from response
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Generate filename with today's date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const filename = `Todays-Visitors-${dateStr}.xlsx`;

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export visitors:', error);
    throw new Error('Failed to download Excel file');
  }
}
