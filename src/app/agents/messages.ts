import type { AgentWriteError } from "@/server/agents";

export const AGENT_MESSAGES: Record<AgentWriteError, string> = {
  not_found: "Fant ikke agenten i ditt firma.",
  conflict: "Agenten er endret i mellomtiden. Last siden på nytt og prøv igjen.",
  forbidden: "Ingen tilgang.",
  active_limit: "Maks 10 aktive agenter per firma er nådd. Pause en annen agent først.",
  not_ready: "Agenten kan ikke aktiveres før alle krav er oppfylt.",
  invalid: "Agenten ble avvist av databasen som ugyldig. Kontroller feltene.",
  active_requires_complete: "En aktiv agent må være komplett. Fyll ut det som mangler, eller pause agenten før du lagrer.",
  failed: "Lagring feilet. Prøv igjen.",
};

export const SUCCESS_MESSAGES: Record<string, string> = {
  saved: "Agenten er lagret.",
  activated: "Agenten er aktivert. Automatisk søk er ikke koblet til ennå (DEV-005).",
  paused: "Agenten er pauset.",
};

/**
 * Slår bare opp nøkler som uttrykkelig finnes i tabellen (egne egenskaper). Query-parametre er brukerstyrt:
 * `obj[key]` ville truffet Object.prototype for `__proto__`, `constructor`, `toString` m.fl. (QA-001 F3).
 */
export function lookupMessage<T extends string>(table: Readonly<Record<string, T>>, key: string | undefined): T | null {
  return key !== undefined && Object.hasOwn(table, key) ? (table[key] as T) : null;
}
