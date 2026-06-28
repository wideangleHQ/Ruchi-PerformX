export interface VMSSettings {
  companyName: string;
  receptionName: string;
  defaultTimeZone: string;
  visitorPassExpiryMinutes: number;
  businessHoursStart: string;
  businessHoursEnd: string;
  
  enableWalkInVisitors: boolean;
  enableEmployeeRequests: boolean;
  defaultCheckInStatus: string;
  requireVisitorPhoto: boolean;
  requireMobileNumber: boolean;
  requireAddress: boolean;
  requirePurpose: boolean;
  
  defaultPrinter: string;
  paperSize: 'A4' | '80mm Thermal';
  printCopies: number;
  autoPrintAfterCheckIn: boolean;
  enableReprintConfirmation: boolean;
  
  defaultCamera: string;
  resolution: string;
  autoCapture: boolean;
  mirrorPreview: boolean;
  imageQuality: 'Low' | 'Medium' | 'High';
  
  maxActiveVisits: number;
  accessCodeLength: number;
  sessionTimeout: number;
  autoCheckOutAfterBusinessHours: boolean;
  enableAuditLogging: boolean;
  
  applicationVersion?: string;
  backendVersion?: string;
  databaseStatus?: string;
  lastSync?: string;
  environment?: string;
}
