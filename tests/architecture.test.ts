/**
 * QA-001 / Gate G1 — arkitekturvakt: modulgrenser, provider-abstraksjon, Supabase kun på server og ingen live-påstander.
 * Statiske kontroller av importer og tekst i src/. Fanger regresjoner når senere oppgaver (DEV-005+) bygger videre.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
interface Src { path: string; rel: string; text: string; imports: { spec: string; typeOnly: boolean }[]; client: boolean }
const ALL: Src[] = files(SRC).map((path) => {
  const text = readFileSync(path, "utf8");
  const imports: Src["imports"] = [];
  for (const m of text.matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?["']([^"']+)["']/gm)) imports.push({ spec: m[2]!, typeOnly: Boolean(m[1]) });
  for (const m of text.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) imports.push({ spec: m[1]!, typeOnly: false });
  return { path, rel: relative(ROOT, path), text, imports, client: /^\s*["']use client["']/m.test(text) };
});
const under = (prefix: string) => ALL.filter((f) => f.rel.startsWith(`src/${prefix}`));

describe("modulgrenser", () => {
  it("domenelaget importerer ikke UI, provider, server, Supabase, React eller Next (CLAUDE.md pkt. 2)", () => {
    expect(under("domain/").length).toBeGreaterThanOrEqual(3);
    for (const f of under("domain/")) {
      for (const i of f.imports) {
        expect(i.spec.startsWith(".") || i.spec.startsWith("@/domain"), `${f.rel} → ${i.spec}`).toBe(true);
      }
    }
  });

  it("provider-laget kjenner ikke UI, server, Supabase eller formatering (ingen avgifts-/AI-logikk i providers)", () => {
    for (const f of under("providers/")) {
      for (const i of f.imports) {
        expect(i.spec, `${f.rel} → ${i.spec}`).not.toMatch(/^@\/(app|components|server|lib|demo)|^@supabase|^next|^react/);
      }
    }
  });

  it("UI og server bruker annonser bare via provider-kontrakten, ikke via den syntetiske implementasjonen", () => {
    for (const f of [...under("app/"), ...under("components/"), ...under("server/"), ...under("lib/")]) {
      for (const i of f.imports) expect(i.spec, `${f.rel} → ${i.spec}`).not.toMatch(/providers\/marketplace\/synthetic/);
    }
  });

  it("det finnes ingen live-provider og ingen mobile.de-adapter ennå (DEV-006 er blokkert)", () => {
    expect(existsSync(join(SRC, "providers/marketplace/mobile-de"))).toBe(false);
    expect(readdirSync(join(SRC, "providers/marketplace")).sort()).toEqual(["errors.ts", "index.ts", "synthetic", "types.ts"]);
    for (const f of ALL) {
      expect(f.text, f.rel).not.toMatch(/fetch\(\s*["'`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
      expect(f.text, f.rel).not.toMatch(/api\.mobile\.de|services\.mobile\.de|search-api\//);
    }
  });
});

describe("Supabase og hemmeligheter", () => {
  it("@supabase/* importeres bare fra src/lib/supabase og src/proxy.ts; aldri @supabase/supabase-js direkte", () => {
    for (const f of ALL) {
      for (const i of f.imports.filter((x) => x.spec.startsWith("@supabase/"))) {
        expect(f.rel.startsWith("src/lib/supabase/") || f.rel === "src/proxy.ts", `${f.rel} → ${i.spec}`).toBe(true);
        expect(i.spec, f.rel).toBe("@supabase/ssr");
      }
    }
  });

  it("klientkomponenter importerer ikke servermoduler, Supabase eller server-only (type-importer er ok)", () => {
    const clients = ALL.filter((f) => f.client);
    expect(clients.map((f) => f.rel).sort()).toEqual(["src/components/AgentForm.tsx", "src/components/RunButton.tsx", "src/components/SiteNav.tsx"]);
    for (const f of clients) {
      for (const i of f.imports.filter((x) => !x.typeOnly)) {
        expect(i.spec, `${f.rel} → ${i.spec}`).not.toMatch(/^@\/server|^@\/lib\/supabase|^@supabase|^server-only|^next\/headers|^pg$/);
      }
    }
  });

  it("serverkode som bruker Supabase-klienten eller cookies er merket server-only", () => {
    for (const f of [...under("server/"), ...under("lib/supabase/")]) {
      const usesServerApi = f.imports.some((i) => /^@\/lib\/supabase\/server$|^next\/headers$|^\.\/server$/.test(i.spec));
      if (usesServerApi) expect(f.text, f.rel).toMatch(/import\s+["']server-only["']/);
    }
  });

  it("bare fire miljøvariabler leses; den eneste hemmelige leses kun i den betrodde skriveveien", () => {
    const names = new Set<string>();
    for (const f of ALL) for (const m of f.text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) names.add(m[1]!);
    expect([...names].sort()).toEqual(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SCOUT_INGEST_DATABASE_URL", "SCOUT_SYNTHETIC_FAILURE"]);
    for (const f of ALL) expect(f.text, f.rel).not.toMatch(/service_role|sb_secret|SERVICE_ROLE/i);
    const readers = ALL.filter((f) => /SCOUT_INGEST_DATABASE_URL/.test(f.text)).map((f) => f.rel);
    expect(readers).toEqual(["src/server/trusted-ingest.ts"]);
  });

  it("databasedriveren pg importeres bare fra den betrodde skriveveien, som er server-only (DEC-029)", () => {
    for (const f of ALL) {
      const importsPg = f.imports.some((i) => i.spec === "pg" || i.spec.startsWith("pg/"));
      if (importsPg) expect(f.rel).toBe("src/server/trusted-ingest.ts");
    }
    const trusted = ALL.find((f) => f.rel === "src/server/trusted-ingest.ts")!;
    expect(trusted.text).toMatch(/import\s+["']server-only["']/);
    expect(trusted.client).toBe(false);
    // Bare server-moduler og tester importerer den betrodde veien; aldri komponenter eller sider direkte.
    for (const f of ALL.filter((x) => x.imports.some((i) => /trusted-ingest/.test(i.spec)))) {
      expect(f.rel.startsWith("src/server/"), f.rel).toBe(true);
    }
  });
});

describe("demo og påstander", () => {
  it("demo-banneret er i felles layout og sier at annonsene er syntetiske", () => {
    const layout = readFileSync(join(SRC, "app/layout.tsx"), "utf8");
    expect(layout).toMatch(/<DemoBanner\s*\/>/);
    expect(readFileSync(join(SRC, "components/DemoBanner.tsx"), "utf8")).toMatch(/syntetiske/);
  });

  it("ingen tekst i appen påstår live- eller mobile.de-data; alle omtaler er negasjoner", () => {
    for (const f of ALL.filter((x) => !x.rel.includes("/synthetic/fixtures/"))) {
      for (const line of f.text.split("\n")) {
        if (/mobile\.de/i.test(line) && /["'`>].*mobile\.de/i.test(line) && !/\/\/|^\s*\*|^\s*\/\*/.test(line)) {
          expect(line, `${f.rel}: ${line.trim()}`).toMatch(/ingen|ikke|IKKE/i);
        }
        if (/\blive\b/i.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) expect(line, `${f.rel}: ${line.trim()}`).toMatch(/ingen live|ikke koblet|Ikke live|ingen/i);
      }
    }
  });
});
