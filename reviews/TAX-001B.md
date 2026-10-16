# TAX-001B — primærkontroll og retting av avgiftsgrunnlaget · leveranserapport

Status: **REVIEW** (ikke DONE). Utfører Claude Code, kontrollør Codex. Dokumentoppdrag: ingen beregningskode, ingen endring i app/UI/DB/auth/pakker/deploy. Ingen myndighet eller selger er kontaktet. Utgangspunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `b6cd8f0` (TAX-001A dokumentasjon `bf3fa84`, ZIP-artefakt `b6cd8f0`), rent arbeidstre.

## 0. Konklusjon (les først)
**Beregningsgrunnlaget er fortsatt ufullstendig – satsavhengig kode kan ikke bestilles ennå.** Seks originale kilder er nå lest og knyttet til regler, de to funnene er rettet, og dokumentene har en kontroll som regner på nytt. Men *satstabellene for engangsavgift (stortingsvedtaket), forskrift §§ 3-1/3-3, mva.-sats/tollkurs/sjablongfrakt og alle uavhengige kalkulatorreferanser mangler*. Ingen regel er godkjent som parameter.

| Mål | TAX-001A | TAX-001B |
|---|---|---|
| Regler (30 totalt) på E1 / E1P (delvis) / E2 | 0 / 0 / 28 | **4 / 13 / 13** |
| Referanser klasse 1 (uavhengig offisiell) | 0 | **0** (ingen kalkulator kjørt) |
| Klasse 2 (håndregnet fra lest kilde) | 0 | **10** |
| Klasse 3 (syntetisk) / klasse 4 (planlagt/blokkert) | 30 / 55 | **38 / 54** |
| Godkjente parametere | 0 | **0** |
85 → 102 tilfeller. De 102 er **ikke** 102 verifiserte beregninger: 0 er uavhengig kontrollert.

## 1. Kildepakken og hvordan den er brukt
Pakke `617c890f-Claude-TAX-001B-kildepakke-og-oppdrag.zip` (Codex, 15.10.2026): `OPPDRAG.md`, `CODEX-REVIEW.md`, `KILDELOGG.md`, `MANIFEST.json` og seks filer i `primarkilder/`. Alle SHA-256 i pakkens manifest er kontrollert mot filene (stemmer). Kildefilene ligger **ikke** i Git (ikke duplisert); `sources.json` har pakkefil og full SHA-256 per E1-kilde, og `node docs/tax/check-docs.mjs --pack <utpakket katalog>` kontrollerer hash og at den transkriberte bruksfradragstabellen stemmer med T07-HTML. Tekst er hentet ut med `pdftotext` og en enkel HTML-til-tekst-konvertering; kun originalfilene er belegg.

| Fil | Kilde-ID | Versjon / dato | Lest |
|---|---|---|---|
| `engangsavgift-2026.pdf` (57 s.) | T03 | Årsrundskriv 2026, datert 1. januar 2026 | 1.3, 2.1.1, 3.1, 3.2.1–3.2.6, 3.3.1–3.3.3, 3.3.11, 3.4, 4.1–4.3, 6.12, 6.21, 13.1 |
| `bruksfradragstabell.html` | T07 | Skatteetaten (engelsk side), ingen sidedato i filen | hele tabellen (41 trinn) + forklaringstekst |
| `vrakpantavgift.html` | T20 | Skatteetaten sats, 2026 valgt | hele satssiden |
| `vrakpant-utbetaling.html` | T09 (omdefinert) | Skatteetaten «Scrap deposit», 2026 valgt | ingress + oppsummering |
| `toll-bilimport.html` | T21 (ny) | Tolletaten, «Oppdatert: 5.2.2026», privatperson-side | hele brødteksten |
| `mva-handbok-8-4-3.html` | T22 (ny) | **Merverdiavgiftshåndboken 2025** (sidens tittel; URL sier «gjeldende») | 8-4.3 Videresalg m.m. |
Nettverket mot norske verter er fortsatt blokkert for Claude (kontrollert: `curl www.skatteetaten.no` → proxy 403). Ikke lest: T04 (stortingsvedtak, Lovdata), T05 (forskrift), T10, T11, T14, T15, T16/T17. Verken kalkulator, Lovdata eller stortingslenken er forsøkt omgått.

## 2. F1 P2 – vrakpantavgift (rettet)
- **Feil i 001A:** T09 («Scrap deposit») ble brukt som kilde for importens vrakpantavgift, og 2 400 mot 3 000 ble ført som kildekonflikt.
- **Retting:** `R-IMP-OTH-001` = *vrakpantavgift*, innbetaling ved første gangs registrering, 2 400 kr for gruppe a, b, c, g, j, k (rundskriv 3.4, side 17) og bekreftet av satssiden T20 (2026 valgt). Styrende hendelse: første gangs registrering. T09 er flyttet til ny regel `R-SCR-PAY-001` (*vrakpantutbetaling* ved skroting, 3 000 kr, status `utenfor_beregning_begrepsskille`): ikke importkostnad, ikke fradrag i kjøpspris, ingen profil. «Kildekonflikt» er fjernet fra register, markdown, referanser (`C4-SCRAP` erstattet av klasse 2: `C2-SCRAP-A/B/PAYOUT`), profiler og rapport (merknad øverst i `reviews/TAX-001A.md`).
- **Kontroll som fanger feil begrep:** `check-docs.mjs` feiler hvis (a) en kilde med `scrap-deposit` støtter en regel som ikke er `utenfor_beregning*`, (b) `R-IMP-OTH-001` mangler satssiden for vrakpantavgift eller siterer utbetalingssiden, (c) `R-SCR-PAY-001` har profil eller i en profilregelliste, (d) et tilfelle med `R-SCR-PAY-001` har beløp i stedet for «ekskludert», (e) tekst setter 2 400 «mot/vs» 3 000. Alle fem er bevist negativt (se §8).
- **Åpent:** om vrakpantavgiften reduseres av bruksfradrag er ikke lest (4.3 sier «utregnede avgiften»); kalkulatorreferanse mangler; gyldighet etter 1.1.2026 ikke dokumentert.

## 3. F2 P2 – økonomisk kost (rettet)
- **Feil i 001A:** økonomisk kost = budsjettsum − fradragsberettiget mva. (purchase-basis §6) og «+ ikke-fradragsberettiget del» (demo-series §C): avhenger av valgfrie budsjettlinjer og kan telle mva. to ganger.
- **Retting:** ett felles komponentgrunnlag (`purchase-basis.md` §6.1: beløp, valuta/kurs, lovgrunnlag, `includedInBudget`, `includedInEconomicCost`, mva.-del, fradragsandel, betalingstidspunkt, refusjon) og tre separate summeringer (§6.2): budsjettsum (brutto valgte linjer, DEC-030), økonomisk kost (Σ beløp − fradragsberettiget mva. for reelle kostnadslinjer, uavhengig av budsjettvalg, ikke-fradragsberettiget mva. én gang, ukjent andel → `not_calculated`), betalings-/kapitalbehov (brutto betalinger; bekreftet og scenario-inndekning separat). Kontraktforslaget `TaxInputV1` (`profiles.md`) er endret tilsvarende; gamle formler er fjernet fra `purchase-basis.md`, `demo-series.md` og `reviews/TAX-001A.md` (merknad).
- **Syntetiske regnede referanser (klasse 3), regnet på nytt av `check-docs.mjs` med heltall i øre:** `C3-031` (a: reell kostnad ikke i budsjett), `C3-032` (b: ingen fradragsrett; mva. én gang – gammel formel ville gitt 1 604 000 mot riktig 1 370 000), `C3-033` (c: full), `C3-034` (d: 60 %), `C3-035` (buffer kun i budsjett), `C3-036` (ukjent andel → `not_calculated`), `C3-037/038` (avtalt vs. betinget refusjon). Tabell i `purchase-basis.md` §6.3. Dette er aritmetiske kontrakttester, ikke bekreftelse av importørens fradragsrett.

## 4. Primærkontroll – hva som er dokumentert (E1/E1P)
Se `TAX-001A-rules.md` (generert) og `e1Findings` i `rules.json`. Hovedpunkter:
- **NOx fjernet fra 1.1.2026** (3.2.4, 13.1.2); **slagvolum** ikke lenger grunnlag i a/b/j uten CO2-plikt, i stedet *anslått CO2 = egenvekt/10* (3.2.6); slagvolum består for campingbil (gruppe c).
- **CO2-grunnlag:** WLTP fra CoC direkte; NEDC justeres opp 24 % (gruppe a, j) / 22 % (b); EPA/NRCan som WLTP; ukjent metode → første utenlandske registrering før 1.9.2018 = NEDC (3.2.5).
- **Ladbar hybrid:** vektfradraget er opphevet fra 1.1.2024 (3.3.11) – motsier 001A-leadet om 10 % fradrag. Leadet «×1,24» ligner NEDC-faktoren; ikke avgjort uten forskrift.
- **Ikke-ladbar hybrid:** rundskrivet har ingen egen regel; «som forbrenningsbil» er fortsatt ubekreftet.
- **Elbil:** fritak opphevet 1.1.2023; el i gruppe a betaler (§ 2); el i andre grupper betaler ikke engangsavgift (6.12). Dermed er elektrisk varebil klasse 2 (gruppe b) uten engangsavgift *hvis* klassifiseringen er riktig – dette må kontrolleres mot SVV.
- **Klassifisering:** Statens vegvesen avgjør; obligatorisk enkeltgodkjenning av bruktimport før beregning/forhåndsbetaling; varebil klasse 1 = N1 som ikke oppfyller klasse 2 (3.1, 3.3.1–3.3.3).
- **Bruksfradrag:** prosent av *utregnet avgift*; alder fra første utenlandske registrering til norsk, dato til dato (rundskriv-eksempel 15. jan → 15. jan); tabellen (41 trinn) er transkribert (`bruksfradrag-tabell-T07.json`) og kontrollert mot HTML; 20-årstrinn = 100 % og anses nådd 1. januar i året 20 år passerer (6.21).
- **Import-mva. (T21):** deklarasjon og mva. til Tolletaten først, deretter engangsavgift, deretter vegvesenet; grunnlag for nylig kjøpt bil = kjøpesum + frakt + forsikring; refusjon av utenlandsk mva. er sak mellom kjøper og selger. Siden gjelder privatpersoner; ingen sats.
- **Fradragsrett (T22, 2025-utgave):** unntaket for personkjøretøy for videresalg (§ 8-4 første ledd annet punktum bokstav a) bekreftet i håndboken; ikke bekreftet for 2026, innførselsmva., varebil eller importørens faktiske stilling. 2026-fradragsprofilen er ikke oppgradert.

### Påstått endring 1.9.2026 (U-001)
Rundskrivet er datert 1. januar og dokumenterer ikke endringer senere i året. T04 er ikke lest. Påstanden står som **uavklart kildeopplysning**; ingen regel eller testfasit bygger på den (`C4-VER-0831/0901` er klasse 4 uten forventet verdi).

### Bruksfradrag: engelsk tekst mot rundskriv (U-002)
Siden sier at neste trinn nås «på produksjonsdato», rundskrivet regner fra første registrering i utlandet, dato til dato, og 20-årstrinnet fra 1. januar. Forskrift § 3-3 er ikke lest; det er **ikke** gjettet. Klasse 2-tilfellene `C2-AGE-01…07` er valgt slik at de ikke hviler på denne uklarheten (rundskrivets eget årseksempel, intervall midt i trinn, og 20-årsregelen); månedstrinn antar samme dato-til-dato-prinsipp (merket på tilfellene).

## 5. Hendelsesdatoer
`event-dates.md`: import (deklarasjon/tollverdi/tollkurs) og norsk registrering/engangsavgift har egne hendelser; første utenlandske registrering styrer bruksfradrag og CO2-metode. Kontrakten får `events.*` og `ruleSetSelection` per komponent. Styrende dato er **E1** for plikt, vrakpantavgift, bruksfradragsalder, 20-årstrinn og CO2-metode; **uavklart** for satsversjon, tollkurs, mva.-regler og fradragsperiode.

## 6. Refusjon og depositum
`R-IMP-REF-001` (E1P): Tolletaten behandler ikke refusjon; brutto betalt = kjøpsgrunnlag med mindre dokumentert netto faktura/kjøpsbekreftelse. Avtalt tilbakebetalingskrav (`agreed`) gir bekreftet inndekning i betalingsforløpet; betinget refusjon (`conditional`) er scenario. Tollverdi, budsjettsum, økonomisk kost og kapitalbinding begrunnes hver for seg (`C3-018`, `C3-037`, `C3-038`; beslutningstreet i `purchase-basis.md` §2 er rettet).

## 7. Evidensmodell og sperrer
`evidenceLevel` E0–E3 + **E1P**; `usableAsRuleParameter` er `false` for alle. En regel kan først godkjennes når `check-docs.mjs` finner: nivå E1 (ikke E1P) + `controlledDate`, bare E1-kilder, `validity.from` og `governingEvent`, et klasse 1-tilfelle (eller godkjent klasse 2), og `parameterApproval.approvedBy/approvedDate`. Sperren er altså ikke svekket, men skiller dokumentert regel fra godkjent parameter. E1-kilder krever lesedato, versjon, begrensninger, pakkefil og SHA-256. Klasse 1 krever `independentReference` (verktøy, kjøredato, output); klasse 2 krever håndregning og kan ikke selv være godkjent.

## 8. Kontroller faktisk kjørt
| Kontroll | Resultat |
|---|---|
| `node docs/tax/check-docs.mjs --pack <utpakket kildepakke>` | **OK**: 30 regler (E1 4, E1P 13, E2 13), 25 kilder, 10 profiler, 102 tilfeller (k1 0, k2 10, k3 38, k4 54); pakkehash stemmer for 6 E1-filer; 41-trinns tabell stemmer med T07-HTML; 8 komponent-tilfeller, 7 bruksfradrag-tilfeller og 4 demoscenarier **regnet på nytt** (heltall/øre, uavhengig av verdiene i filene) |
| Negative prøver (feil injisert i kopi, kontrollen må feile) | 8 av 8 feilet som ønsket: T09 som avgiftskilde, godkjent parameter uten vilkår, feil økonomisk kost, feil bruksfradrag-prosent, E1-funn på E2-kilde, «2 400 mot 3 000»-tekst, gammel økonomisk-kost-formel, ødelagt tabell |
| Kjøring av Skatteetatens kalkulator | **IKKE kjørt** (ikke tilgjengelig) |
| `tsc`, `eslint`, `vitest`, `next build` | **Ikke kjørt** – ingen kode, app eller pakker er endret (kun `docs/`, `reviews/` og dokumentasjonsfiler) |
Demoaritmetikk (tollverdi = grunnlag + 1 200 + 150; NOK med kurs 11,50; syntetisk mva. 25 %) stemmer med `demo-series.json`; 100 000/1,19 = 84 033,61 og /1,25 = 80 000. Demotallene er syntetiske.

## 9. Referansetilfeller klare for manuell kalkulatorkontroll – og hva som mangler
Ingen kalkulator er kjørt, så **ingen** er klasse 1. Per tilfelle trengs eksakte input (se `inputs`/`expected.missing`): 
- **`C4-BASE-PB-*`, `C4-BASE-VB-*`** (10, én per profil): mangler egenvekt (norsk definisjon), CO2 + metode, avgiftsgruppe, datoer (første reg. utland, planlagt norsk reg.), kjørt av Christian/Codex i kalkulator med **fastlagte syntetiske kjøretøydata** (ikke fra annonser).
- **`C4-AGE-PB-BEN-*`, `C4-AGE-VB-DIE-*`** (8): samme bil med fire aldre; kalkulatoren kan avgjøre grensetrinn (1 mnd, 1 år, 14 år, 20 år) og U-002.
- **`C2-AGE-01…07`** (10 klasse 2 totalt): bør kalkulatorsjekkes mot prosentene (19, 18, 62, 94, 98, 100, 100) for å heve til klasse 1.
- **`C2-SCRAP-A/B`**: 2 400 kr bør vises i kalkulatorens avgiftsoppstilling.
- Øvrige klasse 4 (31 «andre»): krever satser (T04), kurs (T10), klima-gass (R-IMP-OTH-002), tyske kilder (T16/T17) eller importørprofil.

## 10. Gjenværende belegg før satsavhengig kode kan bestilles (prioritert)
1. **Stortingsvedtaket om engangsavgift 2026 (T04, Lovdata/Stortinget):** satstabeller §§ 2–3, gruppe a og b, vekt- og CO2-trinn, overgang og **U-001**.
2. **Forskrift om engangsavgift (T05):** § 3-1 (CO2-kilde, ladbar hybrid «vektet kombinert», avrunding av egenvekt/10), § 3-3 (bruksfradragstabell – avstemming mot T07 og U-002), § 2-3 (varebil klasse 2), og om vrakpantavgiften påvirkes av bruksfradrag.
3. **Skatteetatens kalkulator (S07):** klasse 1-kjøringer for tilfellene i §9 med lagret input/dato/output.
4. **Import-mva.:** sats, grunnlag (inngår engangsavgift?), rekkefølge, **tollkurs-dato** (T10), sjablongfrakt, transaksjonsgebyr, elbilfritak (T14, mval.-endringen) og næringsdrivende forhandlers deklarasjon/oppgjør (T11).
5. **Fradragsrett:** håndbok/lov per 2026 for innførselsmva. til videresalg, bindingstid § 9-6, varebil, importørprofil (T12, T13, T22).
6. **Klimagassavgift og gebyrer** (R-IMP-OTH-002/003) og Statens vegvesen-kodeverk for avgiftsgruppe (T15).
7. **Utenlandsk side:** § 6/§ 25a UStG direkte (T16/T17); andre land støttes ikke.
Rekkefølgen for kodeoppgaver (foreslått, ikke startet): først COST-komponentmodell + tre summeringer (kun avhengig av §6; ingen satser), deretter bruksfradrag-motor (venter på T05/U-002 og kalkulator), deretter satsavhengige komponenter etter punkt 1–4.

## 11. Filer og grenser
Endret/ny: `docs/tax/{rules,sources,profiles,references}.json`, `docs/tax/{TAX-001A-rules,profiles,purchase-basis,demo-series}.md`, ny `docs/tax/{bruksfradrag-tabell-T07.json,event-dates.md}`, `docs/tax/check-docs.mjs`, `reviews/TAX-001A.md` (merknad), `reviews/TAX-001B.md`, `IMPORT_ENGINE_SPEC.md`, `SOURCES.md`, `DECISIONS.md` (DEC-032 oppdatert, fortsatt **forslag**), `MVP_BACKLOG.md`. `TAX-001A-rules.md` er generert fra JSON (generatoren er ikke i repoet). Ingen kode, tester, pakker, app, UI, DB, auth, env, sertifikater eller deploy er endret.
Begrensninger: ingen sats er kontrollert; håndbok er 2025-utgave; tabell ikke avstemt mot forskrift; Tolletatens side gjelder privatpersoner; alle demotall er syntetiske; HTML-kopiene kan inneholde navigasjon (kun relevante avsnitt er sitert). Stoppet på **REVIEW**; TAX-001B/TAX-002 er ikke startet.
