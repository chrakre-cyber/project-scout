import { MARKETPLACE_ERROR_LABEL, type MarketplaceError } from "@/providers/marketplace";

/** Viser kildefeil tydelig (PRODUCT_SPEC §5) uten tekniske detaljer. */
export function SourceErrorNotice({ error }: { error: MarketplaceError }) {
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <strong>Kildefeil ({error.code}).</strong> {MARKETPLACE_ERROR_LABEL[error.code]}
      {error.retryable ? " Feilen er midlertidig." : ""}
    </div>
  );
}
