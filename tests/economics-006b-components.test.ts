/**
 * ECON-006b — skjemakomponenter (statisk markup; ikke nettleser): tilgjengelig struktur, ingen forhåndsvalgt bekreftelse, ingen forhåndsutfylling fra annonsen, lenker fra «hva mangler» treffer
 * faktiske felt, ingen positivt budsjettspråk i nye tekster. Rendering i nettleser/e2e hører til 006c.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/searches/[id]/preview/[listingId]/dealer-input/actions", () => ({ confirmDealerInputAction: vi.fn() }));
vi.mock("@/app/searches/economics-profile/actions", () => ({ saveDealerProfileAction: vi.fn() }));

import { DealerInputForm, type DealerInputFormProps } from "@/components/search/DealerInputForm";
import { DealerProfileForm } from "@/components/search/DealerProfileForm";
import { EconomicsNote } from "@/components/search/EconomicsNote";
import { dealerInputToFormValues, type EconomicsView, type FormErrorCode, type FormFieldKey } from "@/domain/search-economics";
import * as L from "@/lib/search-labels";
import { dealerInput } from "./fixtures/economics-005c";

const props = (over: Partial<DealerInputFormProps> = {}): DealerInputFormProps => ({
  searchId: "11111111-1111-4111-8111-111111111111", listingId: "m1_abcdefghijklmnopqrstuvwx", bindingMarker: "b1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  initial: {}, prefill: "none", lines: [{ id: "freight", kind: "transport", label: "Frakt", amountText: "12 000 kr", hasAmount: true }, { id: "ins", kind: "insurance", label: "Forsikring", amountText: "3 000 kr", hasAmount: true }],
  profile: { vatHandling: "ikke satt", deduction: "ikke satt" }, staleReasons: [], backHref: "/searches/x/preview/y?v=4", ...over,
});
const html = (p: DealerInputFormProps = props()) => renderToStaticMarkup(createElement(DealerInputForm, p));
const FORM = html();

describe("skjemastruktur og tilgjengelighet", () => {
  it("gruppert med fieldset/legend, og hvert felt har en etikett knyttet via for/id", () => {
    for (const g of ["propulsion", "taxWeight", "co2", "firstReg", "noReg", "customs", "foreignVat", "fxAcq", "fxCust", "costs", "scopes", "vat", "evidence", "confirm"]) expect(FORM, g).toContain(`id="f-${g}"`);
    expect((FORM.match(/<fieldset/g) ?? []).length).toBeGreaterThanOrEqual(14);
    expect((FORM.match(/<legend/g) ?? []).length).toBe((FORM.match(/<fieldset/g) ?? []).length);
    const controls = [...FORM.matchAll(/<(?:input|select)\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]!);
    expect(controls.length).toBeGreaterThan(40);
    for (const id of controls) expect(FORM, id).toMatch(new RegExp(`<label[^>]*for="${id}"`));
    expect(new Set(controls).size).toBe(controls.length);
  });
  it("skjulte felt: bare søk, offentlig (opak) annonse-id og opak konfliktmarkør — ingen kandidat-id, revisjon, versjonstall eller firma-id", () => {
    const hidden = [...FORM.matchAll(/<input type="hidden" name="([^"]+)"/g)].map((m) => m[1]!).sort();
    expect(hidden).toEqual(["bindingMarker", "listingId", "searchId"]);
    expect(FORM).not.toMatch(/candidateId|candidateVersion|draftVersion/);
    expect(FORM).not.toMatch(/name="(?:dealership|firm)/i);
  });
  it("bekreftelsen er en avkrysning som ALDRI er forhåndsvalgt (heller ikke ved forhåndsutfylling fra tidligere bekreftelse)", () => {
    for (const p of [props(), props({ initial: dealerInputToFormValues(dealerInput()), prefill: "current" }), props({ initial: { ...dealerInputToFormValues(dealerInput()), confirm: "yes" }, prefill: "previous_revision" })]) {
      const h = html(p);
      expect(h).toMatch(/<input type="checkbox"[^>]*name="confirm"[^>]*>/);
      expect(h.match(/<input type="checkbox"[^>]*name="confirm"[^>]*>/)![0]).not.toMatch(/checked/);
      expect(h).toContain(L.DF_CONFIRM_LABEL);
    }
  });
  it("tomt skjema forhåndsvelger ingenting: ingen tekstfelt har verdi og ingen valg er merket", () => {
    expect(FORM).not.toMatch(/<input[^>]*type="text"[^>]*value="[^"]+"/);
    expect(FORM).not.toMatch(/<option value="[^"]+" selected/); // bare «ikke oppgitt» (tom verdi) er valgt
    expect(FORM).not.toMatch(/checked/);
  });
  it("forhåndsutfylling viser verdiene og en tydelig merknad; foreldelse viser årsaker", () => {
    const h = html(props({ initial: dealerInputToFormValues(dealerInput()), prefill: "previous_revision", staleReasons: ["candidate_version_changed", "fx_expired"] }));
    expect(h).toContain('value="8000"');
    expect(h).toContain('data-testid="dealer-form-prefill"');
    expect(h).toContain(L.DF_PREFILL.previous_revision!);
    expect(h).toContain('data-testid="dealer-form-stale"');
    expect(h).toContain("annonsen er endret");
    expect(h).toContain("oppgitt kurs er utløpt");
    expect(FORM).not.toContain('data-testid="dealer-form-stale"');
  });
  it("annonsens egne påstander (ikke dokumentasjon) fylles aldri ut: komponenten får kun lagret input", () => {
    expect(FORM).not.toMatch(/Syntetisk|Testbil/);
  });
  it("omfangslinjer: transport kan fordeles bare når beløpet er kjent; forsikring har ikke fordeling", () => {
    expect(FORM).toContain('name="scope_freight"');
    expect(FORM).toContain('name="scopeTo_freight"');
    expect(FORM).toContain('name="scope_ins"');
    expect(FORM).not.toContain('name="scopeTo_ins"');
    const none = html(props({ lines: [{ id: "freight", kind: "transport", label: "Frakt", amountText: "ukjent beløp", hasAmount: false }] }));
    expect(none).not.toContain('name="scopeTo_freight"');
    expect(none).not.toContain('value="split"');
    expect(html(props({ lines: [] }))).toContain(L.DF_NO_SCOPE_LINES);
  });
  it("ingen skjemaverdi 'listing_claim' og ingen budsjettspråk i skjemaet", () => {
    expect(FORM).not.toContain("listing_claim");
    expect(FORM).not.toMatch(/innenfor budsjett|treff|godkjent kjøp|anbefal/i);
    expect(FORM).toContain(L.DF_NOT_VALIDATED);
  });
  it("profilvisningen er informasjon: viser firmaprofilens verdi uten å forhåndsvelge den", () => {
    const h = html(props({ profile: { vatHandling: "Mva.-registrert: rapporteres i mva.-melding", deduction: "Fradragsberettiget" } }));
    expect(h).toContain("Firmaprofilens standard: Fradragsberettiget");
    expect(h).not.toMatch(/<option value="[^"]+" selected/);
  });
});

describe("«hva mangler» lenker til faktiske felt", () => {
  const FIELDS = Object.keys(L.FIELD_LABEL) as FormFieldKey[];
  it("hvert felt som kan registreres peker til et anker som finnes i skjemaet", () => {
    for (const f of FIELDS) expect(FORM, `${f} → ${L.FIELD_ANCHOR[f]}`).toContain(`id="f-${L.FIELD_ANCHOR[f]}"`);
  });
  const explanation = (missing: Array<{ field: FormFieldKey; collectable: boolean }>): EconomicsView => ({
    status: "lower_bound", labelKey: "incomplete_lower_bound", cash: { kind: "lower_bound", minimumNok: "100", missing: [] }, landed: { kind: "lower_bound", minimumNok: "100", missing: [] },
    estimateReasons: [], incompleteReasons: [], lines: [], dealerInput: { state: "none" }, notes: [], positiveBudgetEligible: false,
    explanation: { breakdown: [], searchCosts: { rows: [], countedNok: "0", uncountedLines: 0 }, assumptions: { fx: [], customsAcceptance: { date: null, kind: "unknown" }, norwegianRegistration: { date: null, kind: null, defaulted: false }, vatRecoverability: { value: "unknown", source: null }, vatHandling: { value: "unknown", source: null }, rulesApprovedForValidation: false }, uncertainty: [], missing, coverage: { documented: 0, knownCostItems: 0 }, basisSummary: "dealer_stated", grossOutlayIsNotCashAtBorder: true },
  });
  const note = (e: EconomicsView, href?: string) => renderToStaticMarkup(createElement(EconomicsNote, { economics: e, dealerFormHref: href }));
  it("med skjema: registrerbare mangler får lenke; ikke-registrerbare får forklaring og ingen lenke", () => {
    const h = note(explanation([{ field: "transport_to_border", collectable: true }, { field: "ev_qualification", collectable: false }]), "/f?v=4");
    expect(h).toContain('href="/f?v=4#f-tb_amount"');
    expect(h).toContain(L.NOT_COLLECTABLE_TEXT);
    expect((h.match(/data-testid="economics-missing-link"/g) ?? []).length).toBe(1);
    expect(h).not.toContain('data-testid="economics-form-unavailable"');
    expect(h).toContain('data-testid="dealer-form-link"');
  });
  it("uten skjemalenke (utilgjengelig/kompakt): gammel «ikke tilgjengelig»-merknad, ingen lenke", () => {
    const h = note(explanation([{ field: "transport_to_border", collectable: true }]));
    expect(h).toContain('data-testid="economics-form-unavailable"');
    expect(h).not.toContain("dealer-form-link");
    const u = renderToStaticMarkup(createElement(EconomicsNote, { economics: { status: "unavailable", labelKey: "rights_not_granted", positiveBudgetEligible: false }, dealerFormHref: "/f" }));
    expect(u).not.toContain("/f");
  });
});

describe("firmaprofil-skjema", () => {
  const h = renderToStaticMarkup(createElement(DealerProfileForm, { initial: { p_vatHandling: "unknown", p_deduction: "" } }));
  it("to valgfelt med etiketter, ingen skjulte felt, ingen firma-id; standard tomt = ingen standard", () => {
    expect(h).toContain('name="p_vatHandling"');
    expect(h).toContain('name="p_deduction"');
    expect(h).not.toContain('type="hidden"');
    expect(h).not.toMatch(/name="(?:dealership|firm)/i);
    expect(h).toContain("Ingen standard (ukjent)");
    expect(h).toContain(L.DP_INTRO);
    for (const id of ["p_vatHandling", "p_deduction"]) expect(h).toMatch(new RegExp(`<label[^>]*for="${id}"`));
  });
});

describe("tekster", () => {
  it("alle skjemafeil har norsk tekst, og alle feltetiketter finnes", () => {
    const codes: FormErrorCode[] = ["required", "invalid_value", "invalid_amount", "invalid_integer", "invalid_date", "invalid_rate", "too_long", "split_mismatch", "choose_one", "must_be_empty"];
    for (const c of codes) expect(L.DF_FIELD_ERROR[c], c).toMatch(/\S/);
    const names = [...FORM.matchAll(/<(?:input|select)\b[^>]*\bname="([^"]+)"/g)].map((m) => m[1]!).filter((n) => !/^(searchId|listingId|bindingMarker|confirm|scope|evidence)/.test(n));
    for (const n of names) expect(L.DF_FIELD[n] ?? L.DF_CHARGE_AMOUNT, n).toBeTruthy();
  });
  it("ingen positivt budsjettspråk, ingen løfte om riktighet/godkjenning i nye skjematekster", () => {
    const texts = [L.DF_INTRO, L.DF_NOT_VALIDATED, L.DF_CONFIRM_LABEL, L.DF_SAVED, L.DP_INTRO, L.DP_SAVED, ...Object.values(L.DF_GROUP_HELP), ...Object.values(L.DF_OUTCOME_TEXT)];
    for (const t of texts) expect(t).not.toMatch(/innenfor budsjett|treff|anbefal|garanti|sikker|trygg|riktig(?! )|nøyaktig|pålitelig/i);
    expect(L.DF_INTRO).toMatch(/ikke oppgitt/);
    expect(L.DF_INTRO).toMatch(/aldri 0/);
    expect(L.DF_NOT_VALIDATED).toMatch(/et estimat\. Endelig kostnad må kontrolleres før kjøp/);
    expect(L.DF_NOT_VALIDATED).not.toMatch(/validert|godkjenner/);
  });
  it("sidene ligger bak sesjon og bruker bare serverlaget (statisk kontroll)", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/app/searches/[id]/preview/[listingId]/dealer-input/page.tsx", "src/app/searches/economics-profile/page.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).toMatch(/getSessionContext\(\)/);
      expect(s, f).toMatch(/ctx\.status !== "member"\) redirect/);
    }
    for (const f of ["src/app/searches/[id]/preview/[listingId]/dealer-input/actions.ts", "src/app/searches/economics-profile/actions.ts"]) {
      const s = readFileSync(f, "utf8");
      expect(s.startsWith('"use server"'), f).toBe(true);
      expect(s, f).toMatch(/getSessionContext\(\)/);
      expect(s, f).not.toMatch(/dealershipId|dealership_id|form\.get\(["']dealership/);
    }
  });
});
