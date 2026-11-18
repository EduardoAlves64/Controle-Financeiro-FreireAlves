import type { Scope } from "./types";

/**
 * Perspectiva financeira: separa o dinheiro individual do dinheiro do casal.
 *  - all      tudo o que a família vê
 *  - shared   somente o que é do casal (compartilhado)
 *  - me       somente as finanças individuais do usuário logado
 *  - partner  somente as finanças individuais do(a) parceiro(a)
 */
export type Perspective = "all" | "shared" | "me" | "partner";
export const PERSPECTIVE_COOKIE = "fh_perspective";
export const PERSPECTIVES: Perspective[] = ["all", "shared", "me", "partner"];

export function parsePerspective(value: string | undefined | null): Perspective {
  return PERSPECTIVES.includes(value as Perspective) ? (value as Perspective) : "all";
}

export function matchesPerspective(
  item: { owner_id: string; scope: Scope },
  perspective: Perspective,
  me: string,
): boolean {
  switch (perspective) {
    case "all":
      return true;
    case "shared":
      return item.scope === "shared";
    case "me":
      return item.scope === "individual" && item.owner_id === me;
    case "partner":
      return item.scope === "individual" && item.owner_id !== me;
  }
}

export function perspectiveLabel(p: Perspective, partnerName?: string): string {
  switch (p) {
    case "all":
      return "Família";
    case "shared":
      return "Do casal";
    case "me":
      return "Só eu";
    case "partner":
      return partnerName ? `Só ${partnerName}` : "Parceiro(a)";
  }
}
