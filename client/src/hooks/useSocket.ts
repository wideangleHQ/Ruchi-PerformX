'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { getSocket, initializeSocket } from '@/config/socketClient';

export const useSocket = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const socketInitialized = useRef(false);

  useEffect(() => {
    if (!user || socketInitialized.current) {
      return;
    }

    // Get token from cookies
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('token='))
      ?.split('=')[1];

    if (!token) {
      return;
    }

    // Initialize socket
    const socket = initializeSocket(token);
    socketInitialized.current = true;

    // Listen for real-time events
    socket.on('notification:new', () => {
      console.log('[Socket.IO] Notification received');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    socket.on('task:updated', () => {
      console.log('[Socket.IO] Task updated');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });

    socket.on('comment:new', () => {
      console.log('[Socket.IO] Comment received');
      // Invalidate all task-related queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    });

    return () => {
      // Cleanup: don't disconnect on unmount as it may be needed globally
      // socket.disconnect();
    };
  }, [user, queryClient]);

  return getSocket();
};
