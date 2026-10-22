import type { FieldErrors, FormValues } from "@/domain/search-economics";

/** Tilstand for forhandlerskjemaet etter en innsending (serialiserbar; ingen avledede tall). */
export interface DealerFormState {
  errors: FieldErrors;
  general: string[];
  /** Brukerens verdier (uten bekreftelsen: den må gis på nytt). */
  values: FormValues | null;
  message: string | null;
  /** true når siden var utdatert (annonse/søk endret): skjemaet må åpnes på nytt. */
  stale: boolean;
}
export const EMPTY_DEALER_FORM_STATE: DealerFormState = { errors: {}, general: [], values: null, message: null, stale: false };
