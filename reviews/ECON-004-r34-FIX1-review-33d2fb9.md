# ECON-004 r34 FIX1 – rettingsreview

Commit: `33d2fb954b096e00b25be7920c5ee59e877085ad`.

Konklusjon: De to opprinnelige reproduksjonene er rettet. Ett P2-funn i kombinasjonen avrundingslikhet og provisjonsfradrag må fortsatt rettes. ECON-004 beholdes på REVIEW; ingen flagg godkjennes.

## P2: Nedre grense blir for høy når avrundede provisjoner trekkes fra

Fil: `src/domain/economics/landed-cost.ts`, `whole()` i provisjonsløkken og subtraksjonen av `commissionDeducted`/`commissionDeductPossible` fra kjøpesummen.

Ved uavklart avrunding velger `round()` laveste kandidat for provisjonsbeløpet. Dette fungerer som en konservativ tilnærming for tillegg, men ikke for fradrag: mindre fradrag gir større tollverdi og mva. Flere slike beløp kan gjøre den oppgitte nedre grensen høyere enn en faktisk mulig fullføring.

Reprodusert med NOK-kjøpesum 100 001, transport 8 000, dokumentert dieselinput og ellers avklarte felt. Tre separate innkjøpsprovisjoner på 2,5 NOK hver er inkludert i prisen, med `deductionConditionsMet: true` og `paidSeparatelyFromPrice: false`.

| Policy i prøvekjøringen | Samlet provisjonsfradrag | Tollverdi | Mva. | Brutto total |
|---|---:|---:|---:|---:|
| Ubekreftet policy, dagens kode | 6 | 107 995 | **26 999 som nedre grense** | **468 723 som nedre grense** |
| Uttrykkelig half-up | 9 | 107 992 | 26 998 | 468 722 |
| Uttrykkelig half-even | 6 | 107 995 | 26 999 | 468 723 |

Den oppgitte nedre grensen overstiger altså den mulige half-up-fullføringen med 1 kr. Det samme rammer økonomisk kost ved non_recoverable. Syntetisk godkjente flagg brukes bare til sammenligning; registerets flagg er fortsatt false. Ingen juridisk avrundingspolicy foreslås godkjent.

Rett usikkerhetspropageringen ved subtraksjon. Beregn en trygg nedre grense over mulige policyfullføringer, eller bruk korrekte intervallgrenser der øvre mulig fradrag gir nedre mulig tollverdi. Ikke innfør en ny rettslig avrundingsregel. Test flere samtidige provisjoner, både bekreftet og uavklart fradragsadgang, samt mva. og begge totalfeltene. Invarianten skal være at nedre grense ikke overstiger noen støttet fullføring.

## Verifikasjon

- Alle 46 manifestoppføringer er kontrollert mot filenes SHA-256.
- Egne direkte kjøringer bekrefter korrekte resultatfelt for provisjon 3,1 og toll 2,4; uavklart provisjon på 3 000 gir incomplete og mva.-grense 26 250; bekreftet fradrag gir estimat, tollverdi 105 000 og uendret anskaffelseskostnad.
- Ny feil er reprodusert mot begge støttede policyer. Maskinlesbare resultater: `output/ECON-004-r34-FIX1-probes.json`; kjørbar reproduksjon: `tmp/econ002/review-r34-fix1.mjs`.
- Koden er kjørt med Node etter fjerning av TypeScript-typer. Jeg har ikke kjørt Vitest, typecheck, lint, check-docs, build, e2e eller DB. De 939 testene er utviklerens oppgitte resultat.
- Avgrenset rettingsreview, ikke en full juridisk eller applikasjonsreview. Ingen produksjonsfiler er endret.
