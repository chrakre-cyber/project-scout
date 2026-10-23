/**
 * DATA-002D-2 (id DATA-002D gjenbrukt; se reviews/DATA-002D.md) — kjøretidslasting av rettigheter, typede resultat-handles og samlet tilgangsvurdering.
 * Alle profiler for «leverandører» her er HYPOTETISK testdata (ingen leverandør har gitt noen av rettighetene). Ingen leverandør er koblet til.
 */
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { buildProvenance, canonicalPermissions, evaluateProvenance, type InternalProvenance } from "@/domain/provenance";
import { REGISTERED_PROFILES, SYNTHETIC_RIGHTS_PROFILE, noRights, resolveRights, type ProviderRightsProfile } from "@/domain/provider-rights";
import { deniedAccess, evaluateResultAccess, type AccessContext } from "@/domain/result-access";
import { createResultHandle, parseResultHandle, provenanceReference, verifyHandle, type ProviderResultHandle } from "@/domain/result-handle";
import { buildRuntimeRights, profileFromRow, resolveRuntimeRights, type RuntimeRights } from "@/domain/rights-runtime";
import type { MarketplaceProvider } from "@/providers/marketplace";
import { SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { syntheticRawListings } from "@/providers/marketplace/synthetic/fixtures";
import { derivePublicId, profileDigest } from "@/server/public-ids";
import { handleFor, accessFor, sha256Hex, verifyHandleMapping } from "@/server/result-handles";
import { loadRuntimeProfiles, loadRuntimeRights } from "@/server/rights-runtime";
import { detailForDisplay, previewInternal } from "@/server/search-display";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues } from "@/server/search-form";
import { sentinelListing } from "./fixtures/display-sentinel";
import { profile } from "./fixtures/rights-profiles";

const T0 = new Date("2026-10-23T12:00:00Z");
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);
const KEY = "test-key-0123456789abcdef";

/** Hypotetisk sandbox-leverandør. Verifisert profil med eksplisitte, smale rettigheter. */
const provider = (over: Parameters<typeof profile>[0] = {}): ProviderRightsProfile =>
  profile({ providerId: "test-provider", environment: "sandbox", providerName: "Testleverandør", ...over });
const P = provider({ display: { price: true, images: false, seller_identity: true, seller_location: false, source_url: true }, geography: { unrestricted: false, countries: ["NO"] } });

/** Inversen av `profileFromRow`: en DB-rad (snake_case, Date-objekter slik pg leverer timestamptz). */
function rowOf(p: ProviderRightsProfile): Record<string, unknown> {
  return {
    id: "00000000-0000-4000-8000-000000000000", provider: p.providerId, version: p.version, status: p.status, environment: p.environment,
    effective_from: new Date(p.validFrom), effective_to: p.validUntil === null ? null : new Date(p.validUntil),
    retention_seconds: p.storage.retentionSeconds, cache_seconds: p.storage.cacheSeconds, history_retention_seconds: p.storage.historyRetentionSeconds,
    allow_price: p.storage.storable.price, allow_specs: p.storage.storable.specs, allow_text: p.storage.storable.text, allow_images: p.storage.storable.images, allow_seller_data: p.storage.storable.sellerData,
    source_ref: p.sourceRef, verified_by: p.verifiedBy, verified_at: p.verifiedAt === null ? null : new Date(p.verifiedAt), provider_name: p.providerName,
    display_fields: { ...p.display }, matching_fields: { ...p.matching },
    multi_customer_reuse: p.usage.multiCustomerReuse, re_evaluation_allowed: p.usage.reEvaluation, alerts_allowed: p.usage.alerts,
    geography_unrestricted: p.geography.unrestricted, allowed_countries: [...p.geography.countries],
    attribution_required: p.attribution.required, attribution_text: p.attribution.text, deep_link_required: p.deepLinkRequired, on_revocation: p.onRevocation,
    allow_derived_economics: { ...p.derivedEconomics.allow }, display_derived_economics: p.derivedEconomics.display, created_at: new Date(),
  };
}
const rights = (rows: unknown[] | null | "unavailable", code: readonly ProviderRightsProfile[] = REGISTERED_PROFILES): RuntimeRights =>
  buildRuntimeRights({ codeProfiles: code, database: rows, now: T0, digestOf: profileDigest });

/** Proveniens + handle for en hypotetisk leverandørannonse hentet under profil `p` ved `retrievedAt`. */
function resultFor(p: ProviderRightsProfile, retrievedAt = T0, listingId = "RAW-PROVIDER-ID-991"): { prov: InternalProvenance; handle: ProviderResultHandle } {
  const listing = { ...sentinelListing(p.providerId), sourceListingId: listingId };
  const publicId = derivePublicId(p.providerId, listingId, KEY);
  const prov = buildProvenance({ listing, publicId, profile: p, profileDigest: profileDigest(p), retrievedAt, schemaVersion: `${p.providerId}@1` });
  return { prov, handle: createResultHandle(prov, sha256Hex) };
}
const ctx = (rt: RuntimeRights, now: Date, country: string | null = "NO", over: Partial<AccessContext> = {}): AccessContext =>
  ({ rights: rt, now, digestOf: profileDigest, hash: sha256Hex, geographyCountry: country, ...over });
const evalAt = (p: ProviderRightsProfile, rt: RuntimeRights, at: Date, retrievedAt = T0, country: string | null = "NO", extra: Partial<AccessContext> = {}) => {
  const { prov, handle } = resultFor(p, retrievedAt);
  return evaluateResultAccess(handle, prov, ctx(rt, at, country, extra));
};
const allDenied = (d: ReturnType<typeof deniedAccess>) => {
  expect(d).toMatchObject({ canDisplay: false, canShowPrice: false, canShowImages: false, canShowSellerInfo: false, canLinkToSource: false, mayRetain: false, retentionSeconds: 0, retainUntil: null, mustRefreshBeforeDisplay: false, refreshAfter: null, geographyAllowed: false });
  expect(Object.values(d.fields).every((v) => v === false)).toBe(true);
  expect(Object.values(d.storable).every((v) => v === false)).toBe(true);
};

// ------------------------------------------------------------------------------------------------ 1. lasting fra autoritativ kilde

describe("kjøretidsrettigheter lastes fra den autoritative tabellen og tolkes strengt", () => {
  it("gyldig rad (slik pg leverer den) → nøyaktig samme profil; leverandør med aktiv profil har rettigheter", () => {
    const m = profileFromRow(rowOf(P));
    expect(m.ok).toBe(true);
    if (m.ok) expect(m.profile).toEqual(P);
    const rt = rights([rowOf(P)]);
    expect(rt.status).toBe("ok");
    const r = resolveRuntimeRights(rt, "test-provider", T0);
    expect(r.inForce).toBe(true);
    if (r.inForce) expect(r.profile.display.price).toBe(true);
  });

  it("den syntetiske DB-raden (som migrasjonene backfyller den) har samme avtrykk som kodeprofilen ⇒ ingen konflikt", () => {
    const rt = rights([rowOf(SYNTHETIC_RIGHTS_PROFILE)]);
    expect(rt.status).toBe("ok");
    expect(rt.rejected).toEqual([]);
    expect(rt.profiles).toHaveLength(1);
    const mapped = profileFromRow(rowOf(SYNTHETIC_RIGHTS_PROFILE));
    expect(mapped.ok && profileDigest(mapped.profile)).toBe(profileDigest(SYNTHETIC_RIGHTS_PROFILE));
  });

  it("manglende rettighetsprofil for leverandøren ⇒ ingen rettigheter (unknown_provider), og ingenting er tillatt", () => {
    const rt = rights([rowOf(P)]);
    const r = resolveRuntimeRights(rt, "annen-leverandor", T0);
    expect(r).toMatchObject({ inForce: false, reason: "unknown_provider", profileVersion: 0 });
    expect(evalAt(provider({ providerId: "annen-leverandor" }), rt, T0)).toMatchObject({ canDisplay: false, reason: "unknown_provider" });
  });

  it.each([
    ["utløpt", { validUntil: "2026-10-23T00:00:00Z" }, "expired"],
    ["ikke begynt", { validFrom: "2026-11-01T00:00:00Z" }, "not_started"],
    ["utkast (ikke verifisert)", { status: "draft", verifiedBy: null, verifiedAt: null }, "not_verified"],
    ["trukket", { status: "revoked" }, "revoked"],
  ] as const)("%s profil ⇒ avslag med årsak %s og alle evner false", (_n, over, reason) => {
    const p = provider(over as Partial<ProviderRightsProfile>);
    const rt = rights([rowOf(p)]);
    expect(resolveRuntimeRights(rt, "test-provider", T0)).toMatchObject({ inForce: false, reason });
    const d = evalAt(p, rt, T0);
    expect(d.reason).toBe(reason);
    allDenied(d);
  });

  it.each([
    ["mangler kolonne", (r: Record<string, unknown>) => { delete r.retention_seconds; }],
    ["ukjent/manglende feltrettighet i display_fields", (r: Record<string, unknown>) => { r.display_fields = { title: true }; }],
    ["ekstra nøkkel i display_fields", (r: Record<string, unknown>) => { r.display_fields = { ...(r.display_fields as object), nytt_felt: true }; }],
    ["ikke-boolsk rettighet", (r: Record<string, unknown>) => { r.matching_fields = { ...(r.matching_fields as object), price: "true" }; }],
    ["display_fields er null", (r: Record<string, unknown>) => { r.display_fields = null; }],
    ["ugyldig tidspunkt", (r: Record<string, unknown>) => { r.effective_from = "ikke-en-dato"; }],
    ["negativ retensjon", (r: Record<string, unknown>) => { r.retention_seconds = -5; }],
    ["ukjent status", (r: Record<string, unknown>) => { r.status = "approved"; }],
    ["ukjent miljø", (r: Record<string, unknown>) => { r.environment = "production"; }],
    ["rettighet er tall", (r: Record<string, unknown>) => { r.allow_price = 1; }],
    ["landliste er ikke liste", (r: Record<string, unknown>) => { r.allowed_countries = "NO"; }],
  ])("ugyldig rad (%s) avvises og leverandøren blokkeres — undefined/ukjent rettighet tolkes aldri som tillatt", (_n, mutate) => {
    const row = rowOf(P);
    mutate(row);
    expect(profileFromRow(row).ok).toBe(false);
    const rt = rights([row]);
    expect(rt.status).toBe("degraded");
    expect(rt.blockedProviders.has("test-provider")).toBe(true);
    expect(resolveRuntimeRights(rt, "test-provider", T0)).toMatchObject({ inForce: false, reason: "invalid_profile" });
    allDenied(evalAt(P, rt, T0));
  });

  it("ikke-objekt som rad (null, tall, liste) avvises uten unntak", () => {
    for (const bad of [null, undefined, 7, "x", [], [1]]) expect(profileFromRow(bad)).toMatchObject({ ok: false });
    expect(rights([null, 7]).status).toBe("degraded");
  });

  it("defekt NYERE versjon blokkerer leverandøren: faller ikke tilbake til en eldre, gyldig versjon", () => {
    const v1 = provider({ version: 1 });
    const v2 = rowOf(provider({ version: 2 })); v2.display_fields = {};
    const rt = rights([rowOf(v1), v2]);
    expect(resolveRuntimeRights(rt, "test-provider", T0)).toMatchObject({ inForce: false, reason: "invalid_profile" });
  });

  it("en sandbox-/live-profil definert i KODE avvises: ekte rettigheter kan bare komme fra databasen", () => {
    const rt = rights(null, [SYNTHETIC_RIGHTS_PROFILE, provider()]);
    expect(rt.rejected).toContainEqual({ providerId: "test-provider", version: 1, reason: "code_profile_not_synthetic" });
    expect(resolveRuntimeRights(rt, "test-provider", T0)).toMatchObject({ inForce: false });
    expect(resolveRuntimeRights(rt, "synthetic-demo", T0).inForce).toBe(true);
  });

  it("samme leverandør+versjon i kode og database med ulikt innhold ⇒ konflikt, leverandøren blokkeres", () => {
    const widened = rowOf({ ...SYNTHETIC_RIGHTS_PROFILE, display: { ...SYNTHETIC_RIGHTS_PROFILE.display, images: true } });
    const rt = rights([widened]);
    expect(rt.rejected).toContainEqual({ providerId: "synthetic-demo", version: 1, reason: "code_database_conflict" });
    expect(resolveRuntimeRights(rt, "synthetic-demo", T0)).toMatchObject({ inForce: false, reason: "invalid_profile" });
  });

  it("databasevei ikke konfigurert ⇒ bare syntetisk (samme sett som i dag); databasen utilgjengelig ⇒ lukket for leverandører, syntetisk virker, ingen feiltekst lekker", async () => {
    const none = await loadRuntimeRights({ reader: async () => null, now: T0 });
    expect(none.status).toBe("database_not_configured");
    expect(none.profiles).toEqual(REGISTERED_PROFILES);
    expect(await loadRuntimeProfiles({ reader: async () => null })).toEqual(REGISTERED_PROFILES);

    const down = await loadRuntimeRights({ reader: async () => { throw new Error("tilkobling feilet: SENTINEL-FEILTEKST-SOM-IKKE-SKAL-LEKKE"); }, now: T0 });
    expect(down.status).toBe("database_unavailable");
    expect(JSON.stringify(down)).not.toContain("SENTINEL-FEILTEKST");
    expect(resolveRuntimeRights(down, "synthetic-demo", T0).inForce).toBe(true);
    expect(resolveRuntimeRights(down, "test-provider", T0)).toMatchObject({ inForce: false, reason: "unknown_provider" });
  });

  it("leser raden fra leseren og bygger øyeblikksbildet (aktiv ekte profil + syntetisk)", async () => {
    const rt = await loadRuntimeRights({ reader: async () => [rowOf(P), rowOf(SYNTHETIC_RIGHTS_PROFILE)], now: T0 });
    expect(rt.status).toBe("ok");
    expect(rt.profiles.map((p) => `${p.providerId}@${p.version}`).sort()).toEqual(["synthetic-demo@1", "test-provider@1"]);
  });
});

// ------------------------------------------------------------------------------------------------ 2. handle

describe("typet resultat-handle", () => {
  const { prov, handle } = resultFor(P);

  it("gyldig handle: bare de avtalte feltene, parser tilbake identisk og hører til proveniensen", () => {
    expect(Object.keys(handle).sort()).toEqual(["environment", "provenanceRef", "providerId", "resultId", "retrievedAt", "rights", "version"]);
    expect(handle).toMatchObject({ version: 1, providerId: "test-provider", environment: "sandbox", resultId: prov.publicId, rights: { profileId: "test-provider@1", version: 1, digest: profileDigest(P) } });
    expect(handle.provenanceRef).toBe(provenanceReference(prov, sha256Hex));
    const parsed = parseResultHandle(JSON.parse(JSON.stringify(handle)));
    expect(parsed).toEqual({ ok: true, handle });
    expect(verifyHandle(handle, prov, sha256Hex)).toBeNull();
    expect(handleFor(prov)).toEqual(handle);
  });

  it("handlen inneholder ikke leverandørens rå id, kilde-URL eller annonsedata", () => {
    const text = JSON.stringify(handle);
    expect(prov.providerListingId).toBe("RAW-PROVIDER-ID-991");
    for (const forbidden of ["RAW-PROVIDER-ID-991", "sentinel-url", "SENTINEL", "31337", "ring 12345678"]) expect(text).not.toContain(forbidden);
  });

  it.each([
    ["null", null, "not_object"], ["streng", "m1_x", "not_object"], ["liste", [], "not_object"], ["tomt objekt", {}, "unknown_keys"],
    ["rå leverandør-id smuglet inn", { ...handle, providerListingId: "RAW-PROVIDER-ID-991" }, "unknown_keys"],
    ["nyttelast smuglet inn", { ...handle, payload: { price: 1 } }, "unknown_keys"],
    ["manglende nøkkel", Object.fromEntries(Object.entries(handle).filter(([k]) => k !== "retrievedAt")), "unknown_keys"],
    ["versjon 2", { ...handle, version: 2 }, "version"],
    ["ugyldig leverandør-id", { ...handle, providerId: "Test Provider!" }, "provider_id"],
    ["ukjent miljø", { ...handle, environment: "production" }, "environment"],
    ["resultat-id er en rå leverandør-id", { ...handle, resultId: "RAW-PROVIDER-ID-991" }, "result_id"],
    ["resultat-id feil lengde", { ...handle, resultId: "m1_kort" }, "result_id"],
    ["ugyldig proveniensreferanse", { ...handle, provenanceRef: "pv1_zz" }, "provenance_ref"],
    ["rettighetsprofil-id stemmer ikke med leverandør@versjon", { ...handle, rights: { ...handle.rights, profileId: "annen@1" } }, "rights"],
    ["ugyldig avtrykk", { ...handle, rights: { ...handle.rights, digest: "abc" } }, "rights"],
    ["ekstra nøkkel i rights", { ...handle, rights: { ...handle.rights, extra: 1 } }, "rights"],
    ["ugyldig hentetid", { ...handle, retrievedAt: "i går" }, "retrieved_at"],
  ] as const)("ugyldig handle (%s) avvises med %s", (_n, input, issue) => {
    expect(parseResultHandle(input)).toEqual({ ok: false, issue });
  });

  it("leverandørmisforhold: handle fra annen leverandør/miljø mot proveniensen avvises", () => {
    expect(verifyHandle({ ...handle, providerId: "annen-leverandor", rights: { ...handle.rights, profileId: "annen-leverandor@1" } }, prov, sha256Hex)).toBe("provider_mismatch");
    expect(verifyHandle({ ...handle, environment: "live" }, prov, sha256Hex)).toBe("provider_mismatch");
  });

  it("resultat-, rettighets- og proveniensmisforhold avdekkes hver for seg", () => {
    expect(verifyHandle({ ...handle, resultId: derivePublicId("test-provider", "ANNEN-ID", KEY) }, prov, sha256Hex)).toBe("result_id_mismatch");
    expect(verifyHandle({ ...handle, rights: { ...handle.rights, version: 2, profileId: "test-provider@2" } }, prov, sha256Hex)).toBe("rights_mismatch");
    expect(verifyHandle({ ...handle, rights: { ...handle.rights, digest: "0".repeat(64) } }, prov, sha256Hex)).toBe("rights_mismatch");
    expect(verifyHandle(handle, { ...prov, schemaVersion: "test-provider@2" }, sha256Hex)).toBe("provenance_mismatch"); // annen normalisering enn handlen peker på
    expect(verifyHandle(handle, { ...prov, retrievedAt: minutes(1).toISOString() }, sha256Hex)).toBe("provenance_mismatch");
    expect(verifyHandle({ ...handle, provenanceRef: "pv1_" + "a".repeat(32) }, prov, sha256Hex)).toBe("provenance_mismatch");
  });

  it("proveniensreferansen avhenger ikke av leverandørens rå id utover resultat-id-en (to ulike annonser ⇒ ulike referanser)", () => {
    expect(resultFor(P, T0, "ANNEN-ID-2").handle.provenanceRef).not.toBe(handle.provenanceRef);
  });

  it("manglende/feil opak kartlegging: id-en må være Merovos HMAC for (leverandør, id); sandbox uten nøkkel feiler lukket", () => {
    expect(verifyHandleMapping(handle, "RAW-PROVIDER-ID-991", KEY)).toBe("ok");
    expect(verifyHandleMapping(handle, "ANNEN-ID", KEY)).toBe("opaque_id_mismatch");
    expect(verifyHandleMapping(handle, "RAW-PROVIDER-ID-991", "for-kort")).toBe("opaque_mapping_missing");
    expect(verifyHandleMapping(handle, "RAW-PROVIDER-ID-991", undefined)).toBe("opaque_mapping_missing"); // (SCOUT_PUBLIC_ID_KEY er ikke satt i testmiljøet)
  });
});

// ------------------------------------------------------------------------------------------------ 3. samlet vurdering

describe("samlet tilgangsvurdering (visning, felt, lenke, lagring, oppdatering, geografi)", () => {
  const rt = rights([rowOf(P)]);

  it("gyldig leverandør + aktive rettigheter: eksplisitt tillatte felt er sanne, eksplisitt forbudte er falske", () => {
    const d = evalAt(P, rt, minutes(1));
    expect(d).toMatchObject({ canDisplay: true, reason: null, canShowPrice: true, canShowImages: false, canShowSellerInfo: true, canLinkToSource: true, geographyAllowed: true });
    expect(d.fields).toMatchObject({ price: true, images: false, seller_identity: true, seller_location: false, source_url: true });
    expect(d.attribution).toEqual({ required: true, text: "Testattribusjon" });
  });

  it("eksplisitt forbudt felt: pris nektet gir canShowPrice=false uten å påvirke resten; eksplisitt tillatte bilder gir true", () => {
    const noPrice = provider({ display: { price: false, images: true, source_url: false, seller_identity: false, seller_location: false }, geography: { unrestricted: true, countries: [] } });
    const d = evalAt(noPrice, rights([rowOf(noPrice)]), minutes(1));
    expect(d).toMatchObject({ canDisplay: true, canShowPrice: false, canShowImages: true, canShowSellerInfo: false, canLinkToSource: false });
  });

  it("selgerinfo er sann bare når identitet ELLER sted er tillatt; kilde-lenke krever både rett og en kilde-URL i proveniensen", () => {
    const loc = provider({ display: { seller_identity: false, seller_location: true }, geography: { unrestricted: true, countries: [] } });
    expect(evalAt(loc, rights([rowOf(loc)]), minutes(1)).canShowSellerInfo).toBe(true);
    const { prov, handle } = resultFor(P);
    // kilde-URL er avledet av profilen (dekket av rettighetsavtrykket), ikke del av proveniensreferansen; fjernes den, kan det ikke lenkes
    const noUrl = evaluateResultAccess(handle, { ...prov, sourceUrlRef: null }, ctx(rt, minutes(1)));
    expect(noUrl.canDisplay).toBe(true);
    expect(noUrl.canLinkToSource).toBe(false);
  });

  it("alt avslag er helt: deniedAccess har alle evner false", () => { allDenied(deniedAccess("expired")); });

  it("rettighetene har endret seg siden hentingen (ny versjon / endret innhold) ⇒ avslag rights_changed", () => {
    const v2 = provider({ version: 2, display: { price: false } });
    expect(evalAt(P, rights([rowOf(P), rowOf(v2)]), minutes(1))).toMatchObject({ canDisplay: false, reason: "rights_changed" });
    const edited = { ...rowOf(P), display_fields: { ...(rowOf(P).display_fields as object), images: true } };
    expect(evalAt(P, rights([edited]), minutes(1))).toMatchObject({ canDisplay: false, reason: "rights_changed" });
  });

  it("retensjon overskredet ⇒ avslag; ikke-lagret (retensjon 0) data eldre enn det transiente vinduet ⇒ avslag", () => {
    const stored = provider({ storage: { ...P.storage, retentionSeconds: 3600 }, geography: { unrestricted: true, countries: [] } });
    const rs = rights([rowOf(stored)]);
    expect(evalAt(stored, rs, minutes(59), T0)).toMatchObject({ canDisplay: true, mayRetain: true, retentionSeconds: 3600, retainUntil: minutes(60).toISOString() });
    expect(evalAt(stored, rs, minutes(61), T0)).toMatchObject({ canDisplay: false, reason: "retention_exceeded" });
    const transient = provider({ storage: { ...P.storage, retentionSeconds: 0, historyRetentionSeconds: 0 }, geography: { unrestricted: true, countries: [] } });
    const rtr = rights([rowOf(transient)]);
    expect(evalAt(transient, rtr, minutes(4), T0)).toMatchObject({ canDisplay: true, mayRetain: false, retainUntil: null });
    expect(evalAt(transient, rtr, minutes(6), T0)).toMatchObject({ canDisplay: false, reason: "transient_data_stale" });
  });

  it("lagringsrett: retainUntil kappes ved profilens slutt", () => {
    const capped = provider({ validUntil: "2026-10-23T12:30:00Z", storage: { ...P.storage, retentionSeconds: 86_400 }, geography: { unrestricted: true, countries: [] } });
    expect(evalAt(capped, rights([rowOf(capped)]), minutes(1))).toMatchObject({ mayRetain: true, retainUntil: "2026-10-23T12:30:00.000Z" });
  });

  it("må oppdateres før visning: cacheSeconds = 0 (ingen cache-rett) ⇒ alltid ny henting, uten oppfunnet varighet; cache > 0 ⇒ profilens egen varighet", () => {
    const stored = (cache: number) => provider({ storage: { ...P.storage, retentionSeconds: 7200, cacheSeconds: cache }, geography: { unrestricted: true, countries: [] } });
    const c0 = stored(0), c10 = stored(600);
    const rt0 = rights([rowOf(c0)]);
    // 0: ingen tidsfrist finnes — hverken etter 0, 4, 6 eller 90 minutter blir svaret et annet (ingen skjult 5-minuttersgrense)
    for (const m of [0, 4, 6, 90]) expect(evalAt(c0, rt0, minutes(m))).toMatchObject({ canDisplay: true, mustRefreshBeforeDisplay: true, refreshAfter: null });
    // > 0: bare profilens egen oppgitte varighet
    expect(evalAt(c10, rights([rowOf(c10)]), minutes(9))).toMatchObject({ mustRefreshBeforeDisplay: false, refreshAfter: minutes(10).toISOString() });
    expect(evalAt(c10, rights([rowOf(c10)]), minutes(11))).toMatchObject({ mustRefreshBeforeDisplay: true, refreshAfter: minutes(10).toISOString() });
  });

  it("denied-utfall oppgir ingen oppdateringsfrist; lagringsretten (retentionSeconds) er uavhengig av cacheSeconds", () => {
    const d = deniedAccess("expired");
    expect(d).toMatchObject({ mustRefreshBeforeDisplay: false, refreshAfter: null });
    const noCacheButStored = provider({ storage: { ...P.storage, retentionSeconds: 7200, cacheSeconds: 0 }, geography: { unrestricted: true, countries: [] } });
    expect(evalAt(noCacheButStored, rights([rowOf(noCacheButStored)]), minutes(1))).toMatchObject({ mayRetain: true, retentionSeconds: 7200, mustRefreshBeforeDisplay: true });
  });

  it("geografi: begrenset leverandør tillater bare oppgitt land; ukjent land (null) nektes; ubegrenset tillater alt", () => {
    expect(evalAt(P, rt, minutes(1), T0, "NO").canDisplay).toBe(true);
    expect(evalAt(P, rt, minutes(1), T0, "SE")).toMatchObject({ canDisplay: false, reason: "geography_not_allowed" });
    expect(evalAt(P, rt, minutes(1), T0, null)).toMatchObject({ canDisplay: false, reason: "geography_not_allowed" });
    const open = provider({ geography: { unrestricted: true, countries: [] } });
    expect(evalAt(open, rights([rowOf(open)]), minutes(1), T0, null).canDisplay).toBe(true);
  });

  it("annonsen er borte hos kilden ⇒ unavailable; handle/proveniens-misforhold gir tilsvarende avslag uten evner", () => {
    expect(evalAt(P, rt, minutes(1), T0, "NO", { listingAvailable: false })).toMatchObject({ canDisplay: false, reason: "unavailable" });
    const { prov, handle } = resultFor(P);
    const other = resultFor(provider({ providerId: "annen-leverandor" })).prov;
    const d = evaluateResultAccess(handle, other, ctx(rt, minutes(1)));
    expect(d.reason).toBe("provider_mismatch");
    allDenied(d);
    expect(evaluateResultAccess(handle, { ...prov, schemaVersion: "x@9" }, ctx(rt, minutes(1))).reason).toBe("provenance_mismatch");
    expect(evaluateResultAccess({ ...handle, resultId: derivePublicId("test-provider", "andre", KEY) }, prov, ctx(rt, minutes(1))).reason).toBe("result_id_mismatch");
  });

  it("serverhjelperen binder avtrykk/hash og gir samme svar som domenet", () => {
    const { prov, handle } = resultFor(P);
    expect(accessFor(handle, prov, rt, minutes(1), "NO")).toEqual(evaluateResultAccess(handle, prov, ctx(rt, minutes(1))));
  });

  it("canonicalPermissions er stabil for samme profil uavhengig av kilde (kode vs. DB-tolket)", () => {
    const m = profileFromRow(rowOf(P));
    expect(m.ok && canonicalPermissions(m.profile)).toBe(canonicalPermissions(P));
    expect(noRights()).toMatchObject({ price: false });
  });
});

// ------------------------------------------------------------------------------------------------ 3b. versjoner og tilbakekalling

describe("tilbakekalling stopper oppløsningen: ingen stille tilbakefall til en eldre versjon (DATA-002D-2)", () => {
  const v = (version: number, over: Partial<ProviderRightsProfile> = {}) => provider({ version, geography: { unrestricted: true, countries: [] }, ...over });
  const REVOKED = { status: "revoked" } as const;
  const DRAFT = { status: "draft", verifiedBy: null, verifiedAt: null } as const;
  const EXPIRED = { validUntil: "2026-10-23T00:00:00Z" } as const; // eksklusiv slutt før T0
  const at = (profiles: ProviderRightsProfile[]) => resolveRights("test-provider", profiles, T0);
  const version = (r: ReturnType<typeof at>) => (r.inForce ? r.profile.version : r.profileVersion);

  it("1. v1 verifisert + v2 trukket ⇒ leverandøren nektes (revoked, versjon 2); ingen tilbakefall til v1", () => {
    const r = at([v(1), v(2, REVOKED)]);
    expect(r).toMatchObject({ inForce: false, reason: "revoked", profileVersion: 2 });
    expect(at([v(2, REVOKED), v(1)])).toMatchObject({ inForce: false, reason: "revoked", profileVersion: 2 }); // rekkefølgen i listen er uten betydning
  });

  it("1b. også gjennom databaseraden → lasteren → samlet vurdering: v1-resultat nektes med årsak revoked og alle evner false", () => {
    const rt = rights([rowOf(v(1)), rowOf(v(2, REVOKED))]);
    expect(rt.profiles).toHaveLength(3); // synthetic-demo + v1 + v2: historikken beholdes, ingenting slettes eller skrives om
    expect(resolveRuntimeRights(rt, "test-provider", T0)).toMatchObject({ inForce: false, reason: "revoked", profileVersion: 2 });
    const d = evalAt(v(1), rt, minutes(1));
    expect(d.reason).toBe("revoked");
    allDenied(d);
  });

  it("1c. en trukket versjon som i tillegg er strukturelt ugyldig nekter fortsatt (uttrykkelig status avgjør, ikke gyldighet)", () => {
    const badRevoked = { ...v(2, REVOKED), display: {} } as unknown as ProviderRightsProfile;
    expect(at([v(1), badRevoked])).toMatchObject({ inForce: false, reason: "revoked", profileVersion: 2 });
  });

  it("1d. proveniens for et resultat hentet under v1 feiler lukket når v2 er trukket (evaluateProvenance alene, uten å gå via resolveRights)", () => {
    const { prov } = resultFor(v(1));
    const ctx1 = { now: minutes(1), digestOf: profileDigest };
    expect(evaluateProvenance(prov, { ...ctx1, profiles: [v(1)] })).toBe("valid");
    expect(evaluateProvenance(prov, { ...ctx1, profiles: [v(1), v(2, REVOKED)] })).toBe("rights_revoked");
    // og en trukket versjon som er ELDRE enn resultatets versjon berører det ikke
    const { prov: prov2 } = resultFor(v(2));
    expect(evaluateProvenance(prov2, { ...ctx1, profiles: [v(1, REVOKED), v(2)] })).toBe("valid");
  });

  it("2. v1 verifisert + v2 utløpt ⇒ uendret utløpssemantikk: v2 hoppes over, v1 gjelder; er også v1 utløpt avslås med årsaken til den nyeste (expired)", () => {
    expect(version(at([v(1), v(2, EXPIRED)]))).toBe(1);
    expect(at([v(1), v(2, EXPIRED)]).inForce).toBe(true);
    expect(at([v(1, EXPIRED), v(2, EXPIRED)])).toMatchObject({ inForce: false, reason: "expired", profileVersion: 2 });
  });

  it("3. v1 verifisert + v2 utkast ⇒ uendret semantikk: et utkast er ikke en tilbakekalling og ikke i kraft, så v1 gjelder; ingen NYTT tilbakefall er innført. Bare utkast ⇒ not_verified", () => {
    expect(version(at([v(1), v(2, DRAFT)]))).toBe(1);
    expect(at([v(1), v(2, DRAFT)]).inForce).toBe(true);
    expect(at([v(2, DRAFT)])).toMatchObject({ inForce: false, reason: "not_verified", profileVersion: 2 });
  });

  it("4. en senere, uttrykkelig gyldig versjon gjenoppretter tilgang — og det er v3 som gjelder, ikke v1", () => {
    const r = at([v(1), v(2, REVOKED), v(3)]);
    expect(r.inForce).toBe(true);
    expect(version(r)).toBe(3);
    // gjennom lasteren og den samlede vurderingen: resultat hentet under v3 kan vises, resultat hentet under v1 kan ikke (hentet under en erstattet profil)
    const rt = rights([rowOf(v(1)), rowOf(v(2, REVOKED)), rowOf(v(3))]);
    expect(evalAt(v(3), rt, minutes(1))).toMatchObject({ canDisplay: true, reason: null });
    expect(evalAt(v(1), rt, minutes(1))).toMatchObject({ canDisplay: false });
  });

  it("4b. en eldre versjon kan ikke gjenopprettes implisitt: v2 trukket + v3 utkast / utløpt / ikke begynt ⇒ fortsatt nektet (ikke v1)", () => {
    for (const later of [DRAFT, EXPIRED, { validFrom: "2026-11-01T00:00:00Z" }] as Partial<ProviderRightsProfile>[]) {
      expect(at([v(1), v(2, REVOKED), v(3, later)]), JSON.stringify(later)).toMatchObject({ inForce: false, reason: "revoked", profileVersion: 2 });
    }
    // v3 var i kraft og utløper senere: da faller oppløsningen til den trukne v2 (nektet), ikke til v1
    const v3 = v(3, { validUntil: "2026-10-24T00:00:00Z" });
    expect(resolveRights("test-provider", [v(1), v(2, REVOKED), v3], T0).inForce).toBe(true);
    expect(resolveRights("test-provider", [v(1), v(2, REVOKED), v3], new Date("2026-10-25T00:00:00Z"))).toMatchObject({ inForce: false, reason: "revoked", profileVersion: 2 });
  });

  it("en trukket ELDRE versjon påvirker ikke en nyere som er i kraft; trukket eneste versjon ⇒ revoked", () => {
    expect(version(at([v(1, REVOKED), v(2)]))).toBe(2);
    expect(at([v(1, REVOKED)])).toMatchObject({ inForce: false, reason: "revoked", profileVersion: 1 });
  });

  it("5. syntetisk/demo er uendret: én verifisert versjon gjelder; trukket sandbox-leverandør påvirker ikke synthetic-demo; DB-lasting beholder syntetisk", () => {
    expect(resolveRights("synthetic-demo", REGISTERED_PROFILES, T0).inForce).toBe(true);
    const rt = rights([rowOf(v(1)), rowOf(v(2, REVOKED)), rowOf(SYNTHETIC_RIGHTS_PROFILE)]);
    expect(resolveRuntimeRights(rt, "synthetic-demo", T0).inForce).toBe(true);
    expect(resolveRuntimeRights(rt, "test-provider", T0)).toMatchObject({ inForce: false, reason: "revoked" });
  });
});

// ------------------------------------------------------------------------------------------------ 4. syntetisk/demo

describe("syntetiske demoresultater virker uendret og arver ingen leverandørrestriksjoner", () => {
  const spec = () => {
    const r = parseSearchFormValues({ ...EXAMPLES.find((e) => e.id === "demo-bmw")!.values() }, DEMO_CATALOG, { newCostId: () => "000000000001" });
    if (!r.ok || !r.spec) throw new Error(JSON.stringify(r.errors));
    return r.spec;
  };
  const synth = (): MarketplaceProvider => new SyntheticMarketplaceProvider({ records: syntheticRawListings, now: () => T0 });

  it("BMW iX3-demoen: standardprofiler (uten databasevei) gir treff, hver med typet handle som matcher visningens opake id; UI-modellen har ingen handle/proveniens", async () => {
    const r = await previewInternal(spec(), { provider: synth(), now: () => T0 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items.length).toBeGreaterThan(0);
    for (const i of r.items) {
      expect(i.handle).toMatchObject({ providerId: "synthetic-demo", environment: "synthetic", resultId: i.display.listing.listingId });
      expect(verifyHandle(i.handle, i.provenance, sha256Hex)).toBeNull();
      expect(Object.keys(i.display).sort()).toEqual(["assessment", "economics", "enrichment", "listing", "media", "unknowns"]);
      const shown = JSON.stringify(i.display, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
      expect(i.display.listing.listingId).not.toBe(i.provenance.providerListingId); // produktkoden bruker alltid den opake id-en
      // leverandørens id kan bare dukke opp i det rettighetsstyrte feltet `providerListingId` (synthetic-demo tillater `listing_id`), aldri andre steder:
      const rest = Object.fromEntries(Object.entries(i.display.listing).filter(([k]) => k !== "providerListingId"));
      expect(JSON.stringify({ ...i.display, listing: rest }, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).not.toContain(i.provenance.providerListingId);
      expect(shown).not.toContain(i.handle.provenanceRef);
    }
  });

  it("samlet vurdering for et syntetisk resultat: vises med syntetisk attribusjon, ubegrenset geografi, bilder ikke tillatt fra kilden", async () => {
    const r = await previewInternal(spec(), { provider: synth(), now: () => T0 });
    if (!r.ok) throw new Error("preview");
    const rt = await loadRuntimeRights({ reader: async () => null, now: T0 });
    const i = r.items[0]!;
    const d = accessFor(i.handle, i.provenance, rt, T0, null);
    expect(d).toMatchObject({ canDisplay: true, canShowPrice: true, canShowImages: false, geographyAllowed: true, mayRetain: true, retentionSeconds: 604_800 });
    expect(d.attribution.text).toMatch(/Syntetiske demodata/);
  });

  it("detaljsiden (via opak id) virker som før; en blokkert/defekt SANDBOX-leverandør påvirker ikke syntetiske resultater", async () => {
    const r = await previewInternal(spec(), { provider: synth(), now: () => T0 });
    if (!r.ok) throw new Error("preview");
    const id = r.items[0]!.display.listing.listingId;
    expect((await detailForDisplay(spec(), id, { provider: synth(), now: () => T0 })).kind).toBe("ok");

    const broken = rowOf(P); broken.display_fields = {};
    const rt = rights([broken]);
    expect(rt.blockedProviders.has("test-provider")).toBe(true);
    expect(resolveRuntimeRights(rt, "synthetic-demo", T0).inForce).toBe(true);
    const i = r.items[0]!;
    expect(accessFor(i.handle, i.provenance, rt, T0, null).canDisplay).toBe(true);
    // og motsatt: utilgjengelig database nekter leverandører, men ikke demoen
    const down = await loadRuntimeRights({ reader: async () => { throw new Error("nede"); }, now: T0 });
    expect(accessFor(i.handle, i.provenance, down, T0, null).canDisplay).toBe(true);
    expect(evalAt(P, down, minutes(1))).toMatchObject({ canDisplay: false, reason: "unknown_provider" });
  });

  it("syntetisk id kan kartlegges uten nøkkel (innebygd pepper), men en sandbox-handle kan ikke det", async () => {
    const r = await previewInternal(spec(), { provider: synth(), now: () => T0 });
    if (!r.ok) throw new Error("preview");
    const i = r.items[0]!;
    expect(verifyHandleMapping(i.handle, i.provenance.providerListingId)).toBe("ok");
    expect(verifyHandleMapping(resultFor(P).handle, "RAW-PROVIDER-ID-991")).toBe("opaque_mapping_missing");
  });
});
