// TESTHJELPER (CI-001, J3 i ekte modus): OBSERVERENDE GJENNOMSENDINGSPROXY mellom den uendrede appen og en LOKAL Supabase-API. Skrivekallene til forhandlerinput gjøres av serveren (server actions),
// ikke av nettleseren, og er derfor usynlige for Playwright; denne proxyen lar nettleserløpet kontrollere påstanden «appen sender aldri dealership_id i kroppen til skrivekall».
//   * Binder bare til 127.0.0.1 (tilfeldig port) og videresender bare til et lokalt http-mål (127.0.0.1/localhost), validert før oppstart. Ingen auth, ingen endring av innhold: metode, sti,
//     spørrestreng, headere (unntatt hop-by-hop), kropp og svar sendes uendret videre.
//   * Registrerer BARE for skrivekall (POST/PATCH/PUT/DELETE) mot de overvåkede tabellene: metode, tabellnavn og NAVNENE på toppnivånøklene i JSON-kroppen (objekt, eller union over objektene i en array).
//     Ingen verdier, headere, cookies, tokens, URL-er/spørrestrenger eller svar lagres eller skrives noe sted; modulen skriver ikke til konsollen. Kroppen leses i minnet (maks. MAX_BODY) og kastes.
//   * Feiler lukket: uleselig/ikke-JSON/komprimert/for stor kropp, avbrutt forespørsel, videresendingsfeil eller intern feil telles og gir FEIL i j3Verdict (aldri OK).
//   * `dealership_id` som FILTER i spørrestrengen (.eq("dealership_id", …)) er ikke skriving og ses aldri; bare kroppens toppnivånøkler vurderes.
import http from "node:http";
import { assertLocalHttpTarget } from "./preflight.mjs";

export const OBSERVED_TABLES = Object.freeze(["dealer_economics_inputs", "dealer_economics_profiles"]);
export const MAX_BODY = 256 * 1024;
const WRITE = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const KEY_RE = /^[a-z_][a-z0-9_]{0,63}$/;
const HOP = new Set(["connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "te", "trailer", "host"]);

/** @returns {{ table: string } | null} relevant skrivekall? (bare metode + sti-del før «?» vurderes) */
function classify(method, rawUrl) {
  if (!WRITE.has(method)) return null;
  const path = String(rawUrl).split("?")[0];
  const m = /^\/rest\/v1\/([a-z_]+)\/?$/.exec(path);
  return m && OBSERVED_TABLES.includes(m[1]) ? { table: m[1] } : null;
}

/** JSON-kropp ⇒ sortert liste med toppnivånøkler, eller null hvis uleselig. Arrayer: alle elementer må være objekter (union). */
export function keysOfBody(buffer) {
  let v;
  try { v = JSON.parse(buffer.toString("utf8")); } catch { return null; }
  const items = Array.isArray(v) ? v : [v];
  const keys = new Set();
  for (const it of items) {
    if (it === null || typeof it !== "object" || Array.isArray(it)) return null;
    for (const k of Object.keys(it)) { if (!KEY_RE.test(k)) return null; keys.add(k); }
  }
  return [...keys].sort();
}

export async function startRequestObserver({ target }) {
  const t = new URL(assertLocalHttpTarget("observatørens mål", target)); // lokalt http-mål, ellers kastes en TargetError uten å nevne hele adressen
  const state = { writes: [], unreadable: 0, overflow: 0, errors: 0, total: 0 };
  const server = http.createServer((req, res) => {
    state.total += 1;
    let rec = null;
    try { rec = classify(req.method ?? "", req.url ?? ""); } catch { state.errors += 1; }
    const headers = {};
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const k = req.rawHeaders[i], lk = k.toLowerCase();
      if (HOP.has(lk)) continue;
      headers[k] = headers[k] === undefined ? req.rawHeaders[i + 1] : [].concat(headers[k], req.rawHeaders[i + 1]);
    }
    const encoded = rec && Object.keys(headers).some((k) => k.toLowerCase() === "content-encoding");
    const up = http.request({ host: t.hostname, port: t.port || 80, method: req.method, path: req.url, headers, agent: false }, (ur) => {
      const raw = [];
      for (let i = 0; i < ur.rawHeaders.length; i += 2) if (!HOP.has(ur.rawHeaders[i].toLowerCase())) raw.push(ur.rawHeaders[i], ur.rawHeaders[i + 1]);
      res.writeHead(ur.statusCode ?? 502, ur.statusMessage, raw);
      ur.pipe(res);
    });
    up.on("error", () => { state.errors += 1; if (!res.headersSent) { res.writeHead(502); } res.end(); });
    let chunks = [], size = 0, over = false, done = false;
    req.on("data", (c) => {
      if (!rec || over) return;
      size += c.length;
      if (size > MAX_BODY) { over = true; chunks = []; } else chunks.push(c);
    });
    req.on("end", () => {
      done = true;
      if (!rec) return;
      try {
        if (over) { state.overflow += 1; return; }
        const keys = encoded ? null : keysOfBody(Buffer.concat(chunks));
        if (keys === null && !(req.method === "DELETE" && size === 0)) { state.unreadable += 1; return; }
        state.writes.push({ method: req.method, table: rec.table, keys: keys ?? [] });
      } catch { state.errors += 1; } finally { chunks = []; }
    });
    req.on("close", () => { if (!done && rec) state.unreadable += 1; });
    req.on("error", () => { state.errors += 1; up.destroy(); });
    req.pipe(up);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  return {
    url: `http://127.0.0.1:${port}`,
    summary: () => ({ writes: state.writes.map((w) => ({ method: w.method, table: w.table, keys: [...w.keys] })), unreadable: state.unreadable, overflow: state.overflow, errors: state.errors, total: state.total }),
    close: () => new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections?.(); }),
  };
}

/** J3 (kroppen, ikke filteret): OK bare hvis observasjonen er hel og minst ett skrivekall mot forhandlerinput er sett og ingen kropp har dealership_id. `detail` har bare metode, tabell og nøkkelnavn. */
export function j3Verdict(s) {
  const problems = [];
  if (!s || typeof s !== "object") return { ok: false, detail: "ingen observasjon" };
  if (s.errors > 0) problems.push(`observatørfeil (${s.errors})`);
  if (s.unreadable > 0) problems.push(`${s.unreadable} skrivekall med uleselig kropp`);
  if (s.overflow > 0) problems.push(`${s.overflow} skrivekall med for stor kropp`);
  if (!(s.total > 0)) problems.push("ingen trafikk gikk gjennom observatøren");
  if (!s.writes.some((w) => w.table === "dealer_economics_inputs")) problems.push("ingen skrivekall mot dealer_economics_inputs observert");
  const bad = s.writes.filter((w) => w.keys.some((k) => k.toLowerCase() === "dealership_id"));
  if (bad.length) problems.push(`dealership_id i kroppen til ${bad.length} av ${s.writes.length} skrivekall: ${bad.slice(0, 5).map((w) => `${w.method} ${w.table} [${w.keys.join(",")}]`).join("; ")}`);
  return { ok: problems.length === 0, detail: problems.length ? problems.join("; ") : `${s.writes.length} skrivekall observert, ingen med dealership_id i kroppen` };
}
