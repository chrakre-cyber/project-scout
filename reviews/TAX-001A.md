# TAX-001A — avgiftsregler, kjøpsgrunnlag og uavhengige kontrolltilfeller · leveranserapport

> **TAX-001B (15.10.2026) – rettelser til denne rapporten:** (1) F1: «vrakpant 2 400 mot 3 000 – kildekonflikt» var feil; T09 gjelder vrakpant*utbetaling*, vrakpantavgiften er 2 400 kr (rundskriv 3.4, T20). (2) F2: «økonomisk kost = budsjettsum − fradrag» er trukket tilbake. (3) «0 E1-regler / 0 klasse 2» gjelder ikke lenger; se `reviews/TAX-001B.md`. Resten av denne rapporten er historikk fra TAX-001A.


Status: **REVIEW** (ikke DONE). Utfører Claude Code, kontrollør Codex. Dette er et dokument-/referanseoppdrag. Ingen beregningskode, ingen satser i kjørende app, ingen endring i eksisterende kode, UI, pipeline, pakker, database, auth, miljøfiler, sertifikater eller deploy. Ingen kontakt med myndigheter eller selgere.

## 0. Viktigste resultat og blokker (les først)

**Gjeldende regler kunne ikke primærkontrolleres.** Utviklingsmiljøets nettverk blokkerer de norske kildeverstene (`www.skatteetaten.no`, `www.toll.no`, `lovdata.no`, `www.regjeringen.no`; `curl` fikk 403 fra proxyen, verktøyet for sidehenting fikk DNS-feil). Skatteetatens kalkulator er derfor ikke forsøkt kjørt. Det som finnes er **12 søk** (15.10.2026) mot offisielle domener, som ga *sammendrag* av offisielle sider. De er klassifisert som **evidensnivå E2 (lead)**, ikke som kontrollert kilde (E1).

Konsekvenser, uten unntak:
- **0 regler** har E1. Ingen sats, terskel, tabell eller beløp er fastsatt. Regelregisteret har «IKKE KONTROLLERT» på alle beløpsfelt og `usableAsRuleParameter = false`.
- **Referansetilfeller klasse 1 (uavhengig kontrollert) = 0 og klasse 2 (manuelt kildeutledet) = 0.** Ingen kalkulatorresultater eller kildeutledede forventninger er oppdiktet.
- Sekundære kilder med tall (Smarte Penger, Crowe) er **avvist** (interne motsigelser; budsjettforslag).
- Å åpne nettverket for navngitte verter (se §6), eller at Christian/Codex leser kildene og kjører kalkulatoren, er forutsetningen for at regelregisteret kan gå fra E2 til E1. **Dette bør avgjøres før TAX-002 starter.**

Det som *er* levert, er derfor: regel-/kildekartlegging med ledetråder og kildekonflikter, profilmatrise og datakontrakt (forslag), beslutningstre for kjøpsgrunnlag/brutto-netto, 85 referansetilfeller i fire strengt adskilte klasser, en syntetisk presentasjonsserie og en dokumentkontroll.

## 1. Utgangspunkt
- Branch `claude/wonderful-bardeen-yussx3`, HEAD før endring: `00805fe` (review-ZIP oppå SEARCH-004 `782bf77`/kode `52dea9d`, base `70f2d90`). Arbeidstreet var rent. Ingen avvik.
- Christians lokale app er på SYNC-001; adapterleveransene er ikke automatisk lagt inn der. Ingen lokal app-/DB-/hosted-handling inngår.
- Les: AGENTS.md/CLAUDE.md, IMPORT_ENGINE_SPEC, SOURCES, DEC-030/031, MEROVO_SEARCH_SPEC (tidligere i økten), backlogg. DEC-030 er primær: salgspris og margin er ikke påkrevd.

## 2. Krav → belegg
| Oppdragskrav | Levert | Fil | Status |
|---|---|---|---|
| L1 datert regel- og kilderegister (id, komponent, profil, input, formel, enhet, avrunding, dato, kilde, kontrollert dato, uløste spørsmål/kildekonflikt) | 28 regler, 22 kilder | `docs/tax/rules.json`, `TAX-001A-rules.md`, `sources.json` | strukturen er fullført; **innholdet er E2/lead** (ingen E1) |
| L1 skill vedtatt fra forslag/fremtid | `fremtidig_ikke_i_kraft` (elbil-nedtrapping 2027/28), budsjettforslag avvist | `rules.json` (R-IMP-VAT-003), `sources.json` (X02) | ok |
| L1 engangsavgift per gruppe, bruksfradrag, aldersgrenser, import-mva., særregler, vrakpant, klimagass | alle komponenter kartlagt som regler med åpne spørsmål | R-OTA-*, R-IMP-* | **kartlagt, ikke kontrollert** |
| L1 ikke universell 25 % / gammel elbilgrense; alternativt bruksfradrag utenfor | 25 % bare som lead + syntetisk demoparameter; elbilgrense 300 000 bare som lead; alt. metode `utenfor_første_motor` | R-IMP-VAT-001/-003, R-OTA-012 | ok |
| L2 profilmatrise 2 × 5, fire lag, krever avklaring | 10 profiler, alle `krever_avklaring` | `profiles.json`, `profiles.md` | ok |
| L2 hva NormalizedListing/CandidateV2 har/mangler, manuelle bekreftelser, blokkeringer | per profil | `profiles.json` | ok |
| L2 datakontrakt (versjonert, kandidat-/kostnadsbinding, regelversjon, dato, kurs, kjøpsbekreftelse, foreldelse) | `TaxInputV1` (forslag) | `profiles.md` §5 | forslag |
| L3 beslutningstre brutto/netto/regime, tre resultater, kurser, transport/dobbelttelling, budsjettvalg ≠ lovgrunnlag | levert | `purchase-basis.md` | forslag; regelinnhold E2 |
| L3 utenlandsk regelmatrise med kilder, landdekning | Tyskland (lead), øvrige land ikke støttet; enkelttilbud som dokumentert tilbud | `purchase-basis.md` §3 | begrenset |
| L4 ≥ 50 tilfeller i fire strenge klasser | 85 (klasse 3: 30, klasse 4: 55; klasse 1–2: 0) | `references.json` | **ingen uavhengige fasiter** |
| L4 presentasjonsserie (EUR 100 000: ingen justering, 19 %, 25 %, annonsert netto, margin, uavklart; personbil, varebil, elbil, hybrid) | 6 scenarioer + 4 biltyper | `demo-series.json/.md` | syntetisk; ingen avgiftsfasit |
| Dokumentkontroll (format, kilde-/regel-/referanse-id-er) | `check-docs.mjs` | `docs/tax/check-docs.mjs` | kjørt: OK |
| Backlogg, DECISIONS (forslag), spesifikasjonstillegg | oppdatert | `MVP_BACKLOG.md`, `DECISIONS.md` (DEC-032 forslag), `IMPORT_ENGINE_SPEC.md`, `SOURCES.md` | ok |

## 3. Hva som faktisk er undersøkt
- **Søk** (15.10.2026, søkeverktøy, offisielle domener; standard og extended): engangsavgift 2026 (3 søk), bruksfradrag, andre avgifter/vrakpant/klimagass, satstabell, elbil-mva./Stortingets vedtak, varebil klasse 1/2/Statens vegvesen, tollverdi/valutakurs, fradragsrett (Mva.-håndboken M-8-4), tysk utførsel og differansebeskatning (§ 6/§ 25a UStG), hybrid/ladbar hybrid, stortingsvedtak gruppe b/bruksfradrag. Hvert sammendrag er lagret som lead i `rules.json` med kilde-ID og merknad om usikkerhet.
- **Direkte henting** av skatteetaten.no, toll.no, lovdata.no og regjeringen.no feilet. Ingen kalkulator kjørt.
- **Ikke gjort:** lesing av årsrundskrivet 2026, Stortingsvedtakets § 3/§ 4, bruksfradragstabellen, Tolletatens kurs- og sjablongfraktsider, Mva.-håndboken i sin helhet, tyske/EU-kilder utover treffene.

### Kildekonflikter og viktige ledetråder (ikke regler)
1. **Mulig regelendring 1.9.2026** av Stortingsvedtakets § 3 (endret 19.6.2026). Planlagt registrering før/etter dette kan ha ulik regelversjon. Dette krever versjonsstyring på registreringsdato og er gjort til eget testtilfelle (C4-VER-0831/0901).
2. **NOx** avviklet fra 1.1.2026 (Skatteetaten), men samme side nevner fortsatt NOx.
3. **Vrakpant** 2 400 mot 3 000 kr.
4. **Tollkurs-dato:** deklarasjon mot frigivelse.
5. Lead-tall for gruppe b (30 kr/kg over 1 200 kg; CO2 450/600/1 200) kan tilhøre versjonen *før* 1.9.2026 og skal ikke brukes.
6. **Elbil-mva.**: 300 000 kr fra 1.1.2026 (lead); nedtrapping 2027/2028 er fremtidig/uenighet.

## 4. Dekningsmatrise (profil × komponent)
Alle celler er `kartlagt, ikke primærkontrollert` med unntak av de som er merket. «✗» = ikke relevant for profilen.

| Komponent | PB-BEN | PB-DIE | PB-HEV | PB-PHEV | PB-BEV | VB-BEN | VB-DIE | VB-HEV | VB-PHEV | VB-BEV |
|---|---|---|---|---|---|---|---|---|---|---|
| Vektkomponent (R-OTA-001) | lead | lead | lead | lead | lead | lead | lead | lead | lead | lead |
| CO2-komponent (R-OTA-002) | lead | lead | lead | lead | ✗ | lead | lead | lead | lead | ✗ |
| NOx (R-OTA-003) | konflikt | konflikt | konflikt | konflikt | ✗ | konflikt | konflikt | konflikt | konflikt | ✗ |
| Hybrid-regler (R-OTA-005/006) | ✗ | ✗ | uavklart | uavklart | ✗ | ✗ | ✗ | uavklart | uavklart | ✗ |
| Gruppe b / varebilklasse (R-OTA-008/009) | ✗ | ✗ | ✗ | ✗ | ✗ | lead | lead | lead | lead | lead |
| Bruksfradrag (R-OTA-010/011) | lead | lead | lead | lead | lead | lead | lead | lead | lead | lead |
| Import-mva. + tollverdi (R-IMP-VAT-001/002, FX) | lead | lead | lead | lead | lead + elbilgrense | lead | lead | lead | lead | lead + elbilgrense |
| Vrakpant / klimagass (R-IMP-OTH) | konflikt / lead | konflikt / lead | konflikt / lead | konflikt / lead | konflikt / uavklart | konflikt / lead | konflikt / lead | konflikt / lead | konflikt / lead | konflikt / uavklart |
| Fradragsrett (R-DED-001) | lead | lead | lead | lead | lead | uavklart for varebil | uavklart | uavklart | uavklart | uavklart |
| Utenlandsk mva. (R-FOR-*) | DE-lead | DE-lead | DE-lead | DE-lead | DE-lead | DE-lead | DE-lead | DE-lead | DE-lead | DE-lead |

## 5. Referansetilfeller: fire klasser (`references.json`)
| Klasse | Antall | Innhold |
|---|---|---|
| 1 Uavhengig kontrollert referanse | **0** | krever kalkulator/offisielt resultat – ikke tilgjengelig |
| 2 Manuelt kildeutledet forventning | **0** | krever E1-kilde – ikke tilgjengelig |
| 3 Syntetisk aritmetikk/demo/regelkontrakt | 30 | brutto/netto-aritmetikk, valuta, tollverdi, null/0, datopresisjon, blokkeringer, eksisterende domenekontrakter (not_calculated); hver med eksplisitt forutsetning |
| 4 Planlagt/blokkert | 55 | alle 10 profiler (grunntilfelle), bruksfradragstrinn (1 mnd/1 år/14 år/20 år), CO2-bånd, manglende CO2/vekt, NEDC/WLTP, hybrid, elbil-mva.-grense, varebilklasse/ombygging, regelversjon 31.8/1.9.2026, vrakpant, klimagass, frakt, kurs, utenlandske regimer, fradrag. **Ingen forventet totalsum**; hvert tilfelle lister hva som mangler og hvordan det oppgraderes |

Antallet er ikke kvalitet: det er 85 distinkte formål, men **0 tilfeller er godkjenningsgrunnlag** for en profil. IMPORT_ENGINE_SPEC krever minst 50 beregningstilfeller *med uavhengige referanser*; det kravet er **ikke oppfylt** og er en eksplisitt blocker (ikke et bestått resultat).

## 6. Hva Christian/Codex må kontrollere eller åpne (presis liste)
**A. Nettverk (valg 1):** Edit environment → Network access → Allowed domains: `www.skatteetaten.no`, `skatteetaten.no`, `oppslag.rettskilder.skatteetaten.no`, `www.toll.no`, `lovdata.no`, `www.regjeringen.no`, `www.stortinget.no`, `stortinget.no`, `usth.bundesfinanzministerium.de`, `www.gesetze-im-internet.de`, `autosys-kjoretoy-api.atlas.vegvesen.no`. (Instruksjonen er <https://code.claude.com/docs/en/cloud-environments#network-access>.)

**B. Direkte lesing (valg 2):** per kilde `whatToExtract` i `sources.json`. Høyest prioritet: T04 (Stortingsvedtak 2026 § 3/§ 4 og endringen 19.6.2026), T03 (årsrundskriv 2026 med eksempler), T07 (bruksfradragstabellen), T10 (tollkurs-dato, sjablongfrakt), T14 (elbil-mva.), T09 (vrakpant), T12 (fradrag).

**C. Kalkulator:** kjør Skatteetatens importkalkulator (S07) for klasse 4-tilfellene `C4-BASE-*` og `C4-AGE-*`; lagre input, dato, resultat og skjermbilde uten persondata.

**D. Faglige avklaringer:** punkt 1–8 i `purchase-basis.md` §7 og de fem lokale spørsmålene i §3 (dokumentasjonspakke utenlandsk selger, selvhenting/utenlandsk kjøper, margin-nettopris, privatsalg, refusjonsvilkår), samt fradragsprofilen til den konkrete importøren.

## 7. Forslag til beslutninger (ikke godkjent av Christian)
`DEC-032 (FORSLAG)` i `DECISIONS.md`: evidensnivåer E0–E3 der bare E1 kan bli regelparameter; regeldata skilt fra motor og versjonert på registreringsdato; tre separate resultater; `legalBase` skilt fra `includedInBudget`; syntetisk demobekreftelse alltid merket syntetisk.

## 8. Prioritert liste over neste avgrensede kodeoppdrag (oppdatert anslag: 12–13, opp fra 9–11)
Økningen skyldes: egen kontrolloppgave før kode, regelversjonering på registreringsdato (mulig 1.9.2026-endring), egen varebilklassifisering/ombygging, hybrid-/elbilspesifikke regler og at avtalt biltype- og brutto/netto-omfang ikke er kuttet.

| # | Oppdrag | Avhenger av |
|---|---|---|
| 0 | **TAX-001B (kontroll, ikke kode):** E1-lesing av T03/T04/T07/T10/T14 + kalkulatorreferanser | nettverk eller manuell lesing |
| 1 | TAX-002 Regeldataformat, versjonering på dato, validering (uten satser) | 0 (format kan startes tidligere) |
| 2 | TAX-003 Kjøpsgrunnlag: brutto/netto/regime/depositum, tollkurs/betalingskurs/buffer (ren aritmetikk + beslutningstre) | kan starte uten satser |
| 3 | TAX-004 Tollverdi og transport før/etter grense, `legalBase` ≠ `includedInBudget`, dobbelttelling | 2 |
| 4 | TAX-005 Import-mva. inkl. elbil-regel | 0, 1, 3 |
| 5 | TAX-006 Engangsavgift personbil bensin/diesel (vekt + CO2, CO2-fallback) | 0, 1 |
| 6 | TAX-007 Ordinært bruksfradrag + datopresisjon/alder | 0, 1, 5 |
| 7 | TAX-008 Hybrid, ladbar hybrid og elbil i engangsavgiften | 5, 6 |
| 8 | TAX-009 Varebil (klasse 1/2, gruppe b, ombygging/godkjenning som inndata) | 5, 6 |
| 9 | TAX-010 Vrakpant og klimagassavgift | 0 |
| 10 | TAX-011 Aggregator: tre resultater (budsjettsum, økonomisk kost, kapitalbehov) + fradragsprofil | 3–9 |
| 11 | TAX-012 QA-referanseharnisk: ≥ 50 tilfeller mot kalkulator, regelversjonstester | 0, 5–10 |
| 12 | TAX-013 Sandbox-demo: TaxInput-adapter fra kandidat, tydelig syntetisk bekreftelse | 11 |

## 9. Kontroller faktisk kjørt
- `node docs/tax/check-docs.mjs` → «OK: format, kilde-id-er, regel-id-er og referanser stemmer» (28 regler, 22 kilder, 10 profiler, 85 tilfeller). Kontrollen er bevist ved syv bevisste feil (ukjent kilde, klasse 4 med verdi, klasse 1 uten E1, regel «brukbar» uten E1, duplikat-id, E1 uten lesing, for få tilfeller): alle gir feilkode 1.
- JSON parses og aritmetikken i klasse 3 er regnet med `Decimal` (halv-opp, 2 desimaler).
- Ikke kjørt (ingen kodeendring): typecheck, lint, vitest, bygg. Ingen nye pakker.

## 10. Avgrensninger
- Dette er ikke en avgiftsberegner og ikke en godkjent regelprofil. Ingen sats brukes noe sted. `r_demo = 25 %` i demoen er et aritmetisk valg, ikke en regel.
- Demobekreftelser er syntetiske og merket slik.
- Eldre oppgaver er ikke endret til DONE.
