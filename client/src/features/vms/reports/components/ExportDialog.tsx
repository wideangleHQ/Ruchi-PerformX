import { useState } from 'react';
import { useExportReport } from '../hooks/useExportReport';
import { ReportFilter, ExportReportRequest } from '../types/report.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface ExportDialogProps {
  currentFilters: ReportFilter;
}

export function ExportDialog({ currentFilters }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportReportRequest['format']>('EXCEL');
  const { mutateAsync: exportReport, isPending } = useExportReport();

  const handleExport = async () => {
    try {
      const blob = await exportReport({ format, filters: currentFilters });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const ext = format === 'EXCEL' ? 'xlsx' : format.toLowerCase();
      a.download = `VMS_Report_${new Date().toISOString().split('T')[0]}.${ext}`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setOpen(false);
    } catch (error) {
      console.error('Export failed', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="font-poppins flex gap-2" />}>
        <Download className="h-4 w-4" />
        Export Report
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] font-poppins">
        <DialogHeader>
          <DialogTitle>Export Report</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-500">
            Export the current report data based on the active filters.
          </p>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportReportRequest['format'])}
              className="w-full h-10 border rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
            >
              <option value="EXCEL">Microsoft Excel (.xlsx)</option>
              <option value="CSV">Comma Separated Values (.csv)</option>
              <option value="PDF">PDF Document (.pdf)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport}
            disabled={isPending}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            {isPending ? 'Generating...' : 'Download'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
