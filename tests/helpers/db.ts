import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

/**
 * Sobe um Postgres em memória (PGlite) com um stub mínimo do schema `auth`
 * do Supabase e aplica todas as migrations (exceto storage, que é exclusiva do Supabase).
 */
export async function createDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  const dir = path.join(process.cwd(), "supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql") && !f.includes("storage")).sort();
  for (const f of files) {
    try {
      await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${f} falhou: ${(e as Error).message}`);
    }
  }
  return db;
}

export async function signUp(db: PGlite, email: string, fullName: string, inviteCode?: string) {
  const meta = JSON.stringify({ full_name: fullName, ...(inviteCode ? { invite_code: inviteCode } : {}) });
  const r = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id",
    [email, meta],
  );
  return r.rows[0].id;
}

/** Executa como usuário autenticado (RLS ativo). */
export async function asUser<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

export async function one<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []) {
  const r = await db.query<T>(sql, params);
  return r.rows[0];
}
