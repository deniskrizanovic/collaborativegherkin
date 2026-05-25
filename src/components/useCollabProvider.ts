import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export type ConnStatus = "connecting" | "connected" | "disconnected";

export function useCollabProvider(sessionId: string, wsUrl: string): {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  connStatus: ConnStatus;
} {
  const [ydoc] = useState<Y.Doc>(() => new Y.Doc());
  const [provider] = useState<WebsocketProvider>(
    () => new WebsocketProvider(wsUrl, `session-${sessionId}`, ydoc)
  );
  const [connStatus, setConnStatus] = useState<ConnStatus>("connecting");
  const providerRef = useRef(provider);

  useEffect(() => {
    const p = providerRef.current;

    // Sync initial state — the provider may have already connected before this
    // effect ran (y-websocket v3 connects in the constructor).
    if (p.wsconnected) setConnStatus("connected");
    else if (!p.wsconnecting) setConnStatus("disconnected");

    const onStatus = ({ status }: { status: string }) => {
      if (status === "connected") setConnStatus("connected");
      else if (status === "disconnected") setConnStatus("disconnected");
      else if (status === "connecting") setConnStatus("connecting");
    };
    p.on("status", onStatus);
    return () => {
      p.off("status", onStatus);
      p.destroy();
      ydoc.destroy();
    };
  }, [ydoc]);

  return { ydoc, provider, connStatus };
}
