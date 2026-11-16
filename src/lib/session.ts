import { desc, eq } from "drizzle-orm";
import type { Db, Tables } from "./db";

interface SessionDeps {
  db: Db;
  tables: Tables;
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

  private get recordColumns() {
    const { sessions } = this.deps.tables;
    return {
      id: sessions.id,
      title: sessions.title,
      prompt: sessions.prompt,
      model: sessions.model,
      createdAt: sessions.createdAt,
      userId: sessions.userId,
    };
  }

  async list(userId: string): Promise<SessionRecord[]> {
    const { sessions } = this.deps.tables;
    return this.deps.db
      .select(this.recordColumns)
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.createdAt));
  }

  async create(input: { title: string; userId: string }): Promise<SessionRecord> {
    const [row] = await this.deps.db
      .insert(this.deps.tables.sessions)
      .values(input)
      .returning(this.recordColumns);
    return row;
  }

  async get(id: string): Promise<SessionRecord> {
    const { sessions } = this.deps.tables;
    const [row] = await this.deps.db
      .select(this.recordColumns)
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    if (!row) throw new SessionNotFoundError(id);
    return row;
  }

  async update(id: string, patch: { prompt?: string; model?: string }): Promise<void> {
    const { sessions } = this.deps.tables;
    const rows = await this.deps.db
      .update(sessions)
      .set(patch)
      .where(eq(sessions.id, id))
      .returning({ id: sessions.id });
    if (rows.length === 0) throw new SessionNotFoundError(id);
  }

  async delete(id: string): Promise<void> {
    const { sessions } = this.deps.tables;
    const rows = await this.deps.db
      .delete(sessions)
      .where(eq(sessions.id, id))
      .returning({ id: sessions.id });
    if (rows.length === 0) throw new SessionNotFoundError(id);
  }
}
