# ECON-002 – rettingsreview av profilavgrensning

Dato: 19.10.2026. Reviewet commit i pakken: `5967fc2ba2c82fe026b31d94f7a637bfe1690025`.

**Konklusjon: profilavgrensningen retter det gjenværende P2-funnet. Ingen nye feil funnet i denne avgrensede reviewen. ECON-002 kan avsluttes innen det avtalte omfanget etter at reviewbelegget og akseptvurderingen er registrert.** Brukerens sju regelgodkjenninger står ved lag. Dette er ikke en utvidelse av godkjent omfang eller en ny godkjenning av andre profiler.

## Verifisert

- Normalisert diesel uten hybrid velger PB-DIE. BEV og PHEV velger sine egne profiler.
- Bensin, annet drivstoff og ikke-ladbar hybrid blokkeres. Manglende/ukjent nødvendig ICE-undertype blokkeres. Ingen sluttkrav, total eller valideringsstatus returneres for disse tilfellene. Kontrollert med både godkjent og ikke-godkjent profil.
- Markedsføringsetiketter påvirker ikke profilvalget; normaliserte tekniske input avgjør.
- Klasse 1-dekning kontrolleres for valgt kjøretøyprofil. Fjerning av dekning for en profil gir ikke approved for den profilen. Klasse 1-ID-ene i motorprofilen samsvarer med references.json.
- validation.class1References er 1 per valgt profil, mens engineProfileClass1References er 3. Begge følger den dokumenterte kontrakten; senere integrasjoner må bruke riktig felt.
- Udokumentert forhandlervekt og referansevekt gir fortsatt estimat, inkludert komponentmerking. Datofølsomme månedsbeløp gir fortsatt estimat. Dokumenterte og entydige input innen støttet profil kan gi approved.
- Tidligere blokkerte NEDC/desimal-CO₂, uavklarte datooverløp og 20-årstilfeller er fortsatt blokkert.
- Totalene er fortsatt PHEV 529 069, BEV 16 748 og diesel 333 723 NOK.

## PHEV-spørsmålet

Den eksisterende profilmodellen har én PB-PHEV, ikke separate bensin- og diesel-PHEV-profiler. Godkjent R-OTA-005 er formulert ut fra stempeldrevet motor og ekstern lading. At én klasse 1-referanse dekker denne profilen betyr ikke at hver variant eller alle mulige input er individuelt testet. Det er ikke et nytt krav i denne reviewen å splitte PB-PHEV etter drivstoff. Referansens faktiske omfang og inputantakelser skal fortsatt fremgå, og fremtidige varianter med egne regler må vurderes særskilt.

## Kontroller faktisk utført

- Alle 19 manifestoppføringer kontrollert mot SHA-256 og størrelse uten avvik.
- Ny profilvelger, profilens dekningskart, statuslogikk, nye typer, testfil og relevante endringer gjennomlest.
- 440 selvstendige kontroller mot motoren bestod. Inkluderer tekniske ICE-kombinasjoner med diesel/bensin/annet/ukjent og hybrid/ikke-hybrid/ukjent, begge profilgodkjenningstilstander, nullbeløp ved blokkering, dekningskontroll, tidligere reviewfunn, vektpolicy, datofølsomhet, referansetotaler og aritmetiske grenser.
- TypeScript-typer fjernet med Node sin innebygde funksjon i midlertidige kjørekopier med lokale importendelser. Originalfiler er ikke endret.

Hele Vitest-suiten, typecheck, lint, build, e2e og DB er ikke kjørt på nytt her. Opplysningen om 781 Vitest-tester er utviklerens resultat. Dette er en avgrenset rettingsreview som bygger på de tidligere reviewene, ikke en ny full juridisk eller applikasjonsreview.

## Avslutning

Registrer at alle tre tidligere P2-funn er lukket (de to første i tidligere rettingsreview, profilavgrensningen her). Avslutt ECON-002 med tydelig støttet omfang: PB-DIE, PB-BEV og PB-PHEV innen den eksisterende 2026-profilen og inputkravene. Hele TAX-fundamentet kan fortsatt stå på REVIEW. U-003/U-008 hører til ECON-004; andre avtalte restpunkter og blokkeringer består. Ingen automatisk oppstart av ECON-003/004.
