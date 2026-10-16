# SEARCH-003 — kobling fra søkeutkast til søkemodell · leveranserapport

Status: **REVIEW** (ikke DONE). Utfører Claude Code, kontrollør Codex. Neste oppgaver (kandidatadapter, UI-/lagringsintegrasjon) er **ikke** startet.

## 0. Utgangspunkt

- Branch `claude/wonderful-bardeen-yussx3`, **base/HEAD før endring: `feaac30`** («legg ved review-ZIP for f7d3104», SYNC-001). Funksjonelt identisk med `f7d3104` (SYNC-001) — `feaac30` la bare SYNC-001-ZIP-en til. Arbeidstreet var rent.
- **Commits for denne leveransen:** implementasjon `7431ee4`; sluttcommit = den neste commiten (kun denne rapporten; hashen står i ZIP-ens MANIFEST og README). Ingen annet arbeid nullstilt.
- Bevart: DEC-030/031, SEARCH-002/FIX1-koden, Windows-stinormaliseringen i arkitekturtesten og «Utløper senest»-rettelsene (alle uberørt; 328 tester fra SYNC-001 kjører fortsatt).
- Ikke endret: prototypen (UI, eksport/import), `src/domain/**`, app, database, migrasjoner, pakker.

## 1. Hva som er levert

Ny, ren TypeScript-adapter **utenfor domenet**: `src/adapters/search-prototype/`

| Fil | Innhold |
|---|---|
| `adapt.ts` | `adaptPrototypeDraft(input: unknown, catalog: SearchCatalog, extra: unknown): AdaptResult` |
| `fields.ts` | Prototypens feltkatalog slik adapteren kjenner den (id, visningsnavn, felttype, enheter, grenser, **valgmengder `FIELD_OPTIONS`**) + kostnadstype-mapping |
| `tests/search-prototype-adapter.test.ts` | 70 tester (kontrakt mot prototypens faktiske eksport) |

Adapteren leser et allerede parset `merovo.search-draft` **v2**-dokument og returnerer enten et validert `SearchSpec` + domenets `SearchSpecJson` (`merovo.search-model` v1), et **blokkert** resultat (utfylte, ustøttede valg) eller et **ugyldig** resultat (feil). Det er ingen integrasjon i appen: ingen UI/nettleserkobling, kandidatdata, lagring, migrasjon eller søk.

## 2. Kontrakt

**Signatur.** `adaptPrototypeDraft(input, catalog, extra)`; `extra = { plannedRegistration: "passenger"|"van"|"unspecified"; listPriorities?: { extColor?, intColor?, material?: "must"|"nice" } }`.

**Resultat.**
```ts
{ ok: true;  spec: SearchSpec; json: SearchSpecJson; origin: "user"|"demo-example"|null }
{ ok: false; kind: "invalid"; issues: Issue[]; unsupported: UnsupportedSelection[] }  // dokument-/inputfeil
{ ok: false; kind: "blocked"; issues: [];       unsupported: UnsupportedSelection[] }  // utfylte ustøttede valg
```
`UnsupportedSelection = { path, prototypeId, label, status, reason }`. Ved `ok:false` finnes **ingen** `spec` eller `json`-egenskap.

**Regler (oppdragets punkt → implementasjon).**
1. *Ukjent input, ingen unntak/mutasjon/delvis spec:* hele funksjonen kontrollerer struktur først og er i tillegg pakket i `try/catch` (kastende getters/Proxy gir `invalid`). Input leses bare; resultatet deler ingen referanser med input.
2. *Bare v2:* v1 → `v1_not_supported` («Åpne filen i forhåndsvisningen og eksporter den på nytt (versjon 2)»); andre versjoner → `unsupported_version`. Ingen egen v1-migrering.
3. *PROTOTYPE_MAPPING:* statusen hentes fra domenets `mappingFor("field", id)`. Utfylt felt med `planned_later`/`not_relevant_for_matching` rapporteres med feltsti (`criteria.<id>`), visningsnavn og grunn (mappingens `note`). Ukjente felt (kriterier, utstyrsnøkler, toppnøkler, nøkler i underobjekter) avvises.
4. *Blokkert uten brukbar spec:* ingen stripping, ingen «fortsett likevel». `blocked` gjelder bare et ellers fullt validert dokument (se FIX1, §8). **Tomt** følger prototypens eksportsemantikk: tom streng, tom liste, intervall/verdi med bare `null` er tomt; **0 er utfylt** (f.eks. «Tidligere eiere maks 0» blokkerer).
5. *Merke/modell:* prototypens verdier er katalognøkler og slås opp direkte i den injiserte katalogen (`Mercedes-Benz`/`mercedes` avvises; ingen fuzzy). Fritekstvariant bevares ordrett under gyldig modell. Ukjent merke/modell, modell fra annet merke og variant uten modell blokkerer (domenefeil med sti).
6. *Utstyr:* `must`/`nice` per element beholdes; lister er ELLER, ulike krav OG (domenets semantikk, uendret); ingen poengmodell. Ukjent utstyrsnøkkel i katalogen → feil.
7. *Farge/materiale:* prototypen har ingen prioritet, så `listPriorities` MÅ gis for hver utfylt liste; manglende eller ugyldig → feltfeil (`extra.listPriorities.<id>`), ingen standard. Prioritet for tom liste skaper ikke et kriterium.
8. *Planlagt registrering:* eksplisitt tilleggsinput; manglende/ugyldig → feil; `unspecified` er gyldig; utledes aldri (ikke fra karosseri, ikke fra van).
9. *Budsjett/kostnader:* `maxPurchaseCost` (øre som BigInt), avvik (basispunkter, 0–10 000) og kostnadslinjer overføres eksakt: faste linjer får id = prototypens nøkkel (`transport`, `travel`, `insurance`, `prep`→type `preparation`), egendefinerte får `custom-<n>` (prototypen eksporterer ingen id); tekst, valuta, beløp (`null` = ukjent, `0` = 0), mva.-grunnlag (`""` → `null`) og «inngår» bevares. Ingen valutakonvertering, ingen summering; linjene påvirker aldri grensen. Ikke-representerbare verdier (label > 60 tegn, styretegn, uriktige mellomrom) blokkerer via domenevalidering.
10. *Modellår, førstegangsreg., km, seter:* overføres uten oppdiktede verdier (`"2021-06"` → måned, `"2023"` → år). Ustøttede utfylte felt valideres likevel strukturelt og for konsistens, bl.a. effekt: `normalizedWatts`/`approxKw` må stemme med oppgitt hk/kW; `budget.deviation.maxAllowed` må stemme med budsjett og avvik. Skadet dokument → `invalid`, ikke `blocked`.
11. *Sluttvalidering:* `validateSpec` mot katalogen, deretter `specToJson`. Rundtur `JSON → specFromJson` er testet for hver vellykket konvertering. Prototype v2 og domenets v1 holdes adskilt.
12. *Gjenbruk/duplisering:* status, `validateSpec`, `specToJson` og `unsupported`-grunner gjenbrukes fra domenet. **Nødvendig duplisering** (modulgrensen forbyr import av prototypen): feltkatalogen (`fields.ts`) og effektkonverteringene (hk↔W↔kW). Kontrakttester sammenligner begge med prototypens faktiske kode og eksport, så drift gir rød test.

## 3. Eksempler

**Vellykket (prototypens «Fyll ut GLS-eksempel», `origin: demo-example`)**, `extra = { plannedRegistration: "van", listPriorities: { extColor: "nice" } }`:
- `vehicle {mercedes-benz, gls, null}`, `modelYear {min 2021, max null}`, `seats {7, 7}`;
- `exteriorColors {black, white; nice}`, `equipment`: `camera_360 must`, `carplay must`, `panoramic_roof nice`, `air_suspension nice`, `heated_seats_front nice`;
- `budget.maxTotal 75000000 øre NOK`, `deviationBasisPoints 1000` → øvre grense **82 500 000 øre = 825 000 kr**, 4 faste kostnadslinjer (ukjent NOK, ikke inkludert), `plannedRegistration van` (kun fra tilleggsinput).

**Viktig funn om eksempelet:** eksempelet inneholder *ingen* ustøttede utfylte valg (kartlagt mot mappingtabellen: `brand, model, modelYear, seats, extColor` er alle `supported_now`; utstyrsnøklene finnes i katalogen). Det blokkeres derfor ikke, men *uten* `listPriorities.extColor` feiler konverteringen med `extra.listPriorities.extColor: missing_input`. Eksempelet er ikke endret.

**Blokkert** (samme eksempel + `cruise = adaptive`, `doors = 4-5`, `freeText = "tekst"`):
```json
{ "ok": false, "kind": "blocked", "issues": [], "unsupported": [
  { "path": "criteria.doors",    "prototypeId": "doors",    "label": "Antall dører", "status": "planned_later", "reason": "Krever kildekatalog for dørvalg." },
  { "path": "criteria.cruise",   "prototypeId": "cruise",   "label": "Cruisekontroll", "status": "planned_later", "reason": "Regel for om adaptiv oppfyller generelt cruisekrav er ikke vedtatt." },
  { "path": "criteria.freeText", "prototypeId": "freeText", "label": "Søk i annonsetekst (supplerende)", "status": "not_relevant_for_matching", "reason": "Supplerende fritekst bekrefter ingen strukturerte krav og brukes ikke i matching." } ] }
```

## 4. Krav → testbelegg (`tests/search-prototype-adapter.test.ts`, 70 tester)

| Krav | Test |
|---|---|
| Gyldig begrenset GLS-utkast (fri variant, begge prioriteter, listeprioriteter, scenario, 750 000 kr / 10 %) → domenets JSON → import, grense 825 000 kr | «vellykket konvertering…» (6 tester inkl. rundtur, uendret input, «ønskelig er ikke krav» via `evaluateCandidate`) |
| Prototypens faktiske GLS-eksempel, ustøttede valg kartlagt | «Fyll ut GLS-eksempel» (2 tester) |
| Alle utfylte ustøttede felt blokkeres, systematisk mot mappingtabellen; katalogendring gir ikke stille bortfall | «ustøttede… blokkeres systematisk» (**29 tester**, én per ikke-støttet prototypefelt, generert fra prototypens egen katalog; pluss tabell-/mappingsamsvar, sample for hvert av de 14 støttede feltene endrer resultatet, 0 vs tom, `freeText`, cruise/klima/hengerfeste) |
| Fargeprioritet gjettes ikke; varebil utledes ikke; unspecified gyldig; prioritet på tom liste | «tilleggsinput» (5 tester) |
| Ukjent vs 0, valuta uten beløp, egne kostnader, avslått/0/100 % avvik, brøkøre, tomt utkast, kostnader øker ikke grensen | «budsjett og kostnadslinjer» (5 tester) |
| Feil katalogmodell/merke/utstyr/farge, ingen fuzzy, fiendtlig tekst | «katalogreferanser» (4 tester) |
| Ukjente nøkler/versjoner, feil containertyper, feil enheter/grenser/typer, skadet effekt/`maxAllowed`, flere feil samtidig | «dokumentvalidering» (7 tester) |
| Ingen unntak/mutasjon/delvis spec ved skadet input | «robusthet»: hver sti (dybde ≤ 4) i et ekte dokument × 15 søppelverdier (ca. 100 stier × 15 verdier ≈ 1 500 kombinasjoner), kastende getter, Proxy, kastende katalog |
| Kontrakt mot ekte eksport | feltkatalog/enheter sammenlignet med `data.js`; effektkonvertering for hele hk/kW-området; 150 pseudotilfeldige ekte eksporter fra prototypens logikk gir aldri `invalid`, og «blokkert ⇔ utfylt ustøttet» |
| Modulgrenser | domenet importerer ikke adapteren; adapteren importerer bare `@/domain/**` og relative moduler; ingen DOM/nett/klokke |

**Mutasjonsprøving** (manuelt skript, én endring av gangen, ikke en del av repoet): 30 mutasjoner av `adapt.ts` — 29 drept ved første kjøring; den siste («standard scenario») var en feilplassert, ekvivalent mutant og ble gjentatt riktig plassert (drept). Dekket bl.a.: ustøttede felt ikke blokkert, tomme felt blokkerer, v1/andre versjoner godtatt, standard fargeprioritet, standard scenario, `normalizedWatts`/`approxKw`/`maxAllowed` uten kontroll, valutafeil, ukjent→0, id-duplikater, prioritet tapt, ukjent utstyr, ukjente nøkler, månedspresisjon tapt, `try/catch` fjernet.

## 5. Kontroller faktisk kjørt (Linux)

`tsc --noEmit` ren · `eslint .` ren · `vitest run` (ikke-DB) **398/398** i 18 filer (328 fra SYNC-001 + 70 nye; inkluderer prototype-, SEARCH-002/FIX1-, arkitektur- og SYNC-tester) · `qa-secret-scan.sh` «INGEN FUNN» · `npm run build` OK. Ingen DB-test, reset, purge, hosted handling, nettverk/API, nye pakker, deploy. Ingen nettleser- eller Windows-kjøring.

## 6. Begrensninger og åpne punkter

- Adapteren er **ikke koblet** til prototypens UI eller appen. Den tar et parset dokument; eksport/import i prototypen er uendret.
- Pakkenavn (`criteria.packages`) kan ikke valideres mot modellens pakker uten en pakkekatalog i `SearchCatalog`; bare form (liste av korte tekster, høyst 10) og avhengigheten «krever valgt modell» kontrolleres. Merke/modell/utstyr/farge/materiale valideres mot den injiserte katalogen.
- Custom kostnadslinjer får posisjonsbaserte id-er (`custom-<n>`); prototypen eksporterer ingen id, så id-en er stabil bare for et gitt dokument.
- `plannedRegistration` og farge-/materialprioritet må komme fra en framtidig UI/lagring; hvordan de samles inn er ikke besluttet her.
- Gammel prototypeimport (P3, v1-effektadvarsel) er ikke berørt.
- Domenet er uendret; ingen ny domeneregel eller beslutning (ingen DEC-endring nødvendig).

## 7. Neste mulige oppgave (ikke startet)

Kandidatadapter (kildetekst → `CandidateV2`) og senere eksplisitt UI-/lagringsintegrasjon (SEARCH-001B).

## 8. SEARCH-003-FIX1 (etter Codex-review av 52dbcc1) — status REVIEW, ikke DONE

Utgangspunkt `52dbcc1` (+ `a0f13c2` som bare la ZIP-en til). Kun `src/adapters/search-prototype/` og tester er endret; domene, prototype, app, database og pakker er uendret. Ingen DB/hosted-handling, API eller UI-integrasjon.

**F1 — blokkering hoppet over validering av støttede verdier.** `adaptPrototypeDraft` returnerte `blocked` før `validateSpec` ble kjørt. Nå bygges `SearchSpec` og valideres alltid mot domenet så lenge de *støttede* delene lot seg lese (feil i ustøttede felt hindrer ikke dette). Rekkefølgen er: samle alle feil → `invalid` hvis noen feil (med `unsupported`-listen beholdt) → `blocked` bare hvis dokumentet ellers er helt gyldig → `ok`. Manglende tilleggsinput (scenario, listeprioritet) rapporteres nå også sammen med ustøttede valg. Ingen spec/JSON ved `invalid` eller `blocked`; ingenting fjernes automatisk.

**F2 — ustøttede felt ble ikke validert fullt ut.** Gjennomgått systematisk per felttype (kilde: prototypens `importValue`/`validateField`):

| Felttype | Regler som nå kontrolleres (også for ustøttede felt) |
|---|---|
| select / radio | tom ("alle") eller gyldig valg (`FIELD_OPTIONS`) |
| towbar / cruise / climate | må være et gyldig valg (prototypens import avviser tom verdi); prioritet uten verdi avvises |
| multi / colors | liste av unike tekster, hvert element i `FIELD_OPTIONS` (også støttede: karosseri, drivstoff, gir, hjuldrift, farger, materiale; prototypens drivstoffvalg har ikke «other») |
| range | heltall innen grenser, riktig enhet, **fra ≤ til** |
| max / owners / tilhengervekt | heltall innen grenser, riktig enhet og grense (`min`/`max`) |
| weight | type ∈ {curb, gross}, 100–10 000 kg, **vekt krever vekttype** |
| consumption | enhet ∈ {l100, kwh100}, `perUnit "100 km"`, **verdi 0,1–100 med høyst én desimal**, **verdi krever enhet** |
| power | enhet hk/kW, hk 1–3 000 / kW 1–2 200, **fra ≤ til**, `normalizedWatts` og `approxKw` konsistente med oppgitt effekt |
| month / text / variant | format og lengde |
| packages | liste av tekster (≤ 10, ≤ 60 tegn), **krever valgt modell** |

Gyldig men ustøttet forblir `blocked`; skadet dokument er `invalid` med feilsti til faktisk feil (`criteria.<id>…`). Pakkenavn mot modellens pakker kan ikke valideres uten pakkekatalog (se begrensninger).

**Nødvendige kopierte formatregler (dokumentert og testet mot faktisk prototypekode):** `FIELD_OPTIONS` (valgmengder), felttabellens grenser/enheter, vekt-/forbruksgrenser og effektkonvertering. Testen «kopierte formatregler samsvarer med prototypens faktiske kode og katalog» sammenligner `FIELD_OPTIONS` med `data.js`, og kjører de samme verdiene (slagvolum, forbruk, vekt, sylindre) gjennom prototypens egen `validate()` og adapteren: begge må avgjøre likt.

### Testbelegg
- Codex' fire uavhengige regresjoner (`tests/codex-search003-review.test.ts`, uendret fra Codex).
- `tests/search-prototype-adapter-fix1.test.ts` (38 tester): Codex-reproduksjonene; 14 kombinasjoner «feil i støttet verdi + gyldig ustøttet valg» (merke/modell/variant, intervall/enhet, registrering, drivstoff, budsjett, kostnadslinje, utstyr/prioritet); manglende tilleggsinput + ustøttet valg; feil i både støttede og ustøttede felt (stier kontrollert); 27 ustøttede felt × gyldig og skadede varianter (valgmengde, duplikat, omvendt intervall, grenser, enhet, grense, avhengigheter, effekt, forbruk, vekt, pakker); tom ustøttet verdi blokkerer ikke; kopierte regler mot prototypen. Alle sjekker at feilsti peker på faktisk feil, at ingen `spec`/`json` leveres og at originalinput (dypfrosset) er uendret.
- To eksisterende tester oppdatert til strengere, prototypekorrekte forventninger (tom hengerfeste/cruise er ugyldig; ukjent karosseri/drivstoff meldes på `criteria.<felt>[i]`; omvendt seter-intervall meldes på `criteria.seats`). Ingen test svekket.
- **Mot gammel kode (`52dbcc1`, med nye tester og kun den nye `fields.ts` som data):** 33 av 42 nye/Codex-tester feiler (Codex' fire + 29 egne: alle kombinasjons- og skadede-felt-tester). De 9 som består gjelder atferd som allerede var riktig (f.eks. tilhengervekt, kuletrykk, eiere, kontrollmåned, fritekst, tom ustøttet verdi, samsvar mot katalogen).
- **Mutasjonsprøving av rettelsene:** 14 mutasjoner — 13 drept; den siste («broken ikke satt ved budsjett/ekstra») er ekvivalent (samme tilstand fanges av en etterfølgende vakt).

### Kontroller faktisk kjørt (Linux)
`tsc --noEmit` ren · `eslint .` ren · `vitest run` (ikke-DB) **440/440** i 20 filer (398 bevart + 38 nye + 4 Codex) · `qa-secret-scan.sh` «INGEN FUNN» · `npm run build` OK. Ingen DB-test, nettverk, nye pakker, Windows- eller nettleserkjøring.

### Commits og ZIP
Rettelsen: se `git log` etter `a0f13c2` (hashen står i ZIP-ens README/MANIFEST). Review-ZIP-en er også sjekket inn i repoet fordi en pålagt stop-hook krever rent arbeidstre; den er ikke en del av manifestet.
