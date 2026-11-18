import "server-only";
import { cache } from "react";
import * as q from "./queries";

// Deduplica consultas repetidas dentro da mesma requisição (layout + página)
export const getAccounts = cache(q.getAccounts);
export const getCards = cache(q.getCards);
