# TAX-001A/B — kjøpsgrunnlag, utenlandsk brutto/netto og norsk mva.

Forskningsdato 15.10.2026, oppdatert i TAX-001B. **Forslag/dokumentasjon.** Utenlandske regler er bare lead-kilder (E2) og dekker bare Tyskland; ingen skattemessig konklusjon trekkes fra annonsetekst. Se `TAX-001A-rules.md` for evidensnivå.

## 1. Fem separate lag (må aldri slås sammen)
| Lag | Hva | Kilde til sannhet | Typisk feil å unngå |
|---|---|---|---|
| L0 Annonse | annonsepris, annonsert brutto/netto/ukjent, oppgitt sats, mva.-påstand («MwSt. ausweisbar»), selgertype, land | annonsen (ubetrodd) | å tolke påstand som netto eksportpris |
| L1 Dokumentert tilbud/faktura | konkret tilbud eller faktura med avtalt eksportkjøpspris og regime | dokument (`confirmation.kind = document`) | å bruke annonsepris som avtalt pris |
| L2 Regime | ordinær lokal mva. / marginbeskatning / privat salg / ukjent | faktura + selgers opplysning | å dele ut mva. fra margin-/privatpris |
| L3 Eksportbehandling | netto eksportfaktura / brutto betaling med senere refusjon / ukjent | tilbud + utførselsbevis | å trekke mva. ut av en pris som allerede er netto |
| L4 Norsk behandling | import-mva., engangsavgift, fradragsbehandling, økonomisk kost, betalingsforløp | regelprofil (E1) + importørprofil | å trekke fradragsberettiget mva. fra budsjettsummen (DEC-030), og å utlede økonomisk kost som «budsjettsum minus noe» (se §6) |

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
                │     → kjøpsgrunnlag = BETALT brutto, med mindre dokumentert netto faktura/kjøpsbekreftelse foreligger.
                │       Refusjonen er en sak mellom kjøper og selger (Tolletaten, T21) og er ikke sikker netto.
                │       · avtalt depositum / tilbakebetalingskrav (status agreed) → bekreftet inndekning i betalingsforløpet
                │       · betinget/forventet refusjon (status conditional)        → kun scenario, aldri bekreftet budsjettfordel
                │       Tollverdi, budsjettsum, økonomisk kost og kapitalbinding begrunnes hver for seg (§6).
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

## 6. Tre separate summeringer fra ett komponentgrunnlag (TAX-001B)

**Retting av TAX-001A:** økonomisk anskaffelseskost er *ikke* «budsjettsum minus fradragsberettiget mva.», og den skal ikke legges til en «ikke-fradragsberettiget del». Budsjettet består av brukerens valgte linjer; reell økonomisk kost kan omfatte andre kostnader; og en ikke-fradragsberettiget avgift ligger allerede i brutto beløp. Alle tre summeringer regnes derfor hver for seg fra samme **komponentliste**, og ingen avledes fra en annen.

### 6.1 Komponent (forslag til datakontrakt, ikke implementert)
| Felt | Betydning |
|---|---|
| `id`, `label` | identitet og visningstekst |
| `amountNok` | brutto beløp i NOK slik det betales/skyldes (inkl. mva. som ligger i beløpet); `null` = ukjent |
| `currency` / kurs | opprinnelig valuta og kurs som egne felt (tollkurs ≠ betalingskurs); `amountNok` er resultatet |
| `legalBasis` | `customsValue` · `importVat` · `engangsavgift` · `domestic` · `none` – lovgrunnlag; uavhengig av budsjettvalg |
| `vatIncludedNok` | mva.-delen som ligger i `amountNok` (0 hvis ingen); `null` = ukjent |
| `deductibleSharePercent` | fradragsandel 0–100 for mva.-delen; `null` = ukjent (blokkerer økonomisk kost, aldri 0) |
| `includedInBudget` | brukerens valg: inngår i budsjettsummen |
| `includedInEconomicCost` | reell kostnad for forhandleren: inngår i økonomisk kost |
| `paymentTiming` | `purchase` · `border` · `registration` · `later` · `none` (ingen betaling, f.eks. buffer) |
| `refund` | valgfritt: `{amountNok, status: agreed | conditional}` – tilbakebetalingskrav |

### 6.2 Tre summeringer
1. **Budsjettsum** = Σ `amountNok` for komponenter med `includedInBudget`. Brutto, inkludert all mva. som er betalt. Trekker ikke fradragsberettiget mva. (DEC-030). Ukjent beløp → `not_calculated`.
2. **Økonomisk anskaffelseskost** = Σ (`amountNok` − `fradragsberettiget mva.`) for komponenter med `includedInEconomicCost`, der `fradragsberettiget mva.` = `vatIncludedNok × deductibleSharePercent / 100` (ROUND_HALF_UP til øre i demo). Ikke-fradragsberettiget mva. blir stående i `amountNok` og telles **nøyaktig én gang**. Ukjent fradragsandel på en komponent med mva. → `not_calculated` (ikke 0). Avhenger ikke av `includedInBudget`.
3. **Betalings-/kapitalbehov** = Σ `amountNok` for komponenter med betaling (`paymentTiming ≠ none`), brutto, uavhengig av begge flaggene. Fradrag og refusjon vises **separat**: *bekreftet inndekning* = Σ `refund` med `agreed`; *scenario* = Σ `refund` med `conditional` + beregnet fradragsberettiget mva. (inntil importørprofil er bekreftet). Netto kontantbehov etter bekreftet inndekning = kapitalbehov − bekreftet inndekning.

Salgspris på norsk videresalg er ikke påkrevd i noen av dem. Refusjon og fradrag endrer verken tollverdi, budsjettsum eller økonomisk kost uten dokumentert netto kjøpsgrunnlag.

### 6.3 Referanser (klasse 3, syntetiske, regnet på nytt av `check-docs.mjs`)
Grunnlag: K1 bil 1 000 000 (ingen mva.), K2 import-mva. 250 000 (hele beløpet er mva.), K3 engangsavgift 100 000, K4 transport etter grensen 20 000 brutto inkl. 4 000 mva. Dette er aritmetiske kontrakttester, **ikke** bekreftelse av importørens fradragsrett.
| Tilfelle | Poeng | Budsjett | Økonomisk kost | Kapitalbehov | Bekreftet / scenario inndekning |
|---|---|---|---|---|---|
| C3-031 (a) | K4 ikke i budsjett, men reell kostnad; full fradragsrett | 1 350 000 | 1 116 000 | 1 370 000 | 0 / 254 000 |
| C3-032 (b) | ingen fradragsrett; mva. telles én gang | 1 350 000 | 1 370 000 | 1 370 000 | 0 / 0 |
| C3-033 (c) | full fradragsrett, alt i budsjett | 1 370 000 | 1 116 000 | 1 370 000 | 0 / 254 000 |
| C3-034 (d) | 60 % delvis fradrag | 1 370 000 | 1 217 600 | 1 370 000 | 0 / 152 400 |
| C3-035 | buffer 30 000 i budsjett, ikke kostnad | 1 400 000 | 1 116 000 | 1 370 000 | 0 / 254 000 |
| C3-036 | fradragsandel ukjent | 1 370 000 | not_calculated | 1 370 000 | 0 / not_calculated |
| C3-037 | avtalt tilbakebetalingskrav 100 000 | 1 100 000 | 1 100 000 | 1 100 000 | 100 000 / 0 (netto kontant 1 000 000) |
| C3-038 | betinget refusjon 100 000 | 1 100 000 | 1 100 000 | 1 100 000 | 0 / 100 000 |

Den gamle formelen i C3-032 ville gitt 1 350 000 + 254 000 = 1 604 000 (mva. i K2 telt to ganger) – derfor sperrer `check-docs.mjs` formuleringene som gjenskaper den.

## 7. Restuklarheter som må avklares FØR koding
1. Satstabeller (stortingsvedtaket, T04), forskrift §§ 3-1/3-3 (T05) og tollkurs/sjablongfrakt (T10) er ikke lest. Rundskrivet, bruksfradragstabellen, vrakpantavgift, Tolletatens oversiktsside og håndbok 8-4.3 er lest (E1, se `TAX-001A-rules.md`).
2. Om engangsavgift inngår i mva.-grunnlaget ved import, og rekkefølgen (Tolletatens side gir bare betalingsrekkefølge). Hendelsesdatoer per komponent: se `event-dates.md`.
3. Uavklart kildeopplysning U-001: om en endring av Stortingsvedtaket § 3 med virkning 1.9.2026 finnes (T04 ikke lest); ingen regel bygger på den.
4. Hvilken dato som styrer tollkursen.
5. Elbil-mva.: hva fritaksgrensen regnes av ved innførsel, og status for fremtidig nedtrapping.
6. Varebil: dokumentasjon av klasse 1/2, ombygging og godkjenning.
7. Fradragsprofilen til den konkrete importøren og om den gjelder varebil.
8. Hvilke utenlandske land/regimer som skal støttes først.
