import type { PrismaClient } from "../generated/prisma/client";

interface SessionDeps {
  session: PrismaClient["session"];
}

export interface SessionRecord {
  id: string;
  title: string;
  prompt: string | null;
  model: string | null;
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
      select: { id: true, title: true, prompt: true, model: true, createdAt: true, userId: true },
    });
  }

  async create(input: { title: string; userId: string }): Promise<SessionRecord> {
    return this.deps.session.create({ data: input });
  }

  async get(id: string): Promise<SessionRecord> {
    const row = await this.deps.session.findUnique({
      where: { id },
      select: { id: true, title: true, prompt: true, model: true, createdAt: true, userId: true },
    });
    if (!row) throw new SessionNotFoundError(id);
    return row;
  }

  async update(id: string, patch: { prompt?: string; model?: string }): Promise<void> {
    try {
      await this.deps.session.update({ where: { id }, data: patch });
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
