/**
 * QA-001 / Gate G1 — arkitekturvakt: modulgrenser, provider-abstraksjon, Supabase kun på server og ingen live-påstander.
 * Statiske kontroller av importer og tekst i src/. Fanger regresjoner når senere oppgaver (DEV-005+) bygger videre.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep, win32 } from "node:path";
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
  // Samme kontrollstier på Windows og POSIX; alle sikkerhetsreglene under bruker '/'.
  return { path, rel: relative(ROOT, path).split(sep).join("/"), text, imports, client: /^\s*["']use client["']/m.test(text) };
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
    expect(clients.map((f) => f.rel).sort()).toEqual(["src/components/AgentForm.tsx", "src/components/AppChrome.tsx", "src/components/RunButton.tsx", "src/components/SiteNav.tsx", "src/components/merovo/MerovoNav.tsx", "src/components/search/DealerInputForm.tsx", "src/components/search/DealerProfileForm.tsx", "src/components/search/SearchForm.tsx"]); // DEV-006D: AppChrome og MerovoNav er ren navigasjon (usePathname), uten server-/Supabase-import
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

  it("bare sju miljøvariabler leses; den eneste hemmelige leses kun i den betrodde skriveveien", () => {
    const names = new Set<string>();
    for (const f of ALL) for (const m of f.text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) names.add(m[1]!);
    expect([...names].sort()).toEqual(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SCOUT_ENABLE_LEGACY_ROUTES", "SCOUT_INGEST_DATABASE_URL", "SCOUT_PUBLIC_ID_KEY", "SCOUT_SYNTHETIC_EPOCH", "SCOUT_SYNTHETIC_FAILURE"]); // ECON-006e: SCOUT_SYNTHETIC_EPOCH (server-only, bare lest i synthetic/epoch.ts); DEV-006G: SCOUT_ENABLE_LEGACY_ROUTES (bare lest i rotlayouten); DATA-002C: SCOUT_PUBLIC_ID_KEY (server-only, bare lest i public-ids.ts)
    for (const f of ALL) expect(f.text, f.rel).not.toMatch(/service_role|sb_secret|SERVICE_ROLE/i);
    const epochReaders = ALL.filter((f) => /process\.env\.SCOUT_SYNTHETIC_EPOCH/.test(f.text)).map((f) => f.rel);
    expect(epochReaders).toEqual(["src/providers/marketplace/synthetic/epoch.ts"]);
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

describe("visningsrettigheter: rå leverandørannonser når ikke /searches-UI (DATA-002A)", () => {
  const UI = ALL.filter((f) => f.rel.startsWith("src/components/search/") || f.rel.startsWith("src/components/merovo/") || f.rel.startsWith("src/app/searches/"));
  const RAW_SPEC = /^@\/(providers\/|server\/search-preview$|adapters\/search-candidate)/;

  it("komponenter og sider i søkeflyten importerer ikke provider, rå forhåndsvisning eller kandidatadapter", () => {
    expect(UI.length).toBeGreaterThan(10);
    for (const f of UI) for (const i of f.imports) expect(i.spec, `${f.rel} → ${i.spec}`).not.toMatch(RAW_SPEC);
  });

  it("komponenter og sider i søkeflyten nevner aldri de rå typene eller funksjonene (også ikke som type)", () => {
    for (const f of UI) {
      const code = f.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const raw of ["NormalizedListing", "PreviewItem", "assessListing", "previewSearch", "getMarketplaceProvider", "MarketplaceProvider", "CandidateMeta", "CandidateV2"]) {
        expect(code, `${f.rel} bruker ${raw}`).not.toMatch(new RegExp(`\\b${raw}\\b`));
      }
      // felt som bare finnes på den rå annonsen (visningsmodellen har sellerType/sellerLocation/sourceUrl/listingDates/listingId)
      expect(code, `${f.rel} leser rå annonsefelt`).not.toMatch(/\b(listing|l)\.(originalUrl|sourceModifiedAt|seller|sourceListingId|provenance)\b/);
    }
  });

  it("bare søkeflatens servergrense (search-display) kjenner både provider og visningsmodell; den bruker applyDisplayPolicy", () => {
    const bridge = ALL.find((f) => f.rel === "src/server/search-display.ts")!;
    expect(bridge.text).toMatch(/applyDisplayPolicy\(/);
    expect(bridge.text).toMatch(/policyForSource/);
    // sidene henter data kun via grensen
    const pages = ALL.filter((f) => f.rel.startsWith("src/app/searches/") && /preview\/(\[listingId\]\/)?page\.tsx$/.test(f.rel));
    expect(pages.length).toBe(2);
    for (const p of pages) expect(p.imports.some((i) => i.spec === "@/server/search-display"), p.rel).toBe(true);
  });

  it("visningspolicyen er rent domene: ingen import av provider, UI, server eller React", () => {
    const d = ALL.find((f) => f.rel === "src/domain/display-policy.ts")!;
    for (const i of d.imports) expect(i.spec, i.spec).toMatch(/^\.\//);
    expect(d.text).not.toMatch(/process\.env|fetch\(|from "react"/);
  });

  it("resultatkortet kan ikke bygges av en rå annonse: komponentens props er DisplayItem", () => {
    const card = ALL.find((f) => f.rel === "src/components/search/ResultCard.tsx")!;
    expect(card.text).toMatch(/item: DisplayItem/);
    const facts = ALL.find((f) => f.rel === "src/components/search/ListingFacts.tsx")!;
    expect(facts.text).toMatch(/listing: DisplayableListing/);
  });
});

describe("én rettighetsmodell (DATA-002B)", () => {
  const rights = () => ALL.find((f) => f.rel === "src/domain/provider-rights.ts")!;
  it("provider-rights er rent domene og eneste sted som kjenner leverandørprofiler; display-policy kjenner ingen leverandør", () => {
    for (const i of rights().imports) expect(i.spec, i.spec).toMatch(/^\.\//);
    expect(rights().text).not.toMatch(/process\.env|fetch\(|from "react"/);
    const dp = ALL.find((f) => f.rel === "src/domain/display-policy.ts")!;
    expect(dp.text.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/synthetic-demo|mobile|SYNTHETIC_DISPLAY_POLICY/);
  });
  it("ingen kjøretidskode registrerer en ekte leverandørprofil (kun syntetisk); eksempelprofilen finnes bare i tester", () => {
    expect(rights().text).toMatch(/REGISTERED_PROFILES: readonly ProviderRightsProfile\[\] = Object\.freeze\(\[SYNTHETIC_RIGHTS_PROFILE\]\)/);
    for (const f of ALL) expect(f.text, f.rel).not.toMatch(/mobile-sandbox|mobile-live|providerId:\s*["']mobile/i);
  });
  it("visning og matching går begge via profilen i servergrensen, og matching fjernes før kandidatadapteren", () => {
    const bridge = ALL.find((f) => f.rel === "src/server/search-display.ts")!;
    expect(bridge.text).toMatch(/rightsForSource\(/);
    expect(bridge.text).toMatch(/restrictForMatching\(/);
    expect(bridge.text).toMatch(/matchingRights\(/);
    const preview = ALL.find((f) => f.rel === "src/server/search-preview.ts")!;
    expect(preview.text).toMatch(/prepare\(listing\)/);
  });
});

describe("proveniens og annonseidentitet (DATA-002C)", () => {
  const UI2 = ALL.filter((f) => f.rel.startsWith("src/components/search/") || f.rel.startsWith("src/components/merovo/") || f.rel.startsWith("src/app/searches/"));
  it("søkeflatens UI importerer verken proveniens eller id-/avtrykksmodulen, og nevner ikke interne provenienstyper", () => {
    for (const f of UI2) {
      for (const i of f.imports) expect(i.spec, `${f.rel} → ${i.spec}`).not.toMatch(/^@\/(domain\/provenance|server\/public-ids)$/);
      const code = f.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const t of ["InternalProvenance", "InternalItem", "previewInternal", "publicIdFor", "derivePublicId", "profileDigest", "providerListingId"]) {
        expect(code, `${f.rel} bruker ${t}`).not.toMatch(new RegExp(`\\b${t}\\b`));
      }
    }
  });
  it("proveniensmodulen er rent domene; nøkkelen leses bare i public-ids.ts; evaluering skjer i servergrensen", () => {
    const prov = ALL.find((f) => f.rel === "src/domain/provenance.ts")!;
    for (const i of prov.imports) expect(i.spec, i.spec).toMatch(/^\.\//);
    expect(prov.text).not.toMatch(/process\.env|node:crypto/);
    expect(ALL.filter((f) => /SCOUT_PUBLIC_ID_KEY/.test(f.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")) && /process\.env/.test(f.text)).map((f) => f.rel)).toEqual(["src/server/public-ids.ts"]);
    const bridge = ALL.find((f) => f.rel === "src/server/search-display.ts")!;
    expect(bridge.text).toMatch(/evaluateProvenance\(/);
    expect(bridge.text).toMatch(/buildProvenance\(/);
  });
  it("resultat-URL-er og detaljsiden bruker kun den opake id-en (PUBLIC_ID_PATTERN), aldri leverandørens id", () => {
    const detail = ALL.find((f) => f.rel === "src/app/searches/[id]/preview/[listingId]/page.tsx")!;
    expect(detail.text).toMatch(/PUBLIC_ID_PATTERN\.test\(/);
    expect(detail.text).not.toMatch(/SAFE_ID/);
    const card = ALL.find((f) => f.rel === "src/components/search/ResultCard.tsx")!;
    expect(card.text).toMatch(/l\.listingId/);
    expect(card.text).not.toMatch(/sourceListingId/);
  });
});

describe("stinormalisering (Windows-rettelse bevart, SYNC-001)", () => {
  it("kontrollstiene bruker alltid '/': win32-stier normaliseres slik at sikkerhetsreglene treffer (inspisert uten Windows-kjøring)", () => {
    const rel = win32.relative("C:\\proj", "C:\\proj\\src\\domain\\search-v2\\types.ts");
    expect(rel).toBe("src\\domain\\search-v2\\types.ts");
    expect(rel.split(win32.sep).join("/")).toBe("src/domain/search-v2/types.ts");
    expect(rel.startsWith("src/domain/")).toBe(false); // uten normalisering ville domeneregelen stille hoppet over filen
  });

  it("sikkerhetsreglene gjennomgår faktisk domenefilene, inkludert søkemodell v1", () => {
    const domain = under("domain/").map((f) => f.rel);
    for (const f of ["src/domain/matching.ts", "src/domain/search-v2/types.ts", "src/domain/search-v2/validation.ts", "src/domain/search-v2/budget.ts", "src/domain/search-v2/serialization.ts"]) {
      expect(domain, f).toContain(f);
    }
    expect(ALL.every((f) => !f.rel.includes("\\"))).toBe(true);
  });
});
