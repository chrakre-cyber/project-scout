# ECON-006 — implementeringsplan: forklaring av beløp og usikkerhet, forhandleropplysninger og brukerforløp (20.10.2026)

> **Oppdatering 20.10.2026: beslutningene B1–B7 er besvart (`DECISIONS.md` runde 53; se § 8a). Kun 006a er startet; 006b og 006c er ikke startet.** Nedenfor står den opprinnelige planen; der § 1C, § 8 og § 8a avviker, gjelder § 8a.
>
> **Opprinnelig status: plan, ikke implementering.** Ingen kode, migrasjon eller runtime er endret av dette dokumentet. Utgangspunkt: ECON-005a–d er DONE innen avgrenset omfang; ECON-005 som helhet er ikke DONE (`reviews/ECON-005-avstemming.md`). Økonomiflaggene er `false` og forblir det; ingen ny juridisk regel, ingen godkjenning, ingen hosted migrasjon, ingen deploy, ingen LLM, ingen lagring av avledede tall.

## 0. Rammer som ikke kan brytes
1. Alt UI ser går via `DisplayItem.economics` (visningsmodellen bak rettighetsgrensen fra 005d). Utvidelser skjer i `EconomicsView` og projeksjonen — aldri ved at UI får `EconomicsResult`, forhandlerinput eller annonseverdier.
2. Alle nye detaljer (nedbrytning, kurs, forutsetninger) avslører pris/kostnadskomponenter og er derfor bak **samme tre porter** som i dag (beregningsrett, visningsrett for avledet økonomi, effektiv prisvisning). Uten rett: uniform `unavailable` (ingen årsaker, ingen tall).
3. Estimat, nedre grense og scenarier gir aldri positiv budsjettstatus, `isFullHit` eller varsel; ingen etikett kan lese som «innenfor budsjett». Bare `validated` kan være positiv-berettiget (uoppnåelig så lenge flaggene er `false`).
4. Annonsepåstander oppgraderes aldri til dokumentert grunnlag. Forhandlerinput lagres som forhandlerens egne data (firmabundet RLS, kandidat+revisjon); det lagres ingen beregnede tall.
5. Mva.-håndtering og fradragsstatus er `unknown` som standard; ukjent fradrag ⇒ to merkede scenarier, aldri ett tall.

## 1. Opprinnelig ECON-006-omfang (fra ECON-001 og backlog)
Backlog: «Forklarings-UI for landed cost (kun via visningsgrensen)». ECON-001: «nedbrytning, forutsetninger, tillit, to summer, «ikke beregnet» der det mangler; kun via `search-display`-grensen». Konkretisert:

### 1A. Nedbrytning av beløp
Visningsmodellen utvides med `breakdown`: en liste rader `{ id, labelKey, state, amountNok | null, basis }` i fast rekkefølge, i tråd med kjernens begreper (ECON-001 § 8):
kjøpesum i kildevaluta og NOK · transport til innførselsstedet · transport etter innførselsstedet · forsikring · lasting/håndtering · tollverdi · tollavgift · mva.-grunnlag · import-mva. · engangsavgift · vrakpant · registreringsgebyr · øvrige kjente poster · valgte kostnadslinjer fra søket (fra `lines`, med behandling).
- `state` er én av: `known` (oppgitt/beregnet), `assumed` (produktantakelse/standard), `unknown` (aldri 0), `lower_bound`, `not_applicable` (oppgitt «ikke relevant»).
- `basis` er en fast nøkkel: `listing_claim` · `dealer_entered` · `vehicle_register` · `type_approval` · `official_rate` · `computed` · `default`. Annonsepåstand vises som «annonsepåstand — ikke dokumentasjon».
- Avstemmingskrav (testes): rader med `known` + nedre grenser summerer til kontantbehov/landed cost slik kjernen oppgir; ingen rad forsvinner; ukjente rader gir nedre grense, ikke 0.
- Kilden til data er `EconomicsResult` (felter: `acquisition`, `transportToBorderNok`, `transportAfterBorderNok`, `insuranceNok`, `loadingHandlingNok`, `customsValueNok`, `customsDuty`, `importVatBaseNok`, `importVat`, `tax`, `importCashRequirement`, `estimatedLandedCost`). Projeksjonen skjer i `toEconomicsView` (domene, ren) via en ny whitelist-mapper; bigint → desimalstreng som i dag.

### 1B. Forutsetninger og kurs
`assumptions`: strukturert liste (ikke bare koder) med: kurs for kjøpesum og tollkurs (par, normalisert kurs, kilde-tekst, dato, gyldighet, «forhandleroppgitt — estimat»), forventet/faktisk norsk registreringsdato (og `defaulted`), akseptdato for tolldeklarasjonen (forventet/faktisk), fradragsstatus og mva.-håndtering (kilde: forhandler/profil/ukjent), utenlandsk mva. (dokumentert/ikke), avrundingsregel «ikke bekreftet», regelstatus («regler ikke godkjent for validering»). Dette lukker ECON-001 § 15.7 (b), (c) og (e).
Fast tekst i UI: «Estimat — ikke validert. Ikke rådgivning.» (ordlyden «ikke rådgivning» legges til; ligger i `search-labels`).

### 1C. Tillit (deterministisk, ikke sannsynlighet)
Ingen skjult score og ingen LLM. «Tillit» = en fast, forklarbar grunnlagsoversikt: for hver komponent `basis` (1A) og en teller «N av M komponenter har dokumentert grunnlag» + hvilke som er annonsepåstand/antakelse/ukjent. Tilstandene er fire faste etiketter (f.eks. «Bygger på annonsepåstander», «Delvis forhandleroppgitt», «Forhandleroppgitt og dokumentert», «Validert» — sistnevnte uoppnåelig nå). **Definisjonen må godkjennes av Christian (§ 8, B4)** før implementering; det er den eneste delen av 1C som er et produktvalg.

### 1D. To summer
Vis alltid begge, adskilt og forklart (ECON-001 § 12): **kontantbehov / brutto utlegg** (aldri «kontant ved grensen») og **økonomisk kost**. Ukjent fradragsstatus ⇒ to merkede scenarier for økonomisk kost; nedre grenser vises som «Minst X kr (ufullstendig)». Søkets budsjettsum og valgte tillegg (DEC-030) vises som egen linje «lagt til av deg» uten å bli en budsjettvurdering.

### 1E. «Ikke beregnet» der det mangler — og hva som kreves
`missingToCalculate`: liste av **inputfelt** (ikke interne koder) som må oppgis for å gå fra «Ikke beregnet»/«Minst …» til estimat, avledet deterministisk av kjernens `incompleteReasons`/`missing`/blokkeringskoder → felt (tabell i § 3). Hver mangel lenker til riktig felt i forhandlerskjemaet (§ 2B). Teksten forklarer *hvorfor* (f.eks. «Drivlinje er ikke dokumentert — annonsens drivstoff er ingen dokumentasjon»).

## 2. Nødvendige forhandleropplysninger
### 2A. Hvorfor dette må med
Uten en flate for forhandleropplysninger kan appen aldri gå forbi «Minst … / Ikke beregnet» (avstemmingen § 5). Forklaringen i § 1 er bare nyttig hvis brukeren kan rette manglene. **Dette er ikke opprinnelig ECON-006-omfang**; det er restomfang fra ECON-005c («UI: liten», skjema-validering). Anbefaling: gjør det til eksplisitt delmål 006b i ECON-006 (alternativ: eget «ECON-005e») — beslutning § 8, B1.

### 2B. Skjema og tjenester (bruker eksisterende serverlag uendret)
Server actions i `src/app/searches/[id]/preview/…` etter mønsteret i `saveSearchAction` (firma fra `getSessionContext`, aldri fra skjema; `expectedVersion`/kandidatrevisjon som konfliktkontroll): `confirmDealerInputAction` → `confirmDealerInput` (streng parsing, omfangsvalidering mot linjer, serverberegnet kontekst) og `saveDealerProfileAction` → `saveDealerProfile`. Feil fra `parseDealerInput` (`path` + `code`) mappes til norske feltmeldinger; ingenting lagres ved feil.
Skjemafelt per kandidat (alle valgfrie; ikke oppgitt = ukjent, aldri 0):
| Gruppe | Felt | Merknad |
|---|---|---|
| Drivlinje | stempelmotor ja/nei/ukjent, ladbar ja/nei/ukjent, drivstoff (diesel/bensin/annet), elektrifisering (ingen/ikke-ladbar hybrid), **grunnlag** (typegodkjenning/kjøretøyregister/forhandler) | annonsens drivstoff vises ved siden av som «annonsepåstand — ikke dokumentasjon» og forhåndsutfylles aldri |
| Avgiftsvekt | kg + grunnlag (EU-typegodkjenning/register/forhandler) | «forhandler uten dokumentasjon ⇒ estimat» forklares |
| CO₂ | g/km + målemetode | |
| Første registrering | presisjon (dag/måned/år/ukjent) + verdi + grunnlag | annonsens verdi vises som påstand; ingen oppdiktet dag/måned |
| Norske datoer | forventet/faktisk norsk registreringsdato; akseptdato for tolldeklarasjon (forventet/faktisk/ukjent) | standard = beregningsdato merket «standard» |
| Utenlandsk mva. | utelukket dokumentert (faktura/avtale) / ikke bekreftet | `listing_claim` finnes ikke som valg |
| Kurs (ikke-NOK) | kjøpesumskurs og tollkurs: par, kurs, kildetekst, dato, gyldighet | alltid «forhandleroppgitt — estimat»; ECON-008 senere |
| Kostnader | transport til/etter innførselsstedet, forsikring, lasting/håndtering (beløp / ikke relevant / ukjent), klimagassavgift, registreringsgebyr | |
| Kostnadslinjer i søket | omfang per transport-/forsikringslinje (til grensen / etter / fordelt / annet / ikke bekreftet), fordelingsbeløp valideres mot linjen i sanntid (server er autoritativ) | |
| Mva. og fradrag | mva.-håndtering og fradragsstatus (ukjent/oppgitt) | standard ukjent; kan settes som firmaprofil |
Firmaprofil (egen side): standard mva.-håndtering og fradragsstatus (`dealer_profile`), standard ukjent; endrer aldri en bekreftet kandidatoverstyring.
Etter lagring: tilbake til detaljsiden med oppdatert vurdering (beregnes på nytt, lagres ikke). Foreldet bekreftelse (ny annonserevisjon, endret kostnadsgrunnlag/scenario, endrede rettigheter, utløpt kurs) vises med årsak og forhåndsutfylt skjema til gjennomgang — **ny bekreftelse må gjøres aktivt**; ingenting bekreftes automatisk.
Tilgjengelighet/mobil: gruppert skjema med `fieldset/legend`, 44 px treffflater, feilsammendrag + feltfeil, tastaturnavigasjon, ingen informasjon bare med farge; 390 px bredde som minimum.

## 3. Datamodell- og kodeendringer (konkret)
| Del | Endring |
|---|---|
| `src/domain/search-economics/view.ts` | `EconomicsView` v2: `breakdown`, `assumptions`, `sums` (kontantbehov + økonomisk kost + scenarier), `missingToCalculate` (feltnøkler), `trust` (§ 1C, etter beslutning). Rene mappere fra `EconomicsResult` + `MappingOutcome` + `StoredDealerInput`-status. Whitelist-test for hvert nytt felt |
| `src/server/economics-view.ts` | uendret port-logikk; projeksjonen får det utvidede resultatet fra `assessEconomics` (`detail` er allerede gated) |
| `src/lib/search-labels.ts` | faste tekster for rader, grunnlag, tillit, forutsetninger, «ikke rådgivning», feltetiketter og feilmeldinger; skann for positivt språk utvides |
| `src/components/search/` | `EconomicsExplanation` (detalj), `EconomicsBreakdown` (tilgjengelig tabell med `caption`), `EconomicsAssumptions`, `MissingToCalculate`, `DealerInputForm` (+ `DealerProfileForm`) |
| `src/app/searches/[id]/preview/[listingId]/` | seksjon for forklaring; `…/dealer-input/` (skjema + action) og `/settings/economics` (profil) |
| DB | **ingen ny migrasjon forventet** (tabellene fra 005c dekker input; `listInputs` brukes). Skulle noe vise seg nødvendig, kreves egen avgjørelse — ingen hosted migrasjon uansett |
Mangel → felt (deterministisk tabell, testes mot hver kjernekode som kan oppstå): `propulsion_unknown`/`tax_blocked` → drivlinje + vekt + CO₂ + første registrering; `customs_acceptance_date_unknown` → akseptdato; `transport_unknown`/`transport_after_border_unknown`/`insurance_unknown`/`loading_handling_unknown` → kostnader; `acquisition_fx_missing`/`customs_fx_missing` → kurs; `foreign_vat_exclusion_undocumented` → utenlandsk mva.; `unresolved_vat_recoverability`/`vat_handling_unknown` → mva. og fradrag; `candidate_listing_mismatch`/`source_observation_*` → ingen felt (kilden må oppdateres).

## 4. Hvordan brukerforløpet testes i appen
### 4A. Automatiske tester (vitest)
1. **Visningsmodell:** whitelist av nøkler per status (ingen kjerneinternt); avstemming av rader mot summene (hånd-utledede referanser fra gyldne fixturer i ECON-003, ikke utledet av implementasjonen); bigint-fri/JSON-trygg; sentineltest for nektede rettigheter (ingen rader/årsaker/tall).
2. **Etiketter:** snapshot og skann for positivt budsjettspråk også for nye tekster; hver kjerneårsak/feltmangel har egen norsk tekst (dekningstest som i 005d).
3. **Komponenter:** `renderToStaticMarkup` for alle statuser; ingen `unavailable`-detaljer.
4. **Server actions:** firma fra sesjon (ikke skjema), feil → feltmeldinger uten skriving, konflikt/foreldet, ugyldig fordeling avvises, `listing_claim`/ukjente nøkler avvises, ingen skriving av beregnede tall.
5. **Gjennom alle tre profiler (test 8):** BEV, PHEV og diesel (PB-BEV/PB-PHEV/PB-DIE) fra søk → kandidat → forhandlerinput → vurdering → visning, pluss ukjent profil og manglende rett. Referanseverdier fra ECON-003-fixturene.
6. **B1 gjennom visning** (akseptdato utenfor dokumentert vindu) og **kurs-utløp** gjennom visning.
### 4B. Nettleser-e2e (utvider eksisterende oppsett)
Gjenbruker `scripts/test-e2e-search005.sh`-mønsteret (isolert PostgreSQL-klynge + `tests/e2e/support/mini-supabase.mjs` som emulerer Auth/PostgREST mot `authenticated`-rollen; Playwright + Chromium finnes i miljøet) i ny `tests/e2e/econ006.e2e.mjs`. Syntetiske annonser (diesel, elektrisk, ladbar hybrid, EUR) i demodatasettet. Forløp:
| # | Forløp | Forventet |
|---|---|---|
| J1 | Innlogget (firma A) → åpne lagret søk → «Prøv med demodata» | kortene viser «Minst … (ufullstendig)» eller «Ikke beregnet»; demo-banner; ingen budsjettspråk |
| J2 | Åpne detaljside → «Hva mangler?» → følg lenke til skjema | mangler listet på norsk, lenker til riktige felt |
| J3 | Fyll ut skjema med gyldige, dokumenterte verdier (dieselcase fra ECON-003-fixturen) → lagre | tilbake på detaljsiden; «Estimat — ikke validert: <hånd-utledet beløp>»; to summer; nedbrytning summerer; forutsetninger (kurs, datoer, «standard»); «ikke rådgivning»; budsjettnotat uendret (ikke beregnet) |
| J4 | Ugyldig input (flyttall, negativ, feil dato/presisjon, ugyldig fordeling, `listing_claim`-forsøk via manipulert POST) | norske feltfeil, ingenting lagret |
| J5 | Ukjent fradragsstatus | to merkede scenarier, aldri ett tall |
| J6 | EUR-annonse med forhandleroppgitt kurs → deretter utløpt kurs | kilde/dato vises; etter utløp «må bekreftes på nytt», ingen tall fra gammel bekreftelse |
| J7 | Endre søkets kostnadslinje / ny revisjon | «må bekreftes på nytt» med årsak; skjema forhåndsutfylt; aktiv ny bekreftelse |
| J8 | Bruker i firma B åpner firma A sine URL-er | ingen innhold, ingen økonomi, ingen lekkasje (RLS i isolert PostgreSQL) |
| J9 | Elektrisk og ladbar hybrid | riktig profil (PB-BEV/PB-PHEV) i forklaringen; usikkerhet vist |
| J10 | 390 px bredde, tastaturnavigasjon, skjermbilder | ingen horisontal scroll, feltgrupper og feil leses opp, 44 px treffflater |
Rettighetsvarianter (ingen visningsrett, skjult pris) kan ikke slås på i den bygde appen uten testkrok i produksjonskode — de dekkes i vitest (4A), ikke e2e. Dette er en kjent begrensning.
### 4C. Integrasjonskontroll utenfor denne miljøet
Lagringsimplementasjonen mot ekte Supabase/PostgREST og Supabase-avhengige DB-filer krever lokal Supabase (Docker) hos eier. Skal stå som eget kontrollpunkt i leveransen (ikke påstått kjørt).

## 5. Foreslåtte tillegg (IKKE opprinnelig ECON-006-omfang — krever eget vedtak)
| Forslag | Hvorfor | Anbefaling |
|---|---|---|
| E7 «kjent kostnad overstiger allerede øvre grense» som informasjonsfelt (aldri filter/varsel/utelukkelse) | planen sa «kan utsettes til ECON-006» | Ta med bare hvis Christian ønsker; ellers eget element |
| E8 `EconomicTarget` (`maxLandedCostNok`, headroom) | opprinnelig ECON-005-rad | **Ikke** i ECON-006: krever spec-JSON-skjema, DB-endring og ny `classifyBudget`-semantikk |
| Kopiere bekreftelse til lignende kandidat / «bruk som mal» | spare inntasting | Utsett; risiko for feil gjenbruk av dokumentert grunnlag |
| Historikk/revisjonslogg for bekreftelser | sporbarhet | Utsett (nåværende tabell lagrer siste bekreftelse) |
| Sammenligning av kandidater på tvers | beslutningsstøtte | Utsett; kan lett bli rangering som ligner budsjettutfall |
| Eksport/utskrift av forklaring | deling | Utsett; krever vurdering av rettigheter for avledet visning utenfor appen |
| FX-tjeneste (ECON-008), vektberikelse (ECON-007), benchmark (ECON-009) | automatisering | Egne oppgaver; ikke avhengighet |
| «Tillit» som tallscore | enklere sammenligning | **Frarådes** (skjult usikkerhet/presisjon); bruk faste etiketter (§ 1C) |

## 6. Skiver, rekkefølge og stoppunkter
| Skive | Innhold | Avhenger av | DB | UI |
|---|---|---|---|---|
| **006a** | Visningsmodell v2 (breakdown, assumptions, sums, missingToCalculate, trust etter beslutning) + forklaring på detaljsiden (skrivebeskyttet) + etiketter + tester 4A 1–3, 6 | beslutning B4 (tillit) | nei | detaljside |
| **006b** | Forhandlerskjema + firmaprofil (server actions, feltmeldinger, foreldet-flyt) + tester 4A 4 | 006a; beslutning B1 | nei (ingen ny migrasjon forventet) | skjema |
| **006c** | Brukerforløpstester: test 8 (tre profiler) i vitest + `econ006.e2e.mjs` (J1–J10) + skjermbilder + reviewpakke | 006a, 006b | nei | – |
Hver skive leveres med rapport, diff, manifest og tester og **stopper for uavhengig review** (som 005a–d). Estimat (utførelsestid, ikke din tid): 006a ca. 1,5 dag, 006b ca. 2 dager, 006c ca. 1,5 dag + reviewrunder.

## 7. Akseptkrav for ECON-006 (DoD)
1. Nedbrytning, forutsetninger (inkl. kurs med kilde/dato for begge roller), to summer, tillit (etter vedtatt definisjon) og «ikke beregnet» med hva-som-mangler vises kun via visningsmodellen, bak de tre portene.
2. Forhandleropplysninger kan registreres, endres og bekreftes på nytt i appen; firma fra sesjon; ingen annonsepåstand blir dokumentasjon; foreldet input brukes ikke.
3. Ingen positive budsjettutfall/varsler; ingen lagring av avledede tall; flagg `false`; ingen nye regler.
4. Test 8 oppfylt (tre profiler + ukjent profil + manglende rett); J1–J10 kjørt i nettleser med skjermbilder; integrasjon mot Supabase/PostgREST oppført som eget, ikke-kjørt kontrollpunkt hvis ikke kjørt.
5. Uavhengig review uten blokkerende funn per skive; avslutningsrapport som skiller reviewers kontroller fra utviklerens.

## 8. Beslutninger jeg trenger fra Christian (før 006a)
| # | Spørsmål | Anbefaling |
|---|---|---|
| **B1** | Skal forhandlerflaten (skjema/profil) ligge i ECON-006 (006b) eller i egen «ECON-005e» før ECON-006? | I ECON-006 som eksplisitt delmål 006b, slik at forklaringen kan testes mot reelle estimater; ECON-005 holdes REVIEW til 006b er levert |
| **B2** | E7 nå eller senere? | Senere (eget element) |
| **B3** | E8 `EconomicTarget`: registrere som utsatt scope-endring og omformulere ECON-005-raden? | Ja (CLAUDE.md pkt 14), nytt element for E8 |
| **B4** | Definisjon av «tillit» (§ 1C): fire faste grunnlagsetiketter + teller, uten score? | Ja |
| **B5** | Godkjenner du ordlyden «Estimat — ikke validert. Ikke rådgivning.» og at «To summer» alltid vises (kontantbehov + økonomisk kost/scenarier)? | Ja |
| **B6** | Er nettleser-e2e med emulator (ikke ekte Supabase) akseptabelt som brukerforløpstest i denne omgangen, med ekte Supabase som separat kontrollpunkt hos deg? | Ja |
| **B7** | Skal dagens demodatasett brukes for e2e (diesel, elektrisk, ladbar hybrid, EUR finnes), eller ønsker du egne golden-baserte testannonser? | Bruk demodata + golden-baserte referanseverdier for forventede beløp |

## 8a. Besvarte beslutninger (Christian, 20.10.2026) — gjelder foran § 1C og § 8
| # | Beslutning | Konsekvens |
|---|---|---|
| **B1** | Forhandlerskjema og firmaprofil legges i ECON-006 (006b) som tydelig videreført restarbeid fra ECON-005. | Skilles fra opprinnelig ECON-006-omfang i rapporter og backlog. |
| **B2** | E7 utsettes. | Ikke del av ECON-006. |
| **B3** | ECON-005 presiseres «v1 uten EconomicTarget»; E8 beholdes som åpent, utsatt arbeid; ECON-005 forblir REVIEW til øvrige akseptkrav er oppfylt. | Backlograden oppdatert. |
| **B4** | Faste, forståelige grunnlagsetiketter uten tillitsscore. En eventuell teller viser bare konkret dokumentasjonsdekning, aldri statistisk sikkerhet eller juridisk godkjenning. | § 1C revidert: ingen «tillit»-begrep; 006a viser «N av M kjente kostnadsposter har dokumentbasert grunnlag» med forbehold. Annonsepåstand teller aldri som dokumentasjon. |
| **B5** | «Estimat — ikke validert» som hovedmerking med konkret forklaring av hva som er usikkert; «Ikke rådgivning» erstatter ikke dette. Brutto utlegg og økonomisk kostnad vises når de kan beregnes; ellers «Ikke beregnet», nedre grense eller merkede scenarier. Brutto utlegg er ikke nødvendigvis kontantbetaling ved grensen. | Fast forklaringstekst i etikettene; testet. |
| **B6** | Emulator godtas for automatiserte integrasjons- og nettlesertester. Ekte Supabase/PostgREST er fortsatt et eget, nødvendig kontrollpunkt før pilot; emulatorresultater omtales ikke som bekreftet Supabase-integrasjon. | Gjelder 006b/006c; 006a har ingen DB- eller nettleserkontroll. |
| **B7** | Demodata for diesel, BEV og PHEV med forventninger fra eksisterende fixtures; skillet offisielle observasjoner / historisk oppgitte tall / syntetiske scenarioer bevares; fixturekonvensjoner er ikke produksjonsregler. | 006a-testene merker alle forventninger «B-Merovo-scenario / fixturekonvensjon». |

**Funn i 006a som påvirker 006c:** BEV (CASE-002) når ikke et punktestimat gjennom 005c-pipelinen, fordi EV-kvalifisering (`ev_qualification`) ikke samles inn i forhandlerinput; den vises som to merkede scenarier (485 077 / 410 077) med mangel «kan ikke registreres i dag». Punktestimat for BEV krever et eget scope-vedtak (nytt innsamlingsfelt) og er ikke gjort.

## 9. Risiko
- **Usikkerhet mistolkes som tilbud/budsjettutfall** → faste etiketter, felles «ikke en budsjettvurdering», ingen grønn/positiv stil, tekstskann.
- **Dokumentasjonsbasis forveksles** med annonsepåstand → basis vises per rad; påstander forhåndsutfylles aldri.
- **Skjemaets kompleksitet** → gruppering, minimumssett for estimat vist først, resten valgfritt.
- **Rettighetslekkasje via nye detaljer** → alle nye felt bak portene; sentineltester per felt.
- **Regelusikkerhet (flaggene false)** → forklaringen sier eksplisitt hvilke regler som ikke er godkjent; ingen tall presenteres som validert.
