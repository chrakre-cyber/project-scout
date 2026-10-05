/**
 * 10 representative SYNTETISKE agentoppsett (TEST_PLAN «Syntetisk mock: … 10
 * ulike agentoppsett»). Brukes av enhetstester (validering/aktivering, mapping
 * mot syntetisk provider) og DB-tester (samme regler i databasen).
 * Ingen ekte kundedata.
 */
export interface AgentSetup {
  id: string;
  title: string;
  form: Record<string, string | string[]>;
  /** Forventet: gyldig utkast (kan lagres). */
  valid: boolean;
  /** Forventet: kan aktiveres (bare relevant når valid). */
  ready: boolean;
  /** Felt som skal ha feil når ugyldig. */
  errorFields?: string[];
  /** Tekstbiter som skal finnes i aktiveringshindringene. */
  issueContains?: string[];
}

const ECONOMY = {
  retailAmount: "399 900", retailVat: "included", retailRegistrationTaxes: "included",
  minimumContribution: "30 000", reserveAmount: "15 000", reserveVatBasis: "ex_vat",
};

export const AGENT_SETUPS: AgentSetup[] = [
  {
    id: "S01", title: "Smalt søk: merke, modell, variant og alle filtre",
    form: {
      name: "Golf Variant automat", make: "Volkswagen", model: "Golf", variant: "Variant", yearMin: "2020", yearMax: "2024",
      maxMileageKm: "100 000", fuels: ["petrol", "hybrid"], transmissions: ["automatic"], bodyTypes: ["estate"],
      countryCodes: ["DE", "AT"], maxPriceAmount: "35 000", maxPriceCurrency: "EUR", ...ECONOMY,
    },
    valid: true, ready: true,
  },
  {
    id: "S02", title: "Bare merke (modell = alle)",
    form: { name: "Alle BMW", make: "BMW", ...ECONOMY },
    valid: true, ready: true,
  },
  {
    id: "S03", title: "Avklart bredt søk: uten merke, bekreftet, SUV + elbil + DE",
    form: { name: "Elektrisk SUV", broadSearchConfirmed: "on", bodyTypes: ["suv"], fuels: ["electric"], countryCodes: ["DE"], ...ECONOMY },
    valid: true, ready: true,
  },
  {
    id: "S04", title: "Bredt søk uten bekreftelse",
    form: { name: "SUV uten merke", bodyTypes: ["suv"], ...ECONOMY },
    valid: true, ready: false, issueContains: ["bekreft uttrykkelig"],
  },
  {
    id: "S05", title: "Bekreftet, men helt åpent («alle» på alt)",
    form: { name: "Alt", broadSearchConfirmed: "on", ...ECONOMY },
    valid: true, ready: false, issueContains: ["minst ett annet kriterium"],
  },
  {
    id: "S06", title: "Grenseverdier: samme år, 1 km, 0,01 i pris og bidrag, reserve 0 kr",
    form: {
      name: "Grenser", make: "Toyota", yearMin: "2024", yearMax: "2024", maxMileageKm: "1",
      maxPriceAmount: "0,01", maxPriceCurrency: "EUR", retailAmount: "0,01", retailVat: "excluded",
      retailRegistrationTaxes: "excluded", minimumContribution: "0,01", reserveAmount: "0", reserveVatBasis: "incl_vat",
    },
    valid: true, ready: true,
  },
  {
    id: "S07", title: "Største trygge beløp (2^53-1 øre)",
    form: { name: "Stort beløp", make: "Porsche", ...ECONOMY, retailAmount: "90 071 992 547 409,91" },
    valid: true, ready: true,
  },
  {
    id: "S08", title: "Ukjente forutsetninger: filtre ok, prisgrunnlag og reserve ikke oppgitt",
    form: { name: "Toyota utkast", make: "Toyota", model: "RAV4", retailAmount: "529 900", minimumContribution: "40 000" },
    valid: true, ready: false,
    issueContains: ["inkluderer mva", "registreringsavgifter", "Klargjøringsreserve", "mva.-basis"],
  },
  {
    id: "S09", title: "Pris i annen støttet valuta (CHF), retail ekskl. registreringsavgifter",
    form: {
      name: "911 fra Sveits", make: "Porsche", model: "911", maxPriceAmount: "120 000", maxPriceCurrency: "CHF",
      ...ECONOMY, retailRegistrationTaxes: "excluded", countryCodes: ["CH"],
    },
    valid: true, ready: true,
  },
  {
    id: "S10", title: "Ugyldig input: år snudd, modell uten merke, 0 km, 0 kr bidrag, USD, ukjent drivstoff",
    form: {
      name: "Ugyldig", model: "Golf", yearMin: "2024", yearMax: "2020", maxMileageKm: "0", fuels: ["rocket"],
      maxPriceAmount: "30 000", maxPriceCurrency: "USD", retailAmount: "1,234", minimumContribution: "0",
    },
    valid: false, ready: false,
    errorFields: ["model", "yearMax", "maxMileageKm", "fuels", "maxPrice", "retailAmount", "minimumContribution"],
  },
];

export function toFormData(fields: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}
