// HOST-001 (forberedelse): rapportformat for H2–H4. Ren funksjon over strukturerte resultater. Regler: PASS bare når alle PÅKREVDE punkter er PASS; HOPPET/IKKE KJØRT/DELVIS/FEIL gir aldri bestått;
// «ikke relevant» finnes bare for DATA-002D i modus fresh (tomt prosjekt); målet vises bare som fingeravtrykk. Teksten saneres (scripts/ci/sanitize.mjs) mot kjente verdier før den kan lagres/deles.
import { hasLeak, sanitizeText } from "../ci/sanitize.mjs";

export const LABEL = { PASS: "BESTÅTT", FAIL: "FEILET", SKIPPED: "HOPPET OVER (ikke bestått)", PARTIAL: "DELVIS (ikke bestått)", NOT_RUN: "IKKE KJØRT", NOT_APPLICABLE: "IKKE RELEVANT" };
export const MODE_LABEL = { fresh: "TOMT prosjekt (første anvendelse av alle migrasjoner)", upgrade: "OPPGRADERING av eksisterende database" };

/** Normaliserer et punkt; ukjent status og «ikke relevant» utenfor DATA-002D/fresh blir IKKE KJØRT. */
function norm(item, mode) {
  let status = item.status;
  if (!(status in LABEL)) status = "NOT_RUN";
  if (status === "NOT_APPLICABLE" && !(item.key === "data002d" && mode === "fresh")) status = "NOT_RUN";
  return { key: item.key, title: item.title, status, required: status === "NOT_APPLICABLE" ? false : item.required !== false, notes: item.notes ?? [] };
}
export function overall(items) {
  const req = items.filter((i) => i.required);
  if (req.length === 0) return "NOT_RUN";
  if (req.some((i) => i.status === "FAIL")) return "FAIL";
  return req.every((i) => i.status === "PASS") ? "PASS" : "INCOMPLETE";
}

const fromInspect = (insp) => (!insp ? "NOT_RUN" : insp.verdict === "OK" ? "PASS" : "FAIL");
export function h2Items({ mode, inspect, dryRun, apply, verify }) {
  const d = inspect?.data002d?.status;
  const data002d = mode === "fresh"
    ? { key: "data002d", title: "DATA-002D-kartlegging", status: "NOT_APPLICABLE", notes: ["tomt prosjekt: ingen eksisterende rader å kartlegge; migrasjonens egen kartlegging kjøres likevel under anvendelsen og forventes å passere trivielt"] }
    : { key: "data002d", title: "DATA-002D-kartlegging mot eksisterende rettighetsprofiler (FØR anvendelse)", status: !inspect ? "NOT_RUN" : d === "OK" || d === "ALREADY_APPLIED" ? "PASS" : d === "NOT_APPLICABLE" ? "NOT_RUN" : "FAIL", notes: inspect ? [`status ${d}`, `ugyldige profiler ${inspect.data002d?.invalidProfiles ?? "ukjent"}`] : [] };
  return [
    { key: "inspect", title: "Skrivebeskyttet inspeksjon (utgangspunkt og modus)", status: fromInspect(inspect), notes: inspect ? [`tilstand ${inspect.state}`, `anvendt ${inspect.migrations?.appliedCount}/${inspect.repoMigrations}`, ...(inspect.stopReasons ?? [])] : [] },
    data002d,
    { key: "dryRun", title: "Dry-run av migrasjonene", status: dryRun?.status ?? "NOT_RUN", notes: dryRun?.notes ?? [] },
    { key: "apply", title: "Anvendelse av migrasjonene", status: apply?.status ?? "NOT_RUN", notes: apply?.notes ?? [] },
    { key: "verify", title: "Kontroll etter anvendelse (historikk = repo, ingen ventende)", status: verify?.status ?? "NOT_RUN", notes: verify?.notes ?? [] },
  ];
}
export function h3Items({ l4a, l6, secrets, browser = {} }) {
  const item = (key, title, r) => ({ key, title, status: r?.status ?? "NOT_RUN", notes: r?.notes ?? [] });
  return [
    item("L4a", "L4a innlogging/tokenvalidering mot hosted (API-nivå)", l4a),
    item("L6", "L6 firmaskille via hosted PostgREST", l6),
    item("L7", "L7 hemmelighetsskann", secrets),
    item("L4b", "L4b innlogging i nettleser mot hosted — IKKE forberedt i denne omgangen", browser.L4b),
    item("L5a", "L5a econ006 i nettleser mot hosted — IKKE forberedt", browser.L5a),
    item("L5b", "L5b econ006d i nettleser mot hosted — IKKE forberedt", browser.L5b),
  ];
}
export function h4Items({ cleanupPlan, cleanupExecute, verify, ownerDeletion }) {
  return [
    { key: "cleanupPlan", title: "Opprydding: tørrkjøring (hva som ville slettes)", status: cleanupPlan?.status ?? "NOT_RUN", notes: cleanupPlan?.notes ?? [] },
    { key: "cleanupExecute", title: "Opprydding: testdata slettet", status: cleanupExecute?.status ?? "NOT_RUN", notes: cleanupExecute?.notes ?? [] },
    { key: "verify", title: "Kontroll etter opprydding (ingen testdata igjen)", status: verify?.status ?? "NOT_RUN", notes: verify?.notes ?? [] },
    { key: "ownerDeletion", title: "Eier har slettet testprosjektet (bekreftes av eier; kan ikke måles av skriptene)", status: ownerDeletion?.status ?? "NOT_RUN", notes: ownerDeletion?.notes ?? [] },
  ];
}

export function formatReport({ stage, target, items, literals = [], versions = [] }) {
  const its = items.map((i) => norm(i, target.mode));
  const v = overall(its);
  const out = [`# Hosted testprosjekt — ${stage} (HOST-001)`, "", `Modus: **${MODE_LABEL[target.mode]}**`, `Mål: fingeravtrykk ${target.fingerprint} (prosjekt-ref, adresser og nøkler vises aldri)`,
    "Dette er et hosted TESTPROSJEKT — ikke produksjon, ikke pilotdata, ikke pilotgodkjenning.", ""];
  for (const l of versions) out.push(`- ${l}`);
  if (versions.length) out.push("");
  for (const i of its) { out.push(`## ${i.title}: ${LABEL[i.status]}`); for (const n of i.notes) out.push(`- ${n}`); out.push(""); }
  out.push(`## Samlet ${stage}: ${v === "PASS" ? "BESTÅTT" : v === "FAIL" ? "FEILET" : v === "NOT_RUN" ? "IKKE KJØRT" : "IKKE FULLT BESTÅTT"}`, "",
    v === "PASS" ? "Alle påkrevde punkter er bestått." : "Minst ett påkrevd punkt feilet, ble hoppet over, er delvis eller ble ikke kjørt. Slike punkter regnes aldri som bestått.");
  const text = sanitizeText(out.join("\n") + "\n", literals);
  if (hasLeak(text, literals)) throw new Error("rapporten inneholder fortsatt noe som ligner en hemmelighet; avvist");
  return text;
}
