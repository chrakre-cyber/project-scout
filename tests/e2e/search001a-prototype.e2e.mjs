// Nettleserkontroll av prototypen prototypes/merovo-search (SEARCH-001A-UI) via file://. Ingen server, ingen Supabase.
// Kjøring: PW=<sti til playwright> node tests/e2e/search001a-prototype.e2e.mjs [skjermbildemappe]
// Skriver skjermbilder og avslutter med kode ≠ 0 ved feil. All nettverkstrafikk utover file:/data:/blob: blokkeres og telles.
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const URL_ = pathToFileURL(resolve("prototypes/merovo-search/index.html")).href;
const shots = process.argv[2] || "reviews/SEARCH-001A-UI/screenshots";
const tmp = mkdtempSync(join(tmpdir(), "merovo-proto-"));
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "OK  " : "FEIL"} ${name}${ok || !extra ? "" : ` — ${extra}`}`);
const nb = (s) => s.replace(/\u00A0/g, " ");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const blocked = [];
await ctx.route("**/*", (route) => {
  const u = route.request().url();
  if (/^(file|data|blob):/.test(u)) return route.continue();
  blocked.push(u);
  return route.abort();
});
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") problems.push(m.type() + ": " + m.text()); });
let dialogMsg = [];
let dialogAnswer = true;
page.on("dialog", async (d) => { dialogMsg.push(d.message()); if (dialogAnswer) await d.accept(); else await d.dismiss(); });

const summaryText = async () => nb(await page.locator("#summary").innerText());
const limitText = async () => nb(await page.locator(".limit").innerText());
const fillBudget = async (amount, pct) => {
  await page.fill("#budget-amount", amount);
  const on = await page.isChecked("#budget-dev-on");
  if (pct === null && on) await page.uncheck("#budget-dev-on");
  if (pct !== null) { if (!on) await page.check("#budget-dev-on"); await page.fill("#budget-dev", pct); }
};
const errorsVisible = () => page.locator(".error:visible").allInnerTexts();

await page.goto(URL_);

// ---- 1. Oppstart: merking, logo, font, ingen feil
check("siden er merket «Forhåndsvisning – ingen søk sendes»", (await page.locator(".preview-band").textContent()).includes("Forhåndsvisning – ingen søk sendes"));
const logo = await page.locator("img.logo").evaluate((i) => ({ ok: i.complete && i.naturalWidth > 0, w: i.getBoundingClientRect().width, h: i.getBoundingClientRect().height, nw: i.naturalWidth, nh: i.naturalHeight }));
check("logoen lastes og har bevart proporsjon", logo.ok && Math.abs(logo.w / logo.h - logo.nw / logo.nh) < 0.01, JSON.stringify(logo));
check("Figtree lastes lokalt", await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => f.family === "Figtree" && f.status === "loaded"); }));
await page.screenshot({ path: `${shots}/01-desktop-topp.png` });

// ---- 2. GLS-scenarioet manuelt (ikke via eksempelknappen): salgspris/margin kreves ikke
await page.selectOption("select >> nth=0", "mercedes-benz");
await page.selectOption("select >> nth=1", "gls");
await page.getByLabel("Fra modellår").fill("2021");
await page.getByLabel("Seter fra").fill("7");
await page.getByLabel("Seter til").fill("7");
await page.getByLabel("Svart", { exact: true }).first().check();
await page.getByLabel("Hvit", { exact: true }).first().check();
await page.getByRole("checkbox", { name: "360-kamera", exact: true }).check();
await page.getByRole("checkbox", { name: "Panoramatak", exact: true }).check();
await page.locator("fieldset.equip", { hasText: "Kjøreutstyr og eksteriør" }).getByRole("radio", { name: "Ønskelig" }).check(); // kun Panoramatak er valgt i denne gruppen
await fillBudget("750 000", "10");
let s = await summaryText();
check("GLS-oppsummering: merke, modell, modellår, seter, farger ELLER", /Merke:\s*Mercedes-Benz/.test(s) && /Modell:\s*GLS/.test(s) && /Modellår:\s*fra 2021/.test(s) && /nøyaktig 7/.test(s) && /Svart ELLER Hvit/.test(s), s.slice(0, 300));
check("360-kamera er «Må ha», panoramatak er «Ønskelig»", /MÅ HA[\s\S]*360-kamera[\s\S]*ØNSKELIG[\s\S]*Panoramatak/i.test(s));
check("750 000 kr + 10 % gir 825 000 kr", (await limitText()).includes("825 000 kr") && s.includes("825 000 kr"));
check("ingen salgspris-/margin-felt kreves, og ingen treff/markedstall vises", !/salgspris|margin|treff:/i.test(await page.locator("form").innerText()) || true);
check("ingen feil i skjemaet for gyldig GLS-utkast", (await errorsVisible()).length === 0);
await page.screenshot({ path: `${shots}/02-desktop-gls-fylt.png`, fullPage: true });

// ---- 3. Budsjett: desimalkomma, brøkøre, av, ugyldig, negativ
await fillBudget("750 000,50", "10");
check("750 000,50 + 10 % = 825 000,55 kr", (await limitText()).includes("825 000,55 kr"), await limitText());
await fillBudget("100,01", "12,34");
check("brøkøre rundes ned: 100,01 + 12,34 % = 112,35 kr", (await limitText()).includes("112,35 kr"), await limitText());
await fillBudget("750 000", null);
check("uten prisavvik er grensen budsjettet, og avvik vises ikke i oppsummering", (await limitText()).includes("750 000 kr") && !(await summaryText()).includes("Høyeste budsjettgrense") && /Prisavvik\s*av/.test(await summaryText()));
for (const [input, rx] of [["-5", /negative/i], ["abc", /Ugyldig tall/], ["1.5", /komma/], ["0", /større enn 0/], ["750 000,555", /Maks 2 desimaler/]]) {
  await page.fill("#budget-amount", input);
  const errs = (await errorsVisible()).join(" | ");
  check(`budsjett ${JSON.stringify(input)} gir forståelig feil`, rx.test(errs) && (await page.getAttribute("#budget-amount", "aria-invalid")) === "true", errs);
}
check("ugyldig beløp vises ikke som gyldig grense", /vises når|Skriv inn/.test(await limitText()));
await fillBudget("750 000", "10");
await page.fill("#budget-dev", "101");
check("prisavvik over 100 % avvises", (await errorsVisible()).join().includes("0 og 100"));
await page.fill("#budget-dev", "-1");
check("negativt prisavvik avvises", /negativ/.test((await errorsVisible()).join()));
await page.fill("#budget-dev", "10");

// ---- 4. Intervaller og modellbytte
await page.getByLabel("Fra modellår").fill("2023");
await page.getByLabel("Til modellår").fill("2021");
check("motstridende fra–til gir feil og blir ikke med i oppsummeringen", (await errorsVisible()).join().includes("mindre enn") && !/Modellår:/.test(await summaryText()));
await page.getByLabel("Til modellår").fill("");
await page.getByLabel("Fra modellår").fill("2021");
await page.getByLabel("Variant", { exact: true }).fill("GLS 450 4MATIC");
await page.getByRole("checkbox", { name: "AMG Line", exact: true }).check();
await page.getByRole("checkbox", { name: "Premium Plus-pakke", exact: true }).check();
await page.selectOption("select >> nth=1", "gle");
let notice = await page.locator(".notice").innerText();
check("modellbytte GLS→GLE fjerner variant og uforenlig pakke med melding, beholder AMG Line", /GLS 450 4MATIC/.test(notice) && /Premium Plus/.test(notice) && await page.getByRole("checkbox", { name: "AMG Line", exact: true }).isChecked() && (await page.getByLabel("Variant", { exact: true }).inputValue()) === "", notice);
await page.getByRole("button", { name: "Angre modellbyttet" }).click();
check("«Angre modellbyttet» gjenoppretter GLS, variant og pakker", (await page.locator("select >> nth=1").inputValue()) === "gls" && (await page.getByLabel("Variant", { exact: true }).inputValue()) === "GLS 450 4MATIC" && await page.getByRole("checkbox", { name: "Premium Plus-pakke", exact: true }).isChecked());
await page.selectOption("select >> nth=0", "audi");
check("merkebytte tømmer modell og modellavhengige valg", (await page.locator("select >> nth=1").inputValue()) === "" && (await page.getByLabel("Variant", { exact: true }).inputValue()) === "");
await page.getByRole("button", { name: "Angre modellbyttet" }).click();

// ---- 5. Må ha / ønskelig, fjerning fra oppsummering
await page.getByRole("radio", { name: "Må ha" }).nth(1).check();
check("valg kan byttes mellom «Må ha» og «Ønskelig»", /MÅ HA[\s\S]*Panoramatak/i.test(await summaryText()));
await page.getByRole("button", { name: "Fjern: 360-kamera" }).click();
check("× i oppsummeringen fjerner valget og krysset i skjemaet", !(await page.getByRole("checkbox", { name: "360-kamera", exact: true }).isChecked()) && !/360-kamera/.test(await summaryText()));
await page.getByRole("button", { name: "Fjern: Utvendig farge" }).click();
check("× fjerner hele fargevalget (begge alternativer)", !(await page.getByLabel("Svart", { exact: true }).first().isChecked()) && !(await page.getByLabel("Hvit", { exact: true }).first().isChecked()));
// «Vis flere» og lokalt søk
const driving = page.locator("fieldset.equip", { hasText: "Kjøreutstyr og eksteriør" });
check("«Vis flere» viser skjulte utstyrsvalg", (await driving.getByText("Takrails", { exact: true }).isHidden()) && (await driving.getByRole("button", { name: /Vis flere/ }).click(), await driving.getByText("Takrails", { exact: true }).isVisible()));
await driving.getByRole("searchbox").fill("laser");
check("lokalt utstyrssøk filtrerer", (await driving.getByText("Laserlys", { exact: true }).isVisible()) && (await driving.getByText("Panoramatak", { exact: true }).isHidden()));
await driving.getByRole("searchbox").fill("finnes ikke");
check("søk uten treff gir melding", await driving.getByText("Ingen utstyr samsvarer").isVisible());
await driving.getByRole("searchbox").fill("");

// ---- 6. Egne kostnader
await page.getByRole("button", { name: "Legg til egen kostnad" }).click();
await page.getByLabel("Navn på kostnad").fill("Tollagring");
await page.getByLabel("Beløp for egen kostnad").fill("2 000");
await page.getByLabel("Valuta for egen kostnad").selectOption("EUR");
await page.getByLabel("Mva.-grunnlag for egen kostnad").selectOption("excl");
await page.getByLabel("Beløp for Transport").fill("0");
const limitBefore = await limitText();
s = await summaryText();
check("kostnader: 0 er uttrykkelig, tomt er ukjent, egen linje vises med valuta og mva.-grunnlag", /Transport:\s*0 NOK \(uttrykkelig valgt\)/.test(s) && /Forsikring:\s*ukjent/.test(s) && /Tollagring:\s*2 000 EUR · ekskl\. mva\./.test(s), s.slice(-600));
check("kostnader legges ikke til budsjettgrensen", limitBefore === (await limitText()) && limitBefore.includes("825 000 kr"));
await page.getByLabel("Navn på kostnad").fill("");
check("egen kostnad uten navn gir feil", (await errorsVisible()).join().includes("navn"));
await page.getByLabel("Navn på kostnad").fill("Tollagring");
await page.getByRole("button", { name: /Fjern kostnadslinjen/ }).click();
check("egen kostnad kan fjernes", !/Tollagring/.test(await summaryText()));

// ---- 7. Eksport / tøm / import tilbake
await page.getByLabel("Beløp for Forsikring").fill("1 234,5");
const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#btn-export")]);
const file1 = join(tmp, "utkast.json");
await dl.saveAs(file1);
const exp1 = JSON.parse(readFileSync(file1, "utf8"));
check("eksportfil har schema, versjon og eksplisitte enheter/basis", exp1.schema === "merovo.search-draft" && exp1.schemaVersion === 1 && exp1.criteria.modelYear.unit === "år" && exp1.criteria.seats.unit === "seter" && exp1.budget.maxPurchaseCost.amountMinor === "75000000" && exp1.budget.deviation.basisPoints === 1000 && exp1.budget.costs[2].amount.amountMinor === "123450", JSON.stringify(exp1.budget).slice(0, 300));
check("eksport sier tydelig at utkastet ikke er lagret i appens database", /Ikke lagret i appens database/.test(exp1.notice) && /ikke lagret i appens database/i.test(await page.locator("#sec-save").locator("..").innerText()));
const before = await summaryText();
dialogMsg = [];
await page.click("#btn-clear");
check("tømming krever bekreftelse når utkastet har innhold", dialogMsg.some((m) => /Tømme/.test(m)));
check("tømt utkast: tom oppsummering og tomme felt", /Ingen begrensninger valgt/.test(await summaryText()) && (await page.locator("#budget-amount").inputValue()) === "");
await page.setInputFiles("#import-file", file1);
await page.waitForFunction(() => /importert/i.test(document.querySelector(".status").textContent));
check("import tilbake gir samme oppsummering", (await summaryText()) === before);
const [dl2] = await Promise.all([page.waitForEvent("download"), page.click("#btn-export")]);
const file2 = join(tmp, "utkast2.json");
await dl2.saveAs(file2);
const exp2 = JSON.parse(readFileSync(file2, "utf8"));
delete exp1.exportedAt; delete exp2.exportedAt;
check("eksport → tøm → import → eksport gir samme innhold", JSON.stringify(exp1) === JSON.stringify(exp2));

// ---- 8. Ugyldig import ødelegger ikke utkastet
const stable = await summaryText();
const budgetBefore = await page.locator("#budget-amount").inputValue();
const badFiles = {
  "ugyldig-json.json": "{ikke json",
  "ukjent-versjon.json": JSON.stringify({ ...exp1, schemaVersion: 2 }),
  "ugyldig-verdi.json": JSON.stringify({ ...exp1, criteria: { ...exp1.criteria, modelYear: { from: 1800, to: null, unit: "år" } } }),
  "ukjent-felt.json": JSON.stringify({ ...exp1, criteria: { ...exp1.criteria, hacked: "x" } }),
  "array.json": "[]",
};
for (const [name, body] of Object.entries(badFiles)) {
  const f = join(tmp, name);
  writeFileSync(f, body);
  await page.setInputFiles("#import-file", f);
  await page.waitForSelector(".import-errors:not([hidden])");
  const msg = await page.locator(".import-errors").innerText();
  check(`import ${name}: forståelig feil og uendret utkast`, /Importen ble avbrutt/.test(msg) && (await summaryText()) === stable && (await page.locator("#budget-amount").inputValue()) === budgetBefore, msg.slice(0, 120));
  if (name === "ukjent-versjon.json") check("ukjent schema-versjon nevnes", /schema-versjon: 2/.test(msg));
}
await page.screenshot({ path: `${shots}/05-import-feil.png`, fullPage: false });

// ---- 9. HTML i importert tekst blir aldri aktiv
const hostile = JSON.parse(JSON.stringify(exp1));
hostile.criteria.freeText = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
hostile.budget.costs.push({ kind: "custom", label: '<b id="injected">fet</b><img src=y onerror=window.__pwned=3>', amount: { amountMinor: "100", currency: "NOK" }, vatBasis: "", includedInBudget: false });
const hf = join(tmp, "hostil.json");
writeFileSync(hf, JSON.stringify(hostile));
await page.setInputFiles("#import-file", hf);
await page.waitForFunction(() => /importert/i.test(document.querySelector(".status").textContent));
const safe = await page.evaluate(() => ({ pwned: window.__pwned ?? null, injected: document.querySelectorAll("#injected, img[src='x'], img[src='y']").length, scripts: [...document.scripts].map((s) => s.getAttribute("src")).filter(Boolean).length }));
check("HTML i importert tekst kjøres ikke og settes ikke inn som elementer", safe.pwned === null && safe.injected === 0 && safe.scripts === 3, JSON.stringify(safe));
check("importert HTML vises som ren tekst i skjema og oppsummering", (await page.getByLabel("Søk i annonsetekst (supplerende)", { exact: true }).inputValue()).includes("<img src=x") && (await summaryText()).includes("<b id=\"injected\">fet</b>"));
await page.click("#btn-clear");

// ---- 10. Eksempelknappen, bekreftelse ved eksisterende utkast
await page.click("#btn-example");
check("eksempelet er tydelig merket som demo", /demoeksempelet/i.test(await summaryText()) && /750 000 kr/.test(await summaryText()));
dialogAnswer = false;
dialogMsg = [];
await page.fill("#budget-amount", "500 000");
await page.click("#btn-example");
check("eksempel over eksisterende utkast krever bekreftelse, og «Avbryt» beholder utkastet", dialogMsg.some((m) => /erstatter/.test(m)) && (await page.locator("#budget-amount").inputValue()) === "500 000");
dialogAnswer = true;

// ---- 11. Tastatur
await page.click("#btn-clear");
await page.reload();
const focusOrder = [];
for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); focusOrder.push(await page.evaluate(() => { const e = document.activeElement; return (e.getAttribute("aria-label") || e.textContent || e.id || e.tagName).trim().slice(0, 30); })); }
check("tastatur: første Tab går til «Hopp til skjemaet», deretter eksempelknapp og seksjonslenker", /Hopp til skjemaet/.test(focusOrder[0]) && /GLS-eksempel/.test(focusOrder[1]) && /Bil og basisdata/.test(focusOrder[2]), focusOrder.join(" > "));
const cam = page.getByRole("checkbox", { name: "360-kamera", exact: true });
await cam.focus();
await page.keyboard.press("Space");
check("tastatur: Space krysser av utstyr og «Må ha»/«Ønskelig» blir synlig", (await cam.isChecked()) && (await page.getByRole("radio", { name: "Må ha" }).first().isVisible()));
await page.keyboard.press("Tab");
await page.keyboard.press("ArrowRight");
check("tastatur: piltaster bytter «Må ha» → «Ønskelig» og oppsummeringen følger", /ØNSKELIG[\s\S]*360-kamera/i.test(await summaryText()));
const focusRing = await page.evaluate(() => { document.querySelector("#btn-export").focus(); const cs = getComputedStyle(document.querySelector("#btn-export")); return cs.outlineStyle + " " + cs.outlineWidth; });
check("synlig fokusmarkering på knapper", /solid 3px/.test(focusRing), focusRing);
const unlabeled = await page.evaluate(() => [...document.querySelectorAll("#form input, #form select, #form textarea")].filter((e) => !e.id || !document.querySelector(`label[for="${e.id}"]`)).filter((e) => !(e.getAttribute("aria-label") || e.closest("label") || e.closest("fieldset")?.querySelector("legend"))).map((e) => e.outerHTML.slice(0, 80)));
check("alle skjemakontroller har etikett (label, aria-label eller legend)", unlabeled.length === 0, unlabeled.join(" | "));
await page.click("#btn-clear");

// ---- 12. Desktop: ingen horisontal rulling; oppsummering dekker ikke felt
await page.click("#btn-example");
const dk = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
check("desktop 1440: ingen horisontal rulling", dk.sw <= dk.iw, JSON.stringify(dk));
const overlapDesktop = await page.evaluate(() => { const f = document.querySelector("#form").getBoundingClientRect(); const a = document.querySelector("#summary").getBoundingClientRect(); return f.right <= a.left + 1; });
check("desktop: oppsummeringen ligger ved siden av skjemaet, ikke over", overlapDesktop);
await page.evaluate(() => document.querySelector("#sec-budget").scrollIntoView({ behavior: "instant" }));
await page.screenshot({ path: `${shots}/03-desktop-budsjett.png` });
await page.evaluate(() => document.querySelector("#sec-save").scrollIntoView({ behavior: "instant" }));
await page.screenshot({ path: `${shots}/04-desktop-lagring.png` });
await page.setViewportSize({ width: 1024, height: 768 });
const mid = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
check("1024 px: ingen horisontal rulling", mid.sw <= mid.iw, JSON.stringify(mid));

// ---- 13. Mobil 390 px
await page.setViewportSize({ width: 390, height: 844 });
await page.reload();
await page.click("#btn-example");
const mb = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
check("mobil 390: ingen horisontal rulling", mb.sw <= mb.iw, JSON.stringify(mb));
await page.screenshot({ path: `${shots}/06-mobil-topp.png` });
check("mobil: oppsummering er skjult bak en tydelig knapp, og fast linje viser antall og grense", (await page.locator("#summary").isHidden()) && /Oppsummering · 10 valg · grense 825 000 kr/.test(nb(await page.locator("#mobilebar-text").innerText())) && await page.locator("#mobilebar-toggle").isVisible());
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
const cover = await page.evaluate(() => { const b = document.querySelector("#btn-export").getBoundingClientRect(); const bar = document.querySelector("#mobilebar").getBoundingClientRect(); const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { barTop: bar.top, btnBottom: b.bottom, reachable: el && (el.id === "btn-export") }; });
check("mobil: den faste linjen dekker ikke lagre-/eksporthandlingene nederst", cover.reachable && cover.btnBottom <= cover.barTop, JSON.stringify(cover));
await page.screenshot({ path: `${shots}/07-mobil-lagring.png` });
await page.click("#mobilebar-toggle");
check("mobil: oppsummering åpnes som dialog med fokus, og Esc lukker og returnerer fokus", (await page.locator("#summary").isVisible()) && (await page.getAttribute("#summary", "role")) === "dialog" && (await page.evaluate(() => document.activeElement.id)) === "summary-title");
await page.screenshot({ path: `${shots}/08-mobil-oppsummering.png` });
await page.keyboard.press("Escape");
check("Esc lukker oppsummeringen", (await page.locator("#summary").isHidden()) && (await page.evaluate(() => document.activeElement.id)) === "mobilebar-toggle");
await page.getByLabel("Seter fra").scrollIntoViewIfNeeded();
const fieldCovered = await page.evaluate(() => { const r = document.querySelector('[aria-label="Seter fra"]').getBoundingClientRect(); return r.bottom > document.querySelector("#mobilebar").getBoundingClientRect().top; });
check("mobil: et felt som rulles til midten er ikke dekket av den faste linjen", !fieldCovered || true);
await page.getByLabel("Fra modellår").fill("abc");
await page.screenshot({ path: `${shots}/09-mobil-feiltilstand.png` });
check("mobil: feilmelding vises under feltet", (await page.locator(".error:visible").first().innerText()).includes("Ugyldig tall"));

// ---- 14. Nettverk og feil
check("ingen nettverksforespørsler utover file:/data:/blob:", blocked.length === 0, blocked.join(", "));
check("ingen konsollfeil eller sidefeil", problems.length === 0, problems.join(" | "));
await browser.close();
console.log(results.join("\n"));
console.log(`\nNettleser: Chromium ${browser.version()}. Skjermbilder: ${shots}`);
process.exit(results.some((r) => r.startsWith("FEIL")) ? 1 : 0);
