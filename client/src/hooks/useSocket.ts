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

    // `AuthContext` stores the JWT in localStorage under `accessToken`. This
    // read used to look for a `token=` cookie that nothing in the app has ever
    // written, so it bailed on every render and no socket was opened at all:
    // no live notifications, no live poll tallies, no task or comment
    // invalidation anywhere in the product.
    const token = localStorage.getItem('accessToken');

    if (!token) {
      return;
    }

    // Initialize socket
    const socket = initializeSocket(token);
    socketInitialized.current = true;

    // Listen for real-time events
    socket.on('notification:new', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    socket.on('task:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });

    // Polls are company wide, so this arrives as a broadcast rather than to a
    // room. Invalidate rather than writing the payload in: the socket shape and
    // the dashboard response are not guaranteed to match.
    socket.on('poll:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['polls'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });

    socket.on('comment:new', () => {
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
