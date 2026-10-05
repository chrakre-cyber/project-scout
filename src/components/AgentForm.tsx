"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveAgentAction, type AgentFormState } from "@/app/agents/actions";
import { BODY_TYPES, COUNTRY_CODES, FUELS, TRANSMISSIONS, type AgentField } from "@/domain/agent-validation";
import { BODY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL } from "@/lib/format";
import type { FormValues } from "@/server/agent-form";

const CURRENCIES = ["EUR", "NOK", "SEK", "DKK", "CHF", "GBP", "PLN"];

/**
 * Skjema for ny/eksisterende agent. Validering skjer på serveren; feltene
 * har bare enkle hint (type/maxLength) for brukeropplevelsen.
 */
export function AgentForm({ id, version, initial }: { id?: string; version?: number; initial: FormValues }) {
  const [state, action, pending] = useActionState<AgentFormState, FormData>(saveAgentAction, {
    errors: {}, values: null, message: null, issues: [],
  });
  const values = state.values ?? initial;
  const val = (k: string) => (typeof values[k] === "string" ? (values[k] as string) : "");
  const list = (k: string) => (Array.isArray(values[k]) ? (values[k] as string[]) : []);
  const err = (k: AgentField) => state.errors[k];

  return (
    <form action={action} className="space-y-6" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      {version !== undefined && <input type="hidden" name="version" value={version} />}

      {state.message && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p>{state.message}</p>
          {state.issues.length > 0 && <ul className="mt-1 list-disc pl-5">{state.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
        </div>
      )}

      <Fieldset title="Agent">
        <TextField name="name" label="Navn" value={val("name")} error={err("name")} maxLength={120} required />
      </Fieldset>

      <Fieldset title="Søkekriterier" note="Tomt felt eller ingen avkrysning betyr «alle». Kriteriene brukes som harde filtre.">
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField name="make" label="Merke" value={val("make")} error={err("make")} maxLength={60} />
          <TextField name="model" label="Modell (krever merke)" value={val("model")} error={err("model")} maxLength={60} />
          <TextField name="variant" label="Variant (krever modell)" value={val("variant")} error={err("variant")} maxLength={60} />
          <TextField name="yearMin" label="Årsmodell fra" value={val("yearMin")} error={err("yearMin")} inputMode="numeric" />
          <TextField name="yearMax" label="Årsmodell til" value={val("yearMax")} error={err("yearMax")} inputMode="numeric" />
          <TextField name="maxMileageKm" label="Maks kilometer" value={val("maxMileageKm")} error={err("maxMileageKm")} inputMode="numeric" />
        </div>
        <Checkboxes name="fuels" label="Drivstoff" options={FUELS.map((f) => [f, FUEL_LABEL[f]])} checked={list("fuels")} error={err("fuels")} />
        <Checkboxes name="transmissions" label="Gir" options={TRANSMISSIONS.map((t) => [t, TRANSMISSION_LABEL[t]])} checked={list("transmissions")} error={err("transmissions")} />
        <Checkboxes name="bodyTypes" label="Karosseri" options={BODY_TYPES.map((b) => [b, BODY_LABEL[b]])} checked={list("bodyTypes")} error={err("bodyTypes")} />
        <Checkboxes name="countryCodes" label="Land" options={COUNTRY_CODES.map((c) => [c, c])} checked={list("countryCodes")} error={err("countryCodes")} />
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField name="maxPriceAmount" label="Maks annonsepris" value={val("maxPriceAmount")} error={err("maxPrice")} inputMode="decimal" />
          <label className="text-sm">
            Valuta for annonsepris
            <select name="maxPriceCurrency" defaultValue={val("maxPriceCurrency")} key={val("maxPriceCurrency")} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              <option value="">Velg valuta</option>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <p className="self-end text-xs text-slate-500">Sammenlignes bare med annonser i samme valuta. Ingen omregning.</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="broadSearchConfirmed" defaultChecked={val("broadSearchConfirmed") === "on"} key={`b-${val("broadSearchConfirmed")}`} className="mt-1" />
          <span>
            Jeg vil bevisst søke på tvers av merker.
            <span className="block text-xs text-slate-500">Gjelder bare når merke er tomt. Søk uten merke krever i tillegg minst ett annet kriterium for å kunne aktiveres.</span>
          </span>
        </label>
      </Fieldset>

      <Fieldset title="Økonomiforutsetninger (NOK)" note="Lagret salgspris betyr ikke at margin er beregnet. Kost- og avgiftsmotor finnes ikke ennå.">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="retailAmount" label="Forventet norsk salgspris" value={val("retailAmount")} error={err("retailAmount")} inputMode="decimal" />
          <TextField name="minimumContribution" label="Minimum ønsket bidrag" value={val("minimumContribution")} error={err("minimumContribution")} inputMode="decimal" />
        </div>
        <Radios name="retailVat" label="Inkluderer salgsprisen mva.?" options={[["included", "Inkl. mva."], ["excluded", "Ekskl. mva."]]} value={val("retailVat")} error={err("retailVat")} />
        <Radios name="retailRegistrationTaxes" label="Inkluderer salgsprisen registreringsavgifter?" options={[["included", "Inkl. registreringsavgifter"], ["excluded", "Ekskl. registreringsavgifter"]]} value={val("retailRegistrationTaxes")} error={err("retailRegistrationTaxes")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="reserveAmount" label="Klargjøringsreserve (0 er lov)" value={val("reserveAmount")} error={err("reserveAmount")} inputMode="decimal" />
        </div>
        <Radios name="reserveVatBasis" label="Mva.-basis for reserven" options={[["ex_vat", "Eks. mva."], ["incl_vat", "Inkl. mva."]]} value={val("reserveVatBasis")} error={err("reserveVatBasis")} />
      </Fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
          {pending ? "Lagrer …" : "Lagre"}
        </button>
        <Link href="/agents" className="text-sm text-slate-600 hover:underline">Avbryt</Link>
        <span className="text-xs text-slate-500">Lagring aktiverer ikke agenten.</span>
      </div>
    </form>
  );
}

function Fieldset({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {note && <p className="text-xs text-slate-500">{note}</p>}
      {children}
    </fieldset>
  );
}

function TextField(props: { name: string; label: string; value: string; error?: string; maxLength?: number; required?: boolean; inputMode?: "numeric" | "decimal" }) {
  const id = `f-${props.name}`;
  return (
    <label htmlFor={id} className="block text-sm">
      {props.label}
      <input
        id={id} name={props.name} defaultValue={props.value} key={props.value} maxLength={props.maxLength} required={props.required}
        inputMode={props.inputMode} aria-invalid={Boolean(props.error)} aria-describedby={props.error ? `${id}-err` : undefined}
        className={`mt-1 w-full rounded-md border px-3 py-2 ${props.error ? "border-red-500" : "border-slate-300"}`}
      />
      {props.error && <span id={`${id}-err`} className="mt-1 block text-xs text-red-700">{props.error}</span>}
    </label>
  );
}

function Checkboxes({ name, label, options, checked, error }: { name: string; label: string; options: [string, string][]; checked: string[]; error?: string }) {
  return (
    <div className="text-sm">
      <p>{label} <span className="text-xs text-slate-500">(ingen valgt = alle)</span></p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {options.map(([v, l]) => (
          <label key={v} className="flex items-center gap-1.5">
            <input type="checkbox" name={name} value={v} defaultChecked={checked.includes(v)} key={`${v}-${checked.includes(v)}`} /> {l}
          </label>
        ))}
      </div>
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </div>
  );
}

function Radios({ name, label, options, value, error }: { name: string; label: string; options: [string, string][]; value: string; error?: string }) {
  return (
    <div className="text-sm">
      <p>{label}</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {[...options, ["", "Ikke oppgitt"] as [string, string]].map(([v, l]) => (
          <label key={v || "none"} className="flex items-center gap-1.5">
            <input type="radio" name={name} value={v} defaultChecked={value === v} key={`${v}-${value}`} /> {l}
          </label>
        ))}
      </div>
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </div>
  );
}
