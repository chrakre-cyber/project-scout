# Merovo søkeskjema — forhåndsvisning (SEARCH-001A-UI)

Lokal, interaktiv prototype. **Ingen søk sendes.** Ingen server, Supabase, innlogging, nettverk, sporing eller nye pakker.

## Åpne
Dobbeltklikk `index.html`, eller åpne den i en nettleser (`file://`). Ingenting må installeres eller konfigureres.

## Innhold
- `index.html`, `css/style.css`, `js/data.js` (feltkatalog), `js/logic.js` (tallparsing, budsjettgrense, validering, oppsummering, eksport/import), `js/app.js` (UI).
- `assets/`: Figtree (med `Figtree-OFL.txt`) og Merovos logo/symbol, uendret fra merkevarepakken.

## Bruk
«Fyll ut GLS-eksempel (demo)» setter demoverdier (kan endres fritt). «Eksporter søkeutkast» laster ned versjonert JSON (`merovo.search-draft`, versjon 1). «Importer søkeutkast» leser samme format lokalt; ugyldig fil endrer ingenting. Utkastet er **ikke lagret i appens database**.

## Kontroller
`npx vitest run tests/search-prototype.test.ts` (logikk) og `PW=<sti til playwright> node tests/e2e/search001a-prototype.e2e.mjs` (nettleser). Se `reviews/SEARCH-001A-UI.md`.

Merke-, modell-, land- og sertifiseringslistene er demonstrasjonsutvalg, ikke en fullstendig katalog. Prototypen er ikke en del av appen og påvirker ikke produksjonsruter, database eller avgiftsberegninger.
