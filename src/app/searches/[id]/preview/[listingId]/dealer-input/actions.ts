"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PUBLIC_ID_PATTERN } from "@/domain/display-policy";
import { DF_ERROR_SUMMARY, DF_OUTCOME_TEXT } from "@/lib/search-labels";
import { createDealerEconomicsStore } from "@/server/dealer-economics-store";
import { formValuesOf, submitDealerInputForm } from "@/server/dealer-input-flow";
import { getDraft } from "@/server/search-drafts";
import { resolveDealerTarget } from "@/server/search-display";
import { getSessionContext } from "@/server/session";
import { EMPTY_DEALER_FORM_STATE, type DealerFormState } from "./state";

/**
 * Bekrefter forhandleropplysninger for (søk, annonse, revisjon). Firma leses ALDRI fra skjemaet: det kommer fra den validerte sesjonen og avgjøres av databasen (RLS). Søk, kandidat
 * og revisjon utledes av serveren på nytt fra utkastet og annonsen; skjemaets versjonsfelt brukes bare som konfliktkontroll. Ingenting lagres ved feil eller manglende bekreftelse.
 */
export async function confirmDealerInputAction(_prev: DealerFormState, form: FormData): Promise<DealerFormState> {
  const fail = (key: keyof typeof DF_OUTCOME_TEXT, extra: Partial<DealerFormState> = {}): DealerFormState => ({ ...EMPTY_DEALER_FORM_STATE, message: DF_OUTCOME_TEXT[key], ...extra });
  const ctx = await getSessionContext();
  if (ctx.status !== "member") return fail("not_logged_in");
  const values = formValuesOf(form);
  const echo = { ...values };
  delete echo.confirm;
  const listingId = values.listingId ?? "";
  if (!PUBLIC_ID_PATTERN.test(listingId)) return fail("not_found");
  let draft;
  try { draft = await getDraft(ctx, values.searchId ?? ""); } catch { return fail("unavailable", { values: echo }); }
  if (!draft || !draft.readable) return fail("not_found");
  let target;
  try { target = await resolveDealerTarget(draft.spec, listingId); } catch { return fail("unavailable", { values: echo }); }
  if (target.kind !== "ok") return fail("not_found");
  let out;
  try {
    out = await submitDealerInputForm({
      store: createDealerEconomicsStore(ctx), searchId: draft.id, spec: draft.spec, draftVersion: draft.version,
      target: { candidate: target.candidate, rights: target.rights, economicsStatus: target.item.economics.status }, form: values,
    });
  } catch { return fail("unavailable", { values: echo }); }
  if (out.ok) {
    revalidatePath(`/searches/${draft.id}/preview`);
    redirect(`/searches/${draft.id}/preview/${encodeURIComponent(listingId)}?v=${draft.version}&msg=econ_saved`);
  }
  if (out.code === "field_errors") return { errors: out.errors, general: out.general, values: echo, message: DF_ERROR_SUMMARY, stale: false };
  return fail(out.code, { values: echo, stale: out.code === "stale_page" });
}
