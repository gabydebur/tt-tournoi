import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsEvent } from '../types';

interface UseWebSocketOptions {
  onMessage?: (event: WsEvent) => void;
  reconnectDelay?: number;
  maxRetries?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastEvent: WsEvent | null;
  disconnect: () => void;
}

export function useWebSocket(
  url: string | null,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const { onMessage, reconnectDelay = 3000, maxRetries = 10 } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const isMountedRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);

  const connect = useCallback(() => {
    if (!url || !isMountedRef.current) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setIsConnected(true);
        retriesRef.current = 0;
      };

      ws.onmessage = (ev) => {
        if (!isMountedRef.current) return;
        try {
          const parsed: WsEvent = JSON.parse(ev.data);
          setLastEvent(parsed);
          onMessage?.(parsed);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setIsConnected(false);
        wsRef.current = null;

        if (retriesRef.current < maxRetries) {
          retriesRef.current += 1;
          reconnectTimerRef.current = setTimeout(connect, reconnectDelay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      if (retriesRef.current < maxRetries) {
        retriesRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, reconnectDelay);
      }
    }
  }, [url, onMessage, reconnectDelay, maxRetries]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    isMountedRef.current = false;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close();
    setIsConnected(false);
  }, []);

  return { isConnected, lastEvent, disconnect };
}
