// Dokumentkontroll for docs/tax (TAX-001A). Ingen produksjonskode og ingen regelberegning.
// Kjøres: node docs/tax/check-docs.mjs  (Node ≥ 20, ingen pakker)
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));
const rd = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const errors = [];
const err = (m) => errors.push(m);
const uniq = (arr, what) => { const s = new Set(); for (const x of arr) { if (s.has(x)) err(`duplikat ${what}: ${x}`); s.add(x); } return s; };

const rules = rd("rules.json"), sources = rd("sources.json"), profiles = rd("profiles.json"), refs = rd("references.json"), demo = rd("demo-series.json");
const ruleIds = uniq(rules.rules.map((r) => r.id), "regel-id");
const srcIds = uniq(sources.sources.map((s) => s.id), "kilde-id");
const profIds = uniq(profiles.profiles.map((p) => p.id), "profil-id");
const caseIds = uniq(refs.cases.map((c) => c.id), "tilfelle-id");

for (const s of sources.sources) {
  if (!/^https:\/\//.test(s.url)) err(`kilde ${s.id}: url må være https`);
  if (s.evidenceLevel === "E1" && !s.directReadDate) err(`kilde ${s.id}: E1 krever directReadDate`);
  if (s.evidenceLevel === "E1" && s.fetchStatus.startsWith("ikke_hentet")) err(`kilde ${s.id}: E1 men ikke hentet`);
  for (const r of s.rules ?? []) if (!ruleIds.has(r)) err(`kilde ${s.id}: ukjent regel ${r}`);
}
for (const r of rules.rules) {
  if (r.usableAsRuleParameter) err(`regel ${r.id}: usableAsRuleParameter må være false uten E1`);
  if (r.evidenceLevel === "E1" && !r.controlledDate) err(`regel ${r.id}: E1 krever controlledDate`);
  for (const s of r.sources) if (!srcIds.has(s.id)) err(`regel ${r.id}: ukjent kilde ${s.id}`);
  for (const p of r.profiles) if (!profIds.has(p)) err(`regel ${r.id}: ukjent profil ${p}`);
  if (!/IKKE KONTROLLERT/.test(r.amountUnitAndRounding) && r.evidenceLevel !== "E1") err(`regel ${r.id}: beløp uten E1`);
}
for (const p of profiles.profiles) for (const r of p.rules) if (!ruleIds.has(r)) err(`profil ${p.id}: ukjent regel ${r}`);
const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (const c of refs.cases) {
  counts[c.evidenceClass] = (counts[c.evidenceClass] ?? 0) + 1;
  if (![1, 2, 3, 4].includes(c.evidenceClass)) err(`tilfelle ${c.id}: ugyldig klasse`);
  if (c.profileId && !profIds.has(c.profileId)) err(`tilfelle ${c.id}: ukjent profil ${c.profileId}`);
  for (const r of c.ruleIds) if (!ruleIds.has(r)) err(`tilfelle ${c.id}: ukjent regel ${r}`);
  for (const s of c.sources) if (!srcIds.has(s)) err(`tilfelle ${c.id}: ukjent kilde ${s}`);
  if (c.evidenceClass === 4 && (c.expected.kind !== "none" || "value" in c.expected)) err(`tilfelle ${c.id}: klasse 4 skal ikke ha forventet verdi`);
  if (c.evidenceClass === 4 && !(c.requiredToUpgrade.length && c.expected.missing?.length)) err(`tilfelle ${c.id}: klasse 4 må liste mangler og oppgradering`);
  if (c.evidenceClass === 3 && !(c.expected.kind === "value" || c.expected.kind === "status")) err(`tilfelle ${c.id}: klasse 3 mangler forventning`);
  if (c.evidenceClass <= 2) {
    // uavhengig kontrollert / manuelt kildeutledet: krever kilde med E1 og dato
    const ok = c.sources.length && c.sources.every((s) => sources.sources.find((x) => x.id === s)?.evidenceLevel === "E1");
    if (!ok) err(`tilfelle ${c.id}: klasse ${c.evidenceClass} krever E1-kilder`);
  }
}
if (refs.cases.length < 50) err(`færre enn 50 tilfeller (${refs.cases.length})`);
const profileCover = new Set(refs.cases.filter((c) => c.profileId).map((c) => c.profileId));
for (const p of profIds) if (!profileCover.has(p)) err(`profil ${p} har ingen tilfeller`);
for (const s of demo.scenarios) if (s.purchaseBasisEur === null && s.customsValueEur !== null) err(`demo ${s.scenario}: inkonsistent`);
// markdown: alle regel-id-er i rules.md finnes i rules.json og omvendt
const md = readFileSync(join(dir, "TAX-001A-rules.md"), "utf8");
const mdIds = new Set([...md.matchAll(/^### (R-[A-Z0-9-]+) —/gm)].map((m) => m[1]));
for (const id of ruleIds) if (!mdIds.has(id)) err(`rules.md mangler ${id}`);
for (const id of mdIds) if (!ruleIds.has(id)) err(`rules.md har ukjent ${id}`);
for (const f of ["profiles.md", "purchase-basis.md", "demo-series.md", "TAX-001A-rules.md"]) {
  const t = readFileSync(join(dir, f), "utf8");
  for (const m of t.matchAll(/\bR-[A-Z]{3}-[A-Z0-9-]+\b/g)) if (!ruleIds.has(m[0])) err(`${f}: ukjent regel-id ${m[0]}`);
  for (const m of t.matchAll(/\bC[34]-[A-Z0-9-]+\b/g)) if (!caseIds.has(m[0]) && !/C4-[A-Z]+-$/.test(m[0])) err(`${f}: ukjent tilfelle-id ${m[0]}`);
}
console.log(`regler ${ruleIds.size}, kilder ${srcIds.size}, profiler ${profIds.size}, tilfeller ${caseIds.size} (klasse1 ${counts[1]}, klasse2 ${counts[2]}, klasse3 ${counts[3]}, klasse4 ${counts[4]})`);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("OK: format, kilde-id-er, regel-id-er og referanser stemmer.");
