import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export type ConnStatus = "connecting" | "connected" | "disconnected";

export function useCollabProvider(sessionId: string, wsUrl: string): {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  connStatus: ConnStatus;
} {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>("connecting");

  // Synchronous init so provider is ready before useEditor runs
  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }
  if (!providerRef.current) {
    providerRef.current = new WebsocketProvider(
      wsUrl,
      `session-${sessionId}`,
      ydocRef.current
    );
  }

  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) return;
    const onStatus = ({ status }: { status: string }) => {
      if (status === "connected") setConnStatus("connected");
      else if (status === "disconnected") setConnStatus("disconnected");
    };
    provider.on("status", onStatus);
    return () => {
      provider.off("status", onStatus);
      providerRef.current?.destroy();
      providerRef.current = null;
      ydocRef.current?.destroy();
      ydocRef.current = null;
    };
  }, []);

  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
    connStatus,
  };
}
