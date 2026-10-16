# DATA-001 — plan for overgang fra syntetiske data til leverandørdata (16.10.2026)

**Status: REVIEW** (planleggingsdokument; ikke DONE før Christians/Codex' gjennomgang). Ingen kode, Supabase, deploy eller leverandørtilkobling er rørt; ingen leverandør-legitimasjon er brukt eller lest; ingen scraping.

**Faktamerking.** *[REPO]* = står i repoets dokumenter/kode. *[OPPGITT]* = oppgitt av Christian, ikke kontrollert mot skriftlig kilde i repoet (gjelder bl.a. mobile.de-sandbox, 10 000 forespørsler/mnd og Light/Professional). *[UKJENT]* = ikke avklart og behandles som **ikke tillatt** (default-deny, jf. DEC-028). Ingen rettighet er antatt gitt. Forhold om VEND, AutoScout24 og OEM-er er **[UKJENT]**: repoet inneholder ingenting om dem.

## 1. Dagens dataarkitektur
```
SyntheticMarketplaceProvider ──► NormalizedListing ──► CandidateAdapter ──► evaluateCandidate/classifyBudget ──► combineAssessment ──► ResultCard/Explanation (/searches)
(src/providers/marketplace/     (src/domain/types.ts)   (src/adapters/       (src/domain/search-v2/*)           (src/server/search-preview.ts)   (src/components/search/*,
 synthetic/*, fixtures/)                                  search-candidate/*)                                                                     src/app/searches/**)
```
- **Providerabstraksjon finnes:** `MarketplaceProvider` (`src/providers/marketplace/types.ts`: `source`, `search(query, window)`, `getListing(id)`), `SearchPage` (med `nextPage`, `sourceTotal`, `truncated`, `fetchedAt`, `rejected`), feiltyper i `errors.ts`, og velgeren `getMarketplaceProvider()` i `index.ts` (returnerer i dag alltid den syntetiske).
- **Provider-uavhengig:** `NormalizedListing`-formen, hele søkemodellen/evalueringen (`src/domain/search-v2`), forklaringstekster (`src/lib/search-explain.ts`), `previewSearch`/`assessListing`, kandidatadapterens kjerne (`candidate.ts` + `mapping.ts`: tar eksplisitt mappingdata per kilde), UI.
- **Syntetisk-spesifikt:** `synthetic/*` (råformat, normalisering, fixturer), `synthetic-mapping-data.ts` (merke/modell/farge-mapping for kilden `synthetic-demo`), `capabilities.ts` (`SYNTHETIC_SOURCE_CAPABILITIES`: hva *denne* kilden kan oppgi), demokatalogen (`demo-catalog.ts`), etiketten «Syntetiske demodata …» (hardkodet i `search-labels.ts`).
- **Hvor rettigheter/retensjon håndheves i dag (DEV-005B0, DEC-028/029):** kun for *lagring* av agentkjøringer: `src/domain/rights.ts` (`applyStoragePolicy`), `private.provider_rights_profiles` (versjonert, default-deny, virkningsperiode, status, retensjon, datatyper), `rights_profile_version`/`expires_at` per rad, RLS-synlighet, `purge_expired_search_runs`, betrodd skriveveg (`trusted-ingest.ts`, rollen `scout_ingest`). Syntetisk kilde har profil `synthetic-demo` v1.
- **Hvor visningsrettigheter MANGLER:** `/searches` (forhåndsvisning og detalj) **bruker ikke** `rights.ts`/profiler i det hele tatt. `previewSearch` henter fra provideren og `ResultCard`/detaljsiden rendrer pris, spesifikasjoner, selgertype/land, fritekst (`listing.text`) og provider-etikett direkte fra `NormalizedListing`. Ingenting lagres (utkastene har bare søkekrav), så lagringsreglene treffes ikke — men en ekte provider ville vises uten kontroll. `NormalizedListing.provenance` har bare `{kind, description, normalizationNotes}`: ingen hentetid, rettighetsprofil, utløp eller tillatte felt. Det finnes ikke noe `images`-felt i modellen i dag (ingen bildevisning; bare nøytral illustrasjon).

## 2. De fire datatrinnene

### Trinn A — kontrollert syntetisk (dagens demo)
**Formål:** produktdemonstrasjon, UX-validering, validering av søkemodellen. **Tillatt:** internt konstruerte annonser med tydelig syntetisk identitet (`synthetic-demo`, id-er `demo-/syn-/dvar-`); ingen ekte markedsplass-/OEM-data, ingen kopierte annonser, ingen navn som imiterer leverandører. **Merking:** «Syntetiske demodata – ikke ekte leverandørdata» overalt. **Eksternt:** kan vises til partnere (er det nå, på `demo.merovo.eu`).
**Exit-kriterier (for å gå videre):** (1) visningsrettighetsfundament (§3) og leverandørprofilmodell (§4) bygget og testet *med syntetiske profiler*; (2) provenance-minimum (§7) lagret/propagert; (3) ≥ 1 skriftlig leverandørvilkår foreligger for sandbox-bruk; (4) Codex-review av DEV-006-sporet; (5) DB-/RLS-suitene kjørt mot faktisk Supabase.

### Trinn B — leverandørsandbox (f.eks. mobile.de)
**Formål:** validere autentisering, kall, spørringsmapping, paginering, feilhåndtering, rate-limit/kvote, skjemamapping.
**Viktig:** sandbox-data er **ikke** live-inventar og må aldri presenteres som det.
- **Kan valideres:** Basic-auth/headers *[REPO: MOBILE_DE_INTEGRATION.md]*, søke- og detaljendepunkter, pagineringsgrense (2 000 annonser/søk *[REPO]*), feilkoder (401/403/404/429/5xx), responsformat og feltnavn, enum-/referansedata-mapping, at søk→detalj gir flere felter, `Accept`-versjonsheader.
- **Kan ikke valideres:** dekning og kvalitet i ekte inventar, ekte pris-/annonseadferd (endringer, bortfall), representative ufullstendige data, volum/ytelse, ekte kvoteforbruk, visnings-/lagringsrettigheter for ekte annonser, kommersielt oppsett.
- **Provider-spesifikk kode:** autentisering og HTTP-klient, spørringsoversetter (`SearchQuery` → provider-parametre), responsnormalisering (`raw → NormalizedListing`), mappingdata (`CandidateMappingData` for kilden), `capabilities` for kilden, feilkodemapping, kvotestyring. Alt annet (evaluering, forklaring, UI, rettighetsprojeksjon) skal gjenbrukes uendret.
- **Tester:** kontrakttester mot dokumenterte respons-eksempler (egne, anonymiserte *syntetiske* fixturer i leverandørformat — kopier ikke sandbox-data inn i git uten at vilkårene tillater det); feilsimulering (401/403/429/timeout/malformed); paginerings-/truncation-test; mapping-test felt for felt; sikkerhetstest at credentials aldri når klient/logg; test at sandbox-annonser får synlig «sandbox»-merking og ikke kan forveksles med live.
- **Eksterne visninger:** sandbox-data vises ikke til eksterne partnere før sandbox-vilkårene eksplisitt tillater det; ellers kun internt.
**Exit-kriterier:** adapteren består alle kontrakt-/feiltester; mapping dokumentert; alle åpne tekniske spørsmål (§9) besvart; ingen secrets i klient/git/logg; rettighetsprofil for sandbox registrert; Codex-review.

### Trinn C — begrenset pilot med ekte inventar
En leverandør gir kontrollert tilgang til ekte annonser for en avgrenset pilot. **Ingenting av dette er tillatt før skriftlig avtale** og er registrert som verifisert profil.
**Minstekrav (hver må være besvart skriftlig, ellers [UKJENT] = nei):**
| Område | Spørsmål som må avklares |
|---|---|
| Kontrakt/dataprofil | Gjeldende avtale, versjon, virkningsdato, utløp, hvem som har signert |
| Tillatte felt / visningsfelt | Hvilke felt kan hentes, hvilke kan **vises** (tittel, pris, km, registrering, spesifikasjoner, fritekst, selger, selgersted) |
| Bilder | Kan bilder vises/lagres/hotlinkes; størrelser; vannmerke |
| Kildehenvisning | Påkrevd leverandørnavn/logo/tekst |
| Dypelenke | Krav om lenke til originalannonse, format, åpne i ny fane, sporing |
| Geografi | Land/regioner annonser og brukere kan dekke |
| Spørrebegrensninger | Kvoter, intervall, samtidighet, burst; kostnad ved overskridelse |
| Lagring/cache | Hva kan lagres, hvor lenge, hvor (region), cache-TTL |
| Retensjon/utløp | Utløp per datatype; tillatt historikk (prishistorikk, revisjoner) |
| Gjenbruk på tvers av kunder | Kan én hentet annonse vurderes mot flere forhandleres forespørsler? Kan resultater deles mellom firma? |
| Varsler/oppdateringer | Kan vi varsle (e-post/push) med dataene, og med hvilket innhold? |
| Sletting/purge | Frist og bevis ved tilbakekalling/avtaleslutt/annonsebortfall |
| Revisjonsspor | Hva må logges (hvem så hva når); innsynsrett for leverandøren |
| Avledede data | Kan beregnede utfall (treff, rang, forklaring) beholdes etter råretensjon? |
| Tredjepartsbehandling | LLM/analyse (i dag: ingen LLM i Merovo) |
| Sluttbrukere | Kan norske forhandlere (ikke bare Merovo) bruke dataene |
**Tekniske porter:** se §11 (alle punkter der).
**Exit-kriterier:** pilotperiode gjennomført uten rettighetsbrudd; kvoter holdt; purge/tilbakekalling øvet; Christian godkjenner overgang.

### Trinn D — produksjonsintegrasjon
For eksterne forhandlere i drift. Må ha: **overvåking** (feilrate, kvoteforbruk, ferskhet, `rejected`-rate, kostnad); **leverandørspesifikk rettighetshåndheving** (profiler som data, håndhevet i flere lag, §3); **feilatferd** (delvis resultat merket per leverandør, aldri stille utelatelse; 401/403 stopper og varsler; 429 med backoff og kvotevern); **retensjon/purge-jobber** planlagt (i dag ingen scheduler); **leverandørversjonering** (API-/skjema-versjon i profilen og mappingen; endringsvarsling); **rate-limit-beskyttelse** (kvotebudsjett per leverandør og per kunde, global strupe); **proveniens** (§7); **tenant-håndtering** (RLS som i dag; fellesdata kun når gjenbruk er avtalt); **kontraktskonfigurasjon** (profil per avtale, versjonert, endringslogg); **offboarding/tilbakekalling** (trukket profil skjuler og sletter umiddelbart; testet øvelse); **hendelseshåndtering** (rutine for lekkasje/feilvisning av data, varsling av leverandør, loggbevaring).

## 3. Håndheving av visningsrettigheter (viktigste åpne tekniske grense)
**Krav:** per leverandør/rettighetsprofil skal systemet kunne avgjøre, per felt: tittel, pris, km, registrering (dato/år), tekniske spesifikasjoner, fritekst, selgeridentitet, selgersted, bilder, leverandørnavn, kilde-URL/dypelenke — pluss om verdier kan caches, hvor lenge de kan lagres og om historiske versjoner kan beholdes. **Et felt som ikke er tillatt skal ikke rendres og aldri erstattes med oppdiktet data.**
**Tilstander (fire, adskilte):**
| Tilstand | Betydning | Visning |
|---|---|---|
| `value` | Kjent og tillatt | verdien |
| `unknown` | Leverandøren oppgir det ikke | «ikke oppgitt» (som i dag) |
| `withheld` | Oppgitt men ikke tillatt vist/lagret (profil) | «vises ikke (leverandørvilkår)» eller utelatt — aldri verdi |
| `unavailable` | Kunne ikke hentes (feil, detalj ikke hentet) | «ikke tilgjengelig nå» |
**Anbefaling: forsvar i dybden (flere lag), med ett autoritativt sted:**
1. **Ved innhenting (minimering):** be bare om tillatte felt der API-et lar oss; forkast ikke-tillatte felt umiddelbart etter normalisering, før noe ligger i minnet lenger enn nødvendig eller lagres.
2. **Normalisert datalag (autoritativt):** en ren funksjon `applyDisplayPolicy(listing, profil, nå) → DisplayableListing` (parallell til dagens `applyStoragePolicy`). `DisplayableListing` er en *egen type* der hvert felt er en av de fire tilstandene. All UI-/server-kode som viser data tar kun denne typen; rå `NormalizedListing` kan ikke importeres i komponenter (arkitekturtest, slik vi allerede har for klientimport).
3. **Serverrespons:** serverkomponenter/handlinger sender bare projisert data til klienten (ingen rå felt i RSC-payload, jf. at bundling av ikke-brukte props også eksponerer data).
4. **UI:** rendrer etter tilstand; kan ikke vise `withheld`. Etikett og kildehenvisning kommer fra profilen (attribution), ikke fra hardkodet tekst.
5. **Database:** lagrede rader bærer allerede profilversjon/utløp og whitelist-skjema (DEV-005B0); utvides med visnings- og cache-regler.
6. **Tester:** egenskapstester (ingen `withheld` verdi finnes i noen utdata, inkl. forklaringstekst og logger), arkitekturtest (ingen rå annonse i komponenter), og «profil trukket → ingenting vises».
**Spesielle hensyn:** (a) *Forklaringer avslører verdier* («kilometerstand over kravet»): forklaringsgenereringen må være rettighetsbevisst — om verdier kun kan brukes til vurdering, men ikke vises, må forklaringen si «oppfyller ikke kravet» uten verdi, og dette er en egen avtalesak (avledede data). (b) *Behandling ≠ visning:* profilen skiller «kan brukes til matching», «kan vises», «kan lagres». (c) *Sandbox/live* er en egenskap i profilen. (d) Profil mangler/utløpt ⇒ alt `withheld` (default-deny).

## 4. Leverandørkonfigurasjon (konseptuell; ikke implementert)
Minste vedlikeholdbare modell: én versjonert, uforanderlig profil per leverandør og avtale (utvider dagens `provider_rights_profiles` i stedet for ny mekanisme).
Felt: `providerId`, `environment` (`synthetic|sandbox|live`), `profileVersion`, `effectiveFrom/To`, `status` (`draft|verified|revoked`), `sourceRef` (avtalehenvisning), `verifiedBy/At`; `fieldDisplay{title,price,mileage,registration,specs,text,sellerIdentity,sellerLocation,images,providerName,sourceUrl}`; `storage{allowed,retentionSeconds,fieldsStorable,historyAllowed}`; `cache{ttlSeconds}`; `geography{countries}`; `limits{requestsPerMonth,perMinute,burst}`; `attribution{text,logoAllowed}`; `deepLink{required,format,newTab}`; `images{allowed,hotlink,store}`; `multiCustomerReuse{allowed}`; `alerts{allowed,contentFields}`; `derivedDataRetention`; `revocation{reason,at}`.
**Eksempler (illustrative; ingen verdier er avtalt):**
```yaml
# synthetic-demo (finnes i dag som profil v1; utvides til display-felt)
providerId: synthetic-demo
environment: synthetic
profileVersion: 2            # forslag
status: verified             # intern; kilde = oss selv
fieldDisplay: { all: true, images: illustration-only, sourceUrl: none }
storage: { retentionSeconds: 604800, text: false, images: false }
attribution: { text: "Syntetiske demodata – ikke ekte leverandørdata" }
multiCustomerReuse: { allowed: true }   # syntetisk, ingen tredjepart
---
# mobile-sandbox (HYPOTETISK profil for sandbox; vilkår må leses først)
providerId: mobile-sandbox
environment: sandbox
status: draft                # blir verified først når vilkårene er lest og registrert
fieldDisplay: { default: withheld }      # default-deny til skriftlig avklart
storage: { allowed: false }
attribution: { text: "Sandbox – ikke live-inventar" }
limits: { requestsPerMonth: "<fra sandbox-vilkår>" }
---
# mobile-live-pilot (HYPOTETISK; mobile.de har IKKE gitt live-rettigheter)
providerId: mobile-live-pilot
environment: live
status: draft                # kan ikke bli verified uten skriftlig avtale
fieldDisplay: "<settes felt for felt fra avtalen>"
storage: { retentionSeconds: "<avtalt>", historyAllowed: "<avtalt>" }
multiCustomerReuse: { allowed: "<avtalt>" }
alerts: { allowed: "<avtalt>" }
```

## 5. Søkearkitektur med flere leverandører
**Prinsipp:** forhandlerens behov defineres **én gang** (`SearchSpec`); leverandørspesifikk spørring/mapping ligger under. Unngå én matchmotor per leverandør, leverandørregler i UI og duplisert evaluering.
```
Forhandlerens forespørsel (SearchSpec, uendret)
 → per leverandør: spørringsoversetter (SearchSpec → leverandørparametre; bare *utvidende* forhåndsfiltre, aldri filter på ønsker eller ukjente)
 → henting (kvote/rate-styring; dekning og truncation rapporteres per leverandør)
 → normalisering (raw → NormalizedListing + provenance)
 → rettighetsfiltrering (applyDisplayPolicy → DisplayableListing + «kan brukes til matching»-flagg)
 → kandidatadapter (leverandørens mappingdata → CandidateV2)
 → evaluering (én felles evaluateCandidate)
 → deduplisering (§6; foreslå «samme bil», ikke slett)
 → forklaring (rettighetsbevisst, felles generator)
 → visning (leverandørnavn/attribution fra profil; dekning per leverandør)
```
Kontrakt per leverandør (`ProviderAdapter`): `capabilities` (hva kan skyves ned/hentes/oppgis), `translate(spec)`, `fetch(page)`, `normalize(raw)`, `mappingData`, `limits`. Delt: spec, kandidatmodell, evaluering, forklaring, rettighetsprojeksjon, dedup, UI. Delvise resultater merkes («mobile.de: avkortet ved 2 000; AutoScout24: utilgjengelig»), ingen stille utelatelse. Om en hentet annonse kan evalueres mot flere forhandlere avgjøres av profilen (`multiCustomerReuse`); er den **nei**, må hentingen skje per forespørsel og kvoten planlegges deretter.

## 6. Deduplisering
Alt er konservativt: **foreslå** likhet, slå aldri sammen i det stille, og vis «også funnet hos …».
| Metode | Når trygg | Merknad |
|---|---|---|
| Leverandørens annonse-id (per kilde) | Alltid | Identitet innen én kilde; stabil nøkkel for revisjoner |
| VIN | **Bare når avtalen tillater å hente og behandle den**; ellers ikke. Ikke anta at VIN kan lagres. Ved tillatt behandling men ikke lagring: sammenlign kun i minnet innen samme kjøring; ved tillatt lagring: lagre som saltet hash, ikke klartekst, med mindre klartekst er avtalt | Sterkest signal |
| Registreringsnummer/kjennemerke | Antas **personopplysning**; ikke bruk uten uttrykkelig avklaring | Unngå |
| Attributtfingeravtrykk (merke, modell, første registrering til måned, km-bånd, drivstoff, land, selgertype) | Alltid som *sannsynlig duplikat* | Skal gi «mulig samme bil», aldri automatisk fjerning |
| Selger + bil | Bare hvis selgeridentitet kan behandles | Kan være avtalebegrenset |
| Tilnærmet tekst-/prislikhet | Kun som tilleggssignal | Prisendringer er normalt |
Per trinn: A — provider-id + attributtfingeravtrykk (syntetisk, ingen begrensning). B — provider-id innen sandbox; ingen krysskilde. C — provider-id; VIN kun hvis avtalt; attributt-fingeravtrykk som «mulig duplikat». D — samme, pluss lagret saltet VIN-hash der avtalt.

## 7. Proveniens (minimum per resultat fra ekte leverandør)
`providerId`, `environment`, `sourceListingId`, `sourceUrl`/dypelenke (hvis tillatt), `retrievedAt` (UTC), `sourceModifiedAt`, `rightsProfileId+version` (profilen som gjaldt ved henting), `expiresAt` (kappet ved profilens slutt), `allowedFields` (hva som kunne vises/lagres), `normalizationNotes`, `mappingVersion`, `adapterVersion`, `requestId` (revisjonsspor), `coverage{truncated,page,sourceTotal}`. Svar på: hvor kom den fra, når hentet, under hvilken profil, når utløper den, hva kan vises, hvor skal forhandleren gå videre. I dag dekker `Provenance` bare `{kind, description, normalizationNotes}`; resten må utvides (og lagres i resultatutdrag der lagring er tillatt).

## 8. Demoprogresjon
- **A (nå):** dagens syntetiske sett. Trygt for eksterne partnere med fast etikett.
- **A+ (anbefalt, billig, helt syntetisk):** realistisk variasjon uten å kopiere annonser — trimnavn og utstyrskombinasjoner, flere valutaer og land, forhandler/privat, realistiske prisbånd og annonsealdre, mer ufullstendighet. **Verdt det:** gjør forklaringene mer overbevisende (flere «ukjent»-tilfeller) og tester rettighets-/dedupmodeller før ekte data. Krever utvidelse av syntetisk råformat/kapabiliteter (utstyr, seter, modellår) — en egen liten oppgave. Må merkes likt; ikke bruk ekte annonsetekster eller merker som antyder samarbeid.
- **Sandbox-støttet demo:** kun internt (eller med uttrykkelig tillatelse); synlig «Sandbox – ikke live-inventar». Ikke vis for eksterne partnere som om det var ekte inventar.
- **Begrenset live-pilot:** kun med verifisert profil, riktig attribution/dypelenker og gatene i §11; merkes «Pilot – ekte annonser fra <leverandør>, begrenset utvalg».
Trygt for eksterne nå: A og A+ (syntetisk). B bare etter avtale. C bare for avtalt pilotgruppe.

## 9. mobile.de som første leverandør (uten tilkobling)
**Kjent *[REPO]*:** Search API (`GET /search-api/search`, `GET /search-api/ad/{ad-key}`), Basic-auth med serverlagrede credentials, `Accept: application/vnd.de.mobile.api+json`, detalj kan gi flere felter enn søk, maks 2 000 annonser/søk, API-konto må aktiveres. **[OPPGITT]:** rettet mot kommersielle brukere; ca. 10 000 forespørsler/mnd inkludert; Light vs Professional (Light kortere lagring, Professional lengre — tidligere oppgitt som 30 min vs inntil 90 dager, **ikke bekreftet skriftlig**); sandbox finnes uten ekte forhandler-/kjøretøydata; kommersielt oppsett er ikke valgt. Light/Professional er **ikke** valgt her, og ingen rett er antatt.
**Tekniske spørsmål som må besvares før integrasjon:** (1) Hvilke felt returneres i søk vs detalj, og hvilke er per vilkår tillatt å vise/lagre i hver plan? (2) Kan vi vise bilder (og hotlinke) og hvilke krav gjelder? (3) Kreves attribution/dypelenke? (4) Kvote: teller hver side og hver detaljhenting? Hva skjer ved overskridelse? Tillatt intervall/polling? (5) Kan samme annonse evalueres mot flere norske forhandlere (multi-kunde) og vises til sluttkunder? (6) Er `modification-time`-filter tilgjengelig og pålitelig? (7) Referansedata for merke/modell/enum og versjonering; hvordan håndteres nye modeller? (8) Hvordan signaliseres at en annonse er fjernet (404, statusfelt)? (9) Geografi: dekker kontoen annonser fra andre land enn Tyskland, og kan de vises i Norge? (10) Hvordan er pris/netto-brutto/mva. representert (bevar gross/net/unknown og VAT-opphav)? (11) Er sandbox-vilkårene forskjellige fra live (kan sandbox-svar caches/lagres/vises)? (12) Hvilke feilkoder og rate-limit-hoder faktisk returneres? (13) Er avledede data (treff/rangering) tillatt å beholde? (14) Krav til databehandling/GDPR og logging.

## 10. Implementeringsrekkefølge (forslag)
| Oppgave | Formål | Avhengighet | Før leverandørsvar? | DB | UI | Credentials |
|---|---|---|---|---|---|---|
| **DATA-002A** Display-right-fundament | `Disclosure`-tilstander, `applyDisplayPolicy`, `DisplayableListing`, arkitekturtest, rettighetsbevisst forklaring | DATA-001 godkjent | **Ja** | Nei | Ja (liten: render etter tilstand) | Nei |
| **DATA-002B** Profil-/konfigmodell | Utvid rettighetsprofil med visning/cache/geografi/grenser/attribution/dypelenke/gjenbruk/miljø; validering | 002A (typer) | **Ja** | **Ja** (migrasjon) | Nei | Nei |
| **DATA-002C** Proveniens | Utvidet provenance på annonse og lagret resultat | 002B | **Ja** | Ja (snapshot-utvidelse) | Liten (vis opphav) | Nei |
| **DATA-001A (A+)** Mer realistisk syntetisk lager | Utstyr/seter/modellår/valuta/land i syntetisk kilde | — | **Ja** | Nei | Nei | Nei |
| **DATA-006** Multi-provider-orkestrering | `ProviderAdapter`-kontrakt, fan-out, dekning per kilde, delvis feil; test med **to syntetiske kilder** | 002A–C | **Ja** | Nei | Ja (dekning per kilde) | Nei |
| **DATA-007** Dedup (syntetisk først) | Fingeravtrykk/«mulig samme bil», «også funnet hos» | 006 | **Ja** | Nei | Ja | Nei |
| **DATA-003** mobile sandbox-adapter | Auth, spørringsoversetter, normalisering, mapping, feilhåndtering | 002A–C, **sandbox-vilkår lest og registrert** | Delvis (design/mapping fra dokumentasjon nå; kall mot sandbox krever tillatelse til å bruke credentials) | Nei | Nei (kun «Sandbox»-etikett) | **Ja** (server-only) |
| **DATA-004** Sandbox-integrasjonstester | Kontrakt-, feil-, paginerings-, kvotetester | 003 | Nei (credentials) | Nei | Nei | **Ja** |
| **DATA-008** Drift | Overvåking, planlagt purge, revokasjonsøvelse, hendelsesrutine | 002B | **Ja** | Ja (jobber) | Nei | Nei |
| **DATA-005** Begrenset live-pilot | Pilotprofil, adapterkonfigurasjon, attribution/dypelenker, pilotgrenser | Skriftlig avtale, 002–004, 008 | **Nei** | Ja (profil) | Ja (attribution/lenker) | **Ja** |
Merk: TAX-grunnlaget (REVIEW) og innkjøpskostnad er uavhengig av denne sekvensen; piloten kan kjøres som «søk og forklar» uten beregnet innkjøpskostnad.

## 11. Porter
**Ingen ekte leverandørdata i `/searches` før:** (1) visningsrettighetshåndheving finnes (DATA-002A) og er testet; (2) en gyldig, verifisert rettighetsprofil gjelder (ikke utløpt/trukket, riktig miljø); (3) retensjon håndheves (utløp, purge, RLS-skjuling); (4) proveniens lagres/propageres; (5) leverandørspesifikke tester består (kontrakt-, feil-, mapping-, rettighetstester); (6) attribution/dypelenke er implementert slik avtalen krever; (7) sandbox er tydelig merket som sandbox hvis den vises.
**Ingen ekstern forhandlerpilot med ekte data før:** (1) tenant-isolasjon fortsatt verifisert i hosted miljø (og DB-suitene kjørt mot faktisk Supabase); (2) leverandørens kontrakt tillater piloten (inkl. multi-kunde og norske forhandlere); (3) attribution og dypelenker er korrekte; (4) tilbakekalling/purge virker og er øvd; (5) overvåking finnes; (6) hendelsesrutine og kontakt hos leverandør finnes; (7) Codex-review av relevante oppgaver.

## 12. Anbefaling
**Bygg nå (før svar):** DATA-002A (visningsrett-fundament), DATA-002B (profilmodell), DATA-002C (proveniens), DATA-001A (A+ syntetisk realisme), DATA-006/007 på to syntetiske kilder, og DATA-008 (drift/purge/revokasjon). I tillegg: kjør DB-/RLS-suitene mot Supabase og få Codex-review på DEV-006-sporet.
**Ikke bygg ennå:** delt global annonsekatalog (DEV-005B), bildevisning/-lagring, LLM-behandling, varsler med leverandørdata, VIN-lagring, avgiftsavhengige kostnadsvisninger, noen leverandørkall mot ekte inventar, og ingen bruk av mottatte sandbox-credentials før sandbox-vilkårene er lest og en sandbox-profil (draft→verified) er registrert.
**Umiddelbart handlingsbart ved ja:** fra mobile.de — registrere profilen (§4), lese sandbox-vilkår, bygge DATA-003/004 mot sandbox (credentials kun server-side), og besvare §9; fra VEND/AutoScout24/OEM — be om API-dokumentasjon, sandbox og skriftlige rettigheter etter malen i §2C, deretter samme sekvens (profil → adapter → kontrakttester).
**Hvilken leverandør først (hvis alle svarer positivt):** **mobile.de**, på nåværende evidens, fordi det er den eneste med dokumentert API i repoet, mottatt sandbox og eksisterende mappingnotater (lavest implementasjonsrisiko og kortest vei til en validert adapter). Rettighetsklarheten for ekte inventar er derimot uavklart (plan ikke valgt), så **mobile.de blir først for sandbox-adapteren (Trinn B)**, mens første *ekte* pilot bør gå til den leverandøren som først gir klareste skriftlige rettigheter (visning, multi-kunde, dypelenke, lagring) — dette er for VEND, AutoScout24 og OEM-er ukjent i dag og kan ikke rangeres uten svar. Beslutningen skal ikke tas ut fra kommersiell preferanse alene.

## Status
**DATA-001 = REVIEW.** Planlegging; ingen kode, Supabase, deploy eller leverandørkontakt. Ikke kjørte kontroller (ikke relevant). Åpne punkter: alle [UKJENT]/[OPPGITT]-merkede leverandørfakta må bekreftes skriftlig.
