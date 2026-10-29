import { useEffect, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export type ConnStatus = "connecting" | "connected" | "disconnected";

export function useCollabProvider(sessionId: string, wsUrl: string): {
  ydoc: Y.Doc;
  provider: WebsocketProvider | null;
  connStatus: ConnStatus;
} {
  // The doc is plain memory, so it is safe to create during render. It lives as
  // long as the component; the editor unbinds from it when it is destroyed.
  const [ydoc] = useState<Y.Doc>(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>("connecting");

  useEffect(() => {
    // The provider opens a socket, so the same effect creates and destroys it.
    // React's dev StrictMode mount → unmount → mount then leaves exactly one
    // live provider, rather than a destroyed one bound to the editor.
    const p = new WebsocketProvider(wsUrl, `session-${sessionId}`, ydoc);

    const onStatus = ({ status }: { status: string }) => {
      if (status === "connected") setConnStatus("connected");
      else if (status === "disconnected") setConnStatus("disconnected");
      else if (status === "connecting") setConnStatus("connecting");
    };
    p.on("status", onStatus);

    /* eslint-disable react-hooks/set-state-in-effect --
       The effect owns the socket, so the provider exists only once it runs and
       must reach render through state. y-websocket v3 starts connecting in the
       constructor; a WebSocket cannot open synchronously, so a new provider is
       always "connecting" here. */
    setConnStatus("connecting");
    setProvider(p);
    /* eslint-enable react-hooks/set-state-in-effect */

    return () => {
      p.off("status", onStatus);
      p.destroy();
      setProvider(null);
    };
  }, [ydoc, sessionId, wsUrl]);

  return { ydoc, provider, connStatus };
}
