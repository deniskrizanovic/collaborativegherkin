import NextAuth, { type NextAuthConfig } from "next-auth";
import ResendProvider from "next-auth/providers/resend";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string; name?: string | null };
  }
}

const providers: NextAuthConfig["providers"] = [
  ResendProvider({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.AUTH_EMAIL_FROM ?? "noreply@yourdomain.com",
  }),
];

// Test-only bypass — never set TEST_AUTH_SECRET in production.
if (process.env.TEST_AUTH_SECRET) {
  providers.push(
    CredentialsProvider({
      id: "test-bypass",
      credentials: { email: {}, secret: {} },
      async authorize(credentials) {
        if (credentials.secret !== process.env.TEST_AUTH_SECRET) return null;
        return db.user.upsert({
          where: { email: credentials.email as string },
          update: {},
          create: { email: credentials.email as string },
          select: { id: true, email: true, name: true },
        });
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db as Parameters<typeof PrismaAdapter>[0]),
  session: { strategy: "jwt" },
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
