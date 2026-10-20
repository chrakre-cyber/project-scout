/**
 * ECON-005d — rettighetsgrensen for økonomivisning: `EconomicsAssessment` (server-internt, kan bære kjernens resultat) → `EconomicsView` (det eneste UI får).
 * Tre porter, alle fail-closed: (1) beregningsrett og visningsrett for avledet økonomi (allerede avgjort av `assessEconomics`; uten visning ingen tall), (2) den EFFEKTIVE
 * feltvisningspolicyen (`DisplayPolicy`, også når den er overstyrt): økonomien avslører annonseprisen, så den vises bare når prisen kan vises, (3) projeksjon til tekst-/kodemodell
 * uten kjernens interne felt. Ingenting her lagrer eller beregner; ren funksjon.
 */
import type { DisplayPolicy } from "@/domain/display-policy";
import { UNAVAILABLE_VIEW, dealerInputView, notCalculatedView, toEconomicsView } from "@/domain/search-economics";
import type { EconomicsView } from "@/domain/search-economics";
import type { EconomicsAssessment } from "./search-economics";

/** Når visningen ikke er koblet til forhandlerkontekst (ingen sesjon/søk): ikke beregnet, uten noe oppslag. */
export const NO_CONTEXT_VIEW: EconomicsView = Object.freeze(notCalculatedView(["no_dealer_context"])) as EconomicsView;

export function toDisplayEconomics(a: EconomicsAssessment, policy: DisplayPolicy): EconomicsView {
  if (a.kind === "unavailable") return UNAVAILABLE_VIEW;
  // Porten mot feltvisning: avledet økonomi avslører prisen, så den følger visningsretten for pris også når policyen er overstyrt eller snevret inn.
  if (policy.allow.price !== true) return UNAVAILABLE_VIEW;
  if (a.kind === "not_calculated") return notCalculatedView([a.reason], dealerInputView(a.dealerInput));
  return toEconomicsView(a.display, dealerInputView(a.dealerInput), a.notes);
}
