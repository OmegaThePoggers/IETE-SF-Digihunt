"use client";

import { useEffect, useRef } from "react";
import { getStoredToken } from "@/lib/api";

export interface TeamSocketEvent {
  type: string;
  [key: string]: unknown;
}

const RECONNECT_MS = 2000;

function teamSocketUrl(token: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const encodedToken = encodeURIComponent(token);

  if (apiUrl.startsWith("/")) {
    const origin = typeof window === "undefined" ? "http://localhost:3000" : window.location.origin;
    const wsOrigin = origin.replace(/^http/, "ws");
    return `${wsOrigin}${apiUrl}/ws?token=${encodedToken}`;
  }

  return `${apiUrl.replace(/^http/, "ws")}/ws?token=${encodedToken}`;
}

// Push channel for realtime team-board and cipher-gate updates (G10).
// Derives ws(s)://<api host>/ws?token=... from NEXT_PUBLIC_API_URL and
// reconnects with a flat 2s backoff on drop — good enough for a hackathon
// LAN, no need for exponential backoff/jitter here.
export function useTeamSocket(onEvent: (event: TeamSocketEvent) => void) {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;

    const wsUrl = teamSocketUrl(token);

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    function connect() {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (ev) => {
        try {
          onEventRef.current(JSON.parse(ev.data));
        } catch {
          // ignore malformed frames
        }
      };
      socket.onclose = () => {
        if (!stopped) reconnectTimer = setTimeout(connect, RECONNECT_MS);
      };
      socket.onerror = () => {
        socket?.close();
      };
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);
}

export { teamSocketUrl };
