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
  /** POST /auth/register — sends OTP to email */
  register: async (data: RegisterRequest): Promise<MessageResponse> => {
    const response = await axiosClient.post<MessageResponse>('/auth/register', data);
    return response.data;
  },

  /** POST /auth/verify-otp — verifies OTP, sets pending_approval for EMPLOYEE */
  verifyOtp: async (data: VerifyOtpRequest): Promise<MessageResponse> => {
    const response = await axiosClient.post<MessageResponse>('/auth/verify-otp', data);
    return response.data;
  },

  /** POST /auth/login — returns accessToken in body */
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await axiosClient.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  /** POST /auth/forgot-password */
  forgotPassword: async (data: ForgotPasswordRequest): Promise<MessageResponse> => {
    const response = await axiosClient.post<MessageResponse>('/auth/forgot-password', data);
    return response.data;
  },

  /** POST /auth/verify-reset-otp */
  verifyResetOtp: async (data: VerifyResetOtpRequest): Promise<MessageResponse> => {
    const response = await axiosClient.post<MessageResponse>('/auth/verify-reset-otp', data);
    return response.data;
  },

  /** POST /auth/reset-password */
  resetPassword: async (data: ResetPasswordRequest): Promise<MessageResponse> => {
    const response = await axiosClient.post<MessageResponse>('/auth/reset-password', data);
    return response.data;
  },

  /** POST /auth/logout */
  logout: async (): Promise<void> => {
    await axiosClient.post('/auth/logout');
  },

  /** GET /auth/me — returns JWT payload */
  getCurrentUser: async (): Promise<JwtUser> => {
    const response = await axiosClient.get<JwtUser>('/auth/me');
    return response.data;
  },
};
