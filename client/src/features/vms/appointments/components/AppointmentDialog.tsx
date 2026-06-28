import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAppointmentSchema, CreateAppointmentFormValues } from '../schemas/appointment.schema';
import { useCreateAppointment } from '../hooks/useCreateAppointment';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AppointmentDialog() {
  const [open, setOpen] = useState(false);
  const { mutateAsync: createAppointment, isPending } = useCreateAppointment();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAppointmentFormValues>({
    resolver: zodResolver(createAppointmentSchema),
  });

  const onSubmit = async (data: CreateAppointmentFormValues) => {
    try {
      await createAppointment(data);
      setOpen(false);
      reset();
    } catch (error) {
      console.error('Failed to create appointment');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-green-600 text-white hover:bg-green-700 font-poppins" />}>
        New Appointment
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] font-poppins max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Appointment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Visitor ID *</label>
            <Input {...register('visitorId')} placeholder="Enter Visitor UUID" />
            {errors.visitorId && <p className="text-xs text-red-500">{errors.visitorId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Branch ID *</label>
              <Input {...register('branchId')} placeholder="Branch UUID" />
              {errors.branchId && <p className="text-xs text-red-500">{errors.branchId.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Employee (Host) ID *</label>
              <Input {...register('hostEmployeeId')} placeholder="Employee UUID" />
              {errors.hostEmployeeId && <p className="text-xs text-red-500">{errors.hostEmployeeId.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Purpose *</label>
            <Input {...register('purpose')} placeholder="e.g. Interview, Sales Pitch" />
            {errors.purpose && <p className="text-xs text-red-500">{errors.purpose.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Appointment Date & Time *</label>
            <Input type="datetime-local" {...register('scheduledAt')} />
            {errors.scheduledAt && <p className="text-xs text-red-500">{errors.scheduledAt.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Remarks (Optional)</label>
            <textarea 
              {...register('meetingDetails')} 
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
              rows={3}
            />
            {errors.meetingDetails && <p className="text-xs text-red-500">{errors.meetingDetails.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-green-600 text-white hover:bg-green-700">
              {isPending ? 'Saving...' : 'Save Appointment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
