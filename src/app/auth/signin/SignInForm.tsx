"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInForm({ testAuthSecret }: { testAuthSecret: string | null }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await signIn("resend", { email, redirect: false });
      if (result?.error) {
        setError("Something went wrong. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDevLogin = async () => {
    setSubmitting(true);
    setError("");
    try {
      await signIn("test-bypass", {
        email: "dev@example.com",
        secret: testAuthSecret ?? "",
        callbackUrl: "/",
      });
    } catch {
      setError("Dev login failed.");
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: "3rem" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero.png"
        alt="Two pickle characters writing Gherkin on a whiteboard"
        style={{ width: "100%", height: "auto", display: "block", borderRadius: "var(--radius)", marginBottom: "1.75rem" }}
      />
      <header className="home-header" style={{ marginBottom: "2rem" }}>
        <p className="home-eyebrow">Collaborative Gherkin</p>
        <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)" }}>Sign in</h1>
        <p className="home-tagline">
          Enter your email address and we&apos;ll send you a magic link to sign in.
        </p>
      </header>

      {sent ? (
        <div className="nsw-in-page-alert nsw-in-page-alert--info" role="alert">
          <div className="nsw-in-page-alert__content">
            <p className="nsw-in-page-alert__title">Check your email</p>
            <p>We&apos;ve sent a sign-in link to <strong>{email}</strong>.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className={`nsw-form__group${error ? " nsw-form__group--error" : ""}`}>
            <label className="nsw-form__label" htmlFor="email">
              Email address
            </label>
            {error && (
              <span className="nsw-form__helper nsw-form__helper--error" role="alert">
                {error}
              </span>
            )}
            <input
              id="email"
              className="nsw-form__input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <button
            className="nsw-button nsw-button--dark"
            type="submit"
            disabled={submitting || !email.trim()}
          >
            {submitting ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}

      {testAuthSecret && (
        <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
          <p className="home-eyebrow" style={{ marginBottom: "0.75rem" }}>Dev login</p>
          <button
            className="nsw-button nsw-button--outline"
            type="button"
            disabled={submitting}
            onClick={handleDevLogin}
          >
            Sign in as dev@example.com
          </button>
        </div>
      )}
    </div>
  );
}
