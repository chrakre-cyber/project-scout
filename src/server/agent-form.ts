/**
 * Tolker agentskjemaet (FormData) til et AgentDraft. Ren funksjon, ingen I/O.
 *
 * - Tomme felt blir null / tom liste («alle» for filtre, «ikke oppgitt» for
 *   forutsetninger). Ingenting blir 0 eller false av seg selv.
 * - Tall godtar norsk format (mellomrom som tusenskille, komma som desimal).
 * - Felt som ikke hører til skjemaet (firma-ID, active, version …) leses ikke.
 */
import { minorToDecimalString, parseDecimalToMinor } from "@/domain/currency";
import {
  BODY_TYPES, COUNTRY_CODES, FUELS, TRANSMISSIONS, validateDraft, type AgentDraft, type AgentField, type FieldErrors,
} from "@/domain/agent-validation";
import type { InclusionBasis, Money } from "@/domain/types";

export type FormValues = Record<string, string | string[]>;

export interface ParsedAgentForm {
  draft: AgentDraft | null;
  errors: FieldErrors;
  /** Råverdier for å fylle skjemaet igjen ved feil. */
  values: FormValues;
}

const SINGLE = [
  "name", "make", "model", "variant", "yearMin", "yearMax", "maxMileageKm", "maxPriceAmount", "maxPriceCurrency",
  "broadSearchConfirmed", "retailAmount", "retailVat", "retailRegistrationTaxes", "minimumContribution",
  "reserveAmount", "reserveVatBasis",
] as const;
const MULTI = ["fuels", "transmissions", "bodyTypes", "countryCodes"] as const;

export function parseAgentForm(form: FormData, now = new Date()): ParsedAgentForm {
  const values: FormValues = {};
  for (const k of SINGLE) values[k] = str(form.get(k));
  for (const k of MULTI) values[k] = form.getAll(k).filter((v): v is string => typeof v === "string");

  const errors: FieldErrors = {};
  const v = (k: (typeof SINGLE)[number]) => (values[k] as string).trim();
  const text = (k: "name" | "make" | "model" | "variant") => v(k) || null;

  const int = (k: "yearMin" | "yearMax" | "maxMileageKm"): number | null => {
    const raw = v(k).replace(/[\s ]/g, "");
    if (raw === "") return null;
    if (!/^\d{1,9}$/.test(raw)) {
      errors[k] = "Må være et heltall.";
      return null;
    }
    return Number(raw);
  };

  const money = (raw: string, field: AgentField, currency: string, allowZero: boolean): Money | null => {
    const s = raw.replace(/[\s ]/g, "").replace(",", ".");
    if (s === "") return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) {
      errors[field] = "Ugyldig beløp. Bruk tall med høyst to desimaler, f.eks. 399 900 eller 1 250,50.";
      return null;
    }
    if (allowZero && /^0+(\.0+)?$/.test(s)) return { amountMinor: 0, currency };
    const minor = parseDecimalToMinor(s, 2);
    if (minor === null) {
      errors[field] = /^0+(\.0+)?$/.test(s) ? "Beløpet må være større enn 0." : "Beløpet er for stort.";
      return null;
    }
    return { amountMinor: minor, currency };
  };

  const oneOf = <T extends string>(k: (typeof SINGLE)[number], allowed: readonly T[], field: AgentField): T | null => {
    const raw = v(k);
    if (raw === "") return null;
    if (!(allowed as readonly string[]).includes(raw)) {
      errors[field] = "Ugyldig valg.";
      return null;
    }
    return raw as T;
  };

  const make = text("make");
  const currency = v("maxPriceCurrency");
  let maxPrice: Money | null = null;
  if (v("maxPriceAmount") !== "") {
    if (currency === "") errors.maxPrice = "Velg valuta for maks annonsepris.";
    else maxPrice = money(v("maxPriceAmount"), "maxPrice", currency, false);
  }

  const draft: AgentDraft = {
    name: v("name"),
    filters: {
      make,
      model: text("model"),
      variant: text("variant"),
      yearMin: int("yearMin"),
      yearMax: int("yearMax"),
      maxMileageKm: int("maxMileageKm"),
      fuels: subset(values.fuels as string[], FUELS, "fuels", errors),
      transmissions: subset(values.transmissions as string[], TRANSMISSIONS, "transmissions", errors),
      bodyTypes: subset(values.bodyTypes as string[], BODY_TYPES, "bodyTypes", errors),
      countryCodes: subset(values.countryCodes as string[], COUNTRY_CODES, "countryCodes", errors),
      maxPrice,
    },
    // Bekreftelsen er bare meningsfull uten merke; ellers lagres den ikke.
    broadSearchConfirmed: make === null && ["on", "true"].includes(v("broadSearchConfirmed")),
    assumptions: {
      retail: {
        expectedRetailTotal: money(v("retailAmount"), "retailAmount", "NOK", false),
        priceBasis: {
          vat: oneOf<InclusionBasis>("retailVat", ["included", "excluded"], "retailVat"),
          registrationTaxes: oneOf<InclusionBasis>("retailRegistrationTaxes", ["included", "excluded"], "retailRegistrationTaxes"),
        },
      },
      minimumContribution: money(v("minimumContribution"), "minimumContribution", "NOK", false),
      preparationReserve: {
        amount: money(v("reserveAmount"), "reserveAmount", "NOK", true),
        vatBasis: oneOf<"ex_vat" | "incl_vat">("reserveVatBasis", ["ex_vat", "incl_vat"], "reserveVatBasis"),
      },
    },
  };

  // Domeneregler for verdier som ble tolket; tolkefeil har forrang per felt.
  for (const [k, msg] of Object.entries(validateDraft(draft, now)) as [AgentField, string][]) errors[k] ??= msg;
  return { draft: Object.keys(errors).length ? null : draft, errors, values };
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

function subset<T extends string>(raw: string[], allowed: readonly T[], field: AgentField, errors: FieldErrors): T[] {
  const unique = [...new Set(raw)];
  if (unique.some((x) => !(allowed as readonly string[]).includes(x))) {
    errors[field] = "Ugyldig valg.";
    return [];
  }
  return unique as T[];
}

/** Lagret agent → skjemaverdier (norsk format, ukjent = tomt felt). */
export function agentToFormValues(a: import("@/domain/types").SearchAgent): FormValues {
  const amount = (m: Money | null) => (m === null ? "" : minorToNb(m.amountMinor));
  const f = a.filters;
  const r = a.assumptions;
  return {
    name: a.name,
    make: f.make ?? "", model: f.model ?? "", variant: f.variant ?? "",
    yearMin: f.yearMin?.toString() ?? "", yearMax: f.yearMax?.toString() ?? "", maxMileageKm: f.maxMileageKm?.toString() ?? "",
    fuels: f.fuels, transmissions: f.transmissions, bodyTypes: f.bodyTypes, countryCodes: f.countryCodes,
    maxPriceAmount: amount(f.maxPrice), maxPriceCurrency: f.maxPrice?.currency ?? "",
    broadSearchConfirmed: a.broadSearchConfirmed ? "on" : "",
    retailAmount: amount(r.retail.expectedRetailTotal),
    retailVat: r.retail.priceBasis.vat ?? "", retailRegistrationTaxes: r.retail.priceBasis.registrationTaxes ?? "",
    minimumContribution: amount(r.minimumContribution),
    reserveAmount: amount(r.preparationReserve.amount), reserveVatBasis: r.preparationReserve.vatBasis ?? "",
  };
}

/** 39990000 → "399900", 125050 → "1250,50". Eksakt, uten flyttall. */
function minorToNb(minor: number): string {
  const s = minorToDecimalString(minor, 2);
  return s.endsWith(".00") ? s.slice(0, -3) : s.replace(".", ",");
}
