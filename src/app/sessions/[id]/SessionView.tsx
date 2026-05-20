"use client";

import { useEffect, useRef, useState } from "react";
import GherkinEditor, { GherkinEditorHandle } from "@/components/GherkinEditor";
import ReactMarkdown from "react-markdown";

interface Props {
  sessionId: string;
  title: string;
}

export default function SessionView({ sessionId, title }: Props) {
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<GherkinEditorHandle>(null);

  // LLM settings
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");

  // Review modal
  const [reviewing, setReviewing] = useState(false);
  const [lastReviewResult, setLastReviewResult] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Prompt edit modal
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);

  useEffect(() => {
    fetch("/api/llm-settings")
      .then((r) => r.json())
      .then((data: { availableModels: string[]; model: string; prompt: string }) => {
        setAvailableModels(data.availableModels);
        setSelectedModel(data.model);
        setPromptText(data.prompt);
      })
      .catch(() => {});
  }, []);

  // Close review modal on Escape
  useEffect(() => {
    if (!reviewOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setReviewOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [reviewOpen]);

  // Close prompt modal on Escape
  useEffect(() => {
    if (!promptOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setPromptOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [promptOpen]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleModelChange = async (model: string) => {
    setSelectedModel(model);
    await fetch("/api/llm-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
  };

  const handleReview = async () => {
    if (!editorRef.current || reviewing) return;
    const content = editorRef.current.getContent();
    setReviewing(true);
    try {
      const res = await fetch("/api/llm-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, model: selectedModel }),
      });
      const data = await res.json() as { result?: string; error?: string };
      setLastReviewResult(data.result ?? data.error ?? "No response received.");
      setReviewOpen(true);
    } catch {
      setLastReviewResult("Failed to reach the review service. Please try again.");
      setReviewOpen(true);
    } finally {
      setReviewing(false);
    }
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      await fetch("/api/llm-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });
      setPromptOpen(false);
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleOpenPrompt = async () => {
    const res = await fetch("/api/llm-settings");
    const data = await res.json() as { prompt: string };
    setPromptText(data.prompt);
    setPromptOpen(true);
  };

  return (
    <div className="container">
      <div className="session-header">
        <h1 className="session-title">{title}</h1>
        <div className="session-actions">
          <button className={`copy-link-btn${copied ? " copied" : ""}`} onClick={copyLink}>
            {copied ? "Copied!" : "Copy invite link"}
          </button>
          <button className="session-edit-prompt-btn" onClick={handleOpenPrompt}>
            Edit prompt
          </button>
          <select
            className="session-model-select"
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={reviewing}
          >
            {availableModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            className="session-review-btn"
            onClick={handleReview}
            disabled={reviewing || !selectedModel}
          >
            {reviewing ? "Reviewing…" : "Get AI Coaching"}
          </button>
          {lastReviewResult !== null && (
            <button
              className="session-view-last-review-btn"
              onClick={() => setReviewOpen(true)}
            >
              View last review
            </button>
          )}
        </div>
      </div>
      <p className="session-hint">
        Share the link above so others can edit this session with you.
        Press <kbd>/</kbd> to pick a block type, or use the toolbar below.
      </p>
      <GherkinEditor ref={editorRef} sessionId={sessionId} />

      {reviewOpen && lastReviewResult !== null && (
        <div className="session-review-modal" onMouseDown={() => setReviewOpen(false)}>
          <div className="session-review-modal-inner" onMouseDown={(e) => e.stopPropagation()}>
            <div className="session-review-modal-header">
              <span className="session-review-modal-title">AI Review — {selectedModel}</span>
              <button className="session-review-modal-close" onClick={() => setReviewOpen(false)}>
                ✕
              </button>
            </div>
            <div className="session-review-modal-body">
              <ReactMarkdown>{lastReviewResult}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {promptOpen && (
        <div className="session-prompt-modal" onMouseDown={() => setPromptOpen(false)}>
          <div className="session-prompt-modal-inner" onMouseDown={(e) => e.stopPropagation()}>
            <p className="session-prompt-modal-label">Review prompt</p>
            <textarea
              className="session-prompt-textarea"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={10}
            />
            <div className="session-prompt-actions">
              <button
                className="session-prompt-save"
                onClick={handleSavePrompt}
                disabled={savingPrompt || promptText.length < 10}
              >
                {savingPrompt ? "Saving…" : "Save"}
              </button>
              <button className="session-prompt-cancel" onClick={() => setPromptOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
