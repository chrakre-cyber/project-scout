"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { parseSearchForm } from "@/server/search-form";
import type { FormErrors, FormValues } from "@/server/search-form";
import { createDraft, updateDraft } from "@/server/search-drafts";
import { getSessionContext } from "@/server/session";
import { DRAFT_MESSAGES } from "./messages";

export interface SearchFormState {
  errors: FormErrors;
  general: string[];
  values: FormValues | null;
  message: string | null;
  /** true når lagringen ble avvist fordi søket er endret av noen andre (skjemaet beholdes). */
  conflict: boolean;
}

const EMPTY: SearchFormState = { errors: {}, general: [], values: null, message: null, conflict: false };

/**
 * Lagrer et nytt eller eksisterende søkeutkast. Firma, aktiv-status, versjon og tidspunkter leses ALDRI fra skjemaet:
 * firma utledes fra validert sesjon/membership (og settes av databasen). Skjemaet oppgir bare id og forventet versjon
 * (konfliktsjekk, ikke autorisasjon). Hele søket valideres her mot katalogen før lagring.
 */
export async function saveSearchAction(_prev: SearchFormState, form: FormData): Promise<SearchFormState> {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") return { ...EMPTY, message: "Du må være innlogget og knyttet til et firma for å lagre søk." };

  const parsed = parseSearchForm(form, DEMO_CATALOG);
  if (!parsed.ok || !parsed.name || !parsed.json) {
    return { errors: parsed.errors, general: parsed.general, values: parsed.values, message: "Søket ble ikke lagret. Rett feltene som er merket.", conflict: false };
  }

  const id = typeof form.get("id") === "string" ? String(form.get("id")) : "";
  const version = Number(form.get("expectedVersion"));
  const result = id
    ? await updateDraft(ctx, id, Number.isSafeInteger(version) ? version : -1, parsed.name, parsed.json)
    : await createDraft(ctx, parsed.name, parsed.json);
  if (!result.ok) {
    return { errors: {}, general: [], values: parsed.values, message: DRAFT_MESSAGES[result.code], conflict: result.code === "conflict" };
  }
  revalidatePath("/searches");
  redirect(`/searches/${result.draft.id}?msg=${id ? "saved" : "created"}`);
}
