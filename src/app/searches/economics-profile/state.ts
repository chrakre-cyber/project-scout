import type { FieldErrors, FormValues } from "@/domain/search-economics";

export interface DealerProfileFormState { errors: FieldErrors; general: string[]; values: FormValues | null; message: string | null; saved: boolean }
export const EMPTY_PROFILE_FORM_STATE: DealerProfileFormState = { errors: {}, general: [], values: null, message: null, saved: false };
