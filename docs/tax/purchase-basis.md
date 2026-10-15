# TAX-001A — kjøpsgrunnlag, utenlandsk brutto/netto og norsk mva.

Forskningsdato 15.10.2026. **Forslag/dokumentasjon.** Utenlandske regler er bare lead-kilder (E2) og dekker bare Tyskland; ingen skattemessig konklusjon trekkes fra annonsetekst. Se `TAX-001A-rules.md` for evidensnivå.

## 1. Fem separate lag (må aldri slås sammen)
| Lag | Hva | Kilde til sannhet | Typisk feil å unngå |
|---|---|---|---|
| L0 Annonse | annonsepris, annonsert brutto/netto/ukjent, oppgitt sats, mva.-påstand («MwSt. ausweisbar»), selgertype, land | annonsen (ubetrodd) | å tolke påstand som netto eksportpris |
| L1 Dokumentert tilbud/faktura | konkret tilbud eller faktura med avtalt eksportkjøpspris og regime | dokument (`confirmation.kind = document`) | å bruke annonsepris som avtalt pris |
| L2 Regime | ordinær lokal mva. / marginbeskatning / privat salg / ukjent | faktura + selgers opplysning | å dele ut mva. fra margin-/privatpris |
| L3 Eksportbehandling | netto eksportfaktura / brutto betaling med senere refusjon / ukjent | tilbud + utførselsbevis | å trekke mva. ut av en pris som allerede er netto |
| L4 Norsk behandling | import-mva., engangsavgift, fradragsbehandling, økonomisk kost, betalingsforløp | regelprofil (E1) + importørprofil | å trekke fradragsberettiget mva. fra budsjettsummen (DEC-030) |

## 2. Beslutningstre for kjøpsgrunnlaget (L0 → L3)
```text
Har vi et DOKUMENTERT tilbud/faktura (L1)?
├─ nei → kjøpsgrunnlag = «ikke bekreftet». Annonsepris kan vises som annonsepris. Ingen total, ingen mva.-justering.
└─ ja → hva sier dokumentet om regime (L2)?
        ├─ ukjent / ikke oppgitt        → BLOKKERT (purchase_basis_unknown). Ingen justering.
        ├─ privat salg                  → ingen mva. å justere. Kjøpsgrunnlag = avtalt pris (brutto = netto).
        ├─ marginbeskatning             → normal mva. kan IKKE deles mekanisk ut av prisen.
        │                                   Kjøpsgrunnlag = faktisk eksportfakturert pris på dokumentet; ellers BLOKKERT.
        └─ ordinær lokal mva.           → er avtalt eksportpris NETTO (mva. 0 på faktura/utførselsbevis dokumentert)?
                ├─ ja, netto allerede     → kjøpsgrunnlag = fakturabeløpet. Mva. trekkes ALDRI ut på nytt.
                ├─ brutto betalt, refusjon senere (depositum)
                │     → kjøpsgrunnlag (økonomisk) = netto; kapitalbehov = brutto til refusjon er mottatt
                │       (refusjonstidspunkt ukjent → kapitalbehov kan ikke avsluttes)
                └─ ellers (brutto, ingen dokumentert netto) → kjøpsgrunnlag = brutto (ingen lokal justering)
```
**Konkret nettofaktura med oppgitt sats:** netto = brutto / (1 + sats) kun når *dokumentet* oppgir at brutto inkluderer sats og at eksporten er skattefri. Sats bestemmes av dokumentet, aldri av land. Avrunding må være eksplisitt (demo: halv-opp til 2 desimaler; offisiell regel ukjent).

**Aldri nok alene:** «MwSt. ausweisbar», registrert selger, eller land. En allerede oppgitt nettopris får aldri mva. trukket ut på nytt.

## 3. Hvilken utenlandsk regelmatrise kan støttes (kilder)
| Land | Regime | Lead-kilde | Status |
|---|---|---|---|
| DE | skattefri utførsel til tredjeland (§ 6 UStG) med utførselsbevis (VIN, tollbekreftet utgang); selvhenting krever utenlandsk kjøper | T16 (E2) | ikke_primærkontrollert |
| DE | differansebeskatning (§ 25a UStG); utførselsfritak består | T17 (E2) | ikke_primærkontrollert |
| DE | privat salg / ukjent regime | prosjektregel | blokkert/uten justering |
| AT, NL, BE, FR … | — | ingen kilde | **ikke støttet** |

**Bekreftede enkelttilbud fra andre land** representeres som *dokumentert tilbud* (`purchase.confirmation.kind = document`) med `regime` og `basis` fra dokumentet, uten at systemet hevder en landregel. Nødvendig lokal faglig avklaring (liste): (1) hvilken dokumentasjonspakke Merovo skal kreve fra utenlandsk selger (faktura, utførselsbevis, VIN); (2) om en norsk forhandler som kjøper med selvhenting oppfyller vilkåret om utenlandsk kjøper i Tyskland; (3) hva som er faktisk fakturert nettopris ved marginordning; (4) privatsalgsdokumentasjon; (5) refusjonsvilkår ved bruttobetaling.

## 4. Transport, forsikring og dobbelttelling
| Kostnad | Før norsk grense | Etter grensen (innenlands) |
|---|---|---|
| Transport/frakt | inngår i **tollverdien** (lovpålagt grunnlag, R-IMP-VAT-002) | utenfor tollverdien; egen kostnad med eget mva.-grunnlag |
| Forsikring | inngår i tollverdien til grensen | utenfor |
| Reise/henting, klargjøring, ombygging, godkjenning | — | brukervalgte budsjettlinjer (`includedInBudget`), eget mva.-grunnlag |
| Bil kjørt inn på egne hjul | sjablongfrakt fra Tolletaten kan brukes, med rett til å dokumentere faktisk (R-IMP-VAT-002) | — |

**Dobbelttelling unngås slik:** (1) en pakkepris merkes med hva den inkluderer (frakt/forsikring) og det inkluderte legges ikke til igjen; (2) hver transportdel har én kostnadslinje med eksplisitt `beforeBorder`/`afterBorder`; (3) samme krone vises i tollverdien *eller* som innenlands tillegg, aldri begge.

**Budsjettvalg ≠ lovens grunnlag.** `includedInBudget = false` på en faktisk frakt før grensen endrer **ikke** tollverdigrunnlaget eller mva.; den endrer bare hva som summeres i *budsjettsummen*. Derfor må kostnadslinjene få en egen klassifisering av lovgrunnlag (`legalBase: customsValue | domestic | none`) separat fra `includedInBudget`. Dette er et forslag til TaxInputV1, ikke en endring av eksisterende typer. (Test: `C3-013`.)

## 5. Kurser
| Kurs | Bruk | Kilde | Status |
|---|---|---|---|
| Tollkurs | omregning av tollverdi (og dermed mva.-/avgiftsgrunnlag) | Tolletaten (ukekurs) | dato som styrer kursen er kildekonflikt (R-IMP-FX-001) |
| Forventet betalingskurs | hva forhandleren faktisk betaler (valutahandel) | bruker/bank | brukerinput |
| Kursbuffer | konservativt tillegg for betalingsrisiko | **ingen fast prosent er vedtatt** | kun åpen forutsetning |
Kurser lagres som egne felt med kilde, dato og versjon; tollkurs og betalingskurs blandes aldri. (Test: `C3-016`.)

## 6. Tre separate resultater
1. **Budsjettsum til Norge** (på avtalt basis): kjøpsgrunnlag i NOK + beregnede norske avgifter + valgte tillegg. Trekker ikke fradragsberettiget mva. (DEC-030). Gir `not_calculated` hvis noe er ukjent.
2. **Økonomisk anskaffelseskost:** budsjettsum − dokumentert fradragsberettiget inngående mva. (R-DED-001), kun med bekreftet fradragsprofil. Ukjent fradragsrett blokkerer resultatet.
3. **Betalings-/kapitalbehov:** faktiske betalingsstrømmer (brutto betaling/depositum, import-mva. ved grensen, senere refusjon/fradrag). Uten betalingsforløp: «ikke beregnet».
Pris på norsk videresalg er ikke påkrevd i noen av dem.

## 7. Restuklarheter som må avklares FØR koding
1. Primærkilder for satser, tabeller og datoversjoner (E1) – blokkert av nettverk i denne oppgaven.
2. Om engangsavgift inngår i mva.-grunnlaget ved import, og rekkefølgen.
3. Om endringen av Stortingsvedtaket § 3 (19.6.2026, virkning 1.9.2026) finnes, og hva den endrer.
4. Hvilken dato som styrer tollkursen.
5. Elbil-mva.: hva fritaksgrensen regnes av ved innførsel, og status for fremtidig nedtrapping.
6. Varebil: dokumentasjon av klasse 1/2, ombygging og godkjenning.
7. Fradragsprofilen til den konkrete importøren og om den gjelder varebil.
8. Hvilke utenlandske land/regimer som skal støttes først.
