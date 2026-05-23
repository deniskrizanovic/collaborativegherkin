import type { NextAuthConfig } from "next-auth";

// Edge-compatible config subset — no Node.js-only imports (no Prisma, no pg).
// Used by middleware.ts (Edge Runtime). The full config lives in src/auth.ts.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
};
