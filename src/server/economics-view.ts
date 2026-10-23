/**
 * ECON-005d — rettighetsgrensen for økonomivisning: `EconomicsAssessment` (server-internt, kan bære kjernens resultat) → `EconomicsView` (det eneste UI får).
 * Tre porter, alle fail-closed: (1) beregningsrett og visningsrett for avledet økonomi (allerede avgjort av `assessEconomics`; uten visning ingen tall), (2) den EFFEKTIVE
 * feltvisningspolicyen (`DisplayPolicy`, også når den er overstyrt): økonomien avslører annonseprisen, så den vises bare når prisen kan vises, (3) projeksjon til tekst-/kodemodell
 * uten kjernens interne felt. Ingenting her lagrer eller beregner; ren funksjon.
 */
import type { DisplayPolicy } from "@/domain/display-policy";
import { economicsDecision } from "@/domain/provider-rights";
import type { ResolvedRights } from "@/domain/provider-rights";
import { UNAVAILABLE_VIEW, dealerInputView, notCalculatedView, toEconomicsView } from "@/domain/search-economics";
import type { EconomicsView } from "@/domain/search-economics";
import type { EconomicsAssessment } from "./search-economics";

/** Når visningen ikke er koblet til forhandlerkontekst (ingen sesjon/søk): ikke beregnet, uten noe oppslag. */
export const NO_CONTEXT_VIEW: EconomicsView = Object.freeze(notCalculatedView(["no_dealer_context"])) as EconomicsView;

/**
 * Porten gjelder ALLE grener — også tidlige avslag («ikke beregnet») og manglende kontekst: uten rett til å vise avledet økonomi (og pris) er modellen alltid «unavailable»,
 * uten avslagsårsaker og uten status for forhandlerbekreftelse. Bare med visningsrett vises «Ikke beregnet» med årsaker.
 */
export function toDisplayEconomics(a: EconomicsAssessment, policy: DisplayPolicy, opts: { demoInputs?: boolean } = {}): EconomicsView {
  if (a.kind === "unavailable") return UNAVAILABLE_VIEW;
  // Porten mot feltvisning: avledet økonomi avslører prisen, så den følger visningsretten for pris også når policyen er overstyrt eller snevret inn.
  if (policy.allow.price !== true) return UNAVAILABLE_VIEW;
  if (a.kind === "not_calculated") {
    // Tidlige avslag bærer ekte rettighetsbeslutning (se `assessEconomics`): visningsrett for avledet økonomi kreves også her.
    if (a.rights.display !== true) return UNAVAILABLE_VIEW;
    return notCalculatedView([a.reason], dealerInputView(a.dealerInput));
  }
  // ECON-003-2: den kuraterte demoen bruker syntetiske demoforutsetninger — aldri merket som «bekreftet av forhandler». Gjelder bare et faktisk beregnet resultat.
  return toEconomicsView(a.display, opts.demoInputs === true ? { state: "demo_fixture" } : dealerInputView(a.dealerInput), a.notes, a.detail);
}

/**
 * Uten forhandlerkontekst: samme visningsgrense. Har kilden/brukeren ikke rett til å vise avledet økonomi (eller prisen skjules) ⇒ «unavailable»; ellers «ikke beregnet» med
 * årsaken «ingen forhandlerkontekst». En manglende kontekst omgår aldri rettighetsgrensen.
 */
export function toDisplayEconomicsWithoutContext(rights: ResolvedRights, policy: DisplayPolicy): EconomicsView {
  if (policy.allow.price !== true) return UNAVAILABLE_VIEW;
  if (!economicsDecision(rights, ["price"], ["price"]).display) return UNAVAILABLE_VIEW;
  return NO_CONTEXT_VIEW;
}
