# ECON-004 runde 34 – uavhengig review

Reviewet commit: `afdc9f0e260d0a4cde29723ec8130403e2a04fbf`.

Konklusjon: To P2-funn må rettes før leveransen kan aksepteres. ECON-004 beholdes på REVIEW. Ingen parametergodkjenning anbefales i denne reviewen.

## P2-1: Rasjonale tellere eksporteres som NOK-beløp

Fil: `src/domain/economics/landed-cost.ts`, konstruksjonen av `customsValueNok` og resultatfeltene `commissionInCustomsValueNok`, `customsDuty.nok`, `importVatBaseNok`.

De nye postene beholdes som rasjonale tall, men resultatet bruker `.n` uten nevneren `.d`. Beløpsparseren godtar desimaler; kommentaren «Hele NOK» på provisjon håndheves ikke.

Reproduksjon med kjøpesum 100 000 NOK, transport 8 000 og ellers entydig dieselinput:

- Salgsprovisjon 3,1 NOK betalt separat gir `customsValueNok = 1080031`, `commissionInCustomsValueNok = 31` og `importVatBaseNok = 1080031`. Den eksakte tollverdien er 108 003,1 NOK.
- Eksplisitt toll 2,4 NOK gir `customsDuty.nok = 12` og `importVatBaseNok = 540012`. De eksakte beløpene er 2,4 og 108 002,4 NOK.

Begge kan gi `validated` med syntetisk godkjente flagg. Mva.-regningen bruker fortsatt rasjonale verdier, slik at viste grunnlag og beregnet mva. dessuten motsier hverandre.

Retting: Definer og håndhev representasjonen på alle berørte beløpsfelt. Bruk eksisterende uttrykkelige avrundingspolicy med likhetshåndtering, returner en eksakt representasjon, eller avvis desimaler der kontrakten faktisk bare tillater hele NOK. Ikke bruk telleren som et beløp. Dekk også desimaler i `importLevies` og klimagassavgift som inngår i grunnlaget. Ingen ny juridisk avrundingsregel skal utledes av rettingen.

## P2-2: Provisjon inkludert i prisen kan gi falskt avklart grunnlag

Fil: `src/domain/economics/landed-cost.ts`, grenen `paidSeparatelyFromPrice === false`.

Ved innkjøpsprovisjon eller ukjent provisjonsrolle gir grenen bare en advarsel og fortsetter med hele kjøpesummen som tollverdi. Uavklart grunnlag påvirker verken `customsComplete`, `importVat.status` eller totalens eksakthet.

Samme basisinput med 3 000 NOK innkjøpsprovisjon allerede inkludert i prisen gir tollverdi 108 000, mva. 27 000 og `validated` med syntetisk godkjent profil. Koden sier selv at fradraget etter § 6-11 (1) e ikke er modellert. Dersom den dokumenterte innkjøpsprovisjonen skilles ut, er grunnlaget 105 000 og mva. 26 250. Ukjent rolle får også `validated`, selv om de mulige rollene gir ulike grunnlag.

Retting: Skill ut dokumentert innkjøpsprovisjon når vilkårene er oppfylt, eller håndter tilfellet uttrykkelig som uavklart. Ved ukjent rolle må mulige tollverdier/scenarioer håndteres. Det eksisterende, høyere mva.-beløpet kan ikke bare ommerkes som nedre grense; en slik grense kan overstige en mulig korrekt fullføring. Behold anskaffelseskostnaden og unngå dobbelttelling.

## Utførte kontroller og begrensninger

- Alle 43 oppføringer i `MANIFEST.sha256` er kontrollert mot pakkens filer.
- Domenekoden er kjørt direkte med Node etter fjerning av TypeScript-typer. Basistilfellet og begge funnene er reprodusert; ingen produksjonsfil er endret.
- Reproduksjon: `tmp/econ002/review-r34.mjs`. Resultater: `output/ECON-004-r34-independent-probes.json`.
- Syntetisk godkjente flagg brukes bare til å prøve valideringsporten. Registerets fire flagg er fortsatt false.
- Jeg har ikke kjørt Vitest, typecheck, lint, check-docs, build, e2e eller DB. De oppgitte 924 testene er utviklerens resultat.
- Dette er en avgrenset implementeringsreview, ikke en ny juridisk godkjenning av kildene eller de fire produktbeslutningene.
