import type { DraftWriteError } from "@/server/search-draft-errors";

export const DRAFT_MESSAGES: Record<DraftWriteError, string> = {
  not_found: "Fant ikke søket i ditt firma.",
  conflict: "Søket er endret etter at du åpnet det, så endringene dine ble ikke lagret. Skjemaet under viser fortsatt det du skrev inn. Åpne siste lagrede versjon i en ny fane, ta med endringene og lagre på nytt.",
  forbidden: "Du har ikke tilgang til å lagre dette søket.",
  invalid: "Databasen avviste søket som ugyldig. Kontroller feltene og prøv igjen.",
  failed: "Lagring feilet. Prøv igjen.",
};

export const DRAFT_SUCCESS: Record<string, string> = {
  saved: "Søket er lagret.",
  created: "Søket er lagret som utkast.",
};

/** Query-parametre er brukerstyrt: bare oppslag av egne nøkler (jf. QA-001 F3). */
export function lookup<T extends string>(table: Readonly<Record<string, T>>, key: string | undefined): T | null {
  return key !== undefined && Object.hasOwn(table, key) ? (table[key] as T) : null;
}
