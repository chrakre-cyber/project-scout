/** QA-001-FIX F3: query-parametre som peker på objektprototyper skal aldri gi en melding eller et unntak. */
import { describe, expect, it } from "vitest";
import { AGENT_MESSAGES, SUCCESS_MESSAGES, lookupMessage } from "@/app/agents/messages";

describe("lookupMessage", () => {
  it("returnerer meldingen for eksplisitt tillatte nøkler", () => {
    expect(lookupMessage(AGENT_MESSAGES, "active_limit")).toMatch(/Maks 10 aktive/);
    expect(lookupMessage(SUCCESS_MESSAGES, "saved")).toBe("Agenten er lagret.");
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf", "isPrototypeOf", "prototype", "__defineGetter__", "", "ukjent", "SAVED"])(
    "ukjent eller arvet nøkkel «%s» gir null (trygg fallback), aldri funksjon eller objekt",
    (key) => {
      expect(lookupMessage(AGENT_MESSAGES, key)).toBeNull();
      expect(lookupMessage(SUCCESS_MESSAGES, key)).toBeNull();
    },
  );

  it("manglende parameter gir null", () => {
    expect(lookupMessage(AGENT_MESSAGES, undefined)).toBeNull();
  });

  it("alle returnerte meldinger er strenger, slik at React kan vise dem", () => {
    for (const table of [AGENT_MESSAGES, SUCCESS_MESSAGES]) for (const k of Object.keys(table)) expect(typeof lookupMessage(table, k)).toBe("string");
  });
});
