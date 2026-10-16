/*
 * Ren logikk for forhåndsvisningen SEARCH-001A-UI: tallparsing (norske formater), budsjettgrense i øre/basispunkter (BigInt),
 * validering, oppsummering, eksport og import. Ingen DOM og ingen nettverk. Importert tekst behandles bare som data.
 * Dette er budsjettaritmetikk og skjemalogikk. Ingen bilpris, avgift, mva., valuta eller marginberegning finnes her.
 */
(function (root, factory) {
  // Klassisk script i nettleseren; CommonJS bare for Node-testene (tests/search-prototype.test.ts).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (typeof module === "object" && module.exports) module.exports = factory(require("./data.js"));
  else root.MerovoLogic = factory(root.MerovoData);
})(typeof self !== "undefined" ? self : this, function (Data) {
  "use strict";

  const NBSP = " ";
  const HP_W_NUM = 73549875; // 1 hk (metrisk) = 735,49875 W; heltallsbrøk 73549875/100000
  const HP_W_DEN = 100000;

  // ---------------------------------------------------------------- tallparsing
  const normalizeSpaces = (s) => String(s).replace(/[    ]/g, " ").trim();

  /**
   * Norsk tall: tusenskille som mellomrom (eller punktum i grupper på 3), komma som desimaltegn. «1.5» avvises
   * (tvetydig), for mange desimaler og negative tall avvises. Returnerer {empty} | {error} | {int, frac} (sifferstrenger).
   */
  function parseDecimal(input, maxDecimals) {
    const s = normalizeSpaces(input);
    if (s === "") return { empty: true };
    if (/^[-−]/.test(s)) return { error: "Negative tall er ikke tillatt." };
    if (/^\+/.test(s)) return { error: "Skriv tallet uten plusstegn." };
    let m = /^(\d{1,3}(?: \d{3})+|\d+)(?:,(\d+))?$/.exec(s);
    let intPart;
    let frac = "";
    if (m) {
      intPart = m[1].replace(/ /g, "");
      frac = m[2] || "";
    } else {
      m = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d+))?$/.exec(s);
      if (m) {
        intPart = m[1].replace(/\./g, "");
        frac = m[2] || "";
      } else if (/^\d+\.\d+$/.test(s)) {
        return { error: "Bruk komma som desimaltegn (for eksempel 1,5). Punktum brukes bare som tusenskille (1.000)." };
      } else {
        return { error: "Ugyldig tall. Bruk siffer, mellomrom som tusenskille og komma som desimaltegn." };
      }
    }
    if (frac.length > maxDecimals) {
      return { error: maxDecimals === 0 ? "Bruk et helt tall uten desimaler." : "Maks " + maxDecimals + " desimal" + (maxDecimals === 1 ? "" : "er") + "." };
    }
    return { int: intPart, frac };
  }

  /** Beløp i minste enhet (øre/cent) som BigInt. opts.allowZero: 0 er et uttrykkelig valg. */
  function parseMoney(input, opts) {
    const o = opts || {};
    const p = parseDecimal(input, 2);
    if (p.empty) return { empty: true };
    if (p.error) return { error: p.error };
    const minor = BigInt(p.int) * 100n + BigInt((p.frac + "00").slice(0, 2));
    if (minor === 0n && !o.allowZero) return { error: "Beløpet må være større enn 0." };
    if (minor > Data.LIMITS.maxBudgetMinor) return { error: "Beløpet er for høyt (maks 1 000 000 000)." };
    return { minor };
  }

  function parseIntBounded(input, min, max) {
    const p = parseDecimal(input, 0);
    if (p.empty) return { empty: true };
    if (p.error) return { error: p.error };
    if (p.int.length > 9) return { error: "Tallet er for stort." };
    const n = Number(p.int);
    if (n < min || n > max) return { error: "Verdien må være mellom " + fmtInt(min) + " og " + fmtInt(max) + "." };
    return { value: n };
  }

  /** Desimaltall med fast antall desimaler, returnert som streng («8.5»). */
  function parseFixedDecimal(input, maxDecimals, min, max) {
    const p = parseDecimal(input, maxDecimals);
    if (p.empty) return { empty: true };
    if (p.error) return { error: p.error };
    const scaled = Number(p.int + (p.frac + "0".repeat(maxDecimals)).slice(0, maxDecimals));
    const sMin = min * 10 ** maxDecimals;
    const sMax = max * 10 ** maxDecimals;
    if (scaled < sMin || scaled > sMax) return { error: "Verdien må være mellom " + fmtDec(min, 0) + " og " + fmtDec(max, 0) + "." };
    return { text: p.int + (p.frac ? "." + (p.frac + "0".repeat(maxDecimals)).slice(0, maxDecimals).replace(/0+$/, "") : "").replace(/\.$/, "") };
  }

  /** Prosent 0–100 med opptil to desimaler (komma eller punktum) → basispunkter (heltall). */
  function parsePercentBp(input) {
    const s = normalizeSpaces(input);
    if (s === "") return { empty: true };
    if (/^[-−]/.test(s)) return { error: "Prosenten kan ikke være negativ." };
    const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(s);
    if (!m) return { error: /^\d+[.,]\d{3,}$/.test(s) ? "Maks to desimaler." : "Ugyldig prosent. Skriv for eksempel 10 eller 7,5." };
    const bp = BigInt(m[1]) * 100n + BigInt(((m[2] || "") + "00").slice(0, 2));
    if (bp > 10000n) return { error: "Prosenten må være mellom 0 og 100." };
    return { bp };
  }

  /** Høyeste tillatte beløp i øre: budsjett × (10000 + bp) / 10000, desimaløre rundes NED (BigInt-heltallsdivisjon). */
  function maxAllowedMinor(budgetMinor, bp) {
    return (budgetMinor * (10000n + bp)) / 10000n;
  }

  // ---------------------------------------------------------------- formatering
  function group(digits) {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  }
  function fmtInt(n) {
    return group(String(n));
  }
  function fmtDec(n, d) {
    return d ? String(n).replace(".", ",") : fmtInt(n);
  }
  /** Beløp i minste enhet → «750 000 kr» eller «112,35 kr». */
  function fmtMinor(minor, unit) {
    const m = BigInt(minor);
    const whole = (m / 100n).toString();
    const cents = (m % 100n).toString().padStart(2, "0");
    return group(whole) + (cents === "00" ? "" : "," + cents) + NBSP + (unit || "kr");
  }
  /** Råtekst for et heltall i skjemafelt (vanlig mellomrom som tusenskille). */
  const rawInt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const rawMinor = (minor) => {
    const m = BigInt(minor);
    const w = (m / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const c = (m % 100n).toString().padStart(2, "0");
    return c === "00" ? w : w + "," + c;
  };
  const bpRaw = (bp) => {
    const b = BigInt(bp);
    const w = (b / 100n).toString();
    const c = (b % 100n).toString().padStart(2, "0");
    return c === "00" ? w : c.endsWith("0") ? w + "," + c[0] : w + "," + c;
  };
  const fmtBp = (bp) => bpRaw(bp) + " %";

  // ---------------------------------------------------------------- effekt (hk/kW), kanonisk i watt
  const hpToW = (hp) => Math.floor((hp * HP_W_NUM + HP_W_DEN / 2) / HP_W_DEN);
  const kwToW = (kw) => kw * 1000;
  const wToHp = (w) => Math.floor((w * HP_W_DEN * 2 + HP_W_NUM) / (HP_W_NUM * 2));
  const wToKw = (w) => Math.floor((w + 500) / 1000);

  // ---------------------------------------------------------------- lister og oppslag
  // Oppslag med null-prototype: nøkler fra importerte filer («toString», «constructor», «__proto__») er aldri felt.
  const fieldIndex = Object.create(null);
  const allFields = [];
  for (const s of Data.SECTIONS) {
    for (const f of s.fields.concat(s.advanced ? s.advanced.fields : [])) {
      fieldIndex[f.id] = Object.assign({ section: s.id }, f);
      allFields.push(fieldIndex[f.id]);
    }
  }
  const equipIndex = Object.create(null);
  for (const g of Data.EQUIPMENT_GROUPS) for (const it of g.items) equipIndex[it[0]] = { key: it[0], label: it[1], group: g.id, section: g.section };
  const label = (opts, v) => (opts.find((o) => o.v === v) || { l: String(v) }).l;
  const PRIO_FIELDS = allFields.filter((f) => f.kind === "equipSelect" || f.kind === "towbar").map((f) => f.id);

  // ---------------------------------------------------------------- tilstand
  const WEIGHT_TYPES = [Data.opt("curb", "Egenvekt"), Data.opt("gross", "Tillatt totalvekt")];
  const CONSUMPTION_UNITS = [Data.opt("l100", "liter/100 km"), Data.opt("kwh100", "kWh/100 km")];
  const POWER_UNITS = { hp: "hk", kw: "kW" };

  function emptyValue(f) {
    switch (f.kind) {
      case "multi": case "colors": case "packages": return [];
      case "range": case "regrange": return { from: "", to: "" };
      case "weight": return { type: "", max: "" };
      case "consumption": return { unit: "", max: "" };
      case "power": return { unit: "hp", from: "", to: "", fromW: null, toW: null };
      default: return "";
    }
  }
  function newCost(label, fixedKey) {
    return { id: fixedKey || "c" + Math.random().toString(36).slice(2, 9), fixed: Boolean(fixedKey), label: label || "", amount: "", currency: "NOK", vat: "", included: false };
  }
  function emptyState() {
    const values = {};
    for (const f of allFields) values[f.id] = emptyValue(f);
    return {
      origin: "user",
      values,
      eq: {}, // nøkkel -> "must" | "nice" (utstyr, hengerfeste, cruise og klima)
      budget: { amount: "", deviationOn: false, deviation: "", costs: Data.FIXED_COSTS.map((c) => newCost(c.label, c.key)) },
    };
  }
  const clone = (s) => JSON.parse(JSON.stringify(s));

  // ---------------------------------------------------------------- validering
  const PRIO_REQUIRED = new Set(["towbar", "cruise", "climate"]);

  function validateField(f, raw) {
    switch (f.kind) {
      case "range": {
        const a = parseIntBounded(raw.from, f.min, f.max);
        const b = parseIntBounded(raw.to, f.min, f.max);
        const out = {};
        if (a.error) out.from = a.error;
        if (b.error) out.to = b.error;
        if (!out.from && !out.to && a.value !== undefined && b.value !== undefined && a.value > b.value) out.to = "«Til» kan ikke være mindre enn «fra».";
        return out;
      }
      case "regrange": {
        const a = parseYm(raw.from);
        const b = parseYm(raw.to);
        const out = {};
        if (a.error) out.from = a.error;
        if (b.error) out.to = b.error;
        if (!out.from && !out.to && a.ym && b.ym && ymIndex(a.ym, false) > ymIndex(b.ym, true)) out.to = "«Til» kan ikke være før «fra».";
        return out;
      }
      case "max": {
        const r = parseIntBounded(raw, f.min, f.max);
        return r.error ? { value: r.error } : {};
      }
      case "month": {
        const r = parseYm(raw, true);
        return r.error ? { value: r.error } : {};
      }
      case "text":
        return raw.length > f.max ? { value: "Maks " + f.max + " tegn." } : {};
      case "weight": {
        const r = parseIntBounded(raw.max, 100, 10000);
        if (r.error) return { max: r.error };
        if (!r.empty && !raw.type) return { type: "Velg vekttype." };
        return {};
      }
      case "consumption": {
        const r = parseFixedDecimal(raw.max, 1, 0.1, 100);
        if (r.error) return { max: r.error };
        if (!r.empty && !raw.unit) return { unit: "Velg enhet." };
        return {};
      }
      case "power": {
        const out = {};
        const lim = raw.unit === "hp" ? [1, 3000] : [1, 2200];
        const a = parseIntBounded(raw.from, lim[0], lim[1]);
        const b = parseIntBounded(raw.to, lim[0], lim[1]);
        if (a.error) out.from = a.error;
        if (b.error) out.to = b.error;
        if (!out.from && !out.to && a.value !== undefined && b.value !== undefined && a.value > b.value) out.to = "«Til» kan ikke være mindre enn «fra».";
        return out;
      }
      case "variant":
        return raw.length > 60 ? { value: "Maks 60 tegn." } : {};
      default:
        return {};
    }
  }

  function parseYm(input, onlyMonth) {
    const s = normalizeSpaces(input);
    if (s === "") return { empty: true };
    const m = /^(\d{4})(?:-(\d{2}))?$/.exec(s);
    if (!m || (onlyMonth && !m[2])) return { error: onlyMonth ? "Skriv ÅÅÅÅ-MM (for eksempel 2026-05)." : "Skriv ÅÅÅÅ eller ÅÅÅÅ-MM (for eksempel 2021 eller 2021-03)." };
    const y = Number(m[1]);
    const mo = m[2] === undefined ? null : Number(m[2]);
    if (y < 1900 || y > 2100) return { error: "Året må være mellom 1900 og 2100." };
    if (mo !== null && (mo < 1 || mo > 12)) return { error: "Måneden må være 01–12." };
    return { ym: { y, m: mo } };
  }
  /** Måned som tall; en «til»-verdi uten måned gjelder hele året, en «fra»-verdi uten måned begynner i januar. */
  const ymIndex = (ym, isEnd) => ym.y * 12 + (ym.m === null ? (isEnd ? 11 : 0) : ym.m - 1);

  /** Har brukeren fylt inn noe på linjen (navn, beløp, valuta, mva.-grunnlag eller «inngår»)? Urørte egendefinerte linjer eksporteres ikke. */
  const costTouched = (c) => (!c.fixed && c.label.trim() !== "") || c.amount.trim() !== "" || c.vat !== "" || Boolean(c.included) || c.currency !== "NOK";

  /** Alle feil: {fieldId: {sub: melding}}, budget og kostnader under nøklene «budget.*» og «cost.<id>.*». */
  function validate(state) {
    const errors = {};
    for (const f of allFields) {
      const e = validateField(f, state.values[f.id]);
      if (Object.keys(e).length) errors[f.id] = e;
    }
    const v = state.values;
    if (v.variant && !v.model) errors.variant = Object.assign({}, errors.variant, { value: "Variant krever valgt modell." });
    if (v.model && !v.brand) errors.model = { value: "Modell krever valgt merke." };
    else if (v.model && !modelInfo(v.brand, v.model)) errors.model = { value: "Ukjent modell for valgt merke." };
    const b = state.budget;
    const amt = parseMoney(b.amount);
    if (amt.error) errors["budget.amount"] = { value: amt.error };
    if (b.deviationOn) {
      const d = parsePercentBp(b.deviation);
      if (d.error) errors["budget.deviation"] = { value: d.error };
      else if (d.empty) errors["budget.deviation"] = { value: "Skriv inn prosent (0–100) eller slå av prisavviket." };
      else if (amt.empty) errors["budget.amount"] = { value: "Prisavvik krever et budsjett." };
    }
    for (const c of b.costs) {
      const e = {};
      const a = parseMoney(c.amount, { allowZero: true });
      if (a.error) e.amount = a.error;
      if (!c.fixed) {
        if (c.label.length > Data.LIMITS.labelMax) e.label = "Maks " + Data.LIMITS.labelMax + " tegn.";
        else if (c.label.trim() === "" && costTouched(c)) e.label = "Gi kostnaden et navn.";
      }
      if (Object.keys(e).length) errors["cost." + c.id] = e;
    }
    return errors;
  }
  const errorCount = (errors) => Object.values(errors).reduce((n, e) => n + Object.keys(e).length, 0);

  /** Budsjettstatus for visning: {state:"none"|"error"|"ok", budgetMinor?, limitMinor?, bp?} */
  function budgetLimit(budget) {
    const a = parseMoney(budget.amount);
    if (a.empty) return { state: "none" };
    if (a.error) return { state: "error" };
    if (!budget.deviationOn) return { state: "ok", budgetMinor: a.minor, limitMinor: a.minor, bp: null };
    const d = parsePercentBp(budget.deviation);
    if (d.error || d.empty) return { state: "error", budgetMinor: a.minor };
    return { state: "ok", budgetMinor: a.minor, limitMinor: maxAllowedMinor(a.minor, d.bp), bp: d.bp };
  }

  // ---------------------------------------------------------------- tomhet og oppsummering
  function isEmptyValue(f, raw) {
    switch (f.kind) {
      case "multi": case "colors": case "packages": return raw.length === 0;
      case "range": case "regrange": return raw.from.trim() === "" && raw.to.trim() === "";
      case "weight": case "consumption": return raw.max.trim() === "" && !(raw.type || raw.unit);
      case "power": return raw.from.trim() === "" && raw.to.trim() === "";
      default: return String(raw).trim() === "";
    }
  }

  function rangeText(from, to, unit, plain) {
    const u = unit ? NBSP + unit : "";
    const n = plain ? String : fmtInt;
    if (from !== null && to !== null) return from === to ? "nøyaktig " + n(from) + u : n(from) + "–" + n(to) + u;
    if (from !== null) return "fra " + n(from) + u;
    return "til " + n(to) + u;
  }

  /** Lesbar tekst for ett kriterium, eller null hvis tomt/ugyldig (ugyldig vises som feil, ikke i oppsummeringen). */
  function criterionText(f, raw, state) {
    if (isEmptyValue(f, raw) || Object.keys(validateField(f, raw)).length) return null;
    const join = (arr, opts) => arr.map((v) => label(opts, v)).join(" ELLER ");
    switch (f.kind) {
      case "brand": return label(Data.BRANDS, raw);
      case "model": return (modelsOf(state.values.brand).find((m) => m.v === raw) || { l: raw }).l;
      case "variant": return raw.trim();
      case "packages": return raw.join(" ELLER ");
      case "multi": return join(raw, f.options);
      case "colors": return join(raw, f.options);
      case "select": case "radio": case "towbar": case "equipSelect": return label(f.options, raw);
      case "text": return "«" + raw.trim() + "»";
      case "month": return "minst " + raw.trim();
      case "max": {
        const n = parseIntBounded(raw, f.min, f.max).value;
        return (f.minimum ? "minst " : "maks ") + fmtInt(n) + NBSP + f.unit;
      }
      case "range": {
        const a = parseIntBounded(raw.from, f.min, f.max);
        const b = parseIntBounded(raw.to, f.min, f.max);
        return rangeText(a.value === undefined ? null : a.value, b.value === undefined ? null : b.value, f.plain ? "" : f.unit, f.plain);
      }
      case "regrange": {
        const a = raw.from.trim();
        const b = raw.to.trim();
        return a && b ? (a === b ? "nøyaktig " + a : a + "–" + b) : a ? "fra " + a : "til " + b;
      }
      case "weight": {
        const n = parseIntBounded(raw.max, 100, 10000).value;
        return n === undefined ? null : label(WEIGHT_TYPES, raw.type).toLowerCase() + " maks " + fmtInt(n) + NBSP + "kg";
      }
      case "consumption": {
        const r = parseFixedDecimal(raw.max, 1, 0.1, 100);
        return r.empty ? null : "maks " + r.text.replace(".", ",") + NBSP + label(CONSUMPTION_UNITS, raw.unit);
      }
      case "power": {
        const a = parseIntBounded(raw.from, 1, 100000);
        const b = parseIntBounded(raw.to, 1, 100000);
        const u = POWER_UNITS[raw.unit];
        const other = raw.unit === "hp" ? (x) => wToKw(hpToW(x)) + NBSP + "kW" : (x) => wToHp(kwToW(x)) + NBSP + "hk";
        const base = rangeText(a.value === undefined ? null : a.value, b.value === undefined ? null : b.value, u);
        const approx = [a.value, b.value].filter((x) => x !== undefined).map(other).join("–");
        return base + " (≈ " + approx + ")";
      }
      default: return null;
    }
  }

  function clearField(state, id) {
    state.values[id] = emptyValue(fieldIndex[id]);
    delete state.eq[id];
    if (id === "brand") {
      state.values.model = "";
      state.values.variant = "";
      state.values.packages = [];
    } else if (id === "model") {
      state.values.variant = "";
      state.values.packages = [];
    }
  }

  /** Oppsummering: kriterier (krav), utstyr per prioritet, og fjernbare elementer. Hvert element har clear(state). */
  function summarize(state) {
    const criteria = [];
    const must = [];
    const nice = [];
    for (const f of allFields) {
      const raw = state.values[f.id];
      const text = criterionText(f, raw, state);
      if (text === null) continue;
      if (PRIO_FIELDS.includes(f.id)) {
        const prio = state.eq[f.id] || "must";
        (prio === "must" ? must : nice).push({ id: f.id, label: f.label, text, clear: (s) => clearField(s, f.id) });
      } else {
        criteria.push({ id: f.id, section: f.section, label: f.label, text, clear: (s) => clearField(s, f.id) });
      }
    }
    for (const key of Object.keys(state.eq)) {
      if (!equipIndex[key]) continue;
      const it = equipIndex[key];
      (state.eq[key] === "must" ? must : nice).push({ id: key, label: it.label, text: null, clear: (s) => { delete s.eq[key]; } });
    }
    return { criteria, must, nice };
  }

  // ---------------------------------------------------------------- modellavhengige valg
  const modelsOf = (brand) => (typeof brand === "string" && Object.hasOwn(Data.MODELS, brand) ? Data.MODELS[brand] : []);
  const modelInfo = (brand, model) => modelsOf(brand).find((m) => m.v === model) || null;

  /**
   * Bytte av merke/modell: fjerner variant og pakker som ikke hører til. Returnerer det som ble fjernet, slik at
   * brukeren kan bekrefte (angre fjerningen). Modellen er allerede satt i state.
   */
  function reconcileModelDependent(state) {
    const removed = { variant: "", packages: [] };
    const v = state.values;
    if (v.model && !modelInfo(v.brand, v.model)) v.model = "";
    const info = modelInfo(v.brand, v.model);
    if (v.variant && !(info && info.variants.includes(v.variant))) {
      removed.variant = v.variant;
      v.variant = "";
    }
    const keep = [];
    for (const p of v.packages) {
      if (info && info.packages.includes(p)) keep.push(p);
      else removed.packages.push(p);
    }
    v.packages = keep;
    return removed;
  }

  // ---------------------------------------------------------------- eksport / import
  const clean = (o) => JSON.parse(JSON.stringify(o));
  const moneyOut = (minor, currency) => ({ amountMinor: minor.toString(), currency });
  const intOrNull = (s, min, max) => {
    const r = parseIntBounded(s, min, max);
    return r.value === undefined ? null : r.value;
  };

  function exportValue(f, raw) {
    switch (f.kind) {
      case "brand": case "model": case "select": case "radio": case "towbar": case "equipSelect": return raw;
      case "variant": return raw.trim();
      case "text": return raw.trim();
      case "month": return raw.trim();
      case "multi": case "colors": case "packages": return raw.slice();
      case "range": return { from: intOrNull(raw.from, f.min, f.max), to: intOrNull(raw.to, f.min, f.max), unit: f.unit };
      case "max": return { value: intOrNull(raw, f.min, f.max), unit: f.unit, bound: f.minimum ? "min" : "max" };
      case "regrange": return { from: raw.from.trim() || null, to: raw.to.trim() || null, format: "ÅÅÅÅ[-MM]" };
      case "weight": return { type: raw.type, max: intOrNull(raw.max, 100, 10000), unit: "kg" };
      case "consumption": { const r = parseFixedDecimal(raw.max, 1, 0.1, 100); return { unit: raw.unit, max: r.empty ? null : r.text, perUnit: "100 km" }; }
      case "power": {
        const a = intOrNull(raw.from, 1, 100000);
        const b = intOrNull(raw.to, 1, 100000);
        const toKw = raw.unit === "hp" ? (x) => wToKw(hpToW(x)) : (x) => x;
        const conv = raw.unit === "hp" ? hpToW : kwToW;
        const back = raw.unit === "hp" ? wToHp : wToKw;
        // Kanonisk verdi i watt bevares, men bare når den fortsatt stemmer med verdien som vises; ellers regnes den fra visningsverdien.
        const canon = (v, w) => (v === null ? null : w !== null && w !== undefined && back(w) === v ? w : conv(v));
        return { unit: raw.unit === "hp" ? "hk" : "kW", from: a, to: b, approxKw: { from: a === null ? null : toKw(a), to: b === null ? null : toKw(b) },
          normalizedWatts: { from: canon(a, raw.fromW), to: canon(b, raw.toW) } };
      }
      default: return null;
    }
  }

  function exportDraft(state, now) {
    const errors = validate(state);
    if (errorCount(errors) > 0) return { ok: false, errors };
    const criteria = {};
    for (const f of allFields) {
      if (isEmptyValue(f, state.values[f.id])) continue;
      criteria[f.id] = exportValue(f, state.values[f.id]);
    }
    const equipment = {};
    for (const [k, p] of Object.entries(state.eq)) {
      if (equipIndex[k] || (PRIO_FIELDS.includes(k) && criteria[k] !== undefined)) equipment[k] = { priority: p };
    }
    for (const k of PRIO_FIELDS) if (criteria[k] !== undefined && !equipment[k]) equipment[k] = { priority: "must" };
    const lim = budgetLimit(state.budget);
    const bAmt = parseMoney(state.budget.amount);
    const dev = state.budget.deviationOn ? parsePercentBp(state.budget.deviation) : null;
    const budget = {
      currency: "NOK",
      maxPurchaseCost: bAmt.minor === undefined ? null : moneyOut(bAmt.minor, "NOK"),
      deviation: {
        enabled: Boolean(state.budget.deviationOn),
        basisPoints: dev && dev.bp !== undefined ? Number(dev.bp) : null,
        maxAllowed: state.budget.deviationOn && lim.state === "ok" ? moneyOut(lim.limitMinor, "NOK") : null,
      },
      costs: state.budget.costs.filter((c) => c.fixed || costTouched(c)).map((c) => {
        const a = parseMoney(c.amount, { allowZero: true });
        return {
          kind: c.fixed ? c.id : "custom",
          label: c.fixed ? (Data.FIXED_COSTS.find((x) => x.key === c.id) || {}).label : c.label.trim(),
          currency: c.currency, // også når beløpet er ukjent
          amount: a.minor === undefined ? null : moneyOut(a.minor, c.currency),
          vatBasis: c.vat,
          includedInBudget: Boolean(c.included),
        };
      }),
      note: "Kostnadslinjer er forutsetninger. De er ikke lagt til budsjettgrensen, og ingen bilpris, avgift eller total er beregnet.",
    };
    return {
      ok: true,
      draft: clean({
        schema: Data.SCHEMA,
        schemaVersion: Data.SCHEMA_VERSION,
        exportedAt: (now || new Date()).toISOString(),
        origin: state.origin,
        notice: "Utkast fra forhåndsvisning. Ikke lagret i appens database. Ingen søk er sendt.",
        criteria,
        equipment,
        budget,
      }),
    };
  }

  const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
  const short = (s) => String(s).slice(0, 40);
  const TOP_KEYS = new Set(["schema", "schemaVersion", "exportedAt", "origin", "notice", "criteria", "equipment", "budget"]);

  function importValue(f, val, errs, ver) {
    const bad = (why) => errs.push(f.label + ": " + why);
    const optIn = (opts, v) => typeof v === "string" && opts.some((o) => o.v === v);
    const intRaw = (n, min, max) => {
      if (n === null) return "";
      if (!Number.isInteger(n) || n < min || n > max) { bad("verdien " + short(n) + " er utenfor grensene."); return ""; }
      return f.plain ? String(n) : rawInt(n);
    };
    switch (f.kind) {
      case "brand": if (!optIn(Data.BRANDS, val)) { bad("ukjent merke."); return ""; } return val;
      case "model": if (typeof val !== "string") { bad("ugyldig modell."); return ""; } return val;
      case "variant": case "text": if (typeof val !== "string" || val.length > (f.max || 60)) { bad("ugyldig tekst."); return ""; } return val;
      case "month": { if (typeof val !== "string" || parseYm(val, true).error) { bad("ugyldig måned."); return ""; } return val; }
      case "select": case "radio": if (val !== "" && !optIn(f.options, val)) { bad("ukjent valg."); return ""; } return val;
      case "towbar": case "equipSelect": if (!optIn(f.options, val)) { bad("ukjent valg."); return ""; } return val;
      case "multi": case "colors": {
        if (!Array.isArray(val) || val.length > 40 || !val.every((v) => optIn(f.options, v)) || new Set(val).size !== val.length) { bad("ugyldig liste over valg."); return []; }
        return val.slice();
      }
      case "packages": if (!Array.isArray(val) || val.length > 10 || !val.every((v) => typeof v === "string" && v.length <= 60)) { bad("ugyldig liste."); return []; } return val.slice();
      case "range": {
        if (!isObj(val) || val.unit !== f.unit) { bad("mangler riktig enhet (" + f.unit + ")."); return { from: "", to: "" }; }
        return { from: intRaw(val.from, f.min, f.max), to: intRaw(val.to, f.min, f.max) };
      }
      case "max": {
        if (!isObj(val) || val.unit !== f.unit || val.bound !== (f.minimum ? "min" : "max")) { bad("mangler riktig enhet/grense."); return ""; }
        return intRaw(val.value, f.min, f.max);
      }
      case "regrange": {
        if (!isObj(val)) { bad("ugyldig verdi."); return { from: "", to: "" }; }
        const one = (s) => (s === null ? "" : typeof s === "string" && !parseYm(s).error ? s : (bad("ugyldig dato."), ""));
        return { from: one(val.from), to: one(val.to) };
      }
      case "weight": {
        if (!isObj(val) || val.unit !== "kg" || (val.type !== "" && !optIn(WEIGHT_TYPES, val.type))) { bad("ugyldig vekt."); return { type: "", max: "" }; }
        return { type: val.type, max: intRaw(val.max, 100, 10000) };
      }
      case "consumption": {
        if (!isObj(val) || (val.unit !== "" && !optIn(CONSUMPTION_UNITS, val.unit)) || val.perUnit !== "100 km") { bad("ugyldig forbruk."); return { unit: "", max: "" }; }
        if (val.max === null) return { unit: val.unit, max: "" };
        if (typeof val.max !== "string" || !/^\d{1,3}(\.\d)?$/.test(val.max)) { bad("ugyldig forbruksverdi."); return { unit: val.unit, max: "" }; }
        return { unit: val.unit, max: val.max.replace(".", ",") };
      }
      case "power": {
        if (!isObj(val) || (val.unit !== "hk" && val.unit !== "kW")) { bad("mangler enhet (hk eller kW)."); return emptyValue(f); }
        const unit = val.unit === "hk" ? "hp" : "kw";
        const lim = unit === "hp" ? [1, 3000] : [1, 2200];
        const from = intRaw(val.from, lim[0], lim[1]);
        const to = intRaw(val.to, lim[0], lim[1]);
        const num = (x) => Number(x.replace(/ /g, ""));
        const conv = unit === "hp" ? hpToW : kwToW;
        const back = unit === "hp" ? wToHp : wToKw;
        let fromW = from === "" ? null : conv(num(from));
        let toW = to === "" ? null : conv(num(to));
        if (ver >= 2) {
          // v2 bærer kanonisk effekt i watt; den må stemme med verdien som vises (ellers er filen selvmotsigende).
          const nw = val.normalizedWatts;
          if (!isObj(nw)) { bad("mangler normalizedWatts."); return emptyValue(f); }
          const side = (shown, w, name) => {
            if (shown === "") { if (w !== null) bad("normalizedWatts." + name + " uten verdi."); return null; }
            if (!Number.isInteger(w) || w < 1 || w > 4000000 || back(w) !== num(shown)) { bad("normalizedWatts." + name + " stemmer ikke med oppgitt effekt."); return null; }
            return w;
          };
          fromW = side(from, nw.from, "from");
          toW = side(to, nw.to, "to");
        }
        return { unit, from, to, fromW, toW };
      }
      default: bad("ukjent felttype."); return emptyValue(f);
    }
  }

  /** Alt-eller-ingenting: returnerer {ok:true,state} bare når hele filen er gyldig; ellers {ok:false,errors} uten å røre noe. */
  function importDraft(text) {
    const errors = [];
    if (typeof text !== "string") return { ok: false, errors: ["Filen kunne ikke leses som tekst."] };
    if (text.length > Data.LIMITS.importBytes) return { ok: false, errors: ["Filen er for stor (maks 200 000 tegn)."] };
    let doc;
    try { doc = JSON.parse(text); } catch { return { ok: false, errors: ["Filen er ikke gyldig JSON."] }; }
    if (!isObj(doc)) return { ok: false, errors: ["Filen har ikke riktig oppbygning (forventet et JSON-objekt)."] };
    if (doc.schema !== Data.SCHEMA) return { ok: false, errors: ["Dette er ikke et Merovo-søkeutkast (schema mangler eller er feil)."] };
    if (!Data.SUPPORTED_VERSIONS.includes(doc.schemaVersion)) {
      return { ok: false, errors: ["Ukjent schema-versjon: " + short(doc.schemaVersion) + ". Denne forhåndsvisningen støtter versjon 2 og leser versjon 1 (med migrering og advarsler)."] };
    }
    for (const k of Object.keys(doc)) if (!TOP_KEYS.has(k)) errors.push("Ukjent toppnivånøkkel: " + short(k));
    if (doc.origin !== undefined && doc.origin !== "user" && doc.origin !== "demo-example") errors.push("Ugyldig origin.");
    if (!isObj(doc.criteria)) errors.push("Mangler «criteria».");
    if (!isObj(doc.equipment)) errors.push("Mangler «equipment».");
    if (!isObj(doc.budget)) errors.push("Mangler «budget».");
    if (errors.length) return { ok: false, errors };

    const ver = doc.schemaVersion;
    const warnings = [];
    const state = emptyState();
    state.origin = doc.origin || "user";
    for (const [id, val] of Object.entries(doc.criteria)) {
      const f = fieldIndex[id];
      if (!f) { errors.push("Ukjent felt: " + short(id)); continue; }
      state.values[id] = importValue(f, val, errors, ver);
    }
    for (const [k, v] of Object.entries(doc.equipment)) {
      if (!isObj(v) || (v.priority !== "must" && v.priority !== "nice")) { errors.push("Ugyldig prioritet for " + short(k) + "."); continue; }
      if (equipIndex[k]) state.eq[k] = v.priority;
      else if (PRIO_FIELDS.includes(k)) {
        if (isEmptyValue(fieldIndex[k], state.values[k])) errors.push("Prioritet uten valgt verdi for " + short(k) + ".");
        else state.eq[k] = v.priority;
      } else errors.push("Ukjent utstyrsnøkkel: " + short(k));
    }
    importBudget(doc.budget, state, errors, ver, warnings);
    if (errors.length) return { ok: false, errors };
    // Merke/modell valideres mot katalogen (validate() under). Fritekstvariant er gyldig under en gyldig modell;
    // forslagene i demokatalogen er ikke uttømmende. Pakker er katalogvalg og må høre til modellen.
    const info = modelInfo(state.values.brand, state.values.model);
    if (state.values.packages.length && !(info && state.values.packages.every((p) => info.packages.includes(p)))) errors.push("Utstyrspakke: hører ikke til valgt modell.");
    const verr = validate(state);
    if (errorCount(verr)) {
      for (const [id, e] of Object.entries(verr)) for (const m of Object.values(e)) errors.push((fieldIndex[id] ? fieldIndex[id].label : id) + ": " + m);
    }
    if (errors.length) return { ok: false, errors };
    return { ok: true, state, warnings };
  }

  function importBudget(b, state, errors, ver, warnings) {
    const money = (m, what, allowNull) => {
      if (m === null && allowNull) return "";
      if (!isObj(m) || typeof m.amountMinor !== "string" || !/^\d{1,13}$/.test(m.amountMinor) || typeof m.currency !== "string") { errors.push(what + ": ugyldig beløp."); return ""; }
      return m;
    };
    if (b.currency !== "NOK") errors.push("Budsjettet må være i NOK.");
    const max = money(b.maxPurchaseCost, "Maks innkjøpskostnad", true);
    if (max && max.currency !== "NOK") errors.push("Maks innkjøpskostnad må være i NOK.");
    state.budget.amount = max ? rawMinor(max.amountMinor) : "";
    const d = b.deviation;
    if (!isObj(d) || typeof d.enabled !== "boolean") { errors.push("Prisavvik: ugyldig."); }
    else {
      state.budget.deviationOn = d.enabled;
      if (d.enabled) {
        if (!Number.isInteger(d.basisPoints) || d.basisPoints < 0 || d.basisPoints > 10000) errors.push("Prisavvik: ugyldige basispunkter.");
        else state.budget.deviation = bpRaw(d.basisPoints);
      } else if (d.basisPoints !== null) errors.push("Prisavvik er av, men har en verdi.");
    }
    if (!Array.isArray(b.costs) || b.costs.length > Data.LIMITS.maxCosts) { errors.push("Kostnadslinjer: ugyldig liste."); return; }
    const fixed = new Set(Data.FIXED_COSTS.map((c) => c.key));
    const seenFixed = new Set();
    const costs = [];
    const v1NoAmount = [];
    for (const c of b.costs) {
      if (!isObj(c) || typeof c.includedInBudget !== "boolean" || !Data.VAT_BASIS.some((o) => o.v === c.vatBasis)) { errors.push("Kostnadslinje: ugyldig oppbygning."); continue; }
      const amt = c.amount === null ? null : money(c.amount, "Kostnadslinje", false);
      if (amt && !Data.CURRENCIES.includes(amt.currency)) { errors.push("Kostnadslinje: valuta støttes ikke."); continue; }
      // v2 har valuta på linjen også uten beløp. v1 hadde den bare inne i beløpet.
      let currency;
      if (ver >= 2) {
        if (typeof c.currency !== "string" || !Data.CURRENCIES.includes(c.currency)) { errors.push("Kostnadslinje: mangler gyldig valuta."); continue; }
        if (amt && amt.currency !== c.currency) { errors.push("Kostnadslinje: valuta på linjen og i beløpet er ulike."); continue; }
        currency = c.currency;
      } else currency = amt ? amt.currency : "NOK";
      const isFixed = fixed.has(c.kind);
      if (isFixed && seenFixed.has(c.kind)) { errors.push("Kostnadslinje: duplikat."); continue; }
      if (!isFixed && c.kind !== "custom") { errors.push("Kostnadslinje: ukjent type."); continue; }
      if (!isFixed && typeof c.label === "string" && c.label.trim() === "" && !amt && c.vatBasis === "" && !c.includedInBudget && currency === "NOK") {
        warnings.push("En tom, urørt egendefinert kostnadslinje ble utelatt.");
        continue;
      }
      if (!isFixed && (typeof c.label !== "string" || c.label.trim() === "" || c.label.length > Data.LIMITS.labelMax)) { errors.push("Kostnadslinje: ugyldig navn."); continue; }
      if (isFixed) seenFixed.add(c.kind);
      const cost = newCost(isFixed ? "" : c.label, isFixed ? c.kind : "");
      cost.amount = amt ? rawMinor(amt.amountMinor) : "";
      cost.currency = currency;
      if (ver < 2 && !amt) v1NoAmount.push(isFixed ? (Data.FIXED_COSTS.find((x) => x.key === c.kind) || {}).label : c.label.trim());
      cost.vat = c.vatBasis;
      cost.included = c.includedInBudget;
      costs.push(cost);
    }
    if (v1NoAmount.length) {
      warnings.push("Versjon 1-filer lagret ikke valuta for kostnadslinjer uten beløp. Valutaen er satt til NOK for: " + v1NoAmount.join(", ") + ". Kontroller valutaen.");
    }
    for (const k of fixed) if (!seenFixed.has(k)) costs.unshift(newCost("", k));
    const order = Data.FIXED_COSTS.map((x) => x.key);
    costs.sort((a, b2) => (a.fixed ? order.indexOf(a.id) : 99) - (b2.fixed ? order.indexOf(b2.id) : 99));
    state.budget.costs = costs;
  }

  // ---------------------------------------------------------------- demoeksempel (Christians GLS-scenario)
  /** Demoverdier. De er eksempler, ikke brukerens valg; km og salgspris/margin er bevisst utelatt. */
  function exampleState() {
    const s = emptyState();
    s.origin = "demo-example";
    const v = s.values;
    v.brand = "mercedes-benz";
    v.model = "gls";
    v.modelYear = { from: "2021", to: "" };
    v.seats = { from: "7", to: "7" };
    v.extColor = ["black", "white"];
    s.eq.panoramic_roof = "nice";
    s.eq.air_suspension = "nice";
    s.eq.camera_360 = "must";
    s.eq.heated_seats_front = "nice";
    s.eq.carplay = "must";
    s.budget.amount = "750 000";
    s.budget.deviationOn = true;
    s.budget.deviation = "10";
    return s;
  }

  /** Finnes det noe brukeren kan miste? (Brukes til advarsel ved lukking og før import/tømming.) */
  function hasContent(state) {
    if (allFields.some((f) => !isEmptyValue(f, state.values[f.id]))) return true;
    if (Object.keys(state.eq).length) return true;
    const b = state.budget;
    if (b.amount.trim() !== "" || b.deviationOn || b.deviation.trim() !== "") return true;
    return b.costs.some(costTouched);
  }

  return {
    parseDecimal, parseMoney, parseIntBounded, parseFixedDecimal, parsePercentBp, maxAllowedMinor, fmtMinor, fmtBp, rawMinor,
    hpToW, wToHp, kwToW, wToKw, parseYm, ymIndex, fieldIndex, equipIndex, allFields, PRIO_FIELDS, PRIO_REQUIRED, WEIGHT_TYPES, CONSUMPTION_UNITS,
    emptyState, emptyValue, newCost, costTouched, clone, validate, validateField, errorCount, budgetLimit, summarize, criterionText, isEmptyValue, clearField,
    modelInfo, reconcileModelDependent, exportDraft, importDraft, exampleState, hasContent, fmtInt, rawInt, label,
  };
});
