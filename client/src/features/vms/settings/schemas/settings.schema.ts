import { z } from 'zod';

export const settingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').trim(),
  receptionName: z.string().min(1, 'Reception name is required').trim(),
  defaultTimeZone: z.string().min(1, 'Time zone is required'),
  visitorPassExpiryMinutes: z.number().min(1).max(1440),
  businessHoursStart: z.string().min(1, 'Required'),
  businessHoursEnd: z.string().min(1, 'Required'),

  enableWalkInVisitors: z.boolean(),
  enableEmployeeRequests: z.boolean(),
  defaultCheckInStatus: z.string().min(1, 'Required'),
  requireVisitorPhoto: z.boolean(),
  requireMobileNumber: z.boolean(),
  requireAddress: z.boolean(),
  requirePurpose: z.boolean(),

  defaultPrinter: z.string().trim(),
  paperSize: z.enum(['A4', '80mm Thermal']),
  printCopies: z.number().min(1).max(10),
  autoPrintAfterCheckIn: z.boolean(),
  enableReprintConfirmation: z.boolean(),

  defaultCamera: z.string().trim(),
  resolution: z.string().trim(),
  autoCapture: z.boolean(),
  mirrorPreview: z.boolean(),
  imageQuality: z.enum(['Low', 'Medium', 'High']),

  maxActiveVisits: z.number().min(1).max(10000),
  accessCodeLength: z.number().min(4).max(10),
  sessionTimeout: z.number().min(1).max(480),
  autoCheckOutAfterBusinessHours: z.boolean(),
  enableAuditLogging: z.boolean(),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
