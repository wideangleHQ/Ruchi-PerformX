export const VMS_JWT_SECRET = process.env.VMS_JWT_SECRET as string;

if (!VMS_JWT_SECRET) {
  throw new Error('VMS_JWT_SECRET environment variable is required');
}

export const VMS_JWT_EXPIRES_IN = (process.env.VMS_JWT_EXPIRES_IN ?? '8h') as any;
