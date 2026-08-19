import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { RealtimeEvent } from "@render-server/shared";

export interface RealtimeStatus {
  connected: boolean;
  lastEvent: RealtimeEvent | null;
}

function buildWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/api/ws`;
}

export function useRealtime(): RealtimeStatus {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let disposed = false;

    const connect = () => {
      socket = new WebSocket(buildWsUrl());

      socket.onopen = () => {
        if (disposed) return;
        setConnected(true);
        void queryClient.invalidateQueries();
      };

      socket.onmessage = (message) => {
        if (disposed) return;
        try {
          const event = JSON.parse(message.data as string) as RealtimeEvent;
          setLastEvent(event);
          void queryClient.invalidateQueries();
        } catch {
          // ignore malformed
        }
      };

      socket.onclose = () => {
        if (disposed) return;
        setConnected(false);
        reconnectRef.current = setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      socket?.close();
    };
  }, [queryClient]);

  return { connected, lastEvent };
}
