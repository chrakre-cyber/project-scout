# ECON-004 — prioritert oversikt over gjenstående kilde- og godkjenningsbehov (19.10.2026)

> **Oppdatert 19.10.2026 (historikk bevart under):** Prio 2 «satsbelegg» er nå besvart (Stortingets vedtak 217 § 2 / FOR-2025-12-18-2752, T76/T77); lov 19.6.2026 nr. 41 er identifisert som særavgiftsloven og er ikke relevant for elbilfritak/tollverdi/fradrag (T70; prio 3 faller bort som blokkering); overgangsregelen i lov 22.12.2025 nr. 121 gjelder bare leasing (T71); meldingsformat for U-013 del C er dokumentert (T79). Se `reviews/ECON-004-kildevurdering-3.md` og `reviews/ECON-004-kildevurdering-4.md`.

**Status: oversikt, ikke godkjenning.** Utgangspunkt: `bd67c8d3c10ca69015b8e50757f8b583180ce6d4` (SRC1-FIX1 uavhengig review: begge P2 lukket, ingen nye blokkerende funn; `reviews/ECON-004-SRC1-FIX1-review-bd67c8d.md`). ECON-004 forblir REVIEW. De fire økonomiflaggene (`vatRulesApproved`, `roundingApproved`, `customsFxRuleApproved`, `deductionRuleApproved`) er `false` og forblir det til du uttrykkelig beslutter noe annet. Ingen kodeendring er gjort. ECON-005 er ikke startet. Kilde-ID-er (Txx) viser til `docs/tax/sources.json`; «registrert URL» = finnes i registeret, men er aldri lest; «søkespor» = tittel/URL ikke verifisert.

## 1. Slik leses oversikten
- **A. Allerede besvart av eksisterende kilder:** teksten er lest (E1) og kan brukes som grunnlag for en regelformulering. Det er ikke det samme som godkjent: hver regel trenger fortsatt registeroppføring (evidensnivå/e1Findings i `rules.json`) og din uttrykkelige beslutning.
- **B. Krever nye kilder:** spørsmålet er ikke dekket av noe lest dokument.
- **C. Produktbeslutning:** ingen kilde kan avgjøre den; den hører til deg.

## 2. Prioritert liste (høyest først)
| Prio | Behov | Type | Blokkerer | Hva som avgjør neste skritt |
|---|---|---|---|---|
| **1** | **U-013 avrunding** (tollverdi, valutaomregning, hver mva-beregning, samlet krav/mva-melding) | B (ingen regel funnet i 19 dokumenter; tekstsøk, ikke bevis for fravær). Hvis kilde ikke finnes: C | `roundingApproved` | Tolletatens veiledning for utfylling av tolldeklarasjon (post 46/rubrikk 47, beløpsformat), Tolldirektoratets tollverdiveileder (nevnt i T60), mva-meldingens spesifikasjon/veiledning (kode 81/82, beløpsfelt) — alle søkespor; T11 (PDF, registrert URL). Uten funn: uttrykkelig produktkonvensjon fra deg, merket som konvensjon (ikke rett). Likhet (x,5) må uansett behandles eksplisitt. |
| **2** | **Elbilfritak ved innførsel: hva 300 000 måles mot** | B + C | `vatRulesApproved` (for EV) | Lovtekst sier «vederlag» (mval. § 6-8), Tolletaten «verdi» (T57), grunnlaget ved innførsel er tollverdi (§ 4-11). Trenger uttalelse/forarbeid som sier målegrunnlaget ved innførsel (søkespor: Skattedirektoratet/Tolletaten, Prop. 1 LS (2025–2026) pkt. 11.2). Inntil da: scenarier (`evThresholdBasis = unresolved`). Beslutning C: skal `vehicle_price_only`-scenarioet beholdes? |
| **3** | **Overgangsregler og senere lovendringer for elbilfritaket** (lov 22.12.2025 nr. 121 del III; lov 19.6.2026 nr. 41; trapp 2027/2028) | B | `vatRulesApproved` | Endringslovene (søkespor); T14 lovvedtak (registrert URL); håndbokens fulle endringslogg (T58 «Se flere endringer»). Avgjør om 300 000 gjelder for alle beregningsdatoer kjernen kan få. |
| **4** | **Akseptøyeblikket for en konkret deklarasjon** (tidlig levering 16–30 dager før, Digitoll, vareførselsloven § 3-3 (3) og § 3-4 «varen er fremlagt»); hvor suspensjon publiseres; kurser før 3.9.2026; valutaer utenfor listen (Norges Banks daglige kurs) | B + C | `customsFxRuleApproved` | Vareførselsloven § 3-3 (T67 delvis lest); Tolletatens suspensjonsvarsel og kurshistorikk (lenke «Finn historiske kursar» på T23; data.toll.no historikk — søkespor). Beslutning C: se pkt. 9. |
| **5** | **Tollverdi/mva-grunnlag i praksis (R-IMP-VAT-002)**: tollsats for personbil; om statistisk verdi (post 46) alltid = tollverdi; hva Tolletaten innkrever ved grensen fra registrerte; at engangsavgift ikke inngår i *innførsels*grunnlaget (uttrykkelig støttet bare for omsetning, § 4-2) | B | `vatRulesApproved` | T10 (registrert URL, betaling av avgifter); tolltariffen (søkespor); tollverdiveileder (søkespor); vareførselsloven §§ 6-2–6-9 (T67, ikke gjennomgått for dette formålet). |
| **6** | **Fradragsrett (R-DED-001), rest**: dokumentasjon av at bilen er «salgsvare»; omdisponering/uttak/tilbakeføring; forholdsmessig fradrag; demonstrasjon/utlån | B + C | `deductionRuleApproved` | T28 (registrert URL, aldri lest); håndbok § 9-6 og uttaksregler (søkespor); Skatteetatens veiledning for bilforhandlere (søkespor). Beslutning C: hvilken dokumentasjon produktet krever før `dealer_entered`/`dealer_profile` godtas (pkt. 7). |
| **7** | Kjøretøykriterier for elbilfritaket: FMVA § 1-3-1 (personkjøretøy), om brenselcelle omfattes, «ikke tidligere registrert i Norge» i praksis | B | `vatRulesApproved` (EV) | Forskriftstekst FMVA § 1-3-1 (søkespor); T57 (lest, dekker ikke brenselcelle). |
| **8** | U-003 rest: lov 19.6.2026 nr. 41 og håndbokens fulle endringslogg for §§ 8-1/8-4 | B | lukking av U-003 | T58 «Se flere endringer»; lovtekst (søkespor). Selve versjonsspørsmålet er besvart (A). |
| **9** | Betalingsfrist for mva-melding; netting av beregnet mva. mot fradrag; engangsavgiftens betalingstidspunkt | B (utenfor ECON-004; gjelder en eventuell likviditetsmodell) | ingen flagg | Skatteetatens mva-melding-frister (søkespor); T10; T21 (lest, gjelder privatpersoner). |

## 3. Besvart av eksisterende kilder (A)
| Spørsmål | Besvart av | Gjenstår før regel kan godkjennes |
|---|---|---|
| Tollkursens syklus, 14 dagers gyldighet, grunnlag (Norges Bank foregående virkedag), avviksordning, tidspunkt = aksept av deklarasjon, gammel vs ny ordning | T65, T69, T68, T67 (§ 3-4), T53, T23, T24, T55 | Registeroppføring (R-IMP-FX-001 er E2 «kildekonflikt»; konflikten er forklart men regelen er ikke løftet); prio 4 og pkt. 9 |
| U-003: håndbok er løpende; videresalgsavsnittet er ordrett likt 2023; rettslig vilkår i mval. § 8-4 (1) a | T58, T59, T36, T63 | Prio 8 |
| Tollverdi = transaksjonsverdi + transport/forsikring til innførselsstedet + lasting/håndtering (objektive, kvantifiserbare tillegg); frakt etter innførselsstedet inngår ikke; transport før/etter fordeles etter avstand; kjøperens egen transport = vanlige fraktkostnader; sjablong 500/1 500/2 500 gjelder bare egne hjul | T67 § 6-10, T69 § 6-10-4, T64 | Prio 5 |
| Mva.-grunnlag ved innførsel = tollverdi + toll og andre avgifter; sats 25 % (eksempel i veiledningen) | T63 § 4-11, T56, T60 | Prio 5 (engangsavgift, tollsats) |
| Registrerte virksomheter beregner og rapporterer innførselsmva. selv i mva-meldingen (kode 81/82); andre betaler ved innførsel; gjelder også varer til videresalg og uten fradragsrett | T56 | Prio 9 hvis likviditet skal modelleres |
| Elbilfritak gjelder ved innførsel (§ 7-1 (1)), 300 000 fra 1.1.2026, bare rene elektriske personkjøretøy fra ladbar batteripakke, nye og brukte, hybrider utenfor, overskytende 25 % | T63, T62, T57, T35 | Prio 2, 3, 7 |
| Fradragsrett: registrert avgiftssubjekt (§ 8-1), personkjøretøy som salgsvare (§ 8-4 (1) a), samme regler for import som innenlands, dokumentasjonskrav | T63, T59, T36, T56 | Prio 6 |

## 4. Produktbeslutninger (C) — hører til deg
1. **Akseptdato i produktet:** skal forhandleren oppgi forventet/faktisk dato, eller skal produktet bruke et scenario (f.eks. dagens dato)? Kjernen krever begge adskilt og gir ufullstendig uten dato.
2. **Transport:** beholde 8 000 som uttrykkelig konfigurert produktantakelse (kun til grensen), gjøre det til produktstandard, eller kreve oppgitt beløp?
3. **`vehicle_price_only`-scenarioet:** beholdes som scenario, eller fjernes til målegrunnlaget er avklart (prio 2)?
4. **Opplysningspolicy for fradragsstatus og mva-håndtering:** hvem kan oppgi dem (`dealer_entered` vs `dealer_profile`), hvilken dokumentasjon kreves, og hvordan vises «ukjent» til brukeren.
5. **Avrundingskonvensjon** hvis kilde ikke finnes (prio 1): metode og tie-regel, merket som produktkonvensjon.
6. **Kursfallback** («bruk anskaffelseskursen som tollkurs»): beholde som uttrykkelig valg (estimat) eller fjerne.
7. **Presentasjon av `importCashRequirement`** (brutto utlegg inkl. import-mva.) i ECON-005: omdøping/merking før noen UI bruker feltet.
8. **Godkjenningsrekkefølge:** hvilke flagg skal vurderes først. Mulig rekkefølge ut fra dekningen: `customsFxRuleApproved` (regelteksten er lest; trenger prio 4 + beslutning 1) → `deductionRuleApproved` (prio 6 + beslutning 4) → `vatRulesApproved` (prio 2, 3, 5, 7) → `roundingApproved` (prio 1). Hver godkjenning krever også at tilhørende regler i `rules.json` løftes med e1Findings og at du uttrykkelig godkjenner.

## 5. Dekningsmatrise per flagg
| Flagg | Dekket av eksisterende kilder | Mangler (prio) | Beslutninger |
|---|---|---|---|
| `customsFxRuleApproved` | syklus, periode, tidspunkt, avvik (T65/T69/T68/T67/T53/T23) | akseptøyeblikk i praksis, suspensjonspublisering, historikk (4) | 1, 6 |
| `deductionRuleApproved` | lovvilkår, uendret videresalgsavsnitt, importveiledning (T63/T59/T36/T56) | salgsvare-dokumentasjon, uttak/omdisponering (6) | 4 |
| `vatRulesApproved` | tollverdikomponenter, grunnlag, 25 %, elbilfritak ved innførsel i prinsippet (T67/T69/T63/T56/T62/T57) | målegrunnlag, overgangsregler, tollsats, engangsavgift i innførselsgrunnlag, kjøretøykriterier (2, 3, 5, 7) | 2, 3 |
| `roundingApproved` | ingenting | hele U-013 (1) | 5 |

## 6. Ikke gjort
Ingen kode, ingen testendring, ingen register- eller regeloppdatering, ingen godkjenninger, ingen flagg. Reviewen av `bd67c8d` er registrert som dokument; ECON-004 forblir REVIEW.
