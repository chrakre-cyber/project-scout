import type { Field } from "@/domain/display-policy";
import { NOT_STATED } from "@/lib/format";

/** Tekst for felt som ikke har en verdi. Tre ulike tilstander, tre ulike tekster: ukjent ≠ ikke tillatt ≠ ikke tilgjengelig. */
export const WITHHELD_TEXT = "vises ikke (leverandørvilkår)";
export const UNAVAILABLE_TEXT = "ikke tilgjengelig nå";

export function fieldText<T>(field: Field<T>, format: (value: T) => string): string {
  switch (field.state) {
    case "value": return format(field.value);
    case "unknown": return NOT_STATED;
    case "withheld": return WITHHELD_TEXT;
    case "unavailable": return UNAVAILABLE_TEXT;
  }
}

/** Verdien når den finnes, ellers null (for logikk som ikke skal vise tekst, f.eks. valg av illustrasjon). */
export function fieldValue<T>(field: Field<T>): T | null {
  return field.state === "value" ? field.value : null;
}
