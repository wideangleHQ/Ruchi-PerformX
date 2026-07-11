'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, LoginRequest, JwtUser } from '@/api/types';
import { authApi } from '@/api/auth';
import { initializeSocket, disconnectSocket } from '@/config/socketClient';

const jwtToUser = (jwt: JwtUser): User => ({
  id: jwt.sub,
  username: jwt.username,
  fullName: jwt.fullName,
  role: jwt.role,
  departmentId: jwt.departmentId,
  departmentIds: jwt.departmentIds,
  departmentName: jwt.departmentName,
});

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<User>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('accessToken');
        
        if (!token) {
          // No token, not authenticated
          setUser(null);
          setIsLoading(false);
          return;
        }

        // Check if user is already authenticated
        const currentUser = await authApi.getCurrentUser();
        setUser(jwtToUser(currentUser));
        setError(null);

        // Initialize Socket.IO if authenticated
        initializeSocket(token);
      } catch (err: any) {
        // User not authenticated or token invalid
        localStorage.removeItem('accessToken');
        setUser(null);
        setError(null); // Not an error, just not logged in
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest): Promise<User> => {
    try {
      setIsLoading(true);
      setError(null);

      // Ensure no stale data from a previous session remains
      queryClient.clear();

      const res = await authApi.login(credentials);
      localStorage.setItem('accessToken', res.accessToken);
      const me = await authApi.getCurrentUser();
      const user = jwtToUser(me);
      setUser(user);

      // Initialize Socket.IO after login
      const token = localStorage.getItem('accessToken');
      if (token) {
        initializeSocket(token);
      }

      return user;
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

      // Remove all cached query data (self-actions, tasks, dashboard, etc.)
      // so the next user never sees a previous user's cached records.
      queryClient.clear();
    } catch (err: any) {
      console.error('Logout error:', err);
      // Still clear cache even if the logout API call failed
      queryClient.clear();
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
