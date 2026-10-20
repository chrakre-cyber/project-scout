# ECON-005a – rettingsreview av 651f309

Commit: `651f309012f05f0b6c141081ec024bd4a39b0d34`.

**Konklusjon:** P2-1 (eksklusiv mva.) er lukket. P2-2 er rettet for 99-øre-eksemplet, men ikke fullt lukket: kandidatsettet ved halvkroner inneholder fortsatt beløp som ingen av de støttede policyene gir. ECON-005a beholdes på REVIEW; ingen oppstart av 005b på dette reviewbelegget.

## Gjenværende P2: Halvkroner med oddetall før komma godtar en umulig lav kandidat

Fil: `src/domain/search-economics/cost-lines.ts`, `roundingCandidates()`, grenen `r === 50n`.

Funksjonen returnerer alltid `[q, q + 1]` ved 50 øre. Men ved for eksempel 1,50 NOK gir både half-up og half-even **2 NOK**, aldri 1 NOK. Kandidatsettet skal da bare inneholde 2. Ved 0,50 og 2,50 gir de to policyene forskjellige kandidater.

Reprodusert med ekte økonomikjerne: transport på 1 NOK gir en validert syntetisk kontrollberegning. En søkekostnad på 150 øre med bekreftet to_border-omfang blir likevel `mapped_to_input` mot komponenten på 1 NOK, og mapperen gir `complete_validated`. Samme feil er reprodusert for forsikring. Kjernen har ikke med den komponentverdien en beregning av 1,50 NOK ville ha gitt. Dagens falske registerflagg beskytter positive utfall i ordinær bruk, men gjør ikke dekningsmappingen korrekt.

**Retting:** Bruk det faktiske kandidatsettet for half-up og half-even. Ved likhet og oddetalls-q er eneste kandidat q+1; ved partalls-q er kandidatene q og q+1. Gjenbruk gjerne den rene avrundingsfunksjonen med de to støttede modusene hvis det passer modulgrensen. Ikke legg til flere policyer eller endre kjernen.

Test både korrekte og feil komponenter ved 0,50 / 1,50 / 2,50 / 3,50 / 8 001,50 NOK. Dekk transport, forsikring og split. De to nye reviewer-testene ligger i `economics-005a-tie-review-regressions.test.ts` og feiler på denne commiten.

## Verifikasjon

- Alle **68 manifestoppføringer** stemmer med SHA-256.
- **125 leverte tester består**: mapping (24), opprinnelige reviewer-regresjoner (2), utvidet dekningssett (55), economics-core (44).
- **To nye reviewer-tester kjørt, begge feiler**, og reproduserer det gjenværende funnet.
- `excl` bevares nå som unsupported med årsak, uten å bli telt som ferdig bruttopris. Det opprinnelige 99-øre-mot-null-eksemplet er også rettet.
- Avgrenset typecheck består for mapperne, mappingtesten og economics-core med importerte avhengigheter.
- ESLint exit 0 for mapperne og de tre leverte 005a-testfilene. Next-regelen melder at pages-mappen mangler i den partielle pakken.

Eksisterende lokale avhengigheter (Vitest 5.0.3) ble brukt, ikke en ren npm ci. Ingen produksjonskode er endret. Ikke kjørt: full repo-suite med 1 066 tester, full app-typecheck/lint, check-docs, build, e2e, DB eller qa-skript. Utviklerens resultater er separat belegg.

Dette er en avgrenset rettingsreview som gjenbruker reviewen av e1c6ad0. Restfunnet krever en liten kode- og testretting, ingen ny regel- eller produktavklaring.
