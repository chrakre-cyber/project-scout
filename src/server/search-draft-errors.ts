/** Feilkoder for lagring av søkeutkast (ren modul; kan importeres uten server-only). */
export type DraftWriteError = "not_found" | "conflict" | "forbidden" | "invalid" | "failed";

/** Databasefeil → trygg kode. Rå feiltekst fra databasen når aldri brukeren. */
export function mapError(error: { code?: string; message?: string }): DraftWriteError {
  const msg = error.message ?? "";
  if (error.code === "42501") return "forbidden";
  if (error.code === "23514" && msg.includes("search_draft_conflict")) return "conflict";
  if (error.code === "23514") return "invalid";
  return "failed";
}
