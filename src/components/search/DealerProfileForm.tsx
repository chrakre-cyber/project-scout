"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { saveDealerProfileAction } from "@/app/searches/economics-profile/actions";
import { EMPTY_PROFILE_FORM_STATE, type DealerProfileFormState } from "@/app/searches/economics-profile/state";
import type { FormValues } from "@/domain/search-economics";
import { DF_OPTION, DP_INTRO, DP_SUBMIT } from "@/lib/search-labels";
import { ErrorSummary, Group, Select, entries } from "./DealerFormFields";

export function DealerProfileForm({ initial }: { initial: FormValues }) {
  const [state, action, pending] = useActionState<DealerProfileFormState, FormData>(saveDealerProfileAction, EMPTY_PROFILE_FORM_STATE);
  const [, startTransition] = useTransition();
  const values = state.values ?? initial;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.message && ref.current) ref.current.focus(); }, [state]);
  const labels: Record<string, string> = { p_vatHandling: "Mva.-håndtering ved import", p_deduction: "Fradragsstatus for import-mva." };
  return (
    <form action={action} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="space-y-5" noValidate data-testid="profile-form">
      <p className="text-sm" data-testid="profile-intro">{DP_INTRO}</p>
      <div ref={ref} tabIndex={-1} className="focus:outline-none">
        {state.saved
          ? <p role="status" className="rounded-lg border border-ok/40 bg-[#e5f0e8] p-3 text-sm text-ok" data-testid="profile-saved">{state.message}</p>
          : <ErrorSummary message={state.message} errors={state.errors} general={state.general} labelOf={(k) => labels[k] ?? "Felt"} />}
      </div>
      <Group id="profile" title="Standarder">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select name="p_vatHandling" label={labels.p_vatHandling} options={entries(DF_OPTION.vatHandling)} unset="Ingen standard (ukjent)" values={values} errors={state.errors} />
          <Select name="p_deduction" label={labels.p_deduction} options={entries(DF_OPTION.deduction)} unset="Ingen standard (ukjent)" values={values} errors={state.errors} />
        </div>
      </Group>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-forest px-5 py-2.5 font-semibold text-cream disabled:opacity-60" data-testid="profile-submit">{DP_SUBMIT}</button>
        <Link className="font-semibold text-rust underline" href="/searches">Tilbake til søkene</Link>
      </div>
    </form>
  );
}
