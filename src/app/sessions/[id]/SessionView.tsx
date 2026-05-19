"use client";

import { useState } from "react";
import GherkinEditor from "@/components/GherkinEditor";

interface Props {
  sessionId: string;
  title: string;
}

export default function SessionView({ sessionId, title }: Props) {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="container">
      <div className="session-header">
        <h1 className="session-title">{title}</h1>
        <button className={`copy-link-btn${copied ? " copied" : ""}`} onClick={copyLink}>
          {copied ? "Copied!" : "Copy invite link"}
        </button>
      </div>
      <p className="session-hint">
        Share the link above so others can edit this session with you.
        Press <kbd>/</kbd> to pick a block type, or use the toolbar below.
      </p>
      <GherkinEditor sessionId={sessionId} />
    </div>
  );
}
