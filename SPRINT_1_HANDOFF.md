# Første utviklingsoppdrag

03.10.2026. Bruk bare ett oppdrag om gangen. Hovedutvikler kan være Claude Code eller Codex. Se backloggstatus før start; DEV-001 kan først startes når SET-001 er gjort.

## DEV-001 — appskall og merket demo

**Mål:** En lokalt kjørbar Next.js-app med navigasjon til dashboard, agenter og opportunity, som viser syntetiske data og gir en konkret visuell start.

**Les:** README, CLAUDE.md/AGENTS.md, PRODUCT_SPEC, ARCHITECTURE, DATABASE_SCHEMA og TEST_PLAN.

**Implementer:** appoppsett, typekontroll, routing, enkel komponentstruktur og åtte tydelig syntetiske bilkort. Bruk Tailwind/egnet komponentbibliotek i valgt versjon; oppgi versjoner og lockfile. Lag dokumentert lokal start/build. Hold domain-types i eget lag slik at provider kan innføres i DEV-003.

**Avgrens:** Ingen live-data, secrets, ekte login eller avgiftsmotor. Demo-login må ikke fremstilles som sikker autentisering. Bilbilder bare fra rettighetsklarert lokal ressurs, enkel placeholder eller syntetisk visual. Ingen oppdiktede mobile.de-lenker; bruk inaktiv «demoannonse»-handling.

**Ferdig når:**

1. Ren lokal installasjon/start dokumentert og faktisk prøvd.
2. Tre visninger kan åpnes uten feil og bruker tydelig demo-banner.
3. Ingen virkelige marginpåstander eller autentiseringspåstander; kostfelt viser syntetiske eksempler/ikke beregnet.
4. Typekontroll og build består; tilgjengelige knapper har forståelig virkning.
5. Rapporter endrede filer, kommandoer/resultat, begrensninger og neste oppgave. Ingen secrets eller live-API-kall.

**Review:** Kontroller brukerflyt og build. Ingen tester som bare speiler enkel dekorasjon er nødvendig.

## DEV-002 — Supabase, Auth og firmatilgang

**Forutsetning:** DEV-001 og SET-002 ferdige. Christian har opprettet nødvendig prosjekt; ikke be om secrets i chattekst eller legg dem i repo.

**Mål:** Bruker kan logge inn, få membership til ett firma og lese/skrive kun egne firmadata.

**Implementer:** SQL-migrasjoner fra logisk modell, Auth-flyt, kontrollert medlemsopprettelse, RLS, avgrenset serverlag og seed med to syntetiske firmaer. Velg én pengetype. Ikke lag egen passordhåndtering.

**Ferdig når:** migrasjoner kan anvendes i tomt testprosjekt; login/logout fungerer; A/B-isolasjon er kontrollert for både DB og serverruter; membership kan ikke byttes av browserinput; service-key er ikke i klientbundle. Rapporter migrasjon/gjenoppretting og testbevis.

## DEV-003 — MarketplaceProvider og mock

**Forutsetning:** DEV-001 ferdig.

**Mål:** Mock-provider returnerer stabile, normaliserte listing-objekter via kontrakten i ARCHITECTURE.

**Implementer:** typed interface, minst 100 syntetiske fixturer for intern modell, search/getListing, pagination og eksplisitte feiltyper. Inkluder endret annonse, duplikat, manglende spesifikasjoner, ukjent prisgrunnlag, ulike registreringspresisjoner og valutaer. Syntetiske data er ikke «mobile.de-format».

**Ferdig når:** search/getListing gir konsistente kilde-IDer og nullable felter; filter/enheter og page boundaries kontrolleres; feil kan simuleres uten nettverk; ingen avgifts-/AI-logikk ligger i provider; fixture-opphav er dokumentert.

## DEV-004 — lagre og styre agenter

**Forutsetning:** DEV-002 og DEV-003 ferdige.

**Mål:** Login → opprett → gjenfinn → rediger → pause en agent, uten cross-tenant-tilgang.

**Implementer:** validerte strukturerte filtre og økonomiforutsetninger med eksplisitt prisgrunnlag. Agenten trenger navn, minst merke/modell eller avklart bredere filter, retail-input, positivt minimum bidrag, reserve og active-status. Version øker ved redigering. Maks 10 aktive håndheves atomisk, ikke bare i UI. Vær tydelig på at lagret retail ikke betyr ferdig beregnet margin.

**Ferdig når:** vedvarende lagring fungerer etter refresh/login; pause og redigering er korrekte; ugyldig input avvises; samtidige aktiveringer kan ikke overskride 10; A kan ikke hente/redigere Bs agent. Lever relevante kontroller til QA-001.

## Ikke start resten som del av Sprint 1

Live-provider, kost-/avgiftsmotor, LLM, varsler og scheduler er separate backloggoppgaver. Logg blokkering og hold mock-demo kjørbar dersom ekstern konfigurasjon mangler. Returner en konkret leveranse fremfor å erklære hele prosjektet ferdig.
