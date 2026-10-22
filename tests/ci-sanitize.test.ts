import { describe, expect, it } from "vitest";
import { hasLeak, sanitizeText } from "../scripts/ci/sanitize.mjs";

// Falske hemmeligheter bygges av deler, så hverken denne filen eller secret-skannet ser et ekte mønster i kildeteksten.
const jwt = ["ey", "JhbGciOiJIUzI1NiJ9", ".", "ey", "Jyb2xlIjoiYW5vbiJ9", ".", "c2lnbmF0dXJlMTIzNDU2"].join("");
const sbSecret = ["sb", "_secret_", "AbCdEfGh1234567890"].join("");
const sbPub = ["sb", "_publishable_", "AbCdEfGh1234567890"].join("");
const dbUrl = ["postgres", "ql://postgres:", "hunter2hunter2", "@127.0.0.1:54322/postgres"].join("");

describe("sanitizeText", () => {
  it.each([
    ["JWT", `token ${jwt} slutt`, jwt],
    ["sb_secret", `key=${sbSecret}`, sbSecret],
    ["sb_publishable", `Publishable key: ${sbPub}`, sbPub],
    ["DB-URL med passord", `Database URL: ${dbUrl}`, "hunter2hunter2"],
    ["navngitt nøkkel", ["SERVICE_ROLE", "_KEY=abcdef123456"].join(""), "abcdef123456"],
    ["JWT_SECRET med anførselstegn", 'JWT_SECRET="super-secret-value-123"', "super-secret-value-123"],
    ["Bearer", "Authorization: Bearer abc.def.ghi123", "abc.def.ghi123"],
    ["apikey-header", "apikey: someOpaqueValue12345", "someOpaqueValue12345"],
    ["passord", ["PGPASS", "WORD=topsecretvalue"].join(""), "topsecretvalue"],
    ["lang opak streng", `x ${"A1b2".repeat(15)} y`, "A1b2A1b2A1b2A1b2"],
    ["GitHub-token", ["gh", "p_", "a".repeat(30)].join(""), "a".repeat(30)],
  ])("fjerner %s", (_n, input, secret) => {
    const out = sanitizeText(input);
    expect(out).not.toContain(secret);
    expect(out).toContain("[REDACTED");
    expect(hasLeak(input)).toBe(true);
    expect(hasLeak(out)).toBe(false); // idempotent: sanert tekst gir ikke nye treff
  });

  it("fjerner eksakte verdier (literals) selv om de ikke ligner en kjent form", () => {
    const secret = "plain-odd-secret";
    expect(sanitizeText(`ok ${secret} ok`, [secret])).not.toContain(secret);
    expect(hasLeak(`ok ${secret}`, [secret])).toBe(true);
    expect(hasLeak("ok", [secret])).toBe(false);
  });

  it("lar vanlig rapporttekst være uendret", () => {
    const t = ["PASS  DEV-004-constraints finnes etter oppgradering", "- 12 migrasjoner anvendt", "image: public.ecr.aws/supabase/postgres:17.6.1.054", "FEIL tests/db/rls.test.ts: bruker B ser ikke A sine rader", "SECRET-SKANN: INGEN FUNN"].join("\n");
    expect(sanitizeText(t)).toBe(t);
    expect(hasLeak(t)).toBe(false);
  });

  it("avkorter svært lange linjer", () => {
    const out = sanitizeText("ord ".repeat(300));
    expect(out.length).toBeLessThan(450);
    expect(out).toContain("avkortet");
  });
});
