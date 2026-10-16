# BUS-002 — beslutningsgrunnlag: datamodell og operativ modell for eksterne markedsdata

Dato: 08.10.2026 · Status: **PRINSIPPET GODKJENT 08.10.2026** (DEC-028). DEV-005B0 er opprettet og levert til REVIEW; DEV-005B forblir BLOCKED på provider-avklaringer. Resten av dokumentet (anbefalinger per fase, spørsmål til markedsplassene) er fortsatt beslutningsgrunnlag, ikke vedtatt · Eier: Christian · Relaterer: BUS-001, BUS-002, OPEN-001, OPEN-002, OPEN-006, DEC-015, DEC-026, FU-005-1, DEV-005A, DEV-005B, DEV-006

## 0. Hvordan fakta er merket

| Merke | Betydning |
|---|---|
| **[REPO]** | Står i repoets dokumenter (S01/S02 i `SOURCES.md`, `MOBILE_DE_INTEGRATION.md`) og er kontrollert mot dem 03.10.2026. |
| **[OPPGITT]** | Oppgitt av Christian i dette oppdraget. **Ikke** kontrollert mot primærkilde, og ikke funnet i repoet. Må bekreftes skriftlig før det brukes som rettighet. |
| **[UKJENT]** | Ikke avklart. Behandles som **ikke tillatt** (default-deny) i all design. |
| **[ANALYSE]** | Min vurdering/utledning. Ikke et faktum om en leverandør. |

Ingen rettigheter er funnet på. Der en leverandørs vilkår ikke er kjent, står det UKJENT, og løsningen skal ikke anta noe annet. OEM-kilder: repoet inneholder **ingen** opplysninger om OEM-kilder; alt om dem er UKJENT.

## 1. Executive summary

1. **Ikke bygg DEV-005B (global `listings`/`listing_revisions`) nå.** Hele modellen forutsetter rett til persistent lagring og gjenvisning på tvers av kunder. Den eneste kjente opplysningen om mobile.de på dette punktet er [OPPGITT]: *Light* = midlertidig lagring maks 30 min, *Professional* = lagring opptil 90 dager pluss visse anonymiserte data under kontrakt. Ingen av dem gir (så vidt kjent) full permanent lagring, og ingen er bekreftet for multi-dealer-bruk (spørsmål 1 i `MOBILE_DE_REQUEST.md`).
2. **Anbefaling: en rettighetsstyrt (policy-drevet) datamodell, ikke en av A/B/C slik de står.** Lagringspolicy er data per provider (en versjonert *rights profile*), ikke en global antakelse. Hver lagret rad bærer `provider`, `rights_profile_version` og `expires_at`. Ukjent eller utløpt profil blokkerer lagring (samme prinsipp som CLAUDE.md pkt. 5). Da kan samme kode støtte «30 min», «90 dager» og «full lagring» samtidig.
3. **Start med A + B (dagens DEV-005A) som MVP/pilot**, men **før en ekte provider kobles til må DEV-005A få retensjon**: i dag lagrer `search_run_results` minimale utdrag (merke, modell, årsmodell, km, drivstoff, pris m.m.) **uten utløp**. Mot en provider med 30 min-grense ville det trolig være brudd. Mot syntetisk provider er det uproblematisk. **[ANALYSE]** — se §6.4 og §9.
4. **Skalering er først og fremst et forespørselsproblem, ikke et lagringsproblem.** Regneeksempel (kun aritmetikk på [OPPGITT] 10 000 forespørsler/mnd inkludert): med polling hvert 30. minutt bruker *én* agent 48 × 30 = 1 440 forespørsler/mnd, så 10 000 dekker omtrent 7 agenter, ikke 50 (5 piloter × 10). Ved 5–10 000 aktive agenter er per-agent-polling umulig; det krever delt, dedupet innhenting per kanonisk spørring. **Men** om én kundes henting kan brukes til flere kunder er uavklart (spørsmål 1) og avgjør om skalering er lovlig i det hele tatt.
5. **DEV-005B kan starte** (delt katalog) først når minst én provider har skriftlig bekreftet: (a) multi-dealer-bruk, (b) lagringstid ≥ 90 dager (eller annen definert), (c) gjenvisning/alerts, og når FU-005-1 (betrodd serverside skriving) er designet. En liten, provider-nøytral **DEV-005B0** (rettighetsprofil + retensjon/utløp + slettejobb + betrodd skriveveg, uten global katalog) kan godkjennes tidligere og er nyttig i alle utfall. Se §9.

## 2. Datamodellene som sammenlignes

| | Modell A — minimal / transient | Modell B — per-run snapshots (DEV-005A i dag) | Modell C — shared ingestion |
|---|---|---|---|
| Kort | Data brukes under søk/vurdering; ingenting (eller kun minimalt) lagres | Hver søkekjøring lagrer et minimalt utdrag per treff, tenant-isolert | Global `listings` + `listing_revisions`, stabil source-identitet, dedup på tvers, sjekkpunkter, server-only ingestion |
| Lagres | Kun beslutningsrelevant utfall (f.eks. «annonse X traff agent Y kl. T»), eller ingenting | `search_runs` + `search_run_results` (≤ 8 kB/rad, ingen annonsetekst/selgerby), per firma | Hele normaliserte annonser og revisjoner, globalt |
| Eier av dataene i praksis | Provider | Provider (kopi per kjøring) | Merovo har en egen katalog av providerdata |
| Allerede bygget | Nei | **Ja** (DEV-005A) | Nei (DEV-005B, BLOCKED) |

## 3. Sammenligning A / B / C

Skala: ✔ gunstig / ◐ avhenger / ✘ uheldig. «Rettighet kreves» betyr at modellen bare er lovlig hvis leverandøren har bekreftet det; ellers gjelder default-deny.

| Dimensjon | A — transient | B — per-run snapshots | C — shared ingestion |
|---|---|---|---|
| **Provider-vilkår** | ✔ Passer strengeste vilkår (f.eks. [OPPGITT] 30 min). Krever bare rett til å søke og vise. | ◐ Kopier lagres per kjøring. Krever lagringsrett, og retensjon må kunne settes. **Mangler i dag.** | ✘ Krever bekreftet persistent lagring **og** gjenbruk på tvers av kunder. Strengest. |
| **Tillatt lagringstid** | ✔ Minutter, eller bare det som trengs i en visning | ◐ Må begrenses med `expires_at` (30 min / 90 d / ubegrenset per provider). Ikke implementert. | ◐ Samme krav, men gjelder alle revisjoner. Revisjonshistorikk >retensjon er forbudt for korttidsprovidere. |
| **Bilder** | ✔ Ev. vise direkte fra kilde uten lagring (hvis visning er tillatt) | ◐ Lagrer ingen bilder i dag. Bildelagring krever egen rett. | ✘ Bildekatalog = lagring + gjenvisning; dyrt og mest rettighetsfølsomt |
| **Annonsetekst** | ✔ Behandles kun i minnet | ✔ Lagres **ikke** i dag (utdraget har ingen tekst) | ✘ Tekst i `normalized_data` krever lagrings- og LLM-rettighet; kan inneholde personopplysninger |
| **Priser** | ✔ Hentes ved behov | ◐ Pris som tekst i utdrag; må følge retensjon | ◐ Prishistorikk er en kjerneverdi, men krever rett til historikk (spørsmål 3) |
| **Seller/dealer-data** | ✔ Ikke lagret | ✔ Bare selgertype/land i utdraget (ikke by/navn/kontakt) | ✘ Fristende å lagre; personopplysninger for private selgere |
| **Revisjoner** | ✘ Ingen | ✘ Bare «det kjøringen så»; ingen sammenheng mellom kjøringer | ✔ Full historikk (hvis lovlig) |
| **Dedupe** | ◐ Bare innen ett kall | ◐ Innen én kjøring; ingen på tvers (samme annonse dukker opp i hver kjøring) | ✔ Globalt og på tvers av agenter/firma |
| **Alerts** | ✘ «Ny siden sist» kan ikke avgjøres uten minne. Kan løses med minimal «sett-før»-liste (kun ID + hash), hvis det tillates | ◐ Kan sammenligne kjøring mot forrige kjøring i samme firma, men bare innenfor retensjon | ✔ Best grunnlag (først-sett, prisfall). Gjenvisning i e-post er egen rettighet (spørsmål 5) |
| **Scheduler** | ◐ Må evaluere umiddelbart ved henting; ingenting å «ta igjen» | ◐ Per-agent-kjøring; **forbruker forespørsler lineært med antall agenter** | ✔ Én henting kan mate mange agenter (hvis multi-tenant bruk er lovlig) |
| **Historical analysis** | ✘ | ✘ Kun per firma og kort | ✔ Bare innenfor retensjon/avtale (anonymisert historikk er et eget avtalepunkt) |
| **Margin calculations** | ✔ Beregnes ved visning fra ferske data | ✔ Beregnes fra lagret utdrag (DEC-027; ingen beregning bygget ennå) | ✔ Immutable kalkylesnapshot mot revisjon. **Kalkyler som inneholder providerpris kan regnes som avledede data (spørsmål 7).** |
| **Valuation** | ✘ Mangler sammenligningsgrunnlag | ✘ Lite grunnlag | ◐ Krever stort lagret grunnlag; mest sårbart for «ikke bruk til konkurrerende verdivurdering»-type vilkår (UKJENT) |
| **AI/LLM-behandling** | ◐ Send kun i øyeblikket, hvis tillatt; cache umulig | ◐ Ingen tekst lagret ⇒ ingenting å analysere senere | ◐ Cache på revisjon+prompt+modell er designet i ARCHITECTURE, men krever rett til lagring **og** tredjepartsbehandling (spørsmål 6) |
| **Tenant isolation** | ✔ Ingenting delt | ✔ Alt per firma, RLS + FK (testet) | ◐ Delt global tabell. Må ikke være lesbar direkte for brukere; tilgang via tenant-scoped treff/kalkyler. Større angrepsflate |
| **GDPR / personvern** | ✔ Minimalt | ✔ Lite (ingen tekst/kontakt) | ✘ Størst: private selgere, fritekst med telefonnr./navn, bilder; sletting, innsyn, oppbevaringsplikt, databehandleravtaler |
| **Sikkerhet** | ✔ | ◐ **Klienten kan skrive egne resultatrader (FU-005-1)** | ◐ Krever server-only skriveveg, secrets, jobbisolasjon, signering av ingestion |
| **Databasekost** | ✔ Ingen | ◐ Vokser lineært: ≤ 8 kB × rader (øvre grense fra CHECK-constraint) × kjøringer × agenter. Uten retensjon: ubegrenset | ◐ Vokser med katalog × revisjoner. Dedup reduserer, historikk øker. Bilder kan dominere (ikke estimert) |
| **Kompleksitet** | ✔ Lavest | ✔ Ferdig | ✘ Høyest: lås, sjekkpunkt, revisjon, purge, rettighetslag, backfill |
| **Migrasjonsrisiko** | ✔ | ◐ A→B er enkel (finnes). B→C: eksisterende snapshots har ingen stabil katalog-ID (kun `content_hash` + `source_listing_id`), så de kan ikke trygt «oppgraderes» | ✘ C→B/A (nedgradering ved strengere vilkår) betyr sletting/rekonstruksjon; krever partisjonering per provider for billig purge |
| **Vendor lock-in** | ✔ | ◐ Moderat: normalisert modell + provider-feltene `source`/`provider` | ✘ Høyest: katalogen *er* leverandørdata; ved avtalebrudd må den slettes (verdi forsvinner) |

### 3.1 Hva tabellen sier i klartekst

- **A** er den eneste modellen som er trygg under strengeste kjente vilkår, men gir ikke «ny siden sist», prisfall, historikk eller verdivurdering.
- **B** er allerede bygget og trygg på tenant-isolasjon, men er **ikke retensjonsstyrt** og skalerer dårlig på forespørsler (en kjøring per agent).
- **C** gir produktverdien (dedup, historikk, delt henting, alerts) men er den eneste som **forutsetter** at leverandøren tillater persistent lagring, gjenbruk på tvers av kunder og historikk. Disse tre er per nå UKJENT for alle kilder.

## 4. Provider rights matrix (standardmal)

Fylles ut **én gang per kilde og kontraktsversjon**. Hvert felt har en verdi fra en fast skala og en kilde (dokument + dato + hvem som verifiserte). **Blankt/UKJENT = ikke tillatt.** Matrisen blir grunnlaget for `provider_rights_profiles` (§6).

| # | Felt | Hva som registreres | Tillatte verdier |
|---|---|---|---|
| 1 | provider | Navn + kontraktsentitet | tekst |
| 2 | API / feed / sandbox | Kanaltype og miljø | `api`, `feed`, `sandbox`, `scrape-forbidden` |
| 3 | search allowed | Søk på kriterier tillatt for vår bruk | ja / nei / vilkår |
| 4 | automated polling allowed | Planlagt, ikke-brukerutløst henting | ja / nei / min. intervall |
| 5 | caching allowed | Mellomlagring (kort, teknisk) | nei / TTL i sekunder |
| 6 | storage allowed | Lagring ut over cache | ingen / tidsbegrenset / permanent |
| 7 | retention period | Maks lagringstid | sekunder/dager; ev. «inntil kontraktsslutt»; krav om sletting ved bortfall av annonse |
| 8 | image storage | Lagre bildefiler | nei / TTL / ja |
| 9 | image display | Vise bilder (egen CDN vs. hotlink) | nei / hotlink / egen kopi |
| 10 | text storage | Lagre annonsetekst | nei / TTL / ja |
| 11 | price storage | Lagre pris og prishistorikk | nei / TTL / ja / historikk-vilkår |
| 12 | seller data storage | Selgernavn, kontakt, adresse | nei / kun type og land / ja |
| 13 | redisplay rights | Vise til flere kunder / gjenvise senere | nei / egen kunde / alle kunder |
| 14 | alerting allowed | E-post/push med innhold | nei / kun lenke / minimalt innhold / fullt innhold |
| 15 | AI/LLM processing allowed | Tredjeparts LLM, region, underleverandører | nei / ja med vilkår (personopplysninger fjernes?) |
| 16 | geographic restrictions | Land for kunder/brukere, behandlingssted | tekst |
| 17 | attribution / linkback | Krav til logo, kildeangivelse, lenke til original | tekst |
| 18 | commercial fee | Fast avgift, volumavgift, minimumsbinding | beløp/valuta/MVA |
| 19 | request limits | Per mnd/døgn/sekund, overforbruksregel | tall + regel |
| 20 | contract notes | Avledede data, sletting ved opphør, revisjonsrett, versjon | tekst + versjon |

### 4.1 Første utfylte eksempel: mobile.de

| # | Felt | Verdi | Status |
|---|---|---|---|
| 1 | provider | mobile.de (Search API) | [REPO] |
| 2 | API / feed / sandbox | API, Basic auth med serverlagrede credentials; JSON `application/vnd.de.mobile.api+json`; `GET /search-api/search`, `GET /search-api/ad/{ad-key}` | [REPO] |
| 2b | sandbox | Sandbox har **ingen ekte forhandler-/kjøretøydata** | [OPPGITT] |
| 3 | search allowed | Teknisk ja. Search API er **kommersielt**. Tillatelse og pris for Merovo som betalt multi-dealer-tjeneste er **ikke avklart** | [REPO] (teknisk) / [UKJENT] (kommersiell rett) |
| 4 | automated polling allowed | Ikke bekreftet. Planlagt målsetting «hver 30. min» står i forespørselen, og «avhenger av tillatt bruk og kvoter» | [UKJENT] |
| 5 | caching allowed | *Light:* midlertidig lagring **maks 30 min**. *Professional:* se 6 | [OPPGITT] |
| 6 | storage allowed | *Light:* kun midlertidig (se 5). *Professional:* lagring opptil 90 dager | [OPPGITT] |
| 7 | retention period | *Light:* 30 min. *Professional:* opptil 90 dager, **pluss visse anonymiserte data beholdt under kontrakt** (omfang/definisjon ukjent). Sletting ved bortfall av annonse/avtale: ikke avklart | [OPPGITT] / [UKJENT] (detaljer) |
| 8 | image storage | – | [UKJENT] |
| 9 | image display | – | [UKJENT] |
| 10 | text storage | – | [UKJENT] |
| 11 | price storage | – (historiske pris-/annonse-revisjoner er et eget spørsmål) | [UKJENT] |
| 12 | seller data storage | – | [UKJENT] |
| 13 | redisplay rights | Multi-dealer-bruk (flere betalende kunder) er **spørsmål 1**, ubesvart | [UKJENT] |
| 14 | alerting allowed | E-post med annonse-/avledede data er **spørsmål 5**, ubesvart | [UKJENT] |
| 15 | AI/LLM processing | Behandling hos tredjeparts LLM er **spørsmål 6**, ubesvart | [UKJENT] |
| 16 | geographic restrictions | – | [UKJENT] |
| 17 | attribution / linkback | Brukeren skal følge lenke til original annonse i vår tjenestebeskrivelse; leverandørens **krav** er ikke avklart | [UKJENT] |
| 18 | commercial fee | Basisavgift **EUR 990/mnd + MVA**. (Uklart om beløpet gjelder Light, Professional eller begge.) Oppstart/minimumsbinding/oppsigelse ikke kjent | [OPPGITT] / [UKJENT] |
| 19 | request limits | **10 000 forespørsler/mnd inkludert.** Pris/regel ved overforbruk: ukjent. Teknisk grense: maks 2 000 annonser per søk (paging) | [OPPGITT] / [REPO] (2 000) |
| 20 | contract notes | API-credentials alene består ikke Gate A. Avledede/historiske data og sletting ved opphør: ikke avklart | [REPO] / [UKJENT] |

### 4.2 Andre kilder og OEM

Samme mal fylles ut per kilde. Repoet har ingen opplysninger om OEM-kilder, andre markedsplasser eller deres vilkår; **alle** felt er UKJENT inntil skriftlig svar. Ingen OEM-kilde skal antas å tillate mer enn «søk og vis» uten bekreftelse.

## 5. Beslutningsrammeverk: anbefalt arkitektur etter fase og rettighetsnivå

### 5.1 Tre faser

| Fase | Anbefaling |
|---|---|
| **1. MVP / pilot** (≤ 5 firma, ≤ 50 agenter) | **A + B med retensjon.** Behold DEV-005A. Legg til `expires_at`/slettejobb og rettighetsprofil før ekte provider. Ingen global katalog. Belastning på forespørsler må dimensjoneres: 50 agenter × polling hvert 30. min = 72 000/mnd (aritmetikk) mot [OPPGITT] 10 000. Pilot må derfor bruke lavere frekvens, brukerutløste søk, og/eller delte spørringer — og **hvis** deling mellom firma er tillatt. |
| **2. 5–10 000 aktive agenter** | **C-lite: delt, dedupet innhenting per kanonisk spørring** (ikke per agent), bak rettighetsprofiler. Persistensen avgjøres av providerens nivå (§5.2). Per-agent-polling er ikke gjennomførbart under noen kjent forespørselskvote. |
| **3. Senere multi-source production** | **Full policy-drevet modell (C med provider-partisjoner)**: kanonisk modell, provider-adaptere, rights profiles, partisjonert lagring per provider, kilde-uavhengig dedup *innen* hver provider (ingen usikker kryss-marked VIN-dedup i MVP, jf. DATABASE_SCHEMA), egen betrodd ingestion-tjeneste. |

### 5.2 Hva vi starter med per rettighetsnivå (kan gjelde samtidig for ulike providers)

| Hvis provider tillater… | Arkitektur | Det som lagres | Det som *ikke* kan gjøres | Praktisk konsekvens |
|---|---|---|---|---|
| **Kun 30 min cache** (mobile.de *Light*, [OPPGITT]) | **A, med korttids B.** Hent → vurder → vis innen 30 min. Alle lagrede providerfelt får `expires_at ≤ observed_at + 30 min`. Lagre utover det kun det rettighetene tillater (UKJENT; anta ingenting). | Egne data: agenter, forutsetninger, brukervalg. Av providerdata: bare innen TTL. | Prishistorikk, revisjoner, «først sett»-historikk, valuation på lagrede data, e-postvarsler med innhold som overlever 30 min, LLM-cache utover TTL | Alert må evalueres ved henting; varsel bør være **lenke + minimal tekst** til appen. Brukerutløst og kort-intervall-søk dominerer. Delt katalog er meningsløs. |
| **90 dager** (mobile.de *Professional*, [OPPGITT]) | **B → C-lite.** Delt `listings`/`listing_revisions` med `expires_at ≤ observed_at + 90 d`, partisjonert per provider for billig purge. «Visse anonymiserte data» beholdes kun slik kontrakten definerer det. | Normaliserte annonser/revisjoner opptil 90 d; avledede kalkyler følger samme utløp inntil kontrakt sier annet | Historikk eldre enn 90 d; ubegrenset analyse; alt UKJENT under punkt 8–17 til bekreftet | Prisfall/«ny siden sist» innen 90 d er mulig. Egen anonymiseringsprosess må defineres **før** noe beholdes utover 90 d. |
| **Full persistent lagring** | **C** (full), fortsatt med rights profile per provider og kontraktsstyrt slettepolicy | Alt kontrakten tillater, inkl. revisjoner; bilder/tekst bare hvis eksplisitt tillatt | Gjenvisning/LLM/alert utover det kontrakten sier | Dette er først da DEV-005B (slik den er skrevet) er riktig. Fortsatt provider-spesifikk lagringspolicy fordi andre kilder kan være strengere. |

**Viktig:** disse tre skal kunne eksistere i samme database samtidig. Derfor foreslås ikke én global lagringsantakelse (§6).

## 6. Anbefalt MVP-arkitektur

### 6.1 Prinsipper

1. **Default-deny:** manglende, ikke-verifisert eller utløpt rights profile ⇒ ingen lagring og ingen alerts/LLM for den kilden (jf. CLAUDE.md pkt. 5). Sandbox/syntetiske data har egen profil «demo».
2. **Policy er data, ikke kode:** `ProviderRightsProfile` er versjonert, har kilde (kontraktdokument), effektiv-dato, verifisert-av. Endring gir ny versjon; gamle rader beholder sin `rights_profile_version`.
3. **Minimer ved skriving:** serverlaget projiserer annonsen gjennom profilen (`project(listing, profile)`) *før* persistens. Tekst, bilder, selgerdata og prishistorikk droppes hvis profilen ikke tillater dem. Dagens `projectSnapshot` er en tidlig form av dette.
4. **Alt som lagres har livsløp:** `expires_at` er `NOT NULL` for all providerdata; slettejobb fjerner utløpt; databasen avviser rader hvis `expires_at` overstiger profilens maks.
5. **Ingen providerdata uten spor:** `provider`, `rights_profile_version`, `observed_at`, `expires_at`.
6. **Betrodd skriveveg (FU-005-1):** kun server-side (ikke brukerens Data API-rettigheter) kan opprette og ferdigstille autoritative resultater. Ingen credentials i klienten. Konkret mekanisme (begrenset DB-rolle, edge function, jobbtjeneste) er et eget designvalg som **ikke** er tatt her.
7. **Tenant-eide data skilles fra providerdata:** agenter, forutsetninger, brukervalg og notater er Merovos/kundens egne data og påvirkes ikke av providerens retensjon.

### 6.2 MVP-komponenter

| Komponent | MVP-valg |
|---|---|
| Datamodell | A + B (dagens DEV-005A) + retensjon + rights profile for hver aktiv provider |
| Provider | Syntetisk (demo-profil); mobile.de bare etter svar på BUS-002 og med profil |
| Innhenting | Brukerutløst søk + lavfrekvent, **delt** planlagt henting kun hvis flerkundebruk er bekreftet; ellers per-kunde med lav frekvens |
| Varsler | Lenke + minimal tekst som standard; fullt innhold bare hvis profilen sier `alert: full` |
| LLM | Av for ekte providerdata til profilen sier ja; syntetiske data uberørt |
| Sletting | Daglig slettejobb + «kill switch» per provider (stopp og slett) |

### 6.3 Hva som ikke bygges i MVP

Global katalog, revisjonshistorikk på tvers av kjøringer, bildelagring, tekstlagring, verdivurdering fra lagret historikk, kryss-marked-dedup.

### 6.4 Nødvendig endring i DEV-005A før ekte provider **[ANALYSE]**

`search_run_results` har i dag ingen utløpsdato, og `listing_snapshot` inneholder pris, spesifikasjoner og kilde-ID. Hvis en provider kun tillater 30 min, må disse radene slettes/utløpe etter 30 min, og historikksiden («Søkekjøringer») kan bare vise antall og metadata etter utløp. Det er en liten migrasjon + slettejobb + UI-tekst, og hører til DEV-005B0 (§9). **Ikke gjort her.**

## 7. Anbefalt production-arkitektur

```
Provider-adaptere (mobile.de, OEM-kilder, …)   ← normaliserer til kanonisk modell
        │  (kun server, betrodd ingestion-tjeneste; credentials aldri i klient)
        ▼
Rights gate  ←── provider_rights_profiles (versjonert, verifisert, default-deny)
        │   project(listing, profile): fjerner felt som ikke kan lagres
        ▼
Lagring partisjonert per provider
   provider_A (TTL 30 min)   provider_B (90 d)   provider_C (permanent)
   expires_at + rights_profile_version på hver rad
        │
        ├── Matcher/dedup (innen provider) → tenant-scopede treff (opportunities)
        ├── Kalkyle (immutable snapshot; arver utløp fra input hvis avledet)
        └── Varsel-outbox (innhold begrenset av profil)
        ▼
Tenant-lag: RLS, brukeren leser aldri global tabell direkte
```

Kjerneideer:

- **Partisjoner per provider** (liste-partisjonering eller egne skjemaer): avtaleopphør = `DROP PARTITION`, ikke tung `DELETE`. Reduserer også lock-in-risiko: leverandørdata er isolert.
- **Delt innhenting, tenant-scopet visning:** global tabell er ikke lesbar for `authenticated`. Brukere leser bare tenant-scopede treff/kalkyler som inneholder det profilen tillater å vise.
- **Kjøringskø med lås per kanonisk spørring**, ikke per agent: én henting mater mange agenter (hvis tillatt). `agent_locks`/sjekkpunkter ligger her (DEV-005B/DEV-013).
- **Avledede data følger input:** kalkyler som inneholder providerdata får samme eller kortere utløp, med mindre kontrakten sier at avledede tall kan beholdes.
- **Observabilitet:** forbruk mot kvote per provider/mnd, truncation (2 000-grensen), policy-avvisninger (rader som ble droppet pga. profil).

## 8. Foreslåtte databasekonsekvenser (forslag, ikke implementert)

| Område | Forslag |
|---|---|
| `provider_rights_profiles` | `provider`, `version`, `effective_from/to`, `source_ref`, `verified_by/at`, `status` (draft/verified/expired), felt for hver matriserad (f.eks. `storage_mode` none/ttl/permanent, `retention_seconds`, `allow_text`, `allow_images`, `allow_price_history`, `allow_seller_data`, `allow_redisplay_scope`, `allow_alert_level`, `allow_llm`, `min_poll_interval`, `attribution`) |
| Alle providerdata-tabeller | `provider`, `rights_profile_version`, `observed_at`, `expires_at NOT NULL`; trigger/CHECK: `expires_at <= observed_at + profile.retention` og avvis hvis profil ikke er `verified`/gyldig |
| `listings` / `listing_revisions` (DEV-005B) | Partisjonert per `provider`; unique `(provider, source_listing_id)` og `(listing_id, content_hash)`; **ingen** brukerrettigheter direkte; `normalized_data` projiseres av rights gate |
| `search_run_results` (DEV-005A) | Legg til `expires_at`, `provider`, `rights_profile_version`; slettejobb. Senere: fjern bruker-INSERT og la betrodd tjeneste skrive (FU-005-1) |
| Slettejobb | Periodisk `delete … where expires_at < now()` (eller drop av partisjon) + revisjonslogg uten providerdata (kun tellere) |
| Kill switch | `provider_status` (active/suspended/terminated) som alle skrive- og lesestier sjekker |
| Tenant-treff | `opportunities`/`calculations` som i DATABASE_SCHEMA, men med `source_expires_at` som styrer visning av providerfelt |
| Kostnad (kvalitativt) | Lagring følger `radantall × radstørrelse`; øvre grense per snapshotrad er 8 kB (CHECK). Partisjonering og TTL begrenser veksten; bilder/tekst er de store postene hvis noen gang tillatt. Ingen tall er estimert fordi volum og rettigheter er ukjente. |

**Migrasjonsrisiko:** rights-kolonnene bør finnes *før* første global tabell opprettes (å legge dem på etterpå er en datamigrering på ukjent volum). Eksisterende `search_run_results` kan få kolonnene med en backfill (`expires_at = created_at + retention`), siden alle nåværende rader er syntetiske.

## 9. Anbefaling: når kan DEV-005B starte?

| Trinn | Innhold | Forutsetning | Anbefaling |
|---|---|---|---|
| **DEV-005B0** (forslag til nytt, lite trinn) | Rights profile-tabell + retensjon/`expires_at` på DEV-005A + slettejobb + kill switch + betrodd skriveveg (FU-005-1), **uten** global katalog | Godkjenning av dette dokumentet (§10). **Ikke** avhengig av kontraktssvar | **Kan starte etter godkjenning.** Nyttig i alle utfall og påkrevd før ekte data. |
| **DEV-005B** (shared catalog, `listings`, `listing_revisions`, sjekkpunkter, låser) | Slik beskrevet i backlog | Skriftlig svar fra minst én provider på: multi-kundebruk, lagringstid ≥ 90 d (eller annen definert), revisjoner/prishistorikk, gjenvisning/alerts. Utfylt rights matrix og vedtatt rights profile. B0 ferdig. | **Ikke start før dette.** Ved kun 30 min: bygg **ikke** B; bruk A + B0. |
| **DEV-006** (MobileDeProvider) | Adapter | BUS-002 (Gate A), konto, rights profile for mobile.de | Etter svar. Kan bygges mot profil som tillater minst mulig. |

Hvis svaret blir «bare 30 min»: DEV-005B skrives om til «transient ingestion» (ingen katalog). Hvis «90 d»: C-lite med TTL. Hvis «full»: C som beskrevet. **Backlog-endring (forslag):** `DEV-005B0` BACKLOG, `DEV-005B` forblir BLOCKED på BUS-002 + utfylt matrix.

## 10. Beslutningspunkter OPEN-001 / OPEN-002

### OPEN-001 — «Godkjennes paid multi-dealer service, caching, bilder, varsler og LLM-behandling?»

Beslutninger Christian må ta (basert på svar fra markedsplassene):

| # | Beslutning | Alternativer | Min anbefaling |
|---|---|---|---|
| 1 | Skal Merovo selges som delt tjeneste til flere forhandlere på samme providerkonto? | Ja (krever skriftlig rett) / Nei, én konto per kunde / Pilot kun med én kunde | Ikke gå live før skriftlig svar. Pilot kan kjøres med færrest mulige kunder inntil svar. |
| 2 | Lagring | 30 min / 90 d / permanent / ingen | Design for default-deny; åpne per provider |
| 3 | Bilder | Ikke lagre / hotlink / egen kopi | Hotlink eller ingen i MVP; ingen lagring før skriftlig rett |
| 4 | Tekst | Ikke lagre / lagre | Ikke lagre i MVP (også personvern) |
| 5 | Varsler | Lenke bare / minimalt innhold / fullt innhold | Lenke + minimal tekst som standard |
| 6 | LLM | Av / på med vilkår | Av for ekte providerdata til skriftlig bekreftet |
| 7 | Hvem er behandlingsansvarlig/databehandler | Se OPEN-006 | Avklares før pilot med ekte data |

### OPEN-002 — «Hva koster datatilgang, hvilke kvoter og hvilken forventet behandlingstid?»

| # | Beslutning | Kjente tall | Mangler |
|---|---|---|---|
| 1 | Nivå (Light/Professional) | [OPPGITT] 30 min vs. 90 d + anonymiserte data | Hvilket nivå koster EUR 990/mnd? Pris for det andre? |
| 2 | Månedlig kostnad | [OPPGITT] EUR 990/mnd + MVA | Oppstart, binding, oppsigelse, valuta/MVA-behandling for norsk kjøper |
| 3 | Kvote | [OPPGITT] 10 000/mnd inkludert; teknisk 2 000 annonser per søk [REPO] | Overforbrukspris, søk- vs. detaljkall regnes likt?, per-sekund-grenser |
| 4 | Polling | Mål «hver 30. min» (ikke bekreftet) | Tillatt intervall |
| 5 | Behandlingstid/aktivering | Ukjent | Forventet aktiveringstid, testkonto med representative data |
| 6 | Budsjettramme | Ikke fastsatt | Christian må sette tak før valg av nivå |

Kvotens konsekvens (aritmetikk, 30 dager): 10 000/mnd ≈ 333 forespørsler/døgn ≈ 14/time totalt for alle agenter samlet. Én agent med 30-min polling bruker 48/døgn (1 440/mnd), så kvoten rekker til ca. 6,9 agenter. Forutsetter ett kall per poll; om detaljkall for treff teller med er UKJENT.

## 11. Spørsmål som fortsatt må sendes til markedsplassene

Utvidelser utover de 7 punktene i `MOBILE_DE_REQUEST.md` (som fortsatt ikke er sendt). **Til mobile.de:**

1. Hvilket produktnivå (Light/Professional) gjelder for EUR 990/mnd, og hva koster det andre? Hva er forskjellen i rettigheter, skriftlig?
2. Hva betyr «midlertidig lagring maks 30 min» presist? Gjelder det også et utdrag (id + hash + pris), avledede tall, og logger/backups?
3. Hva menes med «visse anonymiserte data» under Professional? Hvilke felt, hvilken anonymisering, hvor lenge, og kan de brukes til prishistorikk/verdivurdering?
4. Kan én API-konto betjene flere uavhengige norske forhandlere (multi-tenant), og kan én henting vises til flere kunder? Er det en bestemt partnermodell?
5. Tillatt pollingintervall og forbruk; telles søk og detaljkall likt; hva skjer ved overforbruk?
6. Bilder: kan vi vise (hotlink/egen CDN), lagre, eller bare lenke? Tekst: kan vi vise/lagre/utlede strukturerte data fra?
7. Seller-data (navn, kontakt, adresse, privat vs. forhandler): hva kan vi lagre/vise, og hva er personvernroller (behandlingsansvarlig/databehandler)?
8. E-postvarsler: innholdsnivå (kun lenke, minimalt, bilder, priser, avledede tall)?
9. LLM: tillatt med tredjepart, hvilke data, behandlingssted (EØS?), underleverandører, krav om fjerning av personopplysninger?
10. Sletting: ved bortfall av annonse, ved kontraktsopphør, og på forespørsel; frist og bevis?
11. Avledede data (kalkyler, scorer, prisstatistikk): eier og viderebruk, også etter opphør?
12. Attribution/linkback: obligatorisk logo/kildeangivelse/lenketekst/utseende?
13. Geografiske begrensninger: kunder i Norge (utenfor EU), behandling utenfor EØS?
14. Revisjonsrett og audit av vår bruk; hva logger de?
15. Sandbox: finnes representative testdata (sandbox har ellers ingen ekte forhandler-/kjøretøydata, [OPPGITT])?

**Til hver OEM-/annen kilde:** hele matrisen i §4 (alle 20 felt), skriftlig, med kontraktsversjon. Kartlegg først hvilke kanaler de faktisk tilbyr (API/feed/portal); ingen kanal og ingen rettighet er antatt.

## 12. Risikoer og åpne forhold

| Risiko | Konsekvens | Tiltak |
|---|---|---|
| DEV-005A-snapshots uten utløp | Mulig brudd på korttidsprovider | DEV-005B0 før ekte provider |
| Klienten kan skrive egne resultatrader (FU-005-1) | Resultater ikke autoritative | Betrodd skriveveg i DEV-005B0 |
| Kvote vs. antall agenter | Uholdbar per-agent-polling | Delt innhenting per kanonisk spørring (krever rettigheten i spørsmål 4) |
| Bygge C før rettigheter er avklart | Må rives/slettes | Ikke start DEV-005B før §9-vilkår |
| Personopplysninger i fritekst/selgerdata | GDPR-risiko, DPA-behov | Ikke lagre tekst/selgerdata i MVP; juridisk vurdering før pilot med ekte data (OPEN-006) |
| Pris/vilkår endres | Modellen låses | Rights profile er versjonert; partisjoner per provider |

Dette dokumentet er ikke juridisk rådgivning. Personvern- og avtalejuridiske vurderinger (GDPR, behandlingsansvar, avledede data) bør bekreftes av jurist før pilot med ekte data.

## 13. Neste steg (krever Christians godkjenning)

1. Send `MOBILE_DE_REQUEST.md` (utvidet med §11) — Christian eier BUS-001/BUS-002.
2. Godkjenn eller avvis prinsippet «provider-spesifikk, rettighetsstyrt lagring» (§6.1) og forslaget om **DEV-005B0** (§9).
3. Fyll ut rights matrix (§4) for mobile.de når svar foreligger; vedta rights profile.
4. Først deretter: beslutning om DEV-005B-variant (transient / C-lite 90 d / C full).

**DEV-005B er ikke startet og forblir BLOCKED.**
