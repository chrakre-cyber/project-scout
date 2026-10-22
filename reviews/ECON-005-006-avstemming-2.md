# ECON-005 og ECON-006 — samlet avstemming mot akseptkravene (20.10.2026)

Oppdaterer `reviews/ECON-005-avstemming.md` (før 006) etter 006a–c. **Dette er en avstemming, ikke en erklæring om ferdig:** ECON-005/006 settes ikke til DONE her, og ingenting her er pilotklarhet eller bekreftet Supabase-integrasjon. Økonomiflaggene er `false`; E7 er utsatt og E8 er åpent (Christians beslutning B2/B3).

## 1. Leveransestatus
| Del | Status | Belegg |
|---|---|---|
| ECON-005a–d | DONE innen avgrenset omfang | `reviews/ECON-005a/b/c/d-avslutning.md`, `DATA-002D-avslutning.md` |
| ECON-006a (forklaring) | DONE innen levert omfang | `ECON-006a-avslutning.md` |
| ECON-006b (forhandlerskjema, firmaprofil) | DONE innen levert omfang | `ECON-006b-avslutning.md` |
| ECON-006c (nettleserforløp) | **DONE som avgrenset testleveranse** | `ECON-006c-avslutning.md`; reviewers egne kontroller adskilt fra utviklerens |

## 2. ECON-005 mot akseptkravene
| Krav (se avstemming 1) | Nå | Merknad |
|---|---|---|
| `CostAssessment`-mapping, `validUntil`, ingen dobbelttelling | **Oppfylt** | 005a |
| Rettigheter (`allow`/`display_derived_economics`), default nei, TS↔SQL | **Oppfylt** (vitest + isolert PostgreSQL) | 005b/DATA-002D |
| Adapter, serverorkestrering, binding firma/søk/kandidat/revisjon, foreldelse, lagring av bare forhandlerinput | **Oppfylt** (vitest, isolert PostgreSQL, nettleser mot emulator) | 005c, 006b, 006c |
| Visning gjennom rettighetsgrensen, faste etiketter | **Oppfylt** (markup + nettleser) | 005d, 006a, 006c |
| Ingen positive budsjettutfall; ingen avledede tall lagret; flagg false | **Oppfylt** (vitest; nettleser: `data-positive-budget=false` overalt) | |
| **Brukerflate for forhandleropplysninger** (var manglende) | **Levert** (006b) og testet i nettleser (006c) | videreført restarbeid, B1 |
| Test 8: søk → kandidat → input → vurdering → visning for tre profiler + ukjent profil + manglende rett | **Stort sett oppfylt.** Diesel/PHEV/BEV gjennom pipeline i vitest (006a) og i nettleser (006c); manglende rett i nettleser (to testkopier) og vitest. **Ukjent profil** (f.eks. varebil/uspesifisert) er dekket i vitest (005c server), ikke i nettleser | liten rest |
| Test 7: B1 (akseptdato utenfor dokumentert vindu) gjennom visning | **Delvis**: kjerne, mapper og 005c-tester; ikke eksplisitt gjennom visning/nettleser | liten rest |
| Test 6: varsler | **Ikke relevant** (ingen varselmodul) | |
| Test 1: property-test av mapping-matrisen | Ikke levert (liten svakhet, uendret) | valgfri |
| **E8 `EconomicTarget`** | **Åpent, utsatt** (raden = «v1 uten EconomicTarget») | B3 |
| **E7** kjent kostnad over øvre grense som infofelt | **Utsatt** | B2 |
| Integrasjon mot ekte Supabase/PostgREST/GoTrue | **Ikke utført** | nødvendig før pilot: `forslag-supabase-kontroll.md` |
| Supabase-avhengige DB-filer, hosted migrasjoner (3 uanvendte) | **Ikke utført** | samme |

**Porter før ekstern partnerdemo (ECON-001 § 15.7):** (a) avgiftsmotor validert for viste profiler — **ikke oppfylt** (regelflagg false, U-013 m.fl. åpne; uendret); (b) FX-kilde/dato vist for begge roller — **oppfylt i visning** (006a, nettleser 006c); (c) forutsetninger vist og merket — **oppfylt** (006a); (d) ukjent/ikke beregnet for ikke støttede profiler — oppfylt; (e) «estimat — ikke rådgivning» + syntetisk-etikett — **oppfylt** (006a); (f) rettighetskontroll — oppfylt; (g) gyldne fixturer i CI — **delvis** (fixturer i suiten; repoet har ingen CI-konfigurasjon); (h) uavhengig review — oppfylt for 005a–d og 006a–c. **Inntil (a) er oppfylt gjelder: ingen partnerdemo med landed cost som beslutningsgrunnlag; ingen positive utfall.** I tillegg: uendret demo viser i dag ingen økonomi (utløpt kildedata siden 11.10.2026).

**Disposisjon ECON-005:** alt som var planlagt innenfor v1 (uten `EconomicTarget`) er levert og reviewet bortsett fra de to små restene (ukjent profil i nettleser, B1 gjennom visning — begge dekket på lavere nivå) og integrasjonskontrollene. Jeg foreslår at ECON-005 kan settes til **«DONE innen avgrenset omfang (v1 uten `EconomicTarget`; E7 utsatt; E8 åpent)»** hvis Christian uttrykkelig aksepterer at (i) Supabase-/hosted-kontrollene føres som egne, nødvendige pilotkontroller og (ii) de to restene er akseptable eller tas som små tester. Det er Christians beslutning; inntil da: **REVIEW**.

## 3. ECON-006 mot DoD (plan § 7)
| DoD | Nå |
|---|---|
| 1. Nedbrytning, forutsetninger (kurs med kilde/dato for begge roller), to summer, grunnlagsetiketter uten score (B4), «ikke beregnet» med hva som mangler — kun via visningsmodellen bak rettighetsgrensen | **Oppfylt** (006a; nettleser 006c) |
| 2. Forhandleropplysninger kan registreres, endres og bekreftes på nytt; firma fra sesjon; ingen annonsepåstand blir dokumentasjon; foreldet input brukes ikke | **Oppfylt** (006b; nettleser 006c; foreldelse delvis simulert i testdatabasen) |
| 3. Ingen positive utfall/varsler; ingen lagring av avledede tall; flagg false; ingen nye regler | **Oppfylt** |
| 4. Test 8; J1–J10 i nettleser med skjermbilder; Supabase som eget ikke-kjørt kontrollpunkt | **Stort sett oppfylt:** J1–J4, J6–J9 og J10 (390 px, tastatur, skjermbilder) kjørt; **J5** (ukjent fradragsstatus ⇒ to scenarioer) er dekket i vitest, ikke i nettleser (BEV-scenariene i nettleser skyldes EV-kvalifisering); skjermleser ikke prøvd; Supabase-kontrollen står som ikke-kjørt (som DoD tillater) |
| 5. Uavhengig review uten blokkerende funn per skive; avslutningsrapporter som skiller reviewer fra utvikler | **Oppfylt** (006a, b, c) |

**Disposisjon ECON-006:** DoD er oppfylt slik den er skrevet, med to små rester (J5 og ukjent profil i nettleser) og forbeholdet om simulert foreldelse. Foreslått: **«DONE innen avgrenset omfang (DoD § 7) med de dokumenterte begrensningene»** etter Christians uttrykkelige aksept; foreslåtte tillegg i plan § 5 (E7, kopiering av bekreftelse, historikk, sammenligning, eksport, FX-tjeneste m.fl.) forblir utenfor. Inntil da: IN PROGRESS → klar for beslutning.

## 4. Nødvendige kontroller vs valgfrie forbedringer
**Nødvendig før partnerdemo:** (1) fornyelse av syntetiske demodata med ærlig proveniens og bevart utløpskontroll (`docs/econ/forslag-demodata-fornyelse.md`); (2) avklaring av port (a) / hva demoen får vise (landed cost som beslutningsgrunnlag er ikke tillatt).
**Nødvendig før pilot:** kontroll mot ekte Supabase lokalt og hosted testprosjekt (`docs/econ/forslag-supabase-kontroll.md`); godkjente økonomiregler (flagg false i dag); beslutning om hosted migrasjoner (tre uanvendte) og DATA-002D-kartlegging per mål; CI med gyldne fixturer (port g) bør avklares.
**Valgfritt:** property-test av mapping-matrisen; ukjent profil og B1 som nettleserforløp; J5 i nettleser; skjermleser-/språktest av tekstene; andre nettlesere/ekte mobil; ytelsesmåling; E7; E8; rullerende utviklermodus for demodata.

## 5. Ikke gjort i denne runden
Ingen kodeendring, ingen hosted migrasjon, ingen deploy, ingen kontroll mot Supabase. Økonomiflagg false; E7 utsatt; E8 åpent.

---
## Oppdatering 21.10.2026 (ECON-006d — testrester)
De små restene i § 2/§ 3 er nå dekket gjennom faktisk visning og i nettleser (`reviews/ECON-006d-leveranse.md`, vitest 12 tester + nettleser 26/26; emulator, ikke Supabase): **ukjent rettighetsprofil** (ingen profil ⇒ «ikke funnet»; utkastprofil ⇒ blokkert med forklaring), **ukjent kjøretøy-/registreringsprofil** (uspesifisert/varebil ⇒ «Ikke beregnet»; ukjent drivlinje), **B1** (akseptdato før/etter 2026 ⇒ aldri estimat, årsak vist) og **J5** (ukjent fradrag ⇒ to scenarioer for økonomisk kost, adskilt fra BEV med ukjent elbilkvalifisering og fra BEV med begge ukjente). Test 8 og J5 regnes dermed som oppfylt innen de dokumenterte forbeholdene (emulator, testkopier, relative datoer). **Gjenstår uendret:** ekte Supabase (L1–L7, H1–H4), øvrige rettighetsvarianter og server-action-POST i nettleser, skjermleser/andre nettlesere, port (a), fornyelse av demodata (forslag), E7/E8. **ECON-005/006 er fortsatt ikke markert DONE** — avventer uavhengig review av 006d og Christians beslutning.

