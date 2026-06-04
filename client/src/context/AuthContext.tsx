'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, LoginRequest, JwtUser } from '@/api/types';

const jwtToUser = (jwt: JwtUser): User => ({
  id: jwt.sub,
  username: jwt.username,
  fullName: jwt.fullName,
  role: jwt.role,
  departmentId: jwt.departmentId,
});
import { authApi } from '@/api/auth';
import { initializeSocket, disconnectSocket } from '@/config/socketClient';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        setIsLoading(true);
        // Check if user is already authenticated
        const currentUser = await authApi.getCurrentUser();
        setUser(jwtToUser(currentUser));
        setError(null);

        // Initialize Socket.IO if authenticated
        const token = localStorage.getItem('accessToken');
        if (token) {
          initializeSocket(token);
        }
      } catch (err: any) {
        // User not authenticated
        setUser(null);
        setError(null); // Not an error, just not logged in
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await authApi.login(credentials);
      localStorage.setItem('accessToken', res.accessToken);
      const me = await authApi.getCurrentUser();
      setUser(jwtToUser(me));

      // Get token from cookie and initialize Socket.IO
      const token = localStorage.getItem('accessToken');
      if (token) {
        initializeSocket(token);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await authApi.logout();
      localStorage.removeItem('accessToken');
      setUser(null);
      setError(null);
      disconnectSocket();
    } catch (err: any) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
