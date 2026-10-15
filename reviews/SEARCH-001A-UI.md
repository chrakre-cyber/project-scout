# SEARCH-001A-UI — leveranserapport

Dato: 15.10.2026 · Branch: `claude/wonderful-bardeen-yussx3` · Base-commit: `e5e8272` · Status: **REVIEW** (ikke DONE; Codex gjennomgår separat før neste oppgave)

## 1. Hva som er levert
En lokal, interaktiv forhåndsvisning av Merovos nye søkeskjema og innkjøpsbudsjett i `prototypes/merovo-search/`. **Den fungerer i prototypen. Ingenting av dette er implementert i appen.** Ingen søk sendes, ingen treff vises, ingenting lagres i databasen.

**Åpne:** dobbeltklikk `prototypes/merovo-search/index.html` (file://). Ingen installasjon, server, Supabase, innlogging eller nye pakker.

## 2. Avvik mellom repoet og oppdragets status (rapporteres før jeg berørte noe)
Repoet i dette miljøet er commit `e5e8272` (DEV-005B0 etter review-rettelse) og er eldre enn Christians lokale kopi `project_scout_DEV_005B`. Konkret mangler/avviker:
- `MEROVO_SEARCH_SPEC.md`, **DEC-030** og PRODUCT_SPEC-tillegget fra 15.10.2026 finnes ikke i repoet. Jeg har brukt spesifikasjonen og oppdraget fra den vedlagte pakken; DEC-030 er ikke lest.
- Teksten «Slettes automatisk» er **ikke** endret til «Utløper senest» her (`src/app/agents/[id]/runs/[runId]/page.tsx` sier fortsatt «Slettes automatisk»).
- Windows-sti-normaliseringen i `tests/architecture.test.ts` og testfirma B/18 syntetiske treff kan jeg ikke bekrefte; jeg har ikke rørt disse filene.
- Jeg har ikke kopiert noe tilbake fra den lokale kopien og har ikke opprettet en ny «fasit». Slike rettelser i Christians kopi må bevares ved sammenslåing; denne leveransen berører dem ikke (rent tillegg i `prototypes/`, `tests/`, `reviews/` og én backloggrad).

## 3. Endrede filer
Nye: `prototypes/merovo-search/**` (index.html, css/style.css, js/data.js, js/logic.js, js/app.js, assets/, README.md), `tests/search-prototype.test.ts`, `tests/e2e/search001a-prototype.e2e.mjs`, `reviews/SEARCH-001A-UI.md`, `reviews/SEARCH-001A-UI/screenshots/*.png`.
Endret: `MVP_BACKLOG.md` (én tabellrad og én logglinje). **Ingen** endring i `src/`, `supabase/`, `package.json`, lockfil, AGENTS.md, CLAUDE.md, eksisterende tester eller docs utover backloggen.

## 4. Innhold i prototypen
Merovo-identitet: skoggrønn `#284734`, krem `#F6F1E7`, terrakotta `#A65038`, sand `#D9CEBC`; Figtree lastes lokalt (`assets/figtree.ttf` + `Figtree-OFL.txt`, systemfont som fallback); horisontal logo og symbol uendret fra pakken (proporsjon verifisert i nettleser). Desktop: skjema + fast oppsummering til høyre. Mobil: stablet, oppsummering bak fast bunnlinje («Vis oppsummering») som åpner en dialog (Esc lukker).

| Seksjon | Implementert i prototypen | «Flere tekniske valg» / avansert | Utsatt |
|---|---|---|---|
| 1 Bil og basisdata | merke, modell, variant (fritekst + demoforslag), utstyrspakke (modellavhengig), modellår fra–til, førstegangsregistrering fra–til (ÅÅÅÅ/ÅÅÅÅ-MM), km (maks), karosseri, seter fra–til, dører | – | flere bilalternativer, ekskluder bilalternativ |
| 2 Motor | drivstoff, girkasse, hjuldrift, effekt (hk/kW, tapsfri omregning) | slagvolum, sylindre, vekt (type + maks), forbruk (enhet + maks), utslippsklasse, skyvedør | tankvolum, miljømerke/partikkelfilter, halvautomat |
| 3 Eksteriør og kjøreutstyr | utvendig farge (ELLER) + metallic/matt separat, hengerfeste, tilhengervekt m/u brems, kuletrykk, cruise, parkering/kamera (6), kjøreutstyr (22, «Vis flere» + lokalt søk) | – | – |
| 4 Interiør | interiørfarge, materiale, klima/soner, seteutstyr (7), annet utstyr (12) | – | airbagnivå, rattplassering, spesialinnredning |
| 5 Tilstand, selger og vilkår | ny/brukt, skadestatus, service, garanti, sertifisering (demo), eiere, tidligere bruk, kontroll gyldig til, selgertype, land (demo), mva. oppgitt i annonsen, annonsens alder, fritekst | – | næring/eksport-import, postnummer/radius, «ny i Merovo», selgervurdering/bilder/video |
| 6 Budsjett | NOK-budsjett, valgfritt prisavvik, grense, transport/reise/forsikring/klargjøring + egne linjer (navn, beløp, valuta, mva.-grunnlag, inngår i budsjett) | – | – |
| 7 Lagring | eksporter, importer (fil + innliming), tøm | – | – |

Utstyr/hengerfeste/cruise/klima får synlig «Må ha» (standard) eller «Ønskelig». Flere valg i samme liste er **ELLER**; ulike bilkrav og «må ha» gjelder **OG** (stått i oppsummeringen). Ingen annonsematching utføres.

## 5. Valgte avgrensninger og tolkninger
- **Prisavvik:** av som standard, 0–100 % med opptil to desimaler (komma eller punktum), lagret som basispunkter. Grensen = budsjett × (10 000 + bp) / 10 000 i øre med BigInt; brøkøre rundes **ned**. 750 000 kr + 10 % = 825 000 kr. Budsjett maks 1 000 000 000 kr.
- **Tallformat:** mellomrom/NBSP eller punktum (grupper på 3) som tusenskille, komma som desimaltegn. «1.5» avvises som tvetydig, mer enn to desimaler, negative tall og tekst avvises med forklaring.
- **Kostnadslinjer:** tomt = ukjent, 0 = uttrykkelig (egen tekst), ikke lagt til budsjettgrensen, ingen total/kalkyle. Valuta fra DEC-018-listen, ingen omregning.
- **km:** kun maks (som spesifikasjonen tillater i første byggetrinn). Alle verdier er valgfrie; ingen gjettede km- eller utstyrsverdier.
- **Hengerfeste:** de fire valgene fra spesifikasjonen med prototypens egen tolkning skrevet i skjemaet (må avklares i SEARCH-001B). Adaptiv cruise oppfyller et generelt cruisekrav; klima «minst/nøyaktig» som i spesifikasjonen.
- **Modellbytte:** variant og pakker som ikke hører til ny modell fjernes med synlig melding og «Angre modellbyttet» / «Behold fjerningen»; merkebytte tømmer modell.
- **Effekt:** lagres kanonisk i watt, så hk↔kW-bytte er tapsfritt; visning avrundet til hele tall.
- **Eksempelknappen** setter demoverdier (Mercedes-Benz GLS, modellår fra 2021, 7 seter, svart/hvit, noen utstyrsvalg, 750 000 kr + 10 %) og merker utkastet «Basert på demoeksempelet»; km er bevisst tom, og salgspris/margin finnes ikke.
- **Tapsvern:** bekreftelse (nettleserdialog) før tøm/import/eksempel overskriver et utkast; advarsel ved lukking av fanen når utkastet har ueksporterte endringer; eksport stoppes mens feil finnes; ugyldig import er alt-eller-ingenting.
- **Eksportformat** `merovo.search-draft` v1: `criteria` (felt-ID → verdi med eksplisitt enhet, f.eks. `{"value":150000,"unit":"km","bound":"max"}`, effekt med `unit` og `approxKw`), `equipment` (nøkkel → `must`/`nice`), `budget` (beløp som `amountMinor`-tekst + valuta, prisavvik som basispunkter, kostnadslinjer med mva.-grunnlag og `includedInBudget`), `origin`, `notice`. Import avviser ukjent versjon/felt/nøkkel, feil enhet, verdier utenfor grenser, variant som ikke hører til modell og filer over 200 000 tegn.
- All bruker-/importtekst settes med `textContent`/`value`, aldri som HTML.

## 6. Kontroller faktisk kjørt
Miljø: Chromium 141.0.7390.37 (headless, Playwright), Linux. Viewporter: **1440×900**, **1024×768**, **390×844**. Alle nettverksforespørsler utenom `file:`/`data:`/`blob:` ble blokkert og talt via `context.route`: **0**. Ingen konsoll- eller sidefeil.

| Kontroll | Resultat |
|---|---|
| `tests/search-prototype.test.ts` (logikk, Node/vitest) | 66/66 |
| `tests/e2e/search001a-prototype.e2e.mjs` (nettleser) | 66/66 OK, kjørt to ganger |
| Hele repoets enhetstester (`vitest run`, uten DB) | 218/218 (inkl. de 66 nye) |
| `tsc --noEmit`, `eslint .` | rent (ingen avhengighet av unntak; én lokal `eslint-disable-next-line` for `require` i UMD-linjen i `logic.js`, begrunnet i kommentar) |
| `npm run build` | OK (prototypen er ikke en del av appen) |
| Secret-skann (`qa:secrets`) | ingen funn |
| Mutasjoner på `logic.js` (ikke committet) | 9 av 9 ga røde tester: flyttall i stedet for BigInt, negative tall tillatt, ingen versjonssjekk, variant fjernes ikke, ELLER→OG, «til-år» uten måned, desimalgrense av, prosent >100 tillatt, ukjente toppnøkler. (Mutasjon 6 overlevde først; testen ble skjerpet og fanger den nå.) |
| DB-tester, hosted, reset, purge | **ikke kjørt** (utenfor oppgaven) |

Forventede beløp er regnet for hånd, uavhengig av koden (se kommentarene i testen), bl.a.: 750 000 kr + 10 % = **825 000 kr**; 750 000,50 + 10 % = **825 000,55 kr**; 100,01 kr + 12,34 % = 112,351234 → **112,35 kr** (rundet ned); 999,99 kr + 0,01 % = 1 000,089999 → **1 000,08 kr** (ikke 1 000,09); 1 234 567,89 kr + 7,5 % = 1 327 160,48175 → **1 327 160,48 kr**. Ett øre under/over 82 500 000 øre-grensen er testet, og en egenskapstest viser at ⌊tillatt⌋ aldri overskrides av brøkøre.

Nettleserkontrollen dekker: oppstart/merking/logo/font, GLS-scenarioet fylt manuelt, desimalkomma, brøkøre, avvik av, ugyldig/negativt beløp og prosent, motstridende fra–til, merke-/modellbytte med angre, må ha/ønskelig, fjerning fra oppsummering, «Vis flere» + utstyrssøk, egne kostnader (0/ukjent/legg til/fjern), eksport → tøm → import → eksport (identisk innhold), fem ugyldige importfiler (utkastet uendret), HTML/script i importert tekst (ikke kjørt, ikke satt inn som elementer, vist som tekst), eksempelknapp, tastatur (Tab-rekkefølge, Space, piltaster, fokusmarkering, etiketter), og horisontal rulling/overlapp på 1440, 1024 og 390 px (bunnlinjen dekker ikke eksport/lagre; oppsummeringsdialog med fokus og Esc).

**Reprotrinn (manuelt):** åpne `index.html` → «Fyll ut GLS-eksempel» eller velg Mercedes-Benz/GLS, modellår fra 2021, 7–7 seter, Svart + Hvit, krysse av utstyr → budsjett «750 000» og «Vis også biler inntil 10 %» → «Høyeste tillatte budsjettgrense: 825 000 kr» → «Eksporter søkeutkast», «Tøm utkast», «Importer søkeutkast».

## 7. Skjermbilder (`reviews/SEARCH-001A-UI/screenshots/`)
01 desktop topp (1440×900) · 02 desktop GLS fylt (fullside) · 03 desktop budsjett · 04 desktop lagring · 05 importfeil · 06 mobil topp (390×844) · 07 mobil lagring · 08 mobil oppsummering · 09 mobil feiltilstand.

## 8. Gjenstående problemer og begrensninger
- Ikke gjennomgått med skjermleser; tastatur, etiketter og kontrast er kontrollert, men ikke en full WCAG-revisjon. Kun Chromium er prøvd (ikke Firefox/Safari).
- Merke/modell/land/sertifisering er små demonstrasjonsutvalg; modellvarianter og -pakker er illustrasjoner, ikke fasit eller kildekartlegging.
- Nettleserdialoger (`confirm`) brukes til bekreftelser; de kan være blokkert i enkelte innebygde nettlesere.
- Prototypen kjenner ikke eksisterende agenter, domenetyper eller matching; semantikken (OG/ELLER, ukjent ≠ oppfylt, mva.-status, hengerfeste, klima) er en foreslått tolkning som må bekreftes og implementeres i SEARCH-001B. Ingen avgifts-, mva.-, valuta- eller kostnadsberegning er gjort.
- `docs`: ingen endring i DECISIONS/PRODUCT_SPEC/ARCHITECTURE (oppdraget tillot bare rapport og backloggoppføring).

## 9. Neste mulige oppgave (ikke startet)
Etter Codex-review: feltmodell og validering i appens domenelag (versjonerte typer), deretter kontrollert lagring (SEARCH-001B). Ikke automatisk avgiftsmotor eller publisering.

---

## 10. SEARCH-001A-UI-FIX1 (etter Codex-review av 7878fbf) — status fortsatt REVIEW, ikke DONE

Utgangspunkt `7878fbf`, samme branch. Kun prototypen (`prototypes/merovo-search/`), testene og denne rapporten er endret. Ingen endring i app, database, avgiftsregler, pakker, auth eller providers.

**Overleveringsavvik (uendret):** DEC-030, `MEROVO_SEARCH_SPEC.md` og produktendringen 15.10 finnes fortsatt ikke i repoet. De er ikke lest, og DEC-030 er ikke konstruert eller markert lest; oppdragspakkens spesifikasjon er brukt.

### Rettelser
| Funn | Årsak | Rettelse | Brukerutfall |
|---|---|---|---|
| F1 | Import behandlet demokatalogens varianter som fasit | Fritekstvariant er gyldig under gyldig modell; kun pakker valideres mot modell. Variant uten modell avvises. | «GLS 450 d 4MATIC» eksporteres og importeres uendret |
| F2 | Urørt tom egendefinert linje ble eksportert | `costTouched`: urørt linje (ingen navn, beløp, mva., «inngår», NOK) eksporteres, telles og vises ikke. Linje med innhold men uten navn gir feltfeil før eksport. | Egen fil kan alltid åpnes igjen; reell informasjon slettes aldri stille |
| F3 | Valuta lå bare i beløpsobjektet | Eksport skriver `currency` per kostnadslinje også når beløpet er `null`; import krever gyldig valuta som stemmer med beløpet. | Ukjent beløp i EUR forblir EUR; ukjent og 0 skilles fortsatt |
| F4 | Kun «er streng» ble sjekket | Merke/modell valideres mot katalogen (ukjent modell, modell fra annet merke og modell uten merke avvises, også ved eksport). Hele importen er alt-eller-ingenting, så eksisterende utkast bevares. | «not-a-model» gir «Importen ble avbrutt» og uendret utkast |
| F5 | Visningsverdi i hk ble re-importert | Eksport har `normalizedWatts` (kanonisk watt) per side; import kontrollerer at den stemmer med viste verdi og bruker den. | 100 kW → 136 hk → fil → import → 100 kW (100000 W, ikke 100028) |
| (repro) | `criteria={toString:'x'}` | Oppslag via `Object.create(null)`/`Object.hasOwn` | «Ukjent felt: toString», ingen unntak |

### Schemaendring og v1-utkast
- `merovo.search-draft` **v2**: nytt `currency` på hver kostnadslinje og `power.normalizedWatts`. Versjon 1 og 2 leses; alle andre (0, 3 …) avvises.
- **v1 leses med eksplisitt migrering og synlig merknad («Merk: …»), aldri gjetting:** valuta hentes fra beløpet når det finnes, ellers settes NOK med advarsel; en tom egendefinert linje utelates med advarsel; effekt leses fra viste verdi (med 1 hk = 0,73549875 kW, avrundingen i v1-filen kan ikke gjenopprettes).
- Eksport skriver alltid v2.

### Kontroller faktisk kjørt
- `tests/search-prototype.test.ts`: **80/80 bestått**. Mot uendret 7878fbf-logikk (`PROTO_JS_DIR`, filene hentet med `git show 7878fbf:…`): **14 feiler** – de 12 nye FIX1-testene (F1–F5 og prototypenøkler), pluss to eldre forventninger som er oppdatert til v2. Av FIX1-describe-blokkens 14 tester feiler 12 på gammel kode; de to øvrige tester bare noe som allerede fungerte.
- Nettleser (Playwright/Chromium 141, file://): **90/90 kontroller bestått, kjørt to ganger**. Nye: eksport → nedlasting → tøm → filimport → ny eksport (identisk bortsett fra tidsstempel) for F1, F2, F3 og F5 på **1440 px og 390 px**; F4 ukjent modell avvist med utkastet uendret; v1-fil med merknad; alle eksterne forespørsler blokkert og telt = 0; ingen konsoll-/sidefeil. Mot gammel kode stopper den samme nettleserkjøringen allerede ved første v2-forventning (import av fil med `currency` feiler), så den er ikke bestått der; funn-for-funn-bevis på gammel kode er logikktestene.
- Hele repoet: `tsc --noEmit` og `eslint .` uten feil, `vitest run` 232/232 (15 filer), `qa-secret-scan` ingen funn, `npm run build` OK. Ingen hosted DB-tester, reset eller purge.
- Codex' reproduksjonsskript mot fikset kode: alle fem scenarier og nøkkeltesten gir forventet utfall.

### Begrensninger
- Skjermbilder 02 og 05 er regenerert; øvrige er uendret.
- Variantforslag er fortsatt et demonstrasjonsutvalg; fritekst er tillatt, modellbytte varsler som før.
- Ikke etterkjørt av Codex ennå. Ingen ny oppgave startet.
