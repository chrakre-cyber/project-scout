# Kildebestilling ECON-004 (U-003, U-008, U-013, R-IMP-VAT-002/-003, R-DED-001) — 19.10.2026

**Status: åpen bestilling. Ingenting her er besvart eller godkjent.** ECON-004 står på REVIEW; alle fire økonomiflagg i `EconomicsProfile` (`vatRulesApproved`, `roundingApproved`, `customsFxRuleApproved`, `deductionRuleApproved`) forblir `false`. Tekniske testresultater er ikke et grunnlag for å sette dem. Nettverk til toll.no, lovdata.no, skatteetaten.no og stortinget.no er blokkert i utviklingsmiljøet (HTTP 000, testet på nytt 19.10.2026); ingen URL under er åpnet i dag.

**Lesemåte.** *A = lest tidligere og lagret/registrert (sidetittel og URL er kjent fra en faktisk lesning).* *E1X = bruker har eksternt verifisert at siden finnes og stemmer (T33–T36), men Claude har ikke lest den.* *B = registrert URL som aldri er hentet (E2-ledetråd; tittel fra registeret, ikke bekreftet mot siden).* *C = bare søkespor (tittel/URL ikke verifisert, ikke registrert i `sources.json`).* Kilde-ID-er (Txx) viser til `docs/tax/sources.json`; ingen ny ID er opprettet. Dokumenter som allerede er A er ikke bestilt på nytt.

## Sammenstilling
| Punkt | Hovedmangel | Beslutning fra Christian trengs |
|---|---|---|
| U-003 | At 2025-utgaven av MVA-håndboken også gjelder 2026, og at 2023- og 2025-utgavene sier det samme om videresalg | Hvilken utgave som regnes som autoritativ |
| U-008 | Hvilken dato og hvilken kurssyklus som styrer tollkursen; hvor kursen hentes | Dato-regel og kildevalg (forhandler oppgir vs. oss) |
| U-013 | Om noen lest regel avrunder import-mva./tollverdi/omregning, og hvordan | Avrundingsmetode (kun hvis kilde mangler) |
| R-IMP-VAT-002 | Sjablongfrakt, forsikring, toll og tillegg i mva.-grunnlaget for forhandlerdeklarasjon | Standard transport og forsikring |
| R-IMP-VAT-003 | Om elbilfritaket gjelder ved innførsel/forhandler og hvilket beløp 300 000 måles mot | Scenario vs. regel |
| R-DED-001 | Fradrag for innførselsmva. spesielt (ikke bare kjøp), vilkår for forhandlerprofil | Hvem kan oppgi fradragsstatus, og med hvilket belegg |

## U-003 — MVA-kildenes årgang og anvendelse
**Spørsmål.** Gjelder 2025-utgaven av Merverdiavgiftshåndboken (siden «gjeldende» er merket 2025) for beregningsdatoer i 2026, og avviker 2023-utgaven (T36) fra 2025 på videresalgsunntaket?
**Eksisterende belegg.** T22 (A, E1): § 8-4.3, 2025-utgave, videresalgsunntaket lest. T36 (E1X, verifisert eksternt av bruker, ikke lest av Claude): 2023-utgave av samme § 8-4.3. `rules.json` U-003: «versjon avklart: 2025-utgave; dekning for 2026 ikke kontrollert».
**Mangler.** (1) En kilde som viser at håndboken er gjeldende for 2026 (utgavetekst, endringsoversikt eller 2026-utgave). (2) Ordrett sammenligning 2023 vs 2025 av videresalgsavsnittet (T36 er ikke lest av oss). (3) Om endringer i mva.-loven vedtatt 2026 (Lov 19.6.2026 er nevnt i T49-siden; tittel/URL ikke verifisert) berører innførsel/fradrag.
**Dokumenter.**
| Spor | Dokument | URL | Status |
|---|---|---|---|
| A | MVA-håndboken 8-4.3 (T22) | https://www.skatteetaten.no/en/rettskilder/type/handboker/merverdiavgiftshandboken/gjeldende/M-8/M-8-4/M-8-4.3/ | lest (lokal kildepakke) |
| E1X | MVA-håndboken 8-4.3, utgave 2023 (T36) | https://www.skatteetaten.no/rettskilder/type/handboker/merverdiavgiftshandboken/2023/M-8/M-8-4/M-8-4.3/ | verifisert eksternt av bruker, ikke lest |
| B | Håndbokens «gjeldende»-rot/endringsoversikt (T12-rot) | https://www.skatteetaten.no/en/rettskilder/type/handboker/merverdiavgiftshandboken/gjeldende/ | aldri hentet |
| C | Lov 19. juni 2026 nr. 41 (nevnt i T49) og eventuell 2026-utgave av MVA-håndboken | ikke identifisert | søkespor |

## U-008 — Tollkurs, kursdato og syklus
**Spørsmål.** Hvilken kurs gjelder for omregning av tollverdi (Tolletatens kurs), hvilken dato velger kursen (deklarasjon akseptert, frigivelse, innførsel), hva er syklusen («annenhver tirsdag, gyldig i to uker» mot eldre «ukentlig»), og hvilken kursformat/kilde finnes?
**Eksisterende belegg.** T23 og T24 er B (E2, kildekonflikt i søkesammendrag; primærtekst ikke lest). R-IMP-FX-001 E2 «kildekonflikt». Registeret refererer til endringsforskrift 21.8.2026 til vareførselsforskriften § 6-12-1 (deklarasjon 16–30 dager før innførsel), tittel/URL ikke verifisert. Betalingskurs er en egen kostnad og er ikke bestilt her.
**Mangler.** Primærtekst som sier (1) hvilket tidspunkt som styrer kursen, (2) kurssyklus og gyldighetsperiode, (3) hvordan kursen publiseres (URL/format/historikk), (4) hvordan endringen fra august 2026 virker på tidspunktet.
**Dokumenter.**
| Spor | Dokument | URL | Status |
|---|---|---|---|
| B | Valutakurser (Tolletaten, T23) | https://www.toll.no/no/verktoy/valutakurser | aldri hentet |
| B | Vareførselshandboken § 6-12 Omregningskurs (T24) | https://www.toll.no/no/verktoy/regelverk/handboker/vareforselshandboken/6-12 | aldri hentet |
| B | Betaling av avgifter ved bilimport (T10) | https://www.toll.no/no/varer/bil-og-andre-kjoretoy/bilimport/betaling-av-avgifter | aldri hentet |
| C | Vareførselsforskriften § 6-12-1 og endringsforskrift august 2026 (Lovdata) | ikke identifisert | søkespor |
| C | Tollavgiftsloven § 2-2 / vareførselsloven § 3-4 (nevnt som ledetråd i registeret) | ikke identifisert | søkespor |
**Valgfritt for Christian:** et kurshistorikk-uttrekk fra Tolletaten for noen datoer kan erstatte kildelesing for *verdier*, men ikke avgjøre *regelen* for dato/syklus.

## U-013 — Avrunding av MVA, tollverdi og valutaomregning
**Spørsmål.** Finnes det en lest eller lesbar regel som sier hvordan beregnet import-mva. avrundes (hel krone? opp/ned/nærmest?) og om kjøpesum/tollverdi omregnes og avrundes hver for seg eller samlet?
**Eksisterende belegg.** A (E1, lest): skattebetalingsforskriften § 10-4-4 «avrundes ned til nærmeste hele krone» (T46), loven (T49), håndboken (T45), forarbeid (T50–T52). Konklusjon i ECON-002: nevner ikke import-mva. eksplisitt; R-OTA-014 gjelder *engangsavgiftens* sluttkrav, ikke mva. Valideringstall 16 665,75 → 16 666 og 102 872,75 → 102 873 er ikke nedrundet, men er oppgitt av Christian uten skjermbilder og er et signal, ikke en kilde. Kjernen bruker «nærmeste krone, halvt opp» som ubekreftet fixturekonvensjon.
**Mangler.** Tekst som uttrykkelig dekker avrunding av *innførselsmva.* (Tolletatens deklarasjon / skattemeldingen for mva. / mva.-loven) og av tollverdi i NOK. Videre en tie-regel (x,5), som ingen lest kilde dekker.
**Dokumenter.** Allerede A og ikke bestilt på nytt: T46, T49, T45, T50–T52.
| Spor | Dokument | URL | Status |
|---|---|---|---|
| B | Beregning og rapportering av innførselsmva. (T11) | https://www.skatteetaten.no/globalassets/bedrift-og-organisasjon/avgifter/merverdiavgift/import-mva/beregning-og-bokforing-innforselsmva.pdf | aldri hentet |
| B | Beregning av tollavgift og andre avgifter (T10) | https://www.toll.no/no/varer/bil-og-andre-kjoretoy/bilimport/betaling-av-avgifter | aldri hentet |
| B | Skatteetaten: mva. ved import (S08, registrert i SOURCES.md) | https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/utland/import/ | aldri hentet |
| B | Skatteetatens importkalkulator (S07), som referansepunkt for faktiske avrundede tall | https://www.skatteetaten.no/person/avgifter/bil/importere/regn-ut/ | aldri hentet |
| C | Bestemmelse om avrunding i merverdiavgiftsloven/-forskriften og Tolletatens deklarasjonsveiledning | ikke identifisert | søkespor |
**Hva som kan lukke den uten kilde:** en uttrykkelig produktbeslutning om avrundingsmetode (merket som beslutning, ikke som rett). Da må likhet (x,5) fortsatt behandles eksplisitt.

## R-IMP-VAT-002 — Tollverdi/MVA-grunnlag, transport og forsikring
**Spørsmål.** Er grunnlaget = kjøpspris + frakt + forsikring til norsk grense (+ toll), hva er sjablongfrakt for bil kjørt inn på egne hjul (beløp, land), hvordan dokumenteres faktisk frakt, og inngår transaksjonsgebyr, toll og engangsavgift i mva.-grunnlaget for en forhandlerdeklarasjon?
**Eksisterende belegg.** T34 (E1X, verifisert eksternt, ikke lest): Incoterms/tollverdi. T21 (A, E1): gir ikke sats, tollkurs, fraktsjablong eller regel for næringsdrivende. T08/T10/T11 (B, E2): sammendrag om kjøpspris + frakt + forsikring og sjablongfrakt. Registerets åpne punkter: toll for bil ikke gitt, forhandlerbehandling ikke gitt, «engangsavgift inngår ikke» for mva.-grunnlaget er slutning, ikke bekreftet. Standard transport 8 000 er en produktstandard (ECON-001), ikke en kildeverdi.
**Mangler.** Primærtekst om grunnlagets sammensetning ved innførsel; sjablongfrakt (satser, land, dato); om toll kommer til; forsikringsbehandling når ikke oppgitt.
**Dokumenter.**
| Spor | Dokument | URL | Status |
|---|---|---|---|
| E1X | Tolletaten — Incoterms / tollverdi (T34) | https://www.toll.no/no/bedrift/import/deklarering-av-varer/incoterms-2010 | verifisert eksternt av bruker, ikke lest |
| A | Import av bil og andre kjøretøy (T21/T33) | https://www.toll.no/no/varer/bil-og-andre-kjoretoy/bilimport | lest; dekker ikke spørsmålet |
| B | Andre avgifter ved import (T08) | https://www.skatteetaten.no/person/avgifter/bil/importere/andre-avgifter/ | aldri hentet |
| B | Betaling av avgifter / fraktsjablong (T10) | https://www.toll.no/no/varer/bil-og-andre-kjoretoy/bilimport/betaling-av-avgifter | aldri hentet |
| B | Tollverdi — sjablongsatser for frakt (tilleggs-URL i T10) | https://www.toll.no/no/verktoy/regelverk/tollverdi/fastsettelse-av-tollverdi-sjablongsatser | aldri hentet |
| B | Beregning (tilleggs-URL i T10) | https://www.toll.no/no/bedrift/import/beregning | aldri hentet |
| B | Beregning og rapportering av innførselsmva. (T11) | se U-013 | aldri hentet |
| C | Merverdiavgiftsloven kap. 7 (innførsel) og tolloven/tollforskriften om tollverdi | ikke identifisert | søkespor |

## R-IMP-VAT-003 — Elbilfritak (300 000 kr) ved innførsel
**Spørsmål.** Gjelder fritaket ved innførsel, også for forhandler som importerer til videresalg? Hva er «kvalifiserende» elbil? Hvilket beløp måles 300 000 mot (tollverdi, vederlag, eller annet)? Hvilken dato (registrering, innførsel, levering) og hva skjer etter nedtrapping 2027/2028?
**Eksisterende belegg.** T35 (E1X, verifisert eksternt, ikke lest): MVA-håndboken om elbil/avgiftsfritak. T14 (B): Lovvedtak 14 (2025–2026) og Innst. 4 L; søkeverktøyet: 300 000 fra 1.1.2026, nedtrapping forutsatt ESA. Kalkulatorobservasjoner: 350 000 → 12 500, 300 000 → 0 (tester, ikke kilde). Registeret: lov 19.6.2026 ikrafttredelse ukjent.
**Mangler.** Lest lovtekst/forskrift for anvendelse ved innførsel og grunnlag for målingen; ikrafttredelse og overgangsregler.
**Dokumenter.**
| Spor | Dokument | URL | Status |
|---|---|---|---|
| E1X | MVA-håndboken, elbil (T35) | https://oppslag.rettskilder.skatteetaten.no/rettskilder2/type/handboker/merverdiavgiftshandboken/gjeldende/MVA2025_M-6 | verifisert eksternt av bruker, ikke lest |
| B | Lovvedtak 14 (2025–2026) (T14) | https://stortinget.no/no/saker-og-publikasjoner/vedtak/beslutninger/lovvedtak/2025-2026/vedtak-202526-014/ | aldri hentet |
| C | Merverdiavgiftsloven § 4-7 (nevnt i T14s uttrekkspunkter) og Innst. 4 L, samt lov 19.6.2026 | ikke identifisert | søkespor |
Kjernen behandler fritaket som scenario (`applies`/`not_applicable`/`unknown`); det forblir slik til anvendelsen er avklart.

## R-DED-001 — Fradragsrett og oppgitt fradragsstatus
**Spørsmål.** Gir mval. § 8-4 første ledd bokstav a (personkjøretøy som er salgsvare) fradrag også for *innførselsmva.*? Hvilke vilkår gjelder for importørens profil (registrering, lager, dokumentasjon)? Hva kreves for å godta en forhandleroppgitt fradragsstatus?
**Eksisterende belegg.** T22 (A, E1): videresalgsunntaket for personkjøretøy lest (2025). T36 (E1X, ikke lest): 2023-utgave. T28 (B): tilbakeføring § 9-6 (utleie/persontransport, åtteårsregel) — utenfor første motor (R-DED-002). Registerets åpne punkter: innførselsmva. spesielt, varebil, bindingstid/tilbakeføring og importørprofil ikke gitt.
**Mangler.** Tekst som uttrykkelig dekker innførselsmva. på personbil til videresalg, og hva som dokumenterer at bilen er salgsvare. Hvem som kan oppgi status er en produktbeslutning (kjernen godtar nå bare `dealer_entered`/`dealer_profile`).
**Dokumenter.**
| Spor | Dokument | URL | Status |
|---|---|---|---|
| A | MVA-håndboken 8-4.3 (T22) | https://www.skatteetaten.no/en/rettskilder/type/handboker/merverdiavgiftshandboken/gjeldende/M-8/M-8-4/M-8-4.3/ | lest |
| E1X | MVA-håndboken 8-4.3, 2023 (T36) | se U-003 | verifisert eksternt av bruker, ikke lest |
| B | Tilbakeføring 9-6.2 (T28) | https://www.skatteetaten.no/en/rettskilder/type/handboker/merverdiavgiftshandboken/gjeldende/M-9/M-9-6/M-9-6.2/ | aldri hentet |
| B | Beregning og rapportering av innførselsmva. (T11) | se U-013 | aldri hentet |
| B | Mva.-håndboken kap. 8 (S05 i SOURCES.md) | https://oppslag.rettskilder.skatteetaten.no/rettskilder2/type/handboker/merverdiavgiftshandboken/gjeldende/MVA2025_M-8/MVA2025_M-8-3 | aldri hentet |
| C | Merverdiavgiftsloven § 8-4 og § 8-1, innførselsbestemmelser i kap. 7 og 8 | ikke identifisert | søkespor |

## Hva som ikke bestilles (allerede lest eller utenfor omfang)
Engangsavgiftens kilder (T03, T05, T40–T52), bruksfradrag, vrakpant, avrunding av engangsavgift (R-OTA-014 er E1), betalingskurs/valutahandelskost, salgs-mva. ved videresalg (R-DED-003), tilbakeføring (R-DED-002).

## Slik svarer du
Send filene (PDF/HTML-utskrift med URL og hentedato) eller kopier teksten med paragraf/avsnitt. Merk hvilket punkt de gjelder. Jeg registrerer SHA-256, leser, og foreslår kildenivå uten å sette noe flagg; godkjenning av hver regel/parameter krever din uttrykkelige beslutning.
