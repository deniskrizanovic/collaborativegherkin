"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

interface SessionSummary {
  id: string;
  title: string;
  createdAt: Date;
}

interface Props {
  sessions: SessionSummary[];
  currentUser: { id: string; email: string };
}

export default function HomeClient({ sessions: initialSessions, currentUser }: Props) {
  const router = useRouter();
  const sessions = initialSessions;
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
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
      <header className="home-header">
        <div className="home-user-bar">
          <span className="home-user-email">{currentUser.email}</span>
          <button
            className="nsw-button nsw-button--outline nsw-button--small"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign out
          </button>
        </div>
        <p className="home-eyebrow">Collaborative Gherkin</p>
        <h1>Acceptance criteria,<br />written together.</h1>
        <p className="home-tagline">
          Real-time collaborative editing for Gherkin specs. Share a link, start writing, export anywhere.
        </p>
      </header>

      <form className="create-form" onSubmit={handleCreate}>
        <div className="nsw-form__group">
          <input
            className="nsw-form__input"
            type="text"
            placeholder="Session title — e.g. Login feature"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>
        <button className="nsw-button nsw-button--dark" type="submit" disabled={creating || !title.trim()}>
          {creating ? "Creating…" : "New session"}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}

      {sessions.length > 0 && (
        <section className="sessions-list">
          <p className="sessions-list-heading">Recent sessions</p>
          <ul className="nsw-link-list">
            {sessions.map((s) => (
              <li key={s.id} className="nsw-link-list__item">
                <a href={`/sessions/${s.id}`} className="session-link">
                  <span className="session-name">{s.title}</span>
                  <span className="session-date">
                    {new Date(s.createdAt).toLocaleDateString("en-GB")}
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
