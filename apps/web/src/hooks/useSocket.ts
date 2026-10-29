'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { env } from '@/env';

let sharedSocket: Socket | null = null;

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(sharedSocket);

  useEffect(() => {
    if (!sharedSocket && typeof window !== 'undefined') {
      const rawUrl = env.NEXT_PUBLIC_WS_URL || env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const serverUrl = rawUrl.replace(/\/api\/v1\/?$/, '').replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
      sharedSocket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      sharedSocket.on('connect_error', () => {
        // Silently retry in background during backend service restarts
      });
    }

    setSocket(sharedSocket);
  }, []);

  return socket;
}
