// HOST-001 (forberedelse): port som avgjør om H2 dry-run og anvendelse får starte. Ren funksjon over lokale, nylige og samsvarende belegg — ingenting anvendes uten at skrivebeskyttet inspeksjon
// (og for anvendelse en vellykket dry-run) er gjort mot SAMME prosjekt (fingeravtrykk), SAMME modus og SAMME migrasjonssett i repoet (hash) innen en kort frist.
export const MAX_AGE_MS = 60 * 60 * 1000;

function inspectProblems(inspect, { target, repoHash, now, maxAgeMs }) {
  const r = [];
  if (!inspect || inspect.kind !== "hosted-inspect" || inspect.schemaVersion !== 1) return ["mangler gyldig inspeksjonsrapport"];
  if (inspect.verdict !== "OK") r.push("inspeksjonen endte med STOPP");
  if (inspect.target?.fingerprint !== target.fingerprint) r.push("inspeksjonen gjelder et annet prosjekt");
  if (inspect.mode !== target.mode) r.push("inspeksjonen er tatt i en annen modus");
  if ((target.mode === "fresh" ? "tomt" : "oppgradering") !== inspect.state) r.push("databasetilstanden passer ikke til valgt modus");
  if (inspect.repoHash !== repoHash) r.push("migrasjonene i repoet er endret siden inspeksjonen");
  const age = now.getTime() - Date.parse(inspect.takenAt);
  if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) r.push("inspeksjonen er for gammel eller har ugyldig tidspunkt");
  if (!["OK", "NOT_APPLICABLE", "ALREADY_APPLIED"].includes(inspect.data002d?.status)) r.push("DATA-002D-kartleggingen er ikke OK");
  if (inspect.nothingToApply === true) r.push("ingen ventende migrasjoner å anvende");
  return r;
}

/** stage: «h2-dry-run» | «h2-apply». backupConfirmed gjelder modus upgrade (eksisterende database). */
export function checkGate({ stage, target, inspect, dryRun, repoHash, now = new Date(), backupConfirmed = false, maxAgeMs = MAX_AGE_MS }) {
  const reasons = [];
  if (stage !== "h2-dry-run" && stage !== "h2-apply") return { allow: false, reasons: ["ukjent trinn"] };
  reasons.push(...inspectProblems(inspect, { target, repoHash, now, maxAgeMs }));
  if (stage === "h2-apply") {
    if (!dryRun || dryRun.kind !== "hosted-dry-run" || dryRun.status !== "PASS") reasons.push("mangler vellykket dry-run");
    else {
      if (dryRun.target?.fingerprint !== target.fingerprint) reasons.push("dry-run gjelder et annet prosjekt");
      if (dryRun.mode !== target.mode) reasons.push("dry-run er tatt i en annen modus");
      if (dryRun.inspectTakenAt !== inspect?.takenAt) reasons.push("dry-run hører til en annen inspeksjon");
      if (dryRun.repoHash !== repoHash) reasons.push("migrasjonene er endret siden dry-run");
      const age = now.getTime() - Date.parse(dryRun.takenAt);
      if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) reasons.push("dry-run er for gammel");
    }
    if (target.mode === "upgrade" && backupConfirmed !== true) reasons.push("oppgradering av eksisterende database krever bekreftet sikkerhetskopi (SCOUT_HOSTED_BACKUP=bekreftet)");
  }
  return { allow: reasons.length === 0, reasons };
}
