# Forslag: fornyelse av syntetiske demodata (ikke implementert — venter beslutning)

**Status:** forslag 20.10.2026. Ingen kode er endret. Ingen hosted handling.

## 1. Problem (belagt)
Demoens observasjonstidspunkt er faste datoer: `generated.ts` bruker `Date.UTC(2026, 8, 1) + timer` (siste `lastSeenAt` ≈ 3.10.2026) og `handwritten.ts`/`demo-variation.ts` har egne faste datoer (siste 4.10.2026). Økonomiberegningen avviser kildedata eldre enn rettighetsprofilens oppbevaringstid (`synthetic-demo` v1: 604 800 s = 7 døgn). Fra og med 11.10.2026 gir den uendrede appen «Ikke beregnet — beregningen er utløpt: kildedataene er for gamle» for alle demoannonser (verifisert i nettleser, `reviews/ECON-006c-leveranse.md` funn 1). Kontrollen virker som den skal; hindret er operativt (partnerdemo viser ingen økonomi).

## 2. Krav (fra review og CLAUDE.md)
- Utløpskontrollen svekkes ikke og kan ikke omgås for andre kilder enn den syntetiske.
- Ærlig proveniens: dataene er **genererte**, aldri «hentet på nytt». Ingen påstand om ekstern kilde, mobile.de-format eller referansepriser. Gamle data omdateres ikke som om de var nye uten at det står på dem.
- Annonse-id, kandidat-id og revisjonsavtrykk er uendret (observasjonstidspunkt ligger utenfor avtrykket — verifisert i 006c).
- Alt skal være deterministisk og testbart med injisert klokke.

## 3. Alternativer
| | Beskrivelse | Vurdering |
|---|---|---|
| **A** | Manuell: redigere faste datoer i fixturene når en demo skal holdes | Enkelt, men skjørt, ingen proveniens, vil glemmes; hver gang en kodeendring |
| **B (anbefalt)** | **Eksplisitt datasett-epoke:** alle observasjonstidspunkt = epoke − faste forskyvninger. Epoken er én navngitt verdi (innebygd standard + valgfri server-only overstyring) med validering og synlig «generert»-dato | Kontrollert, eksplisitt, testbar; utløp fungerer fortsatt (demoen «eldes» 5 døgn etter epoken) |
| C | Rullerende: sist sett = nå − x ved hver forespørsel | Utløpskontrollen blir meningsløs i demoen (data utløper aldri) og skjuler nettopp det kontrollen skal vise. **Frarådes** som standard; kan bare vurderes som merket utviklermodus utenfor partnerdemo |

## 4. Forslag B — avgrenset design
1. **Epoke og forskyvninger.** `lastSeenAt = epoke − f` der `f` er 0–48 timer (fast, deterministisk per annonse), `firstSeenAt = lastSeenAt − d` (som i dag, d ≥ 0), revisjoner beholder rekkefølgen (modifiedAt/lastSeen). Resultat: hver post er brukbar minst 7 døgn − 48 t ≈ 5 døgn etter epoken (viktig: dagens spredning på ≈ 33 døgn ville latt de fleste poster utløpe med én gang selv med ny epoke — derfor komprimeres `lastSeen`-spredningen; `firstSeen` kan trolig være eldre fordi utløpet beregnes fra siste observasjon — **antakelsen må verifiseres i koden før implementering**).
2. **Epoken.** Innebygd standard (committed, nevnt i `FIXTURES.md`) + valgfri server-only overstyring `SCOUT_SYNTHETIC_EPOCH` (ISO-UTC). Valideres: ikke i fremtiden, ikke eldre enn 30 døgn, ellers **feiler den syntetiske kilden lukket** (kildefeil) — aldri stille fallback. Brukes **bare** når rettighetsmiljøet er `synthetic`. (En ny miljøvariabel krever oppdatering av arkitekturtesten som låser listen av miljøvariabler.)
3. **Proveniens og merking.** Syntetisk proveniens får `datasetVersion` og `generatedAt` (= epoken); beskrivelsen sier «generert, ikke hentet; observasjonstidspunkt simulert relativt til generert-tidspunktet». Den faste etiketten «Syntetiske demodata – ikke ekte leverandørdata» utvides med «generert <dato>» på kort/detalj.
4. **Utløp uendret.** Ingen endring i retention, rettighetsprofil, `assessEconomics` eller rettighetsregler.
5. **Rutine.** Før en partnerdemo settes epoken til tidspunktet demoen klargjøres (eller en ny standard committes via egen oppgave); etter ≈ 5 døgn utløper dataene igjen — det er ønsket atferd, og demoen viser det ærlig.

## 5. Nødvendige kontroller (må med)
- Tester med injisert klokke: (i) data eldre enn retention blokkeres fortsatt (økonomi «utløpt», også etter ny epoke + 8 døgn); (ii) alle poster er brukbare ved epoke + 0 og epoke + 5 døgn; (iii) epoke i fremtiden/for gammel/ugyldig ⇒ kildefeil; (iv) epoke påvirker ikke annonse-id, kandidat-id eller revisjonsavtrykk (snapshot av id-er før/etter); (v) ikke-syntetiske kilder ignorerer epoken; (vi) firstSeen ≤ lastSeen ≤ epoke for alle poster; revisjonsrekkefølge bevart; (vii) proveniens/merking inneholder «generert» og aldri «hentet»; (viii) arkitekturtest for miljøvariabel oppdatert bevisst; (ix) eksisterende DEV-003/005 normaliserings- og dedupliseringstester grønne (de har datoavhengige forventninger som må gjennomgås).
- Nettleser: fjern `fresh_observations`-patchen fra e2e og kjør den **uendrede** appen med epoke = nå − 1 t (forventer samme 88 sjekker uten patch), pluss et løp med gammel epoke som viser fail-lukket.
- Uavhengig review (proveniens/etiketter er en rettighets- og ærlighetsflate).

## 6. Valgfrie forbedringer (ikke nødvendige)
Rullerende utviklermodus (alt. C, merket, aldri partnerdemo) · visning av «data eldes om N dager» i demo-etiketten · skript som setter epoke og verifiserer utløpsvindu · utvidelse av datasettet.

## 7. Beslutninger jeg trenger fra Christian
**D1** B (anbefalt) / A / C? · **D2** innebygd standard + miljøvariabel, eller bare committed konstant (enklere, men krever kodeendring per demo)? · **D3** vindu: lastSeen 0–48 t (≈ 5 døgns brukbarhet) eller annet? · **D4** ordlyd for «generert»-merking. Estimat (utførelsestid): ≈ 1 dag inkl. tester og e2e-omkjøring + uavhengig review.
