import "server-only";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ActionResult } from "@/lib/types";

/** Converte erros do Postgres/PostgREST em mensagens amigáveis (as RAISE do banco já vêm em português). */
export function friendlyError(error: PostgrestError | Error | { message: string; code?: string } | null): string {
  if (!error) return "Erro inesperado";
  const code = "code" in error ? error.code : undefined;
  const msg = error.message ?? "";
  if (code === "23505") return "Já existe um registro com esses dados.";
  if (code === "23503") return "Este item está vinculado a outros registros e não pode ser removido.";
  if (code === "42501" || /row-level security/i.test(msg)) return "Você não tem permissão para esta operação.";
  if (code === "23514" && !/[áéíóúãõç]/i.test(msg)) return "Dados inválidos para esta operação.";
  if (code === "PGRST116") return "Registro não encontrado.";
  return msg || "Erro inesperado";
}

export function done<T>(data?: T, message?: string): ActionResult<T> {
  revalidatePath("/", "layout");
  return { ok: true, data, message };
}

export function fail(error: string | PostgrestError | Error | null): ActionResult<never> {
  return { ok: false, error: typeof error === "string" ? error : friendlyError(error) };
}

export async function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect/notFound do Next
    console.error("[action]", e);
    return fail(e instanceof Error ? e : "Erro inesperado");
  }
}
