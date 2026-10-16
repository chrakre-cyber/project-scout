import { describe, expect, it } from "vitest";
import { LEGACY_ROUTES_FLAG, LEGACY_SOURCES, legacyRedirects, legacyRoutesEnabled } from "@/lib/legacy-routes";

/** Regelsettet bak `redirects()` i next.config.ts. Selve konfigurasjonen verifiseres mot en ekte bygging i scripts/qa-partner-mode.sh. */
describe("DEV-006G: eldre ruter er blokkert som standard", () => {
  it("bare nøyaktig «1» aktiverer; alt annet (manglende, tom, 0, true, mellomrom, store bokstaver) blokkerer", () => {
    expect(legacyRoutesEnabled("1")).toBe(true);
    for (const v of [undefined, "", "0", "true", "TRUE", "yes", " 1", "1 ", "11", "on"]) expect(legacyRoutesEnabled(v), String(v)).toBe(false);
  });

  it("blokkert: dashboard, agents (inkl. undersider) og opportunities (inkl. undersider) → /login, midlertidig", () => {
    for (const v of [undefined, "", "0", "true"]) {
      const r = legacyRedirects(v);
      expect(r.map((x) => x.source).sort()).toEqual([...LEGACY_SOURCES].sort());
      for (const x of r) { expect(x.destination).toBe("/login"); expect(x.permanent).toBe(false); }
    }
    expect(LEGACY_SOURCES).toEqual(["/dashboard", "/agents/:path*", "/opportunities/:path*"]);
  });

  it("aktivert: ingen omdirigeringer (eldre ruter åpne for intern utvikling)", () => {
    expect(legacyRedirects("1")).toEqual([]);
  });

  it("ingen kildemønster treffer innloggingen, søkeflyten eller roten", () => {
    for (const s of LEGACY_SOURCES) {
      const re = new RegExp("^" + s.replace("/:path*", "(?:/.*)?") + "$");
      for (const ok of ["/", "/login", "/searches", "/searches/abc/preview", "/dashboardx"]) expect(re.test(ok), `${s} ~ ${ok}`).toBe(false);
      expect(re.test(s.replace("/:path*", "")), s).toBe(true);
    }
  });

  it("flaggnavnet er det dokumenterte", () => {
    expect(LEGACY_ROUTES_FLAG).toBe("SCOUT_ENABLE_LEGACY_ROUTES");
  });
});
