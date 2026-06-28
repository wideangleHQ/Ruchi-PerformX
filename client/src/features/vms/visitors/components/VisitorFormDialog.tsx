import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createVisitorSchema, CreateVisitorFormValues } from '../schemas/create-visitor.schema';
import { useCreateVisitor } from '../hooks/useCreateVisitor';
import { uploadVisitorPhoto } from '../api/visitor-image.api';
import { useToast } from '@/hooks/useToast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { CameraDialog } from '../../camera/components/CameraDialog';
import { useQueryClient } from '@tanstack/react-query';

export function VisitorFormDialog() {
  const [open, setOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingData, setPendingData] = useState<CreateVisitorFormValues | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const { mutateAsync: createVisitor, isPending: isCreating } = useCreateVisitor();
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
    getValues
  } = useForm<CreateVisitorFormValues>({
    resolver: zodResolver(createVisitorSchema),
    mode: 'onChange'
  });

  const handleCaptureAndSave = handleSubmit((data: CreateVisitorFormValues) => {
    setPendingData(data);
    setCameraOpen(true);
  });

  const handleSaveWithoutPhoto = handleSubmit(async (data: CreateVisitorFormValues) => {
    await submitVisitorData(data, null);
  });

  const handleCameraConfirm = async (file: File) => {
    if (pendingData) {
      await submitVisitorData(pendingData, file);
    }
  };

  const submitVisitorData = async (data: CreateVisitorFormValues, file: File | null) => {
    setIsUploading(true);
    try {
      const visitor = await createVisitor({
        firstName: data.firstName,
        lastName: data.lastName,
        mobileNumber: data.mobileNumber,
        companyName: data.companyName,
        address: data.address,
        email: data.email || undefined,
        faceRecognitionConsent: data.faceRecognitionConsent,
        notes: data.notes || undefined,
      });

      if (file && visitor?.id) {
        try {
          await uploadVisitorPhoto(visitor.id, file);
        } catch (imgError) {
          console.error('Visitor created but image upload failed', imgError);
          toast.warning('Visitor created successfully. Image upload failed. You can retry later.');
        }
      }

      queryClient.invalidateQueries({ queryKey: ['vms', 'visitors'] });
      setOpen(false);
      reset();
      setPendingData(null);
    } catch (error) {
      console.error('Failed to create visitor', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button className="bg-green-600 text-white hover:bg-green-700 font-poppins" />}>
          Add Visitor
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] font-poppins max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register New Visitor</DialogTitle>
          </DialogHeader>
          <form className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name *</label>
                <Input {...register('firstName')} placeholder="John" />
                {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <Input {...register('lastName')} placeholder="Doe" />
                {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mobile Number *</label>
                <Input {...register('mobileNumber')} placeholder="9876543210" />
                {errors.mobileNumber && <p className="text-xs text-red-500">{errors.mobileNumber.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Company Name *</label>
                <Input {...register('companyName')} placeholder="PerformX Inc." />
                {errors.companyName && <p className="text-xs text-red-500">{errors.companyName.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input {...register('email')} placeholder="john@example.com" />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Address *</label>
                <Input {...register('address')} placeholder="123 Business St, Tech Park" />
                {errors.address && <p className="text-xs text-red-500">{errors.address.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea {...register('notes')} placeholder="Purpose of visit, or any additional context" />
              {errors.notes && <p className="text-xs text-red-500">{errors.notes.message}</p>}
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="faceRecognitionConsent" 
                {...register('faceRecognitionConsent')} 
                onCheckedChange={(checked) => {
                  const e = { target: { name: 'faceRecognitionConsent', value: checked === true } };
                  register('faceRecognitionConsent').onChange(e);
                }}
              />
              <label htmlFor="faceRecognitionConsent" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Visitor consents to Face Recognition mapping
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="secondary"
                disabled={isCreating || isUploading || !isValid} 
                onClick={handleSaveWithoutPhoto}
              >
                Save without Photo
              </Button>
              <Button 
                type="button" 
                onClick={handleCaptureAndSave}
                disabled={isCreating || isUploading || !isValid} 
                className="bg-green-600 text-white hover:bg-green-700"
              >
                {isCreating || isUploading ? 'Saving...' : 'Capture Photo & Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CameraDialog 
        open={cameraOpen} 
        onOpenChange={setCameraOpen} 
        onConfirm={handleCameraConfirm} 
      />
    </>
  );
}
