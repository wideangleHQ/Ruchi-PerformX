import axiosClient from './client';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  VerifyOtpRequest,
  ForgotPasswordRequest,
  VerifyResetOtpRequest,
  ResetPasswordRequest,
  MessageResponse,
  JwtUser,
} from './types';

export const authApi = {
  /** POST /auth/register */
  register: async (data: RegisterRequest): Promise<MessageResponse> => {
    const response = await axiosClient.post<MessageResponse>('/auth/register', data);
    return response.data;
  },

  /** Inactive while OTP is disabled. Keep for future use. */
  verifyOtp: async (data: VerifyOtpRequest): Promise<MessageResponse> => {
    const response = await axiosClient.post<MessageResponse>('/auth/verify-otp', data);
    return response.data;
  },

  /** POST /auth/login */
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await axiosClient.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  /** POST /auth/forgot-password */
  forgotPassword: async (data: ForgotPasswordRequest): Promise<MessageResponse> => {
    const response = await axiosClient.post<MessageResponse>('/auth/forgot-password', data);
    return response.data;
  },

  /** Inactive while OTP is disabled. Keep for future use. */
  verifyResetOtp: async (data: VerifyResetOtpRequest): Promise<MessageResponse> => {
    const response = await axiosClient.post<MessageResponse>('/auth/verify-reset-otp', data);
    return response.data;
  },

  /** Inactive in public forgot-password flow while OTP is disabled. */
  resetPassword: async (data: ResetPasswordRequest): Promise<MessageResponse> => {
    const response = await axiosClient.post<MessageResponse>('/auth/reset-password', data);
    return response.data;
  },

  /** POST /auth/logout */
  logout: async (): Promise<void> => {
    await axiosClient.post('/auth/logout');
  },

  /** GET /auth/me */
  getCurrentUser: async (): Promise<JwtUser> => {
    const response = await axiosClient.get<JwtUser>('/auth/me');
    return response.data;
  },

  /** GET /auth/check-md */
  checkMdExists: async (): Promise<boolean> => {
    const response = await axiosClient.get<{ exists: boolean }>('/auth/check-md');
    return response.data.exists;
  },

  /** GET /auth/check-hod/:departmentId */
  checkHodExists: async (departmentId: string): Promise<boolean> => {
    const response = await axiosClient.get<{ exists: boolean }>(`/auth/check-hod/${departmentId}`);
    return response.data.exists;
  },

  /** GET /auth/check-hod-name/:departmentName */
  checkHodExistsByName: async (departmentName: string): Promise<boolean> => {
    const response = await axiosClient.get<{ exists: boolean }>(`/auth/check-hod-name/${encodeURIComponent(departmentName)}`);
    return response.data.exists;
  },
};
