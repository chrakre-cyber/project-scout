import type { ReactNode } from "react";
import type { FieldErrors, FormValues } from "@/domain/search-economics";
import { DF_FIELD, DF_FIELD_ERROR } from "@/lib/search-labels";

/** Felles byggeklosser for forhandlerskjemaene: etikett, hjelpetekst og feil knyttet til feltet (aria), 44 px treffflater via globale stiler. */
export type Opt = readonly [value: string, label: string];

export const fieldLabel = (name: string): string => DF_FIELD[name] ?? "Felt";
export const errorText = (code: string | undefined): string | undefined => (code ? DF_FIELD_ERROR[code] ?? DF_FIELD_ERROR.invalid_value : undefined);

export function Group({ id, title, help, children }: { id: string; title: string; help?: string; children: ReactNode }) {
  return (
    <fieldset id={`f-${id}`} className="min-w-0 space-y-3 rounded-2xl border border-sand bg-paper p-4 sm:p-5" data-group={id}>
      <legend className="px-1 text-lg font-bold">{title}</legend>
      {help && <p className="text-sm text-muted">{help}</p>}
      {children}
    </fieldset>
  );
}

function Wrap({ name, label, error, help, children }: { name: string; label: string; error?: string; help?: string; children: ReactNode }) {
  return (
    <div id={`f-${name}`} className="min-w-0">
      <label htmlFor={name} className="mb-1 block text-sm font-bold">{label}</label>
      {children}
      {help && !error && <p className="mt-1 text-xs text-muted">{help}</p>}
      {error && <p id={`e-${name}`} className="mt-1 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}

export function Text({ name, label, values, errors, help, placeholder, inputMode, maxLength }: { name: string; label?: string; values: FormValues; errors: FieldErrors; help?: string; placeholder?: string; inputMode?: "text" | "decimal" | "numeric"; maxLength?: number }) {
  const error = errorText(errors[name]);
  return (
    <Wrap name={name} label={label ?? fieldLabel(name)} error={error} help={help}>
      <input id={name} type="text" name={name} defaultValue={values[name] ?? ""} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength ?? 200} autoComplete="off"
        aria-invalid={error ? true : undefined} aria-describedby={error ? `e-${name}` : undefined} />
    </Wrap>
  );
}

export function Select({ name, label, options, values, errors, help, unset = "Ikke oppgitt" }: { name: string; label?: string; options: readonly Opt[]; values: FormValues; errors: FieldErrors; help?: string; unset?: string | null }) {
  const error = errorText(errors[name]);
  return (
    <Wrap name={name} label={label ?? fieldLabel(name)} error={error} help={help}>
      <select id={name} name={name} defaultValue={values[name] ?? ""} aria-invalid={error ? true : undefined} aria-describedby={error ? `e-${name}` : undefined}>
        {unset !== null && <option value="">{unset}</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Wrap>
  );
}

export const entries = (o: Readonly<Record<string, string>>): Opt[] => Object.entries(o);

/** Feiloversikt (fokuseres ved feil): lenker til feltene. */
export function ErrorSummary({ message, errors, general, labelOf }: { message: string | null; errors: FieldErrors; general: string[]; labelOf: (k: string) => string }) {
  const keys = Object.keys(errors);
  if (!message && keys.length === 0 && general.length === 0) return null;
  return (
    <div role="alert" className="rounded-lg border border-danger/40 bg-[#fbeae5] p-4 text-sm text-danger" data-testid="error-summary">
      {message && <p className="font-semibold">{message}</p>}
      {keys.length > 0 && <ul className="mt-2 list-disc pl-5">{keys.map((k) => <li key={k}><a className="underline" href={`#f-${k}`}>{labelOf(k)}</a>: {errorText(errors[k])}</li>)}</ul>}
    </div>
  );
}
