"use server";

import { revalidatePath } from "next/cache";
import { DF_ERROR_SUMMARY, DF_OUTCOME_TEXT, DP_SAVED } from "@/lib/search-labels";
import { createDealerEconomicsStore } from "@/server/dealer-economics-store";
import { formValuesOf, submitDealerProfileForm } from "@/server/dealer-input-flow";
import { getSessionContext } from "@/server/session";
import { EMPTY_PROFILE_FORM_STATE, type DealerProfileFormState } from "./state";

/** Lagrer firmaets standarder. Firma kommer fra den validerte sesjonen (databasen avgjør); skjemaet kan ikke oppgi firma. Endrer aldri en bekreftet verdi for en annonse. */
export async function saveDealerProfileAction(_prev: DealerProfileFormState, form: FormData): Promise<DealerProfileFormState> {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") return { ...EMPTY_PROFILE_FORM_STATE, message: DF_OUTCOME_TEXT.not_logged_in };
  const values = formValuesOf(form);
  let out;
  try { out = await submitDealerProfileForm(createDealerEconomicsStore(ctx), values); } catch { return { ...EMPTY_PROFILE_FORM_STATE, values, message: DF_OUTCOME_TEXT.unavailable }; }
  if (out.ok) { revalidatePath("/searches"); return { ...EMPTY_PROFILE_FORM_STATE, values, message: DP_SAVED, saved: true }; }
  if (out.code === "field_errors") return { errors: out.errors, general: out.general, values, message: DF_ERROR_SUMMARY, saved: false };
  return { ...EMPTY_PROFILE_FORM_STATE, values, message: DF_OUTCOME_TEXT[out.code] };
}
