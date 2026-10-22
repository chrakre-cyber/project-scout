// Sjekkidentiteter og parsing av nettleserløpenes utskrift (tests/e2e/*.e2e.mjs). Identitet = skriptnøkkel + normalisert sjekknavn (fast tekst fra skriptet); dynamiske deler
// (epoketidspunkt, datoer, tilfeldige kjørings-id-er) normaliseres bort så navnene er stabile mellom kjøringer. Navnene lagres i e2e-plan.json.
export const normalizeCheckName = (s) => String(s)
  .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, "‹epoke›")
  .replace(/\b\d{2}\.\d{2}\.\d{4}\b/g, "‹dato›")
  .replace(/\b[0-9a-f]{6}\b(?=[\s)»,:]|$)/g, (m) => (/\d/.test(m) && /[a-f]/.test(m) ? "‹id›" : m))
  .replace(/\s+/g, " ")
  .trim();

/** Leser stdout fra et løp. Resultatlinjer: «OK  navn», «FEIL navn[ — ekstra]», «HOPP navn[ — årsak]». Returnerer også MODUS-linje og sammendrag. */
export function parseE2E(output, knownNames = []) {
  const lines = String(output ?? "").split(/\r?\n/);
  const known = knownNames.map((n) => [n, normalizeCheckName(n)]).sort((a, b) => b[1].length - a[1].length);
  const items = [];
  let modeLine = "", summary = "";
  for (const raw of lines) {
    if (/^MODUS: /.test(raw)) { modeLine = raw; continue; }
    if (/^\d+\/\d+ sjekker OK/.test(raw.trim())) { summary = raw.trim(); continue; }
    const m = /^(OK  |FEIL |HOPP )(.*)$/.exec(raw);
    if (!m) continue;
    const kind = m[1].trim(), rest = m[2];
    if (kind === "OK") { items.push({ kind, name: normalizeCheckName(rest), extra: "" }); continue; }
    const norm = normalizeCheckName(rest);
    const hit = known.find(([, k]) => norm === k || norm.startsWith(`${k} — `));
    items.push(hit ? { kind, name: hit[1], extra: norm.slice(hit[1].length).replace(/^ — /, "") } : { kind, name: norm, extra: "" });
  }
  return { modeLine, summary, items };
}
