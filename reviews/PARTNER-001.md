# PARTNER-001 — sjekkliste for ekstern partnertilgang til `https://demo.merovo.eu` (16.10.2026)

Kun dokumentasjon. Ingen kode, ingen deployendring, ingen brukere eller firma er opprettet. Alle navn, e-postadresser og ID-er under er **plassholdere**; ingen passord eller nøkler skal stå i denne filen, i e-post, i chat eller i git.

**Statusgrunnlag:** at `demo.merovo.eu` er live og at hostet Supabase-innlogging, tenant-isolasjon og isolasjon av gamle ruter er verifisert, er oppgitt av Christian etter hostet test. Claude har ikke selv kjørt eller sett disse hostede kontrollene (kun lokale/emulatorbaserte; DB-suitene mot Supabase er ikke kjørt av Claude). Sjekklisten under gjentar kontrollene per partner, slik at påstanden bekreftes igjen før hver ny tilgang.

## 1. Informasjon Christian trenger fra partneren (før tilgang opprettes)
- Organisasjonens fulle navn (brukes i firmanavnet «Demo – <organisasjon>»).
- For hver person: fullt navn og **personlig arbeids-e-post** (ikke felles postboks), rolle.
- Ønsket demodato/tidsrom og kontaktperson hos Merovo.
- Bekreftelse på at partneren aksepterer vilkår/konfidensialitet etter Christians vurdering (NDA/e-postbekreftelse) og vet at demoen bruker **syntetiske data**.
- Hvilken nettleser/maskin som brukes (moderne Chrome/Edge/Firefox/Safari anbefales; bedriftens nettverk må slippe gjennom `demo.merovo.eu`).
- Om partneren vil ha flere brukere (hver får egen konto).

## 2. Opprettelse (gjøres av Christian som prosjekteier i Supabase; ikke av Claude)
1. **Eget demofirma per ekstern organisasjon.** SQL-editor: `select private.admin_create_dealership('Demo – <organisasjon>');` → noter returnert firma-ID (plassholder `<firma-id>`). Ikke gjenbruk et firma på tvers av organisasjoner.
2. **Individuell bruker per person.** Auth-dashboard → Add user, **auto-confirm**, personlig e-post, sterkt generert engangspassord (minst 12 tegn). Aldri delt konto, aldri partnerens e-post på noen annens konto.
3. **Firmatilknytning.** SQL-editor: `select private.admin_add_member('<epost>', '<firma-id>');`. Én bruker → ett firma. **Ingen konto uten firmatilknytning** skal sendes til en partner.
4. Åpen registrering skal være **av** (bekreft i Auth-innstillinger).
5. Notér (utenfor git): organisasjon, bruker-e-post, firma-ID, dato opprettet, hvem som har sendt tilgang. Ingen passord i notatet.

## 3. Test før tilgang sendes (Christian, i privat nettleservindu)
| # | Kontroll | Forventet |
|---|---|---|
| 1 | Åpne `https://demo.merovo.eu` | Sendes til `/login`; Merovo-stil, «Local demand. European supply.», «Privat partnerdemo …», ingen «Project Scout», ingen gult banner |
| 2 | Logg inn med partnerens nye konto | Lander på `/searches` i Merovo-skall; fast etikett «Syntetiske demodata – ikke ekte leverandørdata»; **ingen utkast** fra andre firma |
| 3 | Opprett «Demosøk som gir treff (BMW 3-serie)» fra eksempellisten, lagre, åpne på nytt, endre, lagre | Versjon øker (1 → 2); verdier bevart |
| 4 | «Prøv med demodata», åpne «Se detaljer» | Grupper og forklaring vises; **syntetiske** annonser; «Innkjøpskostnad til Norge er ikke beregnet»; ingen live-/partnerpåstander |
| 5 | Logg ut | Tilbake på `/login` |
| 6 | Logg inn igjen | Søket fra punkt 3 finnes (versjon 2) |

## 4. Tenant-isolasjon (to kontoer i to ulike firma; bruk to nettleserprofiler)
- Konto B (annet firma) ser **ikke** partnerens utkast, og partnerens konto ser ikke B sine.
- Åpne partnerens utkast-URL (`/searches/<id>`) fra B → Merovo «Fant ikke siden» (ikke data, ikke feilside med detaljer). Og omvendt.
- Bruk en eksisterende testkonto i et annet testfirma som B; **opprett ikke nye kontoer bare for dette** uten at Christian bestemmer det.
- Avvik (partneren ser fremmed data) = **stopp**, ikke send tilgang, meld til Claude/Codex.

## 5. Kun syntetiske data
- Etiketten «Syntetiske demodata – ikke ekte leverandørdata» er synlig på `/searches`, forhåndsvisning, detalj og hvert kort.
- Annonser har ingen kilde-URL/lenke ut; bilder er merket «Illustrasjon».
- Ingen tekst påstår live-leverandør, partnerskap, lager eller beregnet innkjøpskostnad. Annonsepris er merket «ikke innkjøpskostnad».
- `SCOUT_SYNTHETIC_FAILURE` skal ikke være satt i hostingmiljøet (ellers vises simulert kildefeil).

## 6. Gamle ruter skal fortsatt være isolert (anonymt og innlogget)
Åpne direkte: `/dashboard`, `/agents`, `/agents/anything`, `/opportunities/demo-001` → alle sendes til `/login` (innlogget: videre til `/searches`); ingen Project Scout-UI vises. `/finnes-ikke` → Merovo «Fant ikke siden» med lenke til `/login`. `SCOUT_ENABLE_LEGACY_ROUTES` skal være **udefinert** i hostingmiljøet (bygg-tid-flagg; se `reviews/HOST-001.md`).

## 7. Sende tilgang
Send **e-posten** (mal under) og **passordet i en egen kanal** (f.eks. SMS/telefon/passordbehandler-delingslenke med utløp), aldri begge i samme melding. Be partneren bekrefte at innloggingen fungerer. Det finnes ikke passordbytte/«glemt passord» i appen: bytte/tilbakestilling gjøres av Christian i Supabase-dashboardet.

### E-postmal
> **Emne:** Tilgang til Merovo-demo
>
> Hei <fornavn>,
>
> Takk for samtalen. Her er tilgangen til den private Merovo-demoen:
>
> Adresse: https://demo.merovo.eu
> Brukernavn: <din e-postadresse>
> Passord: sendes separat
>
> Demoen viser hvordan en forhandler beskriver bilen kunden vil ha, og hvordan Merovo forklarer treffene. **All informasjon i demoen er syntetiske demodata, ikke ekte annonser eller leverandørdata**, og innkjøpskostnad er ikke beregnet. Tilgangen er personlig og privat; vennligst del den ikke videre.
>
> Gi meg beskjed hvis innloggingen ikke fungerer, eller hvis du ønsker flere brukere fra <organisasjon>.
>
> Vennlig hilsen
> Christian

## 8. Live-demo, 5 minutter
| Tid | Gjør | Si |
|---|---|---|
| 0:00 | Åpne `demo.merovo.eu`, logg inn → `/searches` | «Local demand. European supply. Forhandlere vet hvilke biler kundene vil ha. Merovo finner dem i Europa.» Pek på etiketten: «Alt her er syntetiske demodata.» |
| 0:45 | Pek på flytstripen (Etterspørsel → Merovo søker → Kildeannonse → Selger) | «Slik tenker vi modellen. I demoen er søk mot syntetiske annonser; selger er ikke tilkoblet.» |
| 1:15 | «Nytt søk» → start fra «Demosøk som gir treff (BMW 3-serie)» | Forklar krav («må ha») og ønsker («ønskelig»). Endre én verdi (f.eks. kilometer). Lagre → «lagret, versjon 1/2». |
| 2:15 | «Prøv med demodata» | Tre grupper: Oppfyller kravene / Må kontrolleres / Oppfyller ikke kravene. «Må kontrolleres er ikke feil: kilden oppgir ikke alt.» |
| 3:00 | Åpne ett treff med «Vis forklaring» | «Hvorfor vist» først; krav og ønsker adskilt; ukjent er ukjent, ikke «ikke oppfylt». Annonsepris ≠ innkjøpskostnad (ikke beregnet). |
| 4:00 | «Se detaljer» på ett treff, og ett som «Må kontrolleres» | Kjeden etterspørsel → annonse → selger; hva som mangler i annonsen. |
| 4:40 | Logg ut / avslutt | «Neste steg er ekte kildedata og beregning av innkjøpskostnad — ikke en del av dagens demo.» Ikke lov noe om partnerskap, tilgang til leverandørdata eller datoer. |
Unngå: å påstå live data, samarbeid med navngitte leverandører/OEM-er, beregnet lønnsomhet eller avgifter.

## 9. Etter demoen
Noter tilbakemelding; deaktiver eller slett kontoen når piloten er over (Supabase-dashboardet); fjern firmaet ved behov (egen operasjon, ikke beskrevet her). Ikke gjenbruk kontoer.
