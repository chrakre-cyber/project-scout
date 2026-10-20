# ECON-005c — adapter, serverorkestrering og forhandlerinput (leveranse til review)

**Status: REVIEW (005c; fire P2 fra review av c1295cf er rettet — se `reviews/ECON-005c-retting.md`; tallene og beskrivelsen under gjelder c1295cf, bortsett fra at paring annonse↔kandidat, omfangsvalidering mot linje, observasjonskontroll og lesing etter rettighetskontroll nå er på plass). ECON-005d og ECON-006 er ikke startet. Migrasjonen er IKKE anvendt i hostet miljø og ingenting er deployet.** Ingen UI-, provider- eller pipeline-kobling: orkestreringen kalles ikke fra noen rute ennå (005d). Uendret: økonomiflagg (alle `false`), `classifyBudget`/`src/domain/search-v2`, avgiftsmotor (`src/domain/tax`), økonomikjernen (`src/domain/economics`) og avrundingspolicy (`UNCONFIRMED_HALF_UP`), `src/domain/provider-rights.ts`, `src/components`, `src/app`, `src/providers`, eldre migrasjoner. Forrige skiver: 005a DONE, 005b DONE, DATA-002D DONE (`reviews/ECON-005a-avslutning.md`, `…005b-avslutning.md`, `…DATA-002D-avslutning.md`).

## Hva er levert
| Lag | Fil | Innhold |
|---|---|---|
| Domene (rent) | `src/domain/search-economics/dealer-input.ts` | `DealerInputV1`/`DealerProfileV1`, streng `parseDealerInput`/`parseDealerProfile`, `toLineScopes`, binding (`DealerInputBinding`) og `evaluateDealerInput` (fresh / stale_needs_reconfirmation / foreign / none) |
| Adapter (ren) | `src/adapters/search-economics/to-economics-input.ts` | annonse + søk + forhandleropplysninger → `EconomicsInput` + `lineScopes` + merknader; ingen I/O/klokke/flyttall |
| Server (uten I/O) | `src/server/search-economics.ts` | `assessEconomics`: rettigheter → forhandlerinput-binding → adapter → økonomikjerne (registerprofil) → 005a-mapper → `classifyBudget` → visning |
| Server (logikk) | `src/server/dealer-economics.ts` | `confirmDealerInput`, `loadStoredInput`, `loadDealerProfile`, `saveDealerProfile` mot `DealerEconomicsStore` (servervalidering ved lagring og lesing) |
| Server (lagring) | `src/server/dealer-economics-store.ts` | Supabase-implementasjon (`server-only`, publishable key, aldri service-role) |
| DB | `supabase/migrations/20261023090000_econ005c_dealer_economics_inputs.sql` | `public.dealer_economics_inputs` og `public.dealer_economics_profiles`, firmabundet RLS |

## Rettigheter (005b brukt, tre rettigheter holdt adskilt)
Orkestreringen leser rettigheter for kilden først. **Beregningsrett** per felt (`price`, `registration`, `specs`) styrer hvilke annonsefelt adapteren i det hele tatt leser; **visningsrett** for avledet økonomi (pluss visningsrett for prisen som avsløres) styrer om noen tall forlater orkestreringen; **matchingrett** og felt-visningsrett gir ingen beregningsrett (testet). Uten beregningsrett for pris: `unavailable(rights_not_granted)` og ingen annonsefelt leses (ingen annonsetall i utdata). **Avvik fra plan § 3 (til din vurdering):** manglende rett for *registrering* eller *specs* gir ikke hele økonomien `unavailable`; feltet leses ikke fra annonsen og forblir ukjent (resultatet blir blokkert/ukomplett), og forhandlerens egne verdier gjelder fortsatt (de er ikke leverandørdata). Pris er den eneste obligatoriske beregningsretten. Uten visningsrett returneres `display = unavailable` og `detail = null` (budsjettstatus beregnes likevel som `not_calculated`).

## Forhandlerinput: binding, foreldelse, ukjent (plan P1–P4, E3–E5)
- **Binding:** nøkkel `(firma, søk, kandidat-id, kandidatrevisjon, schemaversjon)`. Firma kommer fra serverens validerte sesjon (parameter) og avgjøres av databasen (trigger fra medlemskap; kolonnen er ikke skrivbar); klientinput kan ikke inneholde firma-id (parseren avviser den som ukjent nøkkel). «Søk» = lagret søkeutkast (`search_drafts.id`); sammensatt FK `(search_id, dealership_id)` binder søket til samme firma (ukjent og fremmed søk gir samme feil, 23503).
- **Ny bekreftelse kreves** (input brukes ikke): ny kandidatrevisjon, endret kostnadsgrunnlag (`costBasisOf`), endret planlagt scenario, endret schemaversjon, endret rettighetsavtrykk for avledet økonomi (kilde, profilversjon, rettigheter — ikke visningsfelt), utløpt forhandleroppgitt kurs. **Ikke** ved endret budsjett/avvik, avgifts-/økonomiprofilversjon. Annet firma/søk/kandidat ⇒ `foreign` (ingen antydning av innholdet).
- **Ingen oppgradering:** pris har bevis `listing_claim`; brutto/netto bare med annonsebelegg; drivlinje uten forhandlergrunnlag er ukjent med `listing_claim` (avgiftsmotoren blokkerer); annonsevekt `reference_listing`; annonse-CO₂ metode `unspecified`; utenlandsk mva. aldri fra annonse; grunnlaget `listing_claim`/`reference_listing`/`unverified` avvises i forhandlerinput. Datopresisjon (dag/måned/år/ukjent) bevares; verdien må stemme med presisjonen. Norsk registreringsdato uten input er standard = beregningsdato (`defaulted`).
- **Ukjent:** mva.-håndtering og fradrag: kandidatoverstyring > firmaprofil > `null` (ukjent); aldri utledet av annonse eller «forhandler». Transportstandard (8 000) settes aldri. Kostnadskomponenter uten input er `unknown` (aldri 0).
- **Kurser:** forhandleroppgitt, kilde (`dealer_entered` + oppgitt kildetekst) og dato påkrevd, estimatstatus bevart (kjernen gir estimatårsaker; aldri validated). Kursens gyldighet begrenser `validUntil` (P3) og utløp krever ny bekreftelse.
- **Transport/forsikring/kostnadslinjer (P1/P4):** omfang per linje bekreftes av forhandler (standard `unconfirmed`). Bekreftet omfang mappes med linjens eksakte beløp til riktig økonomikomponent og telles én gang; split mappes til to komponenter; `excl`/ukjent mva.-grunnlag/ikke-NOK mappes ikke. 005a-mapperen står for ingen-dobbelttelling og eksplisitt behandling av alle linjer (uendret).
- **Ikke samlet inn i 005c** (utelatt, listet som `*_not_collected` i `notes`): provisjon, betalingskostnader, importavgifter, øvrige kostnader, elbilkvalifikasjon, tollavgift.

## Lagring (kun forhandlerinput)
Ingen avledede resultater lagres (test: tabellene har ingen kolonner for beregnede tall; orkestreringen har ingen skriveoperasjoner og importerer ikke Supabase). Databasen garanterer firmabinding, nøkkel, topp-nivå struktur/størrelse (≤ 16 000 byte), kontekstformat, uforanderlig nøkkel, bekreftelsesbruker/-tid satt av databasen, RLS (kun eget firma, ingen anon, ingen sletting). Dyp semantikk valideres av serveren (`parseDealerInput`) ved lagring og lesing.

## Ingen positive utfall
Orkestreringen bruker en intern, frossen konfigurasjon (registerprofilen, uavklart avrunding); forespørselen har ingen config-overstyring. Test over 11 varianter (fullt estimat, ingen input, bare pris tillatt, uten visningsrett, linje med omfang, ukjent linje, ikke-NOK uten kurs, brutto uten belegg, uten budsjett …): aldri `within_budget`/`within_deviation`, `isFullHit` false, `positiveBudgetEligible` false, aldri `validated`/`complete_validated`. `usage.alerts` berøres ikke; ingen varselkode finnes.

## Tester (alle nye: 161)
| Fil | Antall | Innhold |
|---|---|---|
| `tests/economics-005c-dealer-input.test.ts` | 31 | streng parsing, firma-id/ukjente nøkler/listing_claim avvist, datopresisjon, penger, kurs, omfang, binding og foreldelse |
| `tests/economics-005c-adapter.test.ts` | 28 | rettigheter, ingen oppgradering av annonsepåstander, ukjent forblir ukjent, mva./fradrag, kurser, transportomfang × 005a-mapper, renhet |
| `tests/economics-005c-server.test.ts` | 38 | rettighetsmatrise, firma/søk/kandidat/revisjon, foreldelse, ingen positive utfall, arkitektur |
| `tests/economics-005c-dealer-store.test.ts` | 22 | servervalidering, kontekst fra serveren, korrupt lagring, firmaprofil, hele flyten |
| `tests/db/econ005c-dealer-inputs.test.ts` | 42 | RLS med to firma + uten medlemskap + anon, kolonnerettigheter, FK, nøkkel, ny bekreftelse, struktur, TS↔SQL-samsvar, profil |
`tests/db/qa-catalog.test.ts` utvidet (tabeller, kolonnerettigheter, policyer, hjelpefunksjoner — forventet). `tests/db/harness.ts` rydder de nye tabellene. `scripts/test-db-isolated.sh` anvender `*_econ005c_*` etter SEARCH-005-trinnet (FK mot `search_drafts`; skriptets egen testrekkefølge anvender SEARCH-005 sist).
**Mutasjonskontroll** (alle drept): DB — FK fjernet, firma fra klient, firmakolonne skrivbar, åpen SELECT-policy, payload-validator svekket, nøkkelkolonne skrivbar, DELETE gitt, unikhet fjernet, bekreftelsesbruker fra klient, profilfirma skrivbar. TS — pris-bevis oppgradert, brutto/netto uten belegg, transportstandard, drivlinje/CO₂-metode oppgradert, vekt uten rett, fradragsstandard, kurskilde oppgradert, rettighetskontroll fjernet, `detail`-lekkasje, foreldet/fremmed input brukt, avslørt pris ignorert, firmabinding fjernet, kostnadsgrunnlag-foreldelse fjernet, forhandlergrunnlag åpnet.

## Kontroller (utviklerens, ikke uavhengig review)
| Kontroll | Resultat |
|---|---|
| `vitest run` (hele) | **1 274 tester, 54 filer, alle grønne** (1 155 før 005c; +119 domene-/server-tester) |
| `tsc --noEmit`, `eslint .` | ingen feil, ingen advarsler |
| DB i isolert PostgreSQL 16: `econ005c-dealer-inputs`, `qa-catalog` | 42/42 og 18/18; oppgraderingsøyeblikksbildet (SEARCH-005-sjekken) OK |
| Hele DB-suiten i isolert klynge | 258 bestått (216 før), **12 feil og 247 hoppet over — uendret** (Auth/PostgREST mangler i den klyngen; ikke en grønn full DB-suite) |

**Ikke kjørt:** Supabase-avhengige DB-filer (`rls`, `agents`, `search-runs`, `qa-isolation`, `qa-validation`, `rights-retention`, `qa-limit`), Supabase-lagringsimplementasjonen `dealer-economics-store.ts` mot en ekte PostgREST (bare typesjekket og kildeskannet; logikken er testet mot et lagringsgrensesnitt og tabellene direkte i PostgreSQL), `qa:migrations`, `qa:secrets`, build, e2e, hosted migrasjon, deploy. Ingen uavhengig review av 005c ennå.

## Beslutninger/avvik du bør se
1. Rettighetsavvik beskrevet over (registrering/specs ⇒ ukjent, ikke unavailable).
2. «Søk» = lagret søkeutkast; kandidater lagres ikke (kandidat-id/revisjon er tekst i nøkkelen). En ny revisjon betyr ny rad/ny bekreftelse; gamle revisjonsrader blir liggende (ingen sletting i 005c).
3. Kildedata-grense (P3): `lastSeenAt` + lagringsretensjon, ellers + 5 minutter (som proveniens) når lagring ikke er tillatt.
4. Elbil/EV-kvalifikasjon, provisjon m.m. er ikke innsamlet (se over) — resultatene viser dem som «ikke innsamlet», ikke 0.
5. Ingen kobling til UI/pipeline: `assessEconomics` har ingen kallere utenom tester inntil 005d.

## Neste
Uavhengig review av 005c. Deretter, etter Christians beslutning, 005d (visning via display-grensen med faste labels). E7/E8 er fortsatt utsatt.
