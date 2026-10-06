"use client";

import { useFormStatus } from "react-dom";

/** Sender skjemaet én gang og viser at søket pågår. Idempotensen ligger på serveren (token), ikke her. */
export function RunButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" disabled={disabled || pending} aria-busy={pending} data-testid="run-button"
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
    >
      {pending ? "Søker … (syntetiske data)" : "Kjør søk"}
    </button>
  );
}
