"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { saveSearchAction, type SearchFormState } from "@/app/searches/actions";
import {
  DEMO_BRANDS, DEMO_EQUIPMENT_GROUPS, DEMO_EXTERIOR_COLORS, DEMO_INTERIOR_COLORS, DEMO_INTERIOR_MATERIALS, DEMO_MODELS,
} from "@/adapters/search-catalog/demo-catalog";
import type { CatalogOption } from "@/adapters/search-catalog/demo-catalog";
import { PROTOTYPE_FIELDS } from "@/adapters/search-prototype/fields";
import { PROTOTYPE_MAPPING } from "@/domain/search-v2/mapping";
import { BODY_TYPES, DRIVE_TRAINS, TRANSMISSIONS } from "@/domain/search-v2/types";
import { BODY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL } from "@/lib/format";
import {
  BLANK_CUSTOM_ROWS, CURRENCIES, FIXED_COSTS, MAX_CUSTOM_INDEX, PRIORITY_LABEL, SCENARIO_OPTIONS, VAT_OPTIONS,
} from "@/lib/search-labels";
import type { FormValues } from "@/server/search-form";

const DRIVE_LABEL = { awd: "Firehjulsdrift", fwd: "Forhjulsdrift", rwd: "Bakhjulsdrift" } as const;
const FUELS_UI = ["petrol", "diesel", "electric", "hybrid", "plugin_hybrid"] as const;
const INITIAL_STATE: SearchFormState = { errors: {}, general: [], values: null, message: null, conflict: false };

/** Visningsnavn for felt i feiloversikten. */
const FIELD_LABEL: Record<string, string> = {
  name: "Navn", brand: "Merke", model: "Modell", variant: "Variant", modelYearMin: "Modellår fra", modelYearMax: "Modellår til",
  regFrom: "Registrert fra", regTo: "Registrert til", maxMileageKm: "Kilometerstand", seatsMin: "Seter fra", seatsMax: "Seter til",
  bodyTypes: "Karosseri", fuels: "Drivstoff", transmissions: "Girkasse", driveTrains: "Hjuldrift",
  exteriorColorsPriority: "Prioritet for utvendig farge", interiorColorsPriority: "Prioritet for interiørfarge",
  interiorMaterialsPriority: "Prioritet for interiørmateriale", plannedRegistration: "Planlagt norsk registrering",
  budgetMax: "Budsjett", budgetDeviation: "Prisavvik",
};
function fieldLabel(key: string): string {
  if (FIELD_LABEL[key]) return FIELD_LABEL[key]!;
  const m = /^cost\.(\w+)\./.exec(key);
  if (m) return `Kostnadslinje ${FIXED_COSTS.find((f) => f.kind === m[1])?.label.toLowerCase() ?? ""}`.trim();
  if (key.startsWith("custom.")) return "Egen kostnadslinje";
  if (key.startsWith("eq:")) return "Utstyr";
  return "Felt";
}

/** Felt i prototypen som er planlagt senere eller ikke relevante nå — vises som «Kommer senere», ikke som skjemafelt. */
const LATER_LABELS = PROTOTYPE_FIELDS
  .filter((f) => PROTOTYPE_MAPPING.some((m) => m.kind === "field" && m.prototypeId === f.id && m.status === "planned_later"))
  .map((f) => f.label);

export function SearchForm({ id, version, initial, note }: { id?: string; version?: number; initial: FormValues; note?: string }) {
  const [state, action, pending] = useActionState<SearchFormState, FormData>(saveSearchAction, INITIAL_STATE);
  const [, startTransition] = useTransition();
  const values = state.values ?? initial;
  const val = (k: string) => (typeof values[k] === "string" ? (values[k] as string) : "");
  const list = (k: string) => (Array.isArray(values[k]) ? (values[k] as string[]) : []);
  const err = (k: string) => state.errors[k];
  // Valgt merke styrer modelllisten. Valget gjelder bare for gjeldende skjemaverdier; etter en lagringsfeil gjelder verdiene fra serveren.
  const [brandChoice, setBrandChoice] = useState<{ forValues: FormValues; brand: string } | null>(null);
  const brand = brandChoice && brandChoice.forValues === values ? brandChoice.brand : val("brand");
  const [dirty, setDirty] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const errorKeys = Object.keys(state.errors);
  useEffect(() => {
    if ((errorKeys.length || state.general.length || state.message) && summaryRef.current) summaryRef.current.focus();
  }, [state, errorKeys.length]);

  const models = brand ? DEMO_MODELS[brand] ?? [] : [];
  const selectedModel = val("model");
  const variantSuggestions = models.find((m) => m.key === selectedModel)?.variants ?? [];
  // Antall egendefinerte rader: til og med siste rad med innhold + tomme plasser (vokser ikke for hver avviste lagring).
  const usedCustom = Object.keys(values).flatMap((k) => {
    const m = /^custom\.(\d{1,2})\.(id|label|amount|vat|included|remove|currency)$/.exec(k);
    if (!m) return [];
    const val = typeof values[k] === "string" ? (values[k] as string) : "";
    return val !== "" && !(m[2] === "currency" && val === "NOK") ? [Number(m[1]) + 1] : [];
  });
  const customCount = Math.min(MAX_CUSTOM_INDEX + 1, Math.max(0, ...usedCustom) + BLANK_CUSTOM_ROWS);

  return (
    // `action` er reserveveien uten JavaScript. Med JavaScript sendes skjemaet manuelt, slik at React ikke nullstiller feltene etter en
    // avvist lagring: brukerens tekst skal aldri gå tapt (feil, konflikt).
    <form
      action={action}
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}
      onChange={() => setDirty(true)} className="space-y-6" noValidate data-testid="search-form"
    >
      {id && <input type="hidden" name="id" value={id} />}
      {version !== undefined && <input type="hidden" name="expectedVersion" value={version} />}

      {note && <p className="rounded-lg border border-sand bg-sand-soft p-3 text-sm" data-testid="example-note">{note}</p>}

      <div ref={summaryRef} tabIndex={-1} className="focus:outline-none">
        {(state.message || state.general.length > 0 || errorKeys.length > 0) && (
          <div role="alert" className="rounded-lg border border-danger/40 bg-[#fbeae5] p-4 text-sm text-danger" data-testid="error-summary">
            {state.message && <p className="font-semibold">{state.message}</p>}
            {state.general.length > 0 && <ul className="mt-1 list-disc pl-5">{state.general.map((g) => <li key={g}>{g}</li>)}</ul>}
            {errorKeys.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {errorKeys.map((k) => <li key={k}><a className="underline" href={`#f-${k}`}>{fieldLabel(k)}</a>: {state.errors[k]}</li>)}
              </ul>
            )}
            {state.conflict && id && (
              <p className="mt-2"><Link className="underline" href={`/searches/${id}`} target="_blank" rel="noopener">Åpne siste lagrede versjon i ny fane</Link></p>
            )}
          </div>
        )}
      </div>

      <Card title="Navn" n={1}>
        <TextField name="name" label="Navn på søket" value={val("name")} error={err("name")} maxLength={120} required />
      </Card>

      <Card title="Bil og krav" n={2} note="Alt du fyller ut her er krav. Tomt felt betyr «ikke satt» — ingen begrensning.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="brand" label="Merke" error={err("brand")}>
            <select id="brand" name="brand" value={brand} onChange={(e) => setBrandChoice({ forValues: values, brand: e.target.value })} aria-invalid={err("brand") ? true : undefined}>
              <option value="">Ikke satt</option>
              {DEMO_BRANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
          </Field>
          <Field name="model" label="Modell" error={err("model")}>
            <select id="model" key={brand} name="model" defaultValue={brand === val("brand") ? val("model") : ""} disabled={!brand} aria-invalid={err("model") ? true : undefined}>
              <option value="">{brand ? "Ikke satt" : "Velg merke først"}</option>
              {models.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </Field>
          <Field name="variant" label="Variant (fritekst)" error={err("variant")} help="Fritekst; forslagene er et demoutvalg.">
            <input id="variant" type="text" name="variant" defaultValue={val("variant")} list="variant-suggestions" maxLength={100} autoComplete="off" aria-invalid={err("variant") ? true : undefined} />
            <datalist id="variant-suggestions">{variantSuggestions.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Pair label="Modellår" a={{ name: "modelYearMin", ph: "Fra" }} b={{ name: "modelYearMax", ph: "Til" }} values={values} errors={state.errors} help="Modellår er en egen opplysning, ikke det samme som registreringsår." />
          <Pair label="Antall seter" a={{ name: "seatsMin", ph: "Fra" }} b={{ name: "seatsMax", ph: "Til" }} values={values} errors={state.errors} help="Eksakt antall: samme tall i begge felt (sju seter er et eget krav)." />
          <Pair label="Førstegangsregistrering" a={{ name: "regFrom", ph: "ÅÅÅÅ eller ÅÅÅÅ-MM" }} b={{ name: "regTo", ph: "ÅÅÅÅ eller ÅÅÅÅ-MM" }} values={values} errors={state.errors} help="Skriv bare det du vet: ÅÅÅÅ, ÅÅÅÅ-MM eller ÅÅÅÅ-MM-DD. Presisjonen beholdes." />
          <Field name="maxMileageKm" label="Kilometerstand (høyst)" error={err("maxMileageKm")} help="Tomt = ikke satt.">
            <div className="flex items-center gap-2">
              <input id="maxMileageKm" type="text" inputMode="numeric" name="maxMileageKm" defaultValue={val("maxMileageKm")} aria-invalid={err("maxMileageKm") ? true : undefined} />
              <span className="text-sm text-muted">km</span>
            </div>
          </Field>
        </div>
        <Checks name="bodyTypes" label="Karosseri" options={BODY_TYPES.map((b) => ({ key: b, label: BODY_LABEL[b] }))} checked={list("bodyTypes")} error={err("bodyTypes")} />
        <Checks name="fuels" label="Drivstoff / drivlinje" options={FUELS_UI.map((f) => ({ key: f, label: FUEL_LABEL[f] }))} checked={list("fuels")} error={err("fuels")} />
        <Checks name="transmissions" label="Girkasse" options={TRANSMISSIONS.map((t) => ({ key: t, label: TRANSMISSION_LABEL[t] }))} checked={list("transmissions")} error={err("transmissions")} />
        <Checks name="driveTrains" label="Hjuldrift" options={DRIVE_TRAINS.map((d) => ({ key: d, label: DRIVE_LABEL[d] }))} checked={list("driveTrains")} error={err("driveTrains")} />
      </Card>

      <Card title="Farger og materiale" n={3} note="Velg farger/materiale og si uttrykkelig om valget er «Må ha» eller «Ønskelig». Flere valg i en liste betyr ELLER.">
        <PrioritizedChecks name="exteriorColors" label="Utvendig farge" options={DEMO_EXTERIOR_COLORS} values={values} errors={state.errors} />
        <PrioritizedChecks name="interiorColors" label="Interiørfarge" options={DEMO_INTERIOR_COLORS} values={values} errors={state.errors} />
        <PrioritizedChecks name="interiorMaterials" label="Interiørmateriale" options={DEMO_INTERIOR_MATERIALS} values={values} errors={state.errors} />
      </Card>

      <Card title="Utstyr" n={4} note="Hvert utstyr har sin egen prioritet. «Må ha» er et krav; «Ønskelig» er et ønske som aldri alene utelukker en bil.">
        {DEMO_EQUIPMENT_GROUPS.map((g) => (
          <fieldset key={g.id} className="space-y-2">
            <legend className="text-base font-bold">{g.title}</legend>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {g.items.slice(0, g.visible).map((i) => <EquipRow key={i.key} item={i} value={val(`eq:${i.key}`)} />)}
            </div>
            {g.items.length > g.visible && (
              <details className="mt-1" open={g.items.slice(g.visible).some((i) => val(`eq:${i.key}`) !== "")}>
                <summary className="cursor-pointer text-sm font-semibold text-forest underline">Vis flere ({g.items.length - g.visible})</summary>
                <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {g.items.slice(g.visible).map((i) => <EquipRow key={i.key} item={i} value={val(`eq:${i.key}`)} />)}
                </div>
              </details>
            )}
          </fieldset>
        ))}
      </Card>

      <Card title="Planlagt norsk registrering" n={5}>
        <fieldset id="f-plannedRegistration" aria-describedby={err("plannedRegistration") ? "e-plannedRegistration" : undefined}>
          <legend className="mb-1 font-bold">Hva ønsker du å registrere bilen som? <span className="text-danger" aria-hidden="true">*</span></legend>
          <div className="space-y-2">
            {SCENARIO_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-start gap-3">
                <input type="radio" name="plannedRegistration" value={o.value} defaultChecked={val("plannedRegistration") === o.value} className="mt-1 h-5 w-5 accent-forest" />
                <span><span className="font-semibold">{o.label}</span><span className="block text-sm text-muted">{o.help}</span></span>
              </label>
            ))}
          </div>
          {err("plannedRegistration") && <p id="e-plannedRegistration" className="mt-1 text-sm font-semibold text-danger">{err("plannedRegistration")}</p>}
        </fieldset>
      </Card>

      <Card title="Budsjett og kostnader" n={6} note="Budsjettet er maksimal innkjøpskostnad til Norge. Salgspris og margin trengs ikke. Her beregnes ingen avgifter og ingen total.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="budgetMax" label="Maks innkjøpskostnad til Norge" error={err("budgetMax")} help="Tomt = budsjett ikke satt (lov i et utkast).">
            <div className="flex items-center gap-2">
              <input id="budgetMax" type="text" inputMode="decimal" name="budgetMax" defaultValue={val("budgetMax")} aria-invalid={err("budgetMax") ? true : undefined} placeholder="f.eks. 750 000" />
              <span className="text-sm text-muted">NOK</span>
            </div>
          </Field>
          <Field name="budgetDeviation" label="Prisavvik (valgfritt)" error={err("budgetDeviation")} help="Prosent over budsjettet du kan akseptere. Tomt = ikke valgt.">
            <div className="flex items-center gap-2">
              <input id="budgetDeviation" type="text" inputMode="decimal" name="budgetDeviation" defaultValue={val("budgetDeviation")} aria-invalid={err("budgetDeviation") ? true : undefined} placeholder="f.eks. 10" />
              <span className="text-sm text-muted">%</span>
            </div>
          </Field>
        </div>
        <fieldset className="space-y-3">
          <legend className="text-base font-bold">Kostnadslinjer (forutsetninger)</legend>
          <p className="text-sm text-muted">Tomt beløp betyr <strong>ukjent</strong> (valutaen beholdes). Skriv 0 bare hvis kostnaden uttrykkelig er 0. Linjene øker aldri budsjettgrensen.</p>
          {FIXED_COSTS.map(({ kind, label }) => (
            <CostRow key={kind} prefix={`cost.${kind}`} title={label} fixed values={values} errors={state.errors} />
          ))}
          <p className="pt-2 text-sm font-semibold">Egne kostnadslinjer</p>
          {Array.from({ length: customCount }, (_, i) => <CostRow key={i} prefix={`custom.${i}`} title={`Egen linje ${i + 1}`} values={values} errors={state.errors} />)}
          <p className="text-xs text-muted">En egen linje får en varig id første gang den lagres. Kryss av «Fjern linjen» for å slette den.</p>
        </fieldset>
      </Card>

      <section className="rounded-xl border border-sand bg-paper p-4 text-sm" aria-labelledby="later">
        <h2 id="later" className="font-bold">Kommer senere</h2>
        <p className="text-muted">Disse prototypekriteriene er ikke tilgjengelige i demoen ennå, så de kan ikke fylles ut (ingenting går tapt ved lagring): {LATER_LABELS.join(", ")}.</p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-forest px-5 py-2 font-semibold text-cream hover:bg-ink disabled:opacity-60">
          {pending ? "Lagrer…" : id ? "Lagre endringer" : "Lagre som utkast"}
        </button>
        <Link href="/searches" className="min-h-11 rounded-lg border border-forest px-4 py-2 font-semibold text-forest hover:bg-sand-soft">Avbryt</Link>
        {id && version !== undefined && (
          dirty
            ? <span className="text-sm text-muted" data-testid="dirty-note">Du har ulagrede endringer. Lagre før du prøver med demodata — resultatene gjelder alltid lagret versjon.</span>
            : <Link href={`/searches/${id}/preview?v=${version}`} className="min-h-11 rounded-lg bg-rust px-5 py-2 font-semibold text-white hover:bg-rust-dark" data-testid="preview-link">Prøv med demodata</Link>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- byggeklosser

function Card({ title, n, note, children }: { title: string; n: number; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-sand bg-paper p-4 sm:p-6" aria-labelledby={`h-${n}`}>
      <h2 id={`h-${n}`} className="flex items-center gap-3 text-xl font-bold">
        <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-forest text-sm text-cream" aria-hidden="true">{n}</span>
        {title}
      </h2>
      {note && <p className="text-sm text-muted">{note}</p>}
      {children}
    </section>
  );
}

function Field({ name, label, error, help, children }: { name: string; label: string; error?: string; help?: string; children: React.ReactNode }) {
  return (
    <div id={`f-${name}`} className="min-w-0">
      <label htmlFor={name} className="mb-1 block text-sm font-bold">{label}</label>
      {children}
      {help && !error && <p className="mt-1 text-xs text-muted">{help}</p>}
      {error && <p id={`e-${name}`} className="mt-1 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}

function TextField({ name, label, value, error, maxLength, required }: { name: string; label: string; value: string; error?: string; maxLength?: number; required?: boolean }) {
  return (
    <Field name={name} label={required ? `${label} *` : label} error={error}>
      <input id={name} type="text" name={name} defaultValue={value} maxLength={maxLength} aria-invalid={error ? true : undefined} aria-describedby={error ? `e-${name}` : undefined} />
    </Field>
  );
}

function Pair({ label, a, b, values, errors, help }: { label: string; a: { name: string; ph: string }; b: { name: string; ph: string }; values: FormValues; errors: Record<string, string>; help?: string }) {
  const v = (k: string) => (typeof values[k] === "string" ? (values[k] as string) : "");
  return (
    <fieldset id={`f-${a.name}`} className="min-w-0">
      <legend className="mb-1 text-sm font-bold">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {[a, b].map((f) => (
          <div key={f.name} id={`f-${f.name}`}>
            <input type="text" name={f.name} defaultValue={v(f.name)} placeholder={f.ph} aria-label={`${label} ${f === a ? "fra" : "til"}`} inputMode={f.ph.startsWith("ÅÅÅÅ") ? "text" : "numeric"} aria-invalid={errors[f.name] ? true : undefined} />
            {errors[f.name] && <p className="mt-1 text-sm font-semibold text-danger">{errors[f.name]}</p>}
          </div>
        ))}
      </div>
      {help && <p className="mt-1 text-xs text-muted">{help}</p>}
    </fieldset>
  );
}

function Checks({ name, label, options, checked, error }: { name: string; label: string; options: { key: string; label: string }[]; checked: string[]; error?: string }) {
  return (
    <fieldset id={`f-${name}`}>
      <legend className="mb-1 text-sm font-bold">{label} <span className="font-normal text-muted">(flere valg = ELLER)</span></legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((o) => (
          <label key={o.key} className="flex min-h-9 items-center gap-2">
            <input type="checkbox" name={name} value={o.key} defaultChecked={checked.includes(o.key)} className="h-5 w-5 accent-forest" />
            {o.label}
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm font-semibold text-danger">{error}</p>}
    </fieldset>
  );
}

function PrioritizedChecks({ name, label, options, values, errors }: { name: string; label: string; options: readonly CatalogOption[]; values: FormValues; errors: Record<string, string> }) {
  const checked = Array.isArray(values[name]) ? (values[name] as string[]) : [];
  const prio = typeof values[`${name}Priority`] === "string" ? (values[`${name}Priority`] as string) : "";
  const e = errors[`${name}Priority`];
  return (
    <div className="space-y-2">
      <Checks name={name} label={label} options={options.map((o) => ({ key: o.key, label: o.label }))} checked={checked} />
      <fieldset id={`f-${name}Priority`} aria-describedby={e ? `e-${name}Priority` : undefined}>
        <legend className="mb-1 text-sm font-bold">{label}: er dette «Må ha» eller «Ønskelig»?</legend>
        <div className="flex flex-wrap gap-5">
          {(["must", "nice"] as const).map((p) => (
            <label key={p} className="flex min-h-9 items-center gap-2">
              <input type="radio" name={`${name}Priority`} value={p} defaultChecked={prio === p} className="h-5 w-5 accent-forest" />
              {PRIORITY_LABEL[p]}
            </label>
          ))}
        </div>
        {e && <p id={`e-${name}Priority`} className="mt-1 text-sm font-semibold text-danger">{e}</p>}
      </fieldset>
    </div>
  );
}

function EquipRow({ item, value }: { item: CatalogOption; value: string }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>{item.label}</span>
      <select name={`eq:${item.key}`} defaultValue={value} aria-label={`${item.label}: prioritet`} className="!w-40 flex-none">
        <option value="">Ikke valgt</option>
        <option value="must">{PRIORITY_LABEL.must}</option>
        <option value="nice">{PRIORITY_LABEL.nice}</option>
      </select>
    </label>
  );
}

function CostRow({ prefix, title, fixed, values, errors }: { prefix: string; title: string; fixed?: boolean; values: FormValues; errors: Record<string, string> }) {
  const v = (k: string) => (typeof values[`${prefix}.${k}`] === "string" ? (values[`${prefix}.${k}`] as string) : "");
  const e = (k: string) => errors[`${prefix}.${k}`];
  const stored = !fixed && v("id") !== "";
  // Fast linje: feltene er av (og sendes ikke) til linjen er tatt med, så verdier aldri skrives inn på en linje som blir utelatt.
  const [use, setUse] = useState(v("use") === "true");
  const off = fixed && !use;
  return (
    <div className="rounded-xl border border-sand p-3" data-cost={prefix}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {fixed
          ? <label className="flex items-center gap-2 font-bold"><input type="checkbox" name={`${prefix}.use`} value="true" checked={use} onChange={(ev) => setUse(ev.target.checked)} aria-describedby={`h-${prefix}`} className="h-5 w-5 accent-forest" />Ta med: {title}</label>
          : <span className="font-bold">{title}{stored && <span className="ml-2 text-xs font-normal text-muted">lagret linje</span>}</span>}
        {!fixed && stored && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={`${prefix}.remove`} value="true" className="h-5 w-5 accent-danger" />Fjern linjen</label>
        )}
      </div>
      {fixed && (
        <p id={`h-${prefix}`} className={`mb-2 text-xs ${e("use") ? "font-semibold text-danger" : "text-muted"}`}>
          {e("use") ?? (use ? "Linjen tas med. Tomt beløp betyr ukjent." : "Linjen er ikke med. Kryss av for å fylle ut beløp, valuta, mva. og budsjettvalg.")}
        </p>
      )}
      {!fixed && (
        <p className="mb-2 text-xs text-muted">En rad der du bare velger valuta, mva. eller «Inngår i budsjettet» må også ha en beskrivelse.</p>
      )}
      {!fixed && (
        <div className="mb-2" id={`f-${prefix}.label`}>
          <input type="hidden" name={`${prefix}.id`} value={v("id")} />
          <input type="text" name={`${prefix}.label`} defaultValue={v("label")} maxLength={60} placeholder="Beskrivelse, f.eks. Tilleggsutstyr" aria-label={`${title}: beskrivelse`} aria-invalid={e("label") ? true : undefined} />
          {e("label") && <p className="mt-1 text-sm font-semibold text-danger">{e("label")}</p>}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem_9rem_auto] sm:items-start">
        <div id={`f-${prefix}.amount`}>
          <input type="text" inputMode="decimal" name={`${prefix}.amount`} defaultValue={v("amount")} disabled={off} placeholder="Beløp (tomt = ukjent)" aria-label={`${title}: beløp`} aria-invalid={e("amount") ? true : undefined} />
          {e("amount") && <p className="mt-1 text-sm font-semibold text-danger">{e("amount")}</p>}
        </div>
        <select name={`${prefix}.currency`} defaultValue={v("currency") || "NOK"} disabled={off} aria-label={`${title}: valuta`}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name={`${prefix}.vat`} defaultValue={v("vat")} disabled={off} aria-label={`${title}: mva.-grunnlag`}>
          {VAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name={`${prefix}.included`} value="true" defaultChecked={v("included") === "true"} disabled={off} className="h-5 w-5 accent-forest" />
          Inngår i budsjettet
        </label>
      </div>
    </div>
  );
}
