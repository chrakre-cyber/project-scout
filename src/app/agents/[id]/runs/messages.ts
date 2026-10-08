import type { RunStartError } from "@/server/search-runs";

export const RUN_START_MESSAGES: Record<RunStartError, string> = {
  not_found: "Fant ikke agenten i ditt firma.",
  inactive: "Agenten er ikke aktiv. Aktiver den før du kjører søk.",
  not_ready: "Agenten oppfyller ikke lenger aktiveringskravene. Rett den og aktiver på nytt.",
  stale_agent: "Agenten er endret etter at siden ble lastet. Last siden på nytt og kjør søket igjen.",
  already_running: "Et søk for denne agenten pågår allerede.",
  invalid: "Forespørselen var ugyldig. Last siden på nytt.",
  rights_unavailable: "Kilden har ingen gyldig rettighetsprofil for lagring (mangler, utløpt eller trukket). Søket er stoppet.",
  unavailable: "Søk er midlertidig utilgjengelig fordi serveroppsettet for lagring av resultater mangler. Kontakt administrator.",
  failed: "Søket kunne ikke startes. Prøv igjen.",
};
