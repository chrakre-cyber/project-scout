// Observerende proxy for J3 i ekte modus (tests/e2e/support/request-observer.mjs): videresending uten endring, ingen lekkasje av verdier/headere/URL-er, negative kontroller og feilbaner (lukket feiling).
// Kjører mot lokale måleservere — ingen Supabase, ingen nettleser.
import { readFileSync } from "node:fs";
import http from "node:http";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error — ren .mjs uten typer
import { MAX_BODY, j3Verdict, keysOfBody, startRequestObserver } from "./e2e/support/request-observer.mjs";

interface Seen { method: string; url: string; headers: http.IncomingHttpHeaders; rawHeaders: string[]; body: Buffer }
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { for (const c of closers.splice(0)) await c(); });

async function target(reply: (req: http.IncomingMessage) => { status: number; headers?: [string, string][]; body?: Buffer | string } = () => ({ status: 200, body: "{}" })) {
  const seen: Seen[] = [];
  const srv = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      seen.push({ method: req.method!, url: req.url!, headers: req.headers, rawHeaders: req.rawHeaders, body: Buffer.concat(chunks) });
      const r = reply(req);
      res.writeHead(r.status, (r.headers ?? []).flat());
      res.end(r.body ?? "");
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  closers.push(() => new Promise((r) => { srv.close(() => r()); srv.closeAllConnections(); }));
  return { url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, seen };
}
async function observed(reply?: Parameters<typeof target>[0]) {
  const t = await target(reply);
  const obs = await startRequestObserver({ target: t.url });
  closers.push(() => obs.close());
  return { t, obs };
}
const send = (obs: { url: string }, method: string, path: string, body?: string, headers: Record<string, string> = {}) =>
  fetch(`${obs.url}${path}`, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers }, body });
const INPUTS = "/rest/v1/dealer_economics_inputs", PROFILES = "/rest/v1/dealer_economics_profiles";
const good = { search_id: "s", candidate_id: "c", candidate_version: "v", input_schema_version: 1, payload: { x: 1 }, context: {} };

describe("videresending uten endring", () => {
  it("metode, sti, spørrestreng, headere og kropp når målet byte-for-byte; svar (status, headere inkl. flere set-cookie, kropp) kommer uendret tilbake", async () => {
    const reply = Buffer.from([0, 1, 2, 250, 251, 252, 123, 125]);
    const { t, obs } = await observed(() => ({ status: 409, headers: [["set-cookie", "a=1"], ["set-cookie", "b=2"], ["x-test", "ja"], ["content-type", "application/octet-stream"]], body: reply }));
    const body = JSON.stringify({ ...good, payload: { s: "æøå ✓ \n" } });
    const r = await send(obs, "POST", `${INPUTS}?on_conflict=a&dealership_id=eq.abc`, body, { authorization: "Bearer x", apikey: "k", cookie: "c=1", prefer: "return=representation" });
    expect(r.status).toBe(409);
    expect(Buffer.from(await r.arrayBuffer()).equals(reply)).toBe(true);
    expect(r.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
    expect(r.headers.get("x-test")).toBe("ja");
    const s = t.seen[0]!;
    expect(s.method).toBe("POST");
    expect(s.url).toBe(`${INPUTS}?on_conflict=a&dealership_id=eq.abc`);
    expect(s.body.toString("utf8")).toBe(body);
    expect(s.headers).toMatchObject({ authorization: "Bearer x", apikey: "k", cookie: "c=1", prefer: "return=representation", "content-type": "application/json" });
  });
  it("trafikk som ikke er relevant (GET, auth, andre tabeller, forhåndsforespørsel) videresendes uendret og registreres ikke", async () => {
    const { t, obs } = await observed();
    await send(obs, "GET", `${INPUTS}?select=*`);
    await send(obs, "POST", "/auth/v1/token?grant_type=password", JSON.stringify({ email: "a@b.c", password: "p" }));
    await send(obs, "POST", "/rest/v1/search_drafts", JSON.stringify({ name: "x", dealership_id: "y" }));
    await send(obs, "OPTIONS", INPUTS);
    expect(t.seen.map((x) => `${x.method} ${x.url.split("?")[0]}`)).toEqual([`GET ${INPUTS}`, "POST /auth/v1/token", "POST /rest/v1/search_drafts", `OPTIONS ${INPUTS}`]);
    const s = obs.summary();
    expect(s.writes).toEqual([]);
    expect(s.total).toBe(4);
  });
  it("registrerer bare metode, tabell og nøkkelnavn (objekt og array), også for avviste skrivekall", async () => {
    const { obs } = await observed(() => ({ status: 403, body: JSON.stringify({ code: "42501" }) }));
    await send(obs, "POST", INPUTS, JSON.stringify(good));
    await send(obs, "PATCH", `${INPUTS}?id=eq.1`, JSON.stringify({ payload: { a: 1 }, context: {} }));
    await send(obs, "POST", PROFILES, JSON.stringify([{ payload: 1 }, { payload: 2, updated_by: "u" }]));
    expect(obs.summary().writes).toEqual([
      { method: "POST", table: "dealer_economics_inputs", keys: ["candidate_id", "candidate_version", "context", "input_schema_version", "payload", "search_id"] },
      { method: "PATCH", table: "dealer_economics_inputs", keys: ["context", "payload"] },
      { method: "POST", table: "dealer_economics_profiles", keys: ["payload", "updated_by"] },
    ]);
  });
});

describe("ingen lekkasje av verdier, headere, cookies, tokens eller URL-er", () => {
  it("sentinelverdier i kropp, headere, cookie, spørrestreng og sti finnes verken i registreringene, i J3-detaljene, i konsollen eller i stdout/stderr", async () => {
    const S = ["SENT-body-8f3a", "SENT-token-1c2d", "SENT-cookie-77aa", "SENT-query-5e5e", "SENT-key-b00b"] as string[];
    const writes: string[] = [];
    const spies = [vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => { writes.push(String(c)); return true; }), vi.spyOn(process.stderr, "write").mockImplementation((c: unknown) => { writes.push(String(c)); return true; })];
    const consoleSpies = (["log", "error", "warn", "info", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { writes.push(a.map(String).join(" ")); }));
    try {
      const { obs } = await observed();
      await send(obs, "POST", `${INPUTS}?x=${S[3]}`, JSON.stringify({ ...good, payload: { secret: S[0] }, dealership_id: S[0] }), { authorization: `Bearer ${S[1]}`, cookie: `sb=${S[2]}`, apikey: S[4]! });
      await send(obs, "POST", PROFILES, JSON.stringify({ payload: S[0] }), { authorization: `Bearer ${S[1]}` });
      const sum = JSON.stringify(obs.summary()), v = j3Verdict(obs.summary());
      for (const s of S) { expect(sum).not.toContain(s); expect(v.detail).not.toContain(s); }
      expect(v.ok).toBe(false);
      expect(v.detail).toContain("dealership_id");
    } finally { for (const s of [...spies, ...consoleSpies]) s.mockRestore(); }
    for (const s of S) expect(writes.join("\n")).not.toContain(s);
  });
  it("kildekoden skriver ikke noe sted (ingen console/stdout/stderr/fil) og lagrer ikke headere eller URL", () => {
    const src = readFileSync(join(__dirname, "e2e/support/request-observer.mjs"), "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    expect(src).not.toMatch(/console\.|process\.std(out|err)|writeFile|appendFile|createWriteStream/);
    expect(src).not.toMatch(/state\.\w+\.push\([^)]*(headers|url|rawHeaders)/);
  });
});

describe("J3-vurderingen (kroppen, ikke filteret)", () => {
  it("OK: skrivekall uten dealership_id i kroppen mot begge tabeller, også med dealership_id som FILTER i spørrestrengen", async () => {
    const { obs } = await observed();
    await send(obs, "POST", INPUTS, JSON.stringify(good));
    await send(obs, "PATCH", `${INPUTS}?dealership_id=eq.00000000-0000-0000-0000-000000000000&search_id=eq.s`, JSON.stringify({ payload: {}, context: {} }));
    await send(obs, "PATCH", `${PROFILES}?dealership_id=eq.x`, JSON.stringify({ payload: {} }));
    const v = j3Verdict(obs.summary());
    expect(v.ok, v.detail).toBe(true);
    expect(JSON.stringify(obs.summary())).not.toContain("00000000-0000");
  });
  it("FEIL: dealership_id i kroppen — objekt, array-element, profiltabell, store/små bokstaver og senere skrivekall (observasjonen varer hele løpet)", async () => {
    const mk = async (path: string, body: unknown) => { const { obs } = await observed(); await send(obs, "POST", INPUTS, JSON.stringify(good)); expect(j3Verdict(obs.summary()).ok).toBe(true); await send(obs, "POST", path, JSON.stringify(body)); return j3Verdict(obs.summary()); };
    for (const [path, body] of [[INPUTS, { ...good, dealership_id: "x" }], [INPUTS, [good, { ...good, dealership_id: "x" }]], [PROFILES, { payload: {}, dealership_id: "x" }], [PROFILES, { payload: {}, Dealership_ID: "x" }]] as const) {
      const v = await mk(path, body);
      expect(v.ok, JSON.stringify(body)).toBe(false);
      expect(v.detail).not.toContain('"x"');
    }
  });
  it("FEIL (lukket): ingen skrivekall; bare profilskriving uten forhandlerinput; ingen trafikk; manglende observasjon", async () => {
    const a = await observed(); expect(j3Verdict(a.obs.summary()).ok).toBe(false);
    const b = await observed(); await send(b.obs, "POST", PROFILES, JSON.stringify({ payload: {} })); expect(j3Verdict(b.obs.summary())).toMatchObject({ ok: false });
    const c = await observed(); await send(c.obs, "GET", INPUTS); expect(j3Verdict(c.obs.summary()).ok).toBe(false);
    expect(j3Verdict(undefined).ok).toBe(false);
    expect(j3Verdict({ writes: [], unreadable: 0, overflow: 0, errors: 0, total: 0 }).ok).toBe(false);
  });
  it("FEIL (lukket): uleselig kropp — ugyldig JSON, primitiv, null, array med ikke-objekt, ugyldig nøkkel, komprimert, tom kropp", async () => {
    for (const [body, headers] of [["{ikke json", {}], ["42", {}], ["null", {}], ["[1,2]", {}], ['{"Bad-Key":1}', {}], [JSON.stringify(good), { "content-encoding": "gzip" }], ["", {}]] as const) {
      const { obs } = await observed();
      await send(obs, "POST", INPUTS, JSON.stringify(good)); // gyldig først
      await send(obs, "POST", INPUTS, body, headers);
      const v = j3Verdict(obs.summary());
      expect(v.ok, String(body)).toBe(false);
      expect(v.detail).toContain("uleselig");
    }
  });
  it("FEIL (lukket): for stor kropp (> MAX_BODY) videresendes (målet får alt), men gir FEIL", async () => {
    const { t, obs } = await observed();
    await send(obs, "POST", INPUTS, JSON.stringify(good));
    const big = JSON.stringify({ ...good, payload: { pad: "x".repeat(MAX_BODY + 10) } });
    await send(obs, "POST", INPUTS, big);
    expect(t.seen[1]!.body.length).toBe(Buffer.byteLength(big));
    const v = j3Verdict(obs.summary());
    expect(v).toMatchObject({ ok: false });
    expect(v.detail).toContain("for stor");
  });
  it("FEIL (lukket): avbrutt forespørsel midt i kroppen og videresendingsfeil (målet nede) gir FEIL", async () => {
    const { obs } = await observed();
    await send(obs, "POST", INPUTS, JSON.stringify(good));
    await new Promise<void>((resolve) => {
      const u = new URL(obs.url);
      const rq = http.request({ host: u.hostname, port: u.port, method: "POST", path: INPUTS, headers: { "content-type": "application/json", "content-length": "500" } });
      rq.on("error", () => resolve());
      rq.write('{"payload":'); setTimeout(() => rq.destroy(), 50);
      rq.on("close", () => setTimeout(resolve, 50));
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(j3Verdict(obs.summary()).ok).toBe(false);
    const down = await startRequestObserver({ target: "http://127.0.0.1:1" });
    closers.push(() => down.close());
    expect((await send(down, "POST", INPUTS, JSON.stringify(good))).status).toBe(502);
    expect(down.summary().errors).toBeGreaterThan(0);
    expect(j3Verdict(down.summary()).ok).toBe(false);
  });
});

describe("keysOfBody", () => {
  it("objekt, array (union), tom array; null for alt annet", () => {
    expect(keysOfBody(Buffer.from('{"b":1,"a":{"dealership_id":1}}'))).toEqual(["a", "b"]); // nøkler inne i verdier teller ikke (toppnivå)
    expect(keysOfBody(Buffer.from('[{"a":1},{"b":2}]'))).toEqual(["a", "b"]);
    expect(keysOfBody(Buffer.from("[]"))).toEqual([]);
    for (const bad of ["", "x", "1", "null", '"s"', "[[]]", "[null]", '{"A":1}', '{"a-b":1}']) expect(keysOfBody(Buffer.from(bad)), bad).toBeNull();
  });
});

describe("lokal binding og målvalidering", () => {
  it("lytter bare på 127.0.0.1", async () => {
    const { obs } = await observed();
    expect(new URL(obs.url).hostname).toBe("127.0.0.1");
  });
  it("avviser ikke-lokale, ikke-http, ugyldige og innloggings-mål FØR noe starter (ingen port åpnes), uten å skrive ut adressen", async () => {
    for (const bad of ["http://example.com:54321", "https://127.0.0.1:54321", "http://127.0.0.1.evil.example", "http://user:pw@127.0.0.1:54321", "http://127.0.0.1@evil.example", "ikke en url", "", undefined]) {
      const err = await startRequestObserver({ target: bad as unknown as string }).then(() => null, (e: Error) => e);
      expect(err, String(bad)).not.toBeNull();
      expect(err!.message).not.toMatch(/pw|evil\.example\/|example\.com:/);
    }
  });
});
