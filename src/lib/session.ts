import type { PrismaClient } from "../generated/prisma/client";

interface SessionDeps {
  session: PrismaClient["session"];
}

export interface SessionRecord {
  id: string;
  title: string;
  createdAt: Date;
  userId: string;
}

export class SessionNotFoundError extends Error {}

export class Session {
  constructor(private deps: SessionDeps) {}

  async list(userId: string): Promise<SessionRecord[]> {
    return this.deps.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true, userId: true },
    });
  }

  async create(input: { title: string; userId: string }): Promise<SessionRecord> {
    return this.deps.session.create({ data: input });
  }

  async get(id: string): Promise<SessionRecord> {
    const row = await this.deps.session.findUnique({ where: { id } });
    if (!row) throw new SessionNotFoundError(id);
    return row;
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deps.session.delete({ where: { id } });
    } catch (err: unknown) {
      if (
        err instanceof Object &&
        "code" in err &&
        (err as { code: string }).code === "P2025"
      ) {
        throw new SessionNotFoundError(id);
      }
      throw err;
    }
  }
}
