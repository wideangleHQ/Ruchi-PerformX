import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v\d+\/?$/, '') ||
  'http://localhost:3001';

const SOCKET_NAMESPACE = '/performx';

let socket: Socket | null = null;

export const initializeSocket = (token: string): Socket => {
  if (socket?.connected) {
    return socket;
  }

  socket = io(`${SOCKET_URL.replace(/\/$/, '')}${SOCKET_NAMESPACE}`, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('[Socket.IO] Connected');
  });

  socket.on('disconnect', () => {
    console.log('[Socket.IO] Disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket.IO] Connection error:', error);
  });

  return socket;
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
