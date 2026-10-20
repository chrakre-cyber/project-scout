"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { confirmDealerInputAction } from "@/app/searches/[id]/preview/[listingId]/dealer-input/actions";
import { EMPTY_DEALER_FORM_STATE, type DealerFormState } from "@/app/searches/[id]/preview/[listingId]/dealer-input/state";
import type { FormValues } from "@/domain/search-economics";
import {
  DF_CHARGE_AMOUNT, DF_CHARGE_NOTE, DF_CONFIRM_LABEL, DF_GROUP, DF_GROUP_HELP, DF_INTRO, DF_NOT_VALIDATED, DF_NO_SCOPE_LINES, DF_OPTION, DF_PREFILL, DF_SPLIT_AFTER, DF_SPLIT_TO, DF_SUBMIT, DF_CANCEL,
  DF_LINE_AMOUNT, DF_PROFILE_NOW, STALE_REASON_TEXT, CURRENCIES,
} from "@/lib/search-labels";
import { ErrorSummary, Group, Select, Text, entries, errorText, fieldLabel } from "./DealerFormFields";

export interface DealerFormLine { id: string; kind: "transport" | "insurance"; label: string; amountText: string; hasAmount: boolean }
export interface DealerInputFormProps {
  searchId: string; listingId: string;
  /** Opak, integritetsbeskyttet konfliktmarkør (serverutstedt). Klienten får aldri rå kandidat-id, leverandørens annonse-id eller revisjon. */
  bindingMarker: string;
  initial: FormValues; prefill: "current" | "previous_revision" | "none"; lines: DealerFormLine[];
  /** Firmaprofilens standarder som tekst (til informasjon; forhåndsvelger ingenting). */
  profile: { vatHandling: string; deduction: string };
  staleReasons: string[]; backHref: string;
}

const PAIRS = CURRENCIES.filter((c) => c !== "NOK").map((c) => [`${c}/NOK`, `${c}/NOK`] as const);
const YN = [["yes", DF_OPTION.yes], ["no", DF_OPTION.no]] as const;

export function DealerInputForm(p: DealerInputFormProps) {
  const [state, action, pending] = useActionState<DealerFormState, FormData>(confirmDealerInputAction, EMPTY_DEALER_FORM_STATE);
  const [, startTransition] = useTransition();
  const values: FormValues = state.values ?? p.initial;
  const errors = state.errors;
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if ((state.message || Object.keys(state.errors).length) && summaryRef.current) summaryRef.current.focus(); }, [state]);
  const labelOf = (k: string) => (k === "confirm" ? DF_GROUP.confirm : /^scope(To|After)?_/.test(k) ? "Kostnadslinje" : fieldLabel(k));
  const prefillText = state.values ? null : DF_PREFILL[p.prefill];
  const t = { values, errors };

  return (
    // Samme mønster som søkeskjemaet: manuell innsending, slik at React ikke nullstiller feltene etter en avvist lagring (brukerens tekst går ikke tapt).
    <form action={action} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="space-y-5" noValidate data-testid="dealer-form">
      <input type="hidden" name="searchId" value={p.searchId} />
      <input type="hidden" name="listingId" value={p.listingId} />
      <input type="hidden" name="bindingMarker" value={p.bindingMarker} />

      <p className="text-sm" data-testid="dealer-form-intro">{DF_INTRO}</p>
      <p className="text-sm text-muted">{DF_NOT_VALIDATED}</p>
      {prefillText && <p role="status" className="rounded-lg border border-sand bg-sand-soft p-3 text-sm" data-testid="dealer-form-prefill" data-prefill={p.prefill}>{prefillText}</p>}
      {p.staleReasons.length > 0 && (
        <p role="status" className="rounded-lg border border-sand bg-sand-soft p-3 text-sm" data-testid="dealer-form-stale">
          Forrige bekreftelse brukes ikke fordi {p.staleReasons.map((r) => STALE_REASON_TEXT[r] ?? "forutsetningene er endret").join(", ")}. Gjennomgå og bekreft på nytt.
        </p>
      )}
      <div ref={summaryRef} tabIndex={-1} className="focus:outline-none">
        <ErrorSummary message={state.message} errors={errors} general={state.general} labelOf={labelOf} />
        {state.stale && <p className="mt-2 text-sm"><Link className="font-semibold text-rust underline" href={p.backHref}>Åpne annonsen på nytt</Link></p>}
      </div>

      <Group id="propulsion" title={DF_GROUP.propulsion} help={DF_GROUP_HELP.propulsion}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select name="prop_piston" options={YN} unset={DF_OPTION.unknown} {...t} />
          <Select name="prop_chargeable" options={YN} unset={DF_OPTION.unknown} {...t} />
          <Select name="prop_fuel" options={entries(DF_OPTION.fuel)} unset={DF_OPTION.unknown} {...t} />
          <Select name="prop_hybrid" options={entries(DF_OPTION.hybrid)} unset={DF_OPTION.unknown} {...t} />
          <Select name="prop_basis" options={entries(DF_OPTION.basis)} unset="Velg grunnlag" {...t} />
        </div>
      </Group>
      <Group id="taxWeight" title={DF_GROUP.taxWeight} help={DF_GROUP_HELP.taxWeight}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text name="tw_kg" inputMode="numeric" placeholder="for eksempel 1976" {...t} />
          <Select name="tw_basis" options={entries(DF_OPTION.weightBasis)} unset="Velg grunnlag" {...t} />
        </div>
      </Group>
      <Group id="co2" title={DF_GROUP.co2}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text name="co2_g" inputMode="numeric" placeholder="for eksempel 179" {...t} />
          <Select name="co2_method" options={entries(DF_OPTION.co2)} unset="Velg metode" {...t} />
        </div>
      </Group>
      <Group id="firstReg" title={DF_GROUP.firstReg} help={DF_GROUP_HELP.firstReg}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select name="fr_precision" options={entries(DF_OPTION.precision)} unset="Velg presisjon" {...t} />
          <Text name="fr_value" placeholder="2023-11" {...t} />
          <Select name="fr_basis" options={entries(DF_OPTION.basis)} unset="Velg grunnlag" {...t} />
        </div>
      </Group>
      <Group id="noReg" title={DF_GROUP.noReg} help={DF_GROUP_HELP.noReg}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text name="nr_date" placeholder="ÅÅÅÅ-MM-DD" {...t} />
          <Select name="nr_kind" options={entries(DF_OPTION.regKind)} unset="Velg" {...t} />
        </div>
      </Group>
      <Group id="customs" title={DF_GROUP.customs} help={DF_GROUP_HELP.customs}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select name="cd_kind" options={entries(DF_OPTION.customsKind)} unset="Velg" {...t} />
          <Text name="cd_date" placeholder="ÅÅÅÅ-MM-DD" {...t} />
        </div>
      </Group>
      <Group id="foreignVat" title={DF_GROUP.foreignVat} help={DF_GROUP_HELP.foreignVat}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select name="fv_treatment" options={entries(DF_OPTION.foreignVat)} unset="Velg" {...t} />
          <Select name="fv_evidence" options={entries(DF_OPTION.foreignVatEvidence)} unset="Velg dokumentasjon" {...t} />
        </div>
      </Group>
      <Group id="fxAcq" title={DF_GROUP.fxAcq} help={DF_GROUP_HELP.fxAcq}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select name="fxA_pair" options={PAIRS} unset="Velg valutapar" {...t} />
          <Text name="fxA_rate" inputMode="decimal" placeholder="10,6709" {...t} />
          <Text name="fxA_source" maxLength={100} {...t} />
          <Text name="fxA_quotedAt" placeholder="ÅÅÅÅ-MM-DD" {...t} />
          <Text name="fxA_effectiveAt" placeholder="ÅÅÅÅ-MM-DD" {...t} />
          <Text name="fxA_validUntil" placeholder="ÅÅÅÅ-MM-DD" {...t} />
        </div>
      </Group>
      <Group id="fxCust" title={DF_GROUP.fxCust} help={DF_GROUP_HELP.fxCust}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select name="fxC_pair" options={PAIRS} unset="Velg valutapar" {...t} />
          <Text name="fxC_rate" inputMode="decimal" placeholder="10,6709" {...t} />
          <Text name="fxC_source" maxLength={100} {...t} />
          <Text name="fxC_quotedAt" placeholder="ÅÅÅÅ-MM-DD" {...t} />
          <Text name="fxC_effectiveAt" placeholder="ÅÅÅÅ-MM-DD" {...t} />
          <Text name="fxC_validFrom" placeholder="ÅÅÅÅ-MM-DD" {...t} />
          <Text name="fxC_validTo" placeholder="ÅÅÅÅ-MM-DD" {...t} />
        </div>
      </Group>
      <Group id="costs" title={DF_GROUP.costs} help={DF_GROUP_HELP.costs}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text name="tb_amount" inputMode="decimal" placeholder="for eksempel 8000" {...t} />
          <Text name="ins_amount" inputMode="decimal" placeholder="for eksempel 0" {...t} />
        </div>
        {([["ta", "transportAfterBorder"], ["lh", "loadingHandling"], ["cg", "climateGas"], ["rf", "registrationFee"]] as const).map(([k]) => (
          <div key={k} id={`f-${k === "ta" ? "transportAfterBorder" : k === "lh" ? "loadingHandling" : k}`} className="grid gap-4 border-t border-sand pt-3 sm:grid-cols-3">
            <Select name={`${k}_mode`} options={entries(DF_OPTION.chargeMode)} {...t} />
            <Text name={`${k}_amount`} label={DF_CHARGE_AMOUNT} inputMode="decimal" {...t} />
            <Text name={`${k}_note`} label={DF_CHARGE_NOTE} maxLength={100} {...t} />
          </div>
        ))}
      </Group>
      <Group id="scopes" title={DF_GROUP.scopes} help={DF_GROUP_HELP.scopes}>
        {p.lines.length === 0 && <p className="text-sm text-muted">{DF_NO_SCOPE_LINES}</p>}
        {p.lines.map((l) => (
          <div key={l.id} className="grid gap-4 border-t border-sand pt-3 first:border-0 first:pt-0 sm:grid-cols-3" data-line={l.id}>
            <Select name={`scope_${l.id}`} label={`${l.label} — ${DF_LINE_AMOUNT}: ${l.amountText}`}
              options={l.kind === "transport" ? [["to_border", DF_OPTION.scope.to_border], ["after_border", DF_OPTION.scope.after_border], ...(l.hasAmount ? [["split", DF_OPTION.scope.split] as const] : [])] : [["to_border", DF_OPTION.scope.to_border], ["other", DF_OPTION.scope.other]]}
              unset={DF_OPTION.scope.unconfirmed} {...t} />
            {l.kind === "transport" && l.hasAmount && <>
              <Text name={`scopeTo_${l.id}`} label={DF_SPLIT_TO} inputMode="decimal" {...t} />
              <Text name={`scopeAfter_${l.id}`} label={DF_SPLIT_AFTER} inputMode="decimal" {...t} />
            </>}
          </div>
        ))}
      </Group>
      <Group id="vat" title={DF_GROUP.vat} help={DF_GROUP_HELP.vat}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Select name="vatHandling" options={entries(DF_OPTION.vatHandling)} unset="Ikke satt for denne annonsen" {...t} /><p className="mt-1 text-xs text-muted">{DF_PROFILE_NOW}: {p.profile.vatHandling}</p></div>
          <div><Select name="deduction" options={entries(DF_OPTION.deduction)} unset="Ikke satt for denne annonsen" {...t} /><p className="mt-1 text-xs text-muted">{DF_PROFILE_NOW}: {p.profile.deduction}</p></div>
        </div>
      </Group>
      <Group id="evidence" title={DF_GROUP.evidence}>
        <Text name="evidenceRef" maxLength={200} {...t} />
      </Group>

      <Group id="confirm" title={DF_GROUP.confirm}>
        <div id="f-confirm">
          <label className="flex min-h-11 items-start gap-3 text-sm font-semibold">
            <input type="checkbox" name="confirm" value="yes" className="mt-1 h-5 w-5" aria-invalid={errors.confirm ? true : undefined} aria-describedby={errors.confirm ? "e-confirm" : undefined} data-testid="confirm" />
            <span>{DF_CONFIRM_LABEL}</span>
          </label>
          {errors.confirm && <p id="e-confirm" className="mt-1 text-sm font-semibold text-danger">{errorText(errors.confirm)}</p>}
        </div>
      </Group>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-forest px-5 py-2.5 font-semibold text-cream disabled:opacity-60" data-testid="dealer-form-submit">{DF_SUBMIT}</button>
        <Link className="font-semibold text-rust underline" href={p.backHref}>{DF_CANCEL}</Link>
      </div>
    </form>
  );
}
