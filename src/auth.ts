import NextAuth, { type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import ResendProvider from "next-auth/providers/resend";
import { db, tables } from "@/lib/db";
import { authAdapter, ensureUserByEmail } from "@/lib/user";

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string; name?: string | null };
  }
}

const providers: NextAuthConfig["providers"] = [
  ResendProvider({
    apiKey: process.env.AUTH_RESEND_KEY,
    from: process.env.AUTH_EMAIL_FROM ?? "onboarding@resend.dev",
  }),
];

// Test-only bypass — never set TEST_AUTH_SECRET in production.
// The static `NODE_ENV !== "production"` literal lets the bundler
// dead-code-eliminate this entire block from a production build (ENG-003).
if (process.env.NODE_ENV !== "production" && process.env.TEST_AUTH_SECRET) {
  providers.push(
    CredentialsProvider({
      id: "test-bypass",
      credentials: { email: {}, secret: {} },
      async authorize(credentials) {
        // The client no longer carries the secret (ENG-004); an unsubmitted
        // secret defaults to the server-side value. A caller that explicitly
        // submits a non-matching secret is still rejected (defense in depth).
        const submitted =
          (credentials.secret as string | undefined) ?? process.env.TEST_AUTH_SECRET;
        if (submitted !== process.env.TEST_AUTH_SECRET) return null;
        return ensureUserByEmail(db, tables, credentials.email as string);
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: authAdapter(db, tables),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  providers,
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
