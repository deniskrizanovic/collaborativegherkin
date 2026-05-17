"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SessionSummary {
  id: string;
  title: string;
  createdAt: Date;
}

interface Props {
  sessions: SessionSummary[];
}

export default function HomeClient({ sessions: initialSessions }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    try {
      // Use a placeholder userId until auth is wired up
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), userId: "cm000000000000000000000000" }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error?.fieldErrors?.title?.[0] ?? "Failed to create session");
        return;
      }
      const session = await res.json();
      router.push(`/sessions/${session.id}`);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container">
      <h1>Collaborative Gherkin</h1>
      <p>Write Gherkin acceptance criteria together, in real time.</p>

      <form className="create-form" onSubmit={handleCreate}>
        <input
          className="create-input"
          type="text"
          placeholder="Session title (e.g. Login feature)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <button className="create-btn" type="submit" disabled={creating || !title.trim()}>
          {creating ? "Creating…" : "Create session"}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}

      {sessions.length > 0 && (
        <section className="sessions-list">
          <h2>Recent sessions</h2>
          <ul>
            {sessions.map((s) => (
              <li key={s.id}>
                <a href={`/sessions/${s.id}`} className="session-link">
                  {s.title}
                  <span className="session-date">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
