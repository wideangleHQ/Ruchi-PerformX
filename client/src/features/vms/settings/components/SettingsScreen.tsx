'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { settingsSchema, SettingsFormValues } from '../schemas/settings.schema';
import { useSettings } from '../hooks/useSettings';
import { useUpdateSettings } from '../hooks/useUpdateSettings';

import { GeneralSettingsCard } from './GeneralSettingsCard';
import { ReceptionSettingsCard } from './ReceptionSettingsCard';
import { PrinterSettingsCard } from './PrinterSettingsCard';
import { CameraSettingsCard } from './CameraSettingsCard';
import { SecuritySettingsCard } from './SecuritySettingsCard';
import { SystemInformationCard } from './SystemInformationCard';
import { SaveSettingsDialog } from './SaveSettingsDialog';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

export function SettingsScreen() {
  const { data: currentSettings, isLoading, error } = useSettings();
  const { mutateAsync: updateSettings, isPending } = useUpdateSettings();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<SettingsFormValues | undefined>();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (currentSettings) {
      form.reset(currentSettings);
    }
  }, [currentSettings, form]);

  const onSubmit = (values: SettingsFormValues) => {
    setPendingValues(values);
    setIsConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    if (pendingValues) {
      try {
        await updateSettings(pendingValues);
        setIsConfirmOpen(false);
      } catch (e) {
        console.error('Failed to save settings:', e);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 font-poppins">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg font-poppins">
        Failed to load configuration. Please try again.
      </div>
    );
  }

  return (
    <div className="font-poppins">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">VMS Configuration</h2>
          <p className="text-sm text-gray-500 mt-1">Manage global enterprise settings</p>
        </div>
        <Button 
          onClick={form.handleSubmit(onSubmit)} 
          className="bg-green-600 hover:bg-green-700 text-white flex gap-2"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>

      <SystemInformationCard settings={currentSettings} />

      <form className="mt-6 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <GeneralSettingsCard form={form} />
        <ReceptionSettingsCard form={form} />
        <SecuritySettingsCard form={form} />
        <PrinterSettingsCard form={form} />
        <CameraSettingsCard form={form} />
      </form>

      <SaveSettingsDialog 
        open={isConfirmOpen} 
        onOpenChange={setIsConfirmOpen} 
        onConfirm={handleConfirmSave} 
        isPending={isPending}
        values={pendingValues}
      />
    </div>
  );
}
