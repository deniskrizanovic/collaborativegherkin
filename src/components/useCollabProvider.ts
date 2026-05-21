import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export function useCollabProvider(sessionId: string, wsUrl: string): {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
} {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

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
    return () => {
      providerRef.current?.destroy();
      providerRef.current = null;
      ydocRef.current?.destroy();
      ydocRef.current = null;
    };
  }, []);

  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
  };
}
