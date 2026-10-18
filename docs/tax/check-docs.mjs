// Dokumentkontroll for docs/tax (TAX-001A/B). Ingen produksjonskode og ingen produksjonsregelberegning.
// Kjøres: node docs/tax/check-docs.mjs [--pack <katalog med uttrukket kildepakke TAX-001B-handoff>]  (Node ≥ 20, ingen pakker)
// Med --pack kontrolleres også SHA-256 for kildefilene og at bruksfradragstabellen i JSON stemmer med T07-HTML-filen.
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));
const rd = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const errors = [];
function addDay(d) { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); }
const err = (m) => errors.push(m);
const uniq = (arr, what) => { const s = new Set(); for (const x of arr) { if (s.has(x)) err(`duplikat ${what}: ${x}`); s.add(x); } return s; };
const packIdx = process.argv.indexOf("--pack");
const packDir = packIdx > 0 ? process.argv[packIdx + 1] : null;

const rules = rd("rules.json"), sources = rd("sources.json"), profiles = rd("profiles.json"), refs = rd("references.json"), demo = rd("demo-series.json"), table = rd("bruksfradrag-tabell-T07.json");
const ruleIds = uniq(rules.rules.map((r) => r.id), "regel-id");
const srcIds = uniq(sources.sources.map((s) => s.id), "kilde-id");
const profIds = uniq(profiles.profiles.map((p) => p.id), "profil-id");
const caseIds = uniq(refs.cases.map((c) => c.id), "tilfelle-id");
const srcById = new Map(sources.sources.map((s) => [s.id, s]));
const ruleById = new Map(rules.rules.map((r) => [r.id, r]));
const LEVELS = ["E0", "E1", "E1P", "E1X", "E2", "E3"];

// ---- kilder
for (const s of sources.sources) {
  if (!/^https:\/\//.test(s.url)) err(`kilde ${s.id}: url må være https`);
  if (!["E0", "E1", "E1X", "E2", "E3"].includes(s.evidenceLevel)) err(`kilde ${s.id}: ugyldig nivå ${s.evidenceLevel}`);
  if (s.evidenceLevel === "E1X") {
    // Eksternt verifisert (ikke lest av Claude): ingen lesedato/hash, men verifisør, dato, oppgitte fakta og begrensninger kreves.
    if (s.directReadDate || s.packageSha256) err(`kilde ${s.id}: E1X skal ikke ha directReadDate/packageSha256 (ikke lest av Claude)`);
    if (!s.verifiedBy || !s.verifiedDate || !s.providedFacts?.length || !s.limitations) err(`kilde ${s.id}: E1X krever verifiedBy, verifiedDate, providedFacts og limitations`);
  }
  if (s.evidenceLevel === "E1") {
    if (!s.directReadDate) err(`kilde ${s.id}: E1 krever directReadDate`);
    if (!String(s.fetchStatus).startsWith("lest_")) err(`kilde ${s.id}: E1 krever fetchStatus lest_*`);
    if (!s.publishedVersion) err(`kilde ${s.id}: E1 krever publishedVersion`);
    if (!s.limitations) err(`kilde ${s.id}: E1 krever limitations`);
    if (!s.packageFile || !/^[0-9a-f]{64}$/.test(s.packageSha256 ?? "")) err(`kilde ${s.id}: E1 krever packageFile og packageSha256`);
  } else if (s.directReadDate) err(`kilde ${s.id}: directReadDate satt uten E1`);
  if (s.externalVerification && s.evidenceLevel !== "E1") err(`kilde ${s.id}: externalVerification er bare for E1-kilder (E1X bruker egne felt)`);
  for (const r of s.rules ?? []) if (!ruleIds.has(r)) err(`kilde ${s.id}: ukjent regel ${r}`);
}
// ---- kildefiler i repoet (ECON-002): SHA-256 av faktiske filbytes må stemme med registeret
for (const s of sources.sources) if (s.repoFile) {
  const p = join(dir, "..", "..", s.repoFile);
  if (!existsSync(p)) { err(`kilde ${s.id}: repoFile mangler (${s.repoFile})`); continue; }
  const h = createHash("sha256").update(readFileSync(p)).digest("hex");
  if (h !== s.packageSha256) err(`kilde ${s.id}: SHA-256 for ${s.repoFile} er ${h}, registrert ${s.packageSha256}`);
}
// ---- begrepsvern (F1): vrakpantutbetaling er ikke vrakpantavgift
for (const s of sources.sources) {
  if (/scrap-deposit/.test(s.url)) for (const rid of s.rules ?? []) if (!/^utenfor_beregning/.test(ruleById.get(rid)?.status ?? "")) err(`kilde ${s.id} (vrakpant-UTBETALING) brukes som grunnlag for beregningsregel ${rid}`);
}
{
  const fee = ruleById.get("R-IMP-OTH-001"), pay = ruleById.get("R-SCR-PAY-001");
  if (!fee || !fee.sources.some((x) => /\/satser\/vrakpantavgift/.test(srcById.get(x.id)?.url ?? ""))) err("R-IMP-OTH-001 må ha satssiden for vrakpantavgift som kilde");
  if (fee && fee.sources.some((x) => /scrap-deposit/.test(srcById.get(x.id)?.url ?? ""))) err("R-IMP-OTH-001 siterer vrakpant-utbetalingssiden");
  if (!pay || !/^utenfor_beregning/.test(pay.status) || pay.profiles.length) err("R-SCR-PAY-001 må være utenfor_beregning og uten profiler");
  for (const p of profiles.profiles) if (p.rules.includes("R-SCR-PAY-001")) err(`profil ${p.id} bruker vrakpantutbetaling som regel`);
}
// ---- regler
for (const r of rules.rules) {
  if (!LEVELS.includes(r.evidenceLevel)) err(`regel ${r.id}: ugyldig nivå`);
  const f = r.e1Findings ?? [];
  if (r.evidenceLevel === "E1" || r.evidenceLevel === "E1P") {
    if (!r.controlledDate) err(`regel ${r.id}: ${r.evidenceLevel} krever controlledDate`);
    if (!f.length) err(`regel ${r.id}: ${r.evidenceLevel} krever e1Findings`);
    for (const x of f) {
      if (srcById.get(x.source)?.evidenceLevel !== "E1") err(`regel ${r.id}: e1Finding bygger på ikke-E1-kilde ${x.source}`);
      if (!x.locator || !x.readDate || !x.claim) err(`regel ${r.id}: e1Finding mangler claim/locator/readDate`);
    }
    if (r.evidenceLevel === "E1P" && !r.openQuestions.length) err(`regel ${r.id}: E1P krever åpne spørsmål`);
  } else if (f.length) err(`regel ${r.id}: e1Findings uten E1/E1P`);
  const fx = r.e1xFindings ?? [];
  if (r.evidenceLevel === "E1X" && !fx.length) err(`regel ${r.id}: E1X krever e1xFindings`);
  if (fx.length && !["E1", "E1P", "E1X"].includes(r.evidenceLevel)) err(`regel ${r.id}: e1xFindings på regel uten E1/E1P/E1X`);
  for (const x of fx) {
    const xs = srcById.get(x.source);
    if (!(xs?.evidenceLevel === "E1X" || (xs?.evidenceLevel === "E1" && xs.externalVerification))) err(`regel ${r.id}: e1xFinding bygger på kilde ${x.source} som verken er E1X eller E1 med externalVerification`);
    if (!x.claim || !x.locator || !x.verifiedDate || !x.verifiedBy) err(`regel ${r.id}: e1xFinding mangler claim/locator/verifiedDate/verifiedBy`);
  }
  if (r.evidenceLevel === "E1X" && !r.openQuestions.length) err(`regel ${r.id}: E1X krever åpne spørsmål (unknown stays unknown)`);
  // Datosensitive parametere: må ha fra-dato, stigende bånd, og aldri brukes før fra-datoen.
  for (const dp of r.datedParameters ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dp.from ?? "")) err(`regel ${r.id}: datedParameter ${dp.id} mangler fra-dato`);
    if (!dp.beforeFrom || !/UKJENT|not_calculated|dekket av DP-/i.test(dp.beforeFrom)) err(`regel ${r.id}: datedParameter ${dp.id} må si at tiden før fra-datoen er ukjent eller dekket av annen parameter`);
    if (dp.to && !/^\d{4}-\d{2}-\d{2}$/.test(dp.to)) err(`regel ${r.id}: datedParameter ${dp.id} har ugyldig til-dato`);
    if (dp.to && dp.to < dp.from) err(`regel ${r.id}: datedParameter ${dp.id} har til-dato før fra-dato`);
    if (dp.to && !(dp.afterTo && /UKJENT|not_calculated|dekket av DP-/i.test(dp.afterTo))) err(`regel ${r.id}: datedParameter ${dp.id} har til-dato men mangler afterTo (ukjent eller dekket av annen parameter)`);
    if (!dp.series || !["a", "b"].includes(dp.group)) err(`regel ${r.id}: datedParameter ${dp.id} mangler series/group`);
    if (!dp.bands && !(dp.thresholdKg > 0 && dp.rate > 0)) err(`regel ${r.id}: datedParameter ${dp.id} mangler bands eller thresholdKg+rate`);
    if (/dekket av (DP-[A-Z0-9-]+)/.test(dp.beforeFrom ?? "")) { const o = (r.datedParameters ?? []).find((q) => q.id === RegExp.$1); if (!o || o.series !== dp.series || !o.to || addDay(o.to) !== dp.from) err(`regel ${r.id}: datedParameter ${dp.id} beforeFrom peker ikke på tilstøtende parameter i samme serie`); }
    if (/dekket av (DP-[A-Z0-9-]+)/.test(dp.afterTo ?? "")) { const o = (r.datedParameters ?? []).find((q) => q.id === RegExp.$1); if (!o || o.series !== dp.series || !dp.to || addDay(dp.to) !== o.from) err(`regel ${r.id}: datedParameter ${dp.id} afterTo peker ikke på tilstøtende parameter i samme serie`); }
    if (r.id === "R-OTA-008" && dp.group !== "b") err(`regel ${r.id}: gruppe-b-regel har parameter i gruppe ${dp.group}`);
    if (["R-OTA-001", "R-OTA-002"].includes(r.id) && dp.group !== "a") err(`regel ${r.id}: gruppe-a-regel har parameter i gruppe ${dp.group}`);
    if (dp.evidence !== "E1X" && dp.evidence !== "E1") err(`regel ${r.id}: datedParameter ${dp.id} mangler evidens`);
    let prev = -1;
    for (const b of dp.bands ?? []) { if (b.fromGramKm <= prev && prev !== -1) err(`regel ${r.id}: bånd ikke stigende i ${dp.id}`); prev = b.fromGramKm; if (!(b.rate > 0)) err(`regel ${r.id}: bånd uten sats i ${dp.id}`); }
    if (r.validity?.from && dp.from < r.validity.from && r.validity.from !== dp.from) err(`regel ${r.id}: validity.from ${r.validity.from} etter datedParameter`);
    if (r.usableAsRuleParameter) err(`regel ${r.id}: datert parameter kan ikke godkjennes uten E1 og klasse 1`);
  }
  // godkjent parameter krever eksplisitte vilkår
  if (r.usableAsRuleParameter || r.parameterApproval?.approved) {
    const a = r.parameterApproval ?? {};
    if (r.evidenceLevel !== "E1") err(`regel ${r.id}: godkjent parameter krever E1 (ikke ${r.evidenceLevel})`);
    if (!a.approvedBy || !a.approvedDate) err(`regel ${r.id}: godkjent parameter krever approvedBy og approvedDate`);
    if (!r.validity?.from || !r.governingEvent) err(`regel ${r.id}: godkjent parameter krever validity.from og governingEvent`);
    if (!r.sources.every((x) => srcById.get(x.id)?.evidenceLevel === "E1")) err(`regel ${r.id}: godkjent parameter krever bare E1-kilder`);
    const ref = refs.cases.some((c) => c.ruleIds.includes(r.id) && (c.evidenceClass === 1 || (c.evidenceClass === 2 && c.approvedHandCalculation === true)));
    if (!ref) err(`regel ${r.id}: godkjent parameter krever klasse 1-tilfelle (eller godkjent klasse 2)`);
  }
  for (const s of r.sources) if (!srcIds.has(s.id)) err(`regel ${r.id}: ukjent kilde ${s.id}`);
  for (const p of r.profiles) if (!profIds.has(p)) err(`regel ${r.id}: ukjent profil ${p}`);
  if (!/IKKE KONTROLLERT/.test(r.amountUnitAndRounding) && !["E1", "E1P", "E1X"].includes(r.evidenceLevel)) err(`regel ${r.id}: beløp uten E1/E1P/E1X`);
}
for (const p of profiles.profiles) for (const r of p.rules) if (!ruleIds.has(r)) err(`profil ${p.id}: ukjent regel ${r}`);

// ---- bruksfradragstabell (intern konsistens)
{
  const st = table.steps; let pm = 0, pp = 0;
  for (const x of st) { if (x.ageMonths <= pm || x.percent < pp || x.percent > 100) err(`tabell: ikke stigende ved ${x.label}`); pm = x.ageMonths; pp = x.percent; }
  if (st.at(-1).ageMonths !== 240 || st.at(-1).percent !== 100) err("tabell: siste trinn må være 20 år = 100 %");
  if (st.length !== 41) err(`tabell: forventet 41 trinn, fant ${st.length}`);
}
// uavhengig håndregning av bruksfradrag-prosent (kun kontroll, ikke produksjonskode)
const pad = (n) => String(n).padStart(2, "0");
function addMonths(iso, m) { const [y, mo, d] = iso.split("-").map(Number); const t = (y * 12 + (mo - 1)) + m; return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}-${pad(Math.min(d, 28))}`; }
function deductionPercent(first, reg) {
  if (reg >= `${Number(first.slice(0, 4)) + 20}-01-01`) return 100;           // rundskriv 6.21
  let best = 0;
  for (const s of table.steps) if (s.ageMonths < 240 && addMonths(first, s.ageMonths) <= reg) best = s.percent; // 4.2 dato til dato
  return best;
}
// ---- penger i øre (BigInt) for komponentkontroll
const toMinor = (s) => { const m = /^(-?)(\d+)\.(\d{2})$/.exec(s); if (!m) throw new Error(`ugyldig beløp ${s}`); return BigInt(m[1] + m[2] + m[3]); };
const fmt = (n) => { const neg = n < 0n; const a = (neg ? -n : n).toString().padStart(3, "0"); return `${neg ? "-" : ""}${a.slice(0, -2)}.${a.slice(-2)}`; };
function mulPct(minor, pct) { const num = minor * BigInt(pct); return (num + 50n) / 100n; } // ROUND_HALF_UP, positive tall
function summarize(components) {
  let budget = 0n, eco = 0n, cash = 0n, conf = 0n, scen = 0n, ecoOk = true, scenOk = true;
  for (const c of components) {
    const amt = toMinor(c.amountNok), vat = c.vatIncludedNok === null ? null : toMinor(c.vatIncludedNok);
    if (vat !== null && vat > amt) throw new Error(`${c.id}: mva > beløp`);
    if (c.includedInBudget) budget += amt;
    if (c.paymentTiming !== "none") cash += amt;
    let ded = 0n;
    if (vat === null) { if (c.includedInEconomicCost) ecoOk = false; scenOk = false; }
    else if (vat > 0n) { if (c.deductibleSharePercent === null) { if (c.includedInEconomicCost) ecoOk = false; scenOk = false; } else ded = mulPct(vat, Number(c.deductibleSharePercent)); }
    if (c.includedInEconomicCost && ecoOk) eco += amt - ded;
    scen += ded;
    if (c.refund) { if (c.refund.status === "agreed") conf += toMinor(c.refund.amountNok); else if (c.refund.status === "conditional") scen += toMinor(c.refund.amountNok); else throw new Error(`${c.id}: ukjent refusjonsstatus`); }
  }
  return { budgetTotalNok: fmt(budget), economicCostNok: ecoOk ? fmt(eco) : "not_calculated", cashRequiredNok: fmt(cash), confirmedRecoveryNok: fmt(conf), scenarioRecoveryNok: scenOk ? fmt(scen) : "not_calculated", netCashAfterConfirmedRecoveryNok: fmt(cash - conf) };
}
// ---- tilfeller
const counts = { 1: 0, 2: 0, 3: 0, 4: 0 }; let arithChecked = 0, ageChecked = 0;
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
    const ok = c.sources.length && c.sources.every((s) => srcById.get(s)?.evidenceLevel === "E1");
    if (!ok) err(`tilfelle ${c.id}: klasse ${c.evidenceClass} krever E1-kilder`);
  }
  if (c.evidenceClass === 2) {
    if (!c.handCalculation?.length) err(`tilfelle ${c.id}: klasse 2 krever handCalculation`);
    if (c.approvedHandCalculation) err(`tilfelle ${c.id}: klasse 2 kan ikke selv være godkjent referanse`);
  }
  if (c.evidenceClass === 1 && !(c.independentReference?.tool && c.independentReference?.runDate && c.independentReference?.output)) err(`tilfelle ${c.id}: klasse 1 krever independentReference (tool, runDate, output)`);
  if (c.id.startsWith("C2-AGE-")) {
    const got = String(deductionPercent(c.inputs.firstRegistrationAbroad, c.inputs.norwegianRegistration));
    if (got !== c.expected.value) err(`tilfelle ${c.id}: forventet ${c.expected.value} men uavhengig utregning gir ${got}`);
    ageChecked++;
  }
  if (c.id.startsWith("C2-SCRAP-") && c.expected.kind === "value" && !/2 400/.test(ruleById.get("R-IMP-OTH-001").amountUnitAndRounding)) err(`tilfelle ${c.id}: stemmer ikke med regelens beløp`);
  if (c.ruleIds.includes("R-SCR-PAY-001") && !(c.expected.kind === "status" && /ekskludert/.test(c.expected.value))) err(`tilfelle ${c.id}: vrakpantutbetaling skal være ekskludert, ikke et beløp`);
  if (c.inputs?.calc) {
    const k = c.inputs.calc; let got;
    if (k.kind === "importVat") {
      const cv = toMinor(k.vehiclePriceNok) + toMinor(k.freightToBorderNok) + toMinor(k.insuranceToBorderNok); // senere norske avgifter inngår IKKE
      const vat = (cv * BigInt(k.rateBp) + 5000n) / 10000n;
      got = `customsValue=${fmt(cv)} ; importVat=${fmt(vat)}`;
    } else if (k.kind === "evVat") {
      const price = toMinor(k.priceNok), thr = toMinor(k.thresholdNok);
      const base = price > thr ? price - thr : 0n;
      got = `vatBase=${fmt(base)} ; vat=${fmt((base * BigInt(k.rateBp) + 5000n) / 10000n)}`;
    } else { err(`tilfelle ${c.id}: ukjent calc ${k.kind}`); continue; }
    if (got !== c.expected.value) err(`tilfelle ${c.id}: forventet «${c.expected.value}», regnet «${got}»`);
    arithChecked++;
  }
  if (c.inputs?.components) {
    let got; try { got = summarize(c.inputs.components); } catch (e) { err(`tilfelle ${c.id}: ${e.message}`); continue; }
    for (const [k, v] of Object.entries(c.expected.value)) if (got[k] !== v) err(`tilfelle ${c.id}: ${k} forventet ${v}, regnet ${got[k]}`);
    arithChecked++;
  }
}
if (refs.cases.length < 50) err(`færre enn 50 tilfeller (${refs.cases.length})`);
const profileCover = new Set(refs.cases.filter((c) => c.profileId).map((c) => c.profileId));
for (const p of profIds) if (!profileCover.has(p)) err(`profil ${p} har ingen tilfeller`);
for (const s of demo.scenarios) if (s.purchaseBasisEur === null && s.customsValueEur !== null) err(`demo ${s.scenario}: inkonsistent`);
// demoaritmetikk: tollverdi = grunnlag + frakt + forsikring; NOK = EUR × kurs (ROUND_HALF_UP, øre)
{
  const eur = (s) => toMinor(s), fx = 1150n;
  for (const s of demo.scenarios) if (s.purchaseBasisEur !== null) {
    const cv = eur(s.purchaseBasisEur) + 120000n + 15000n;
    if (fmt(cv) !== s.customsValueEur) err(`demo ${s.scenario}: tollverdi ${s.customsValueEur} ≠ ${fmt(cv)}`);
    const nok = (cv * fx + 50n) / 100n; if (fmt(nok) !== s.customsValueNokDemo) err(`demo ${s.scenario}: NOK ${s.customsValueNokDemo} ≠ ${fmt(nok)}`);
    const vat = (nok * 25n + 50n) / 100n; if (fmt(vat) !== s.importVatDemoParam25) err(`demo ${s.scenario}: mva-demo ${s.importVatDemoParam25} ≠ ${fmt(vat)}`);
  }
  const net = (10000000n * 100n + 119n / 2n) / 119n; if (fmt(net) !== "84033.61") err(`aritmetikk 100000/1,19 ≠ 84033.61 (${fmt(net)})`);
}
// ---- markdown
const md = readFileSync(join(dir, "TAX-001A-rules.md"), "utf8");
const mdIds = new Set([...md.matchAll(/^### (R-[A-Z0-9-]+) —/gm)].map((m) => m[1]));
for (const id of ruleIds) if (!mdIds.has(id)) err(`rules.md mangler ${id}`);
for (const id of mdIds) if (!ruleIds.has(id)) err(`rules.md har ukjent ${id}`);
for (const f of ["profiles.md", "purchase-basis.md", "demo-series.md", "TAX-001A-rules.md", "event-dates.md"]) {
  if (!existsSync(join(dir, f))) { err(`mangler ${f}`); continue; }
  const t = readFileSync(join(dir, f), "utf8");
  for (const m of t.matchAll(/\bR-[A-Z]{3}-[A-Z0-9-]+\b/g)) if (!ruleIds.has(m[0])) err(`${f}: ukjent regel-id ${m[0]}`);
  for (const m of t.matchAll(/\bC[1-4]-[A-Z0-9-]+\b/g)) if (!caseIds.has(m[0]) && !/-$/.test(m[0]) && !/^C[1-4]-(AGE|SCRAP|[A-Z]+)-?$/.test(m[0])) err(`${f}: ukjent tilfelle-id ${m[0]}`);
}
// ---- forbudte formuleringer (F1/F2): feil begrep/formel skal ikke gjenta seg
const BAD = [
  [/2\s?400[^\n.]{0,60}\b(mot|vs\.?|versus)\b[^\n.]{0,30}3\s?000/i, "vrakpantavgift/utbetaling framstilt som satskonflikt"],
  [/økonomisk anskaffelseskost\s*(=|er)\s*budsjettsum\s*[−-]/i, "økonomisk kost definert som budsjettsum minus fradrag"],
  [/\+\s*ikke-fradragsberettiget del/i, "ikke-fradragsberettiget del lagt til en gang til"],
];
for (const f of ["profiles.md", "purchase-basis.md", "demo-series.md", "TAX-001A-rules.md", "event-dates.md", "rules.json", "sources.json", "references.json", "demo-series.json", "profiles.json"]) {
  const t = readFileSync(join(dir, f), "utf8");
  for (const [re, why] of BAD) if (re.test(t)) err(`${f}: ${why}`);
}
// ---- valgfri kontroll mot kildepakke
if (packDir) {
  for (const s of sources.sources) if (s.evidenceLevel === "E1") {
    const p = join(packDir, s.packageFile);
    if (!existsSync(p)) { err(`pack: mangler ${s.packageFile}`); continue; }
    const h = createHash("sha256").update(readFileSync(p)).digest("hex");
    if (h !== s.packageSha256) err(`pack: hash for ${s.packageFile} stemmer ikke (${h})`);
  }
  const p = join(packDir, table.sourceFile);
  if (existsSync(p)) {
    const text = readFileSync(p, "utf8").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, "\n").replace(/&nbsp;| /g, " ");
    const lines = text.split("\n").map((l) => l.trim().replace(/\|$/, "").trim()).filter(Boolean);
    const i = lines.indexOf("Age over..."); const out = [];
    for (let k = i + 2; k + 1 < lines.length; k += 2) {
      const m = /^(\d+) ?%$/.exec(lines[k + 1]); if (!m) break;
      const y = /(\d+) year/.exec(lines[k]), mo = /(\d+) month/.exec(lines[k]);
      out.push({ ageMonths: (y ? Number(y[1]) * 12 : 0) + (mo ? Number(mo[1]) : 0), percent: Number(m[1]) });
    }
    if (JSON.stringify(out) !== JSON.stringify(table.steps.map((s) => ({ ageMonths: s.ageMonths, percent: s.percent })))) err("pack: bruksfradragstabell i JSON avviker fra T07-HTML");
    else console.log("pack: bruksfradragstabell (41 trinn) stemmer med T07-HTML");
  }
}
// Grunnlagsstatus: DONE krever godkjente parametere og klasse 1-dekning per profil i omfang (TAX-001C).
{
  for (const u of rules.unresolvedSourceClaims ?? []) {
    if (!["open", "closed"].includes(u.state)) err(`unresolvedSourceClaims ${u.id}: ugyldig state ${u.state}`);
  }
  const fs = rules.foundationStatus;
  if (!fs || !["REVIEW", "DONE"].includes(fs.status)) err("foundationStatus mangler eller er ugyldig");
  else {
    const approved = rules.rules.filter((r) => r.usableAsRuleParameter).length;
    const c1 = refs.cases.filter((c) => c.evidenceClass === 1);
    if (fs.approvedParameters !== approved) err(`foundationStatus.approvedParameters ${fs.approvedParameters} ≠ faktisk ${approved}`);
    if (fs.class1References !== c1.length) err(`foundationStatus.class1References ${fs.class1References} ≠ faktisk ${c1.length}`);
    if (fs.status === "DONE") {
      if (approved === 0) err("foundationStatus DONE uten godkjente parametere");
      for (const p of profIds) if (!c1.some((c) => c.profileId === p)) err(`foundationStatus DONE men profil ${p} mangler klasse 1-tilfelle`);
    }
  }
}
const lv = {}; for (const r of rules.rules) lv[r.evidenceLevel] = (lv[r.evidenceLevel] ?? 0) + 1;
console.log(`regler ${ruleIds.size} (${Object.entries(lv).map(([k, v]) => `${k}:${v}`).join(" ")}), kilder ${srcIds.size}, profiler ${profIds.size}, tilfeller ${caseIds.size} (klasse1 ${counts[1]}, klasse2 ${counts[2]}, klasse3 ${counts[3]}, klasse4 ${counts[4]})`);
console.log(`regnet på nytt: ${arithChecked} komponent-tilfeller, ${ageChecked} bruksfradrag-tilfeller, ${demo.scenarios.filter((s) => s.purchaseBasisEur !== null).length} demoscenarier`);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("OK: format, kilde-/regel-id-er, evidensregler, begrepsvern og aritmetikk stemmer.");
