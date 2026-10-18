# TAX-001A–D — regel- og kilderegister (dokumentasjon, ikke regelsett)

Oppdatert **16.10.2026** (TAX-001D: eksternt verifiserte fakta lagt inn som E1X, se `TAX-001D-evidence-status.md`). Status: **REVIEW**. Generert fra `rules.json` og `sources.json`. Dette er et *kartleggingsregister*. Ingen regel her er godkjent som parameter i kode (`usableAsRuleParameter=false` for alle); «dokumentert E1» betyr lest primærkilde, ikke godkjent regelprofil.

## 1. Status for kontrollgrunnlaget

**Seks originale kildefiler** (kildepakke `TAX-001B-handoff`, hentet av Codex 15.10.2026, SHA-256 i `sources.json`) er lest lokalt av Claude: rundskriv for engangsavgift 2026 (T03), bruksfradragstabell (T07), vrakpantutbetaling (T09), vrakpantavgift (T20), Tolletatens bilimportside (T21) og Merverdiavgiftshåndboken 8-4.3 (T22, **2025-utgave**). Nettverket mot norske verter er fortsatt blokkert for Claude; det er ikke lest noe utover pakken.

**Ikke lest:** stortingsvedtaket om engangsavgift (T04, satstabellene for vekt og CO2), forskrift om engangsavgift (T05, §§ 3-1 og 3-3), Tolletatens underordnede sider (T10: tollkurs, sjablongfrakt), Skatteetatens guide til innførselsmva. (T11), elbil-mva. (T14), Statens vegvesen-kodeverk (T15) og tyske kilder (T16/T17). **Ingen satstabell for engangsavgift eller mva.-sats er derfor kontrollert**, og ingen offisiell kalkulator er kjørt.

### Evidensnivåer
| Nivå | Betydning | Brukes som grunnlag? |
|---|---|---|
| E0 | ikke undersøkt | nei |
| E1 | primærkilde lest; regelens `e1Findings` dekkes av lest tekst (kilde, versjon, avsnitt, dato) | dokumentert regel – **ikke** automatisk godkjent parameter |
| E1P | delvis: avgrensede påstander er E1, resten uavklart | bare de enkelte `e1Findings` |
| E1X | primærkilde verifisert eksternt av Christian/Codex (TAX-001D); fakta gitt som sammendrag, **kildefil/hash ikke levert og ikke lest av Claude** | dokumentert regel – svakere enn E1; kan ikke alene godkjenne parameter |
| E2 | sammendrag fra søkeverktøy, ikke lest | nei – lead |
| E3 | sekundærkilde | **avvist** (Smarte Penger, Crowe) |

**Krav før en regel kan godkjennes som parameter** (`approvalRequirements`, håndheves av `check-docs.mjs`): evidenceLevel E1 (ikke E1P) med controlledDate; alle kilder i sources er E1 med publishedVersion og packageSha256; validity.from og governingEvent er satt og begrunnet mot rettskilden; minst ett uavhengig klasse 1-referansetilfelle (offisiell kalkulator/vedtak) eller godkjent dokumentert klasse 2-håndregning; parameterApproval.approved=true med approvedBy og approvedDate (Christian eller delegert) – ikke satt av utvikler alene.

Antall regler: 34 (E1 4, E1P 13, E1X 6, E2 8). Ingen er godkjent.

### Uavklarte kildeopplysninger
- **U-001** (lukket så langt dokumentert (E1X)): Søkesammendrag av stortingsvedtaket (T04) nevnte en endring med virkning 1.9.2026 (vedtak 19.6.2026). Gruppe b-endringen med virkning 2026-09-01 er dokumentert (CO2 450/600/1 200, før: 300/600/1 200). Vektsats gruppe b fra 09-01 og eventuelle øvrige endringer er ikke dokumentert – de er ukjente, ikke bekreftet uendret. _(berører: R-OTA-001, R-OTA-002, R-OTA-008)_
- **U-002** (uavklart språkforskjell): Engelsk bruksfradragsside sier at neste trinn nås på 'date of the vehicle's production', mens rundskriv 4.2/6.21 regner fra første gangs registrering i utlandet, dato til dato. Forskrift § 3-3 er ikke lest. Ikke gjettet. _(berører: R-OTA-010, R-OTA-011)_
- **U-003** (versjon avklart: 2025-utgave): Merverdiavgiftshåndbok-siden med URL 'gjeldende' er faktisk merket 2025. Dekning for 2026 ikke kontrollert. _(berører: R-DED-001)_
- **U-004** (lukket (E1X): gruppe a og b separert): Motstridende satstabeller for CO2/vekt i sammendrag av stortingsvedtaket (Lovdata 450/600/1 200; Stortinget 800/1 600/3 200/5 000). Gruppe a 2026: CO2 800/1 600/3 200/5 000 og vekt 260/kg. Gruppe b: 300/600/1 200 + vekt 30/kg til og med 2026-08-31; CO2 450/600/1 200 fra 2026-09-01. Satsene må aldri blandes mellom grupper. _(berører: R-OTA-001, R-OTA-002, R-OTA-008)_
- **U-005** (åpen, innsnevret): Ladbar hybrid: sammendrag nevner 10 % vektfradrag, rundskriv 2026 (E1) sier vektfradraget er opphevet fra 1.1.2024. CO2-grunnlag for ladbar hybrid (vektet kombinert) og tolkningen av 1,24 er besvart (E1X). Motsigelsen om 10 % vektfradrag (rundskriv E1: opphevet 2024; E2-sammendrag: inntil 10 %) er ikke adressert og forblir åpen. _(berører: R-OTA-005)_
- **U-006** (lukket (E1X): HFK-134a 2 130,70 kr/kg ekskl. mva.): Klimagassavgift: 1,639 mot 2 130,70 kr/kg i sammendrag. 1,639 forklares sannsynlig som sats per GWP-enhet (ikke bekreftet kilde). Andre gasser, GWP og mengde per bil er ukjent. _(berører: R-IMP-OTH-002)_
- **U-007** (løst (E1X): 300 000 kr fra 2026-01-01; anvendelse ved innførsel og lov 19.6.2026 uavklart): Elbil-mva.: 300 000 mot 500 000 kr i sammendrag; ikrafttredelse av lov 19.6.2026 ukjent. Håndbok § 6-8 (T35): mva.-fritt opptil 300 000 kr, 25 % over, vektkomponenten ikke i grunnlaget. 500 000 kr-tallet i sammendraget hører ikke til denne regelen. Eksplisitt innførselsanvendelse ikke gitt. _(berører: R-IMP-VAT-003)_
- **U-008** (uavklart kildekonflikt (E2)): Tollkursens syklus (annenhver tirsdag/to uker mot ukentlig). T23/T24 ikke lest. _(berører: R-IMP-FX-001)_

### Viktigste dokumenterte funn (E1, lest 15.10.2026)
- **Vrakpantavgift** (innbetaling ved registrering) er **2 400 kr** for gruppe a, b, c, g, j, k (rundskriv 3.4, side 17; satsside T20, 2026 valgt). Vrakpant**utbetaling** (3 000 kr, T09) er et annet begrep ved skroting og ikke en kostnad ved import – **ikke en satskonflikt** (TAX-001A feilet her).
- **NOx-komponenten** er fjernet fra 1.1.2026; **slagvolum** er ikke lenger alternativt grunnlag i gruppe a/b/j fra 1.1.2026 (anslått CO2 = egenvekt/10).
- **Ladbar hybrid:** vektfradraget er opphevet fra 1.1.2024 (3.3.11) – motsier TAX-001A-leadet om 10 % fradrag.
- **Elbil:** fritaket opphevet 1.1.2023; el i gruppe a betaler vektkomponent; el i andre grupper enn a betaler ikke engangsavgift (6.12).
- **Bruksfradrag:** alder fra første registrering i utlandet til norsk registrering, dato til dato; tabellen (41 trinn) er transkribert; 20-årstrinnet følger 1. januar-regelen (6.21). Forskjell mot engelsk sidetekst («production») er uavklart (U-002).
- **Import:** mva. betales til Tolletaten ved grensen før engangsavgift; refusjon av utenlandsk mva. er sak mellom kjøper og selger (T21). Siden gjelder privatpersoner.
- **Fradragsrett:** unntaket for personkjøretøy til videresalg beskrives i Merverdiavgiftshåndboken (2025-utgave); ikke verifisert for 2026 eller innførselsmva.

## 2. Regelregister

Kolonnen «Beløp» er «IKKE KONTROLLERT» der ingen E1 finnes. `Lead` er søkeverktøyets sammendrag, ikke en regel. `E1-funn` er lest i primærkilde.

### R-OTA-000 — Rekkefølge og sammensetning av avgifter ved import

- **Komponent:** Oversikt  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** avgiftsgruppe; drivlinje; registreringsdato  
- **Formel/trinn (struktur):** Engangsavgift + import-mva. + vrakpant + klimagassavgift (Skatteetaten oversikt); toll normalt 0 for bil fra EU/EØS-kontekst (IKKE undersøkt)  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ukjent. Virkningsdatoer må leses per komponent.  
- **Kilder:** T01, T08  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato:** ingen · **Godkjent parameter:** nei
- **Lead (ikke regel):**
  - Import av kjøretøy gir engangsavgift, merverdiavgift, vrakpant og klimagassavgift (sammendrag av Skatteetaten-sider). _(kilde T01/T08; Tollsats ikke undersøkt.)_
- **Uløste spørsmål:**
  - Toll (tollsats) for personbil/varebil importert fra EU/EØS: ikke kartlagt.
  - Registrerings-/merkegebyrer hos Statens vegvesen: ikke kartlagt.

### R-IMP-VAT-001 — Norsk import-mva.: sats og grunnlag

- **Komponent:** Import-mva.  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** tollverdi (NOK); engangsavgift (inngår i grunnlaget?); kjøretøyprofil (elbil-fritak)  
- **Formel/trinn (struktur):** mva = sats × grunnlag; sats og grunnlagets sammensetning skal leses fra primærkilde  
- **Beløp/enhet/avrunding:** 25 % av tollverdi (E1X, eksternt verifisert). Avrunding og øre: IKKE KONTROLLERT. Ikrafttredelse: ikke oppgitt.  
- **Dato fra/til:** ukjent / ukjent — Sats-/grunnlagsdato ikke lest.  
- **Styrende hendelse:** Innførsel/deklarasjon til Tolletaten  
- **Kilder:** T01, T08, T11, T21  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_og_E1X_sats_og_grunnlag` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Kjøretøy innført av privatperson deklareres og merverdiavgift betales til Tolletaten (ved grensen); deretter engangsavgift til Skatteetaten etter godkjenning; til slutt registrering hos Statens vegvesen. (Betalingsrekkefølge – ikke beregningsrekkefølge eller grunnlag.) _(kilde T21, innledning, «Avgifter du må betale til Tolletaten», lest 2026-10-15)_
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Mva. ved import av kjøretøy er 25 %; mva.-grunnlaget er tollverdien. _(kilde T33, Bilimport (Tolletaten), verifisert 2026-10-16)_
- **Lead (ikke regel):**
  - Sammendrag: mva. 25 % av tollverdien for importerte kjøretøy. _(kilde T08; Universell 25 % skal ikke innføres uten kildekontroll (IMPORT_ENGINE_SPEC); elbil har egen regel (R-IMP-VAT-003).)_
- **Uløste spørsmål:**
  - Toll (tollsats) for bil: ikke gitt – grunnlaget «tollverdi + toll» fra tidligere ledetråd er derfor ikke avgjort.
  - Forhandlerbehandling (næringsdrivende deklarasjon/oppgjør) ikke gitt.
  - Tollkurs-dato (U-008), avrunding.

### R-IMP-VAT-002 — Tollverdi: kjøpspris + frakt + forsikring til norsk grense

- **Komponent:** Tollverdi  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** kjøpspris i kontrakts-/fakturavaluta; frakt til norsk grense; forsikring til norsk grense; kurs  
- **Formel/trinn (struktur):** tollverdi = kjøpspris + frakt til grensen + forsikring til grensen (sammendrag); frakt etter grensen inngår ikke  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ikke lest.  
- **Styrende hendelse:** Innførsel/deklarasjon til Tolletaten (dato for tollkurs og tollverdi uavklart, se R-IMP-FX-001)  
- **Kilder:** T08, T10, T21  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_og_E1X_grunnlag` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - For nylig kjøpt bil beregnes avgiften ut fra kjøpesummen, frakt og forsikring; ellers må bilens verdi dokumenteres, og noen ganger kreves takst. _(kilde T21, «Avgifter du må betale til Tolletaten», lest 2026-10-15)_
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Transport og forsikring fram til norsk innførselssted inngår i tollverdien. _(kilde T34, Incoterms/tollverdi, verifisert 2026-10-16)_
  - Norske avgifter som oppstår etter innførsel (f.eks. engangsavgift ved registrering) inngår ikke i tollverdien bare fordi de oppstår senere. _(kilde T34, Incoterms/tollverdi, verifisert 2026-10-16)_
  - Mva.-grunnlaget er tollverdien. _(kilde T33, Bilimport (Tolletaten), verifisert 2026-10-16)_
  - Bekreftet på nytt (TAX-001E): tollverdi inkluderer kjøpesum pluss transport og forsikring til norsk innførselssted; senere norske avgifter blir ikke automatisk del av import-mva.-grunnlaget bare fordi de oppstår etter innførsel. _(kilde T34, Incoterms/tollverdi, verifisert 2026-10-16)_
- **Lead (ikke regel):**
  - Tollverdi bygges av kjøpspris, frakt og forsikring til norsk grense (Skatteetaten og Tolletaten, sammendrag). _(kilde T08/T10)_
  - For biler kjørt inn på egne hjul brukes Tolletatens sjablongfrakt per land, med rett til å dokumentere faktisk frakt (sammendrag). _(kilde T10)_
- **Uløste spørsmål:**
  - Sjablongfrakt, transaksjonsgebyr og tollkurs (U-008) ikke gitt.
  - Gjelder «engangsavgift inngår ikke» også eksplisitt for mva.-grunnlaget? Slutning fra tollverdi-regelen; ikke separat bekreftet for import-mva. i forhandlerdeklarasjon.

### R-IMP-FX-001 — Tollkurs (Tolletatens kurs) kontra betalingskurs

- **Komponent:** Valutakurs  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** valuta; tidspunkt/dato for kursvalg  
- **Formel/trinn (struktur):** tollverdi i NOK = tollverdi i valuta × Tolletatens kurs; betalingskurs er egen kostnad  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ukjent.  
- **Kilder:** T10, T23, T24  
- **Evidensnivå:** E2 · **Status:** `kildekonflikt` · **Kontrollert dato:** ingen · **Godkjent parameter:** nei
- **Lead (ikke regel):**
  - Tolletaten fastsetter kurs for én uke om gangen (sammendrag). _(kilde T10)_
  - Kildene er uenige om hvilken dato som styrer kursen: tidspunkt tolldeklarasjon godtas, eller frigivelsestidspunkt. _(kilde T10; KILDEKONFLIKT i sammendragene.)_
  - Sammendrag: tollverdi omregnes med Tolletatens kurs på det tidspunktet tollmyndighetene aksepterer deklarasjonen (vareførselsloven § 3-4 / tollavgiftsloven § 2-2). _(kilde T24; Primærtekst ikke lest. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
  - Kurssyklus motstridende: «annenhver tirsdag, gyldig i to uker» (T23) mot eldre «ukentlig onsdag/mandag». Endringsforskrift 21.8.2026 til vareførselsforskriften § 6-12-1 åpner for deklarasjon 16–30 dager før innførsel. _(kilde T23; KILDEKONFLIKT (syklus). Ikke avgjort. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Hvilken dato styrer kursen?
  - Hvor hentes ukekursen (kilde-URL, format)?

### R-IMP-VAT-003 — Elbil: fritak/beløpsgrense for mva.

- **Komponent:** Import-mva.  
- **Profiler:** PB-BEV, VB-BEV  
- **Nødvendig input:** drivlinje = batterielektrisk; beløp fritaket regnes av; dato  
- **Formel/trinn (struktur):** mva. beregnes bare på den delen av vederlaget/grunnlaget som overstiger grensen (sammendrag); grense avhenger av dato  
- **Beløp/enhet/avrunding:** Grense 300 000 kr (mva.-fritt); 25 % over grensen (E1X). «Kvalifiserende», anvendelse ved innførsel og avrunding: IKKE KONTROLLERT.  
- **Dato fra/til:** 2026-01-01 / ukjent — 300 000 kr-grensen gjelder fra 1.1.2026 (håndbok merket 2025-utgave). Videre nedtrapping/lov 19.6.2026: ikke avgjort.  
- **Kilder:** T14  
- **Evidensnivå:** E1X · **Status:** `delvis_E1X_300000_fra_2026-01-01` · **Kontrollert dato:** 2026-10-16 · **Godkjent parameter:** nei
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Fra 2026-01-01 er kvalifiserende elektriske personkjøretøy mva.-frie opptil 300 000 kr; 25 % mva. på beløp over 300 000 kr. Vektkomponenten i engangsavgiften er ikke del av dette mva.-grunnlaget. _(kilde T35, Håndbok § 6-8, verifisert 2026-10-16)_
- **Lead (ikke regel):**
  - Videre nedtrapping (150 000 kr per år i 2027 og 2028 forutsatt ESA-godkjenning; regjeringen foreslo full mva. fra 2027) er FREMTIDIG/uenighet. _(kilde T14)_
- **Uløste spørsmål:**
  - Eksplisitt anvendelse ved INNFØRSEL for forhandler er ikke gitt i pakken (regelen er oppgitt for kvalifiserende elbiler).
  - Hva som regnes som «kvalifiserende» elbil og hvilket beløp grensen måles mot ved import.
  - Lov av 19.6.2026: ikrafttredelse ukjent; ev. senere nedtrapping.

### R-OTA-001 — Vektkomponent

- **Komponent:** Engangsavgift gruppe a  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** egenvekt (kg, norsk definisjon); avgiftsgruppe; drivlinje  
- **Formel/trinn (struktur):** komponent = sats × (vekt over terskel) per sats-trinn; ny komponent for alle drivlinjer inkl. elbil fra 2026  
- **Beløp/enhet/avrunding:** Gruppe a 2026: 260 kr per kg over 1 200 kg (E1X). Gruppe b: se R-OTA-008. Avrunding og andre grupper: IKKE KONTROLLERT.  
- **Dato fra/til:** 2026-01-01 / ukjent — Gruppe a 2026. Gruppe b-vekt er oppgitt bare til og med 2026-08-31 (R-OTA-008).  
- **Kilder:** T03, T40, T41, T05, T47, T43, T48  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_og_E1X_gruppe_a_vekt` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Avgiften beregnes for personbil og varebil i gruppe a og b på grunnlag av egenvekt og CO2-utslipp; satsendringer og omstrukturering av satstabellene i § 3 ble gjort 1.1.2026. _(kilde T03, 3.1, 13.1.1, lest 2026-10-15)_
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Revidert 2026 (vedtak 1131/1132) endrer engangsavgiften for gruppe b med virkning fra 2026-09-01 (CO2-komponenten). Øvrig innhold er ikke gitt. _(kilde T31, Vedtak 1131/1132, verifisert 2026-10-16)_
  - Gruppe a 2026: vektkomponent 260 kr per kg over 1 200 kg. _(kilde T30, Vedtak 220 (gruppe a), verifisert 2026-10-16)_
- **Datert parameter DP-WEIGHT-A-2026:** Vektkomponent, avgiftsgruppe a fra **2026-01-01** (NOK per kg over terskel): over 1200 kg = 260 (gruppe a, til åpen). Før fra-datoen: UKJENT – tiden før fra-datoen er ikke dokumentert for denne parameteren (skal gi not_calculated). Etter til-datoen: n/a. Ikke godkjente implementasjonsforutsetninger: Om regelen endres for gruppe a etter 2026-09-01 er IKKE oppgitt (to=null betyr «ingen endring dokumentert», ikke «bekreftet ut året»); Styrende hendelsesdato og rekkefølge mot bruksfradrag er ikke gitt; Plug-in hybrid: vektfradrag-spørsmålet (U-005) er åpent.
- **Lead (ikke regel):**
  - Bil med forbrenningsmotor: ny vektkomponent + generell engangsavgift (CO2/egenvekt); elbil: bare vektkomponent (Skatteetaten, sammendrag). _(kilde T02)_
  - Lovdata-sammendrag av stortingsvedtaket (T04) viser vektsats i § 3 over 1 200 kg (260 kr/kg og 30 kr/kg nevnt uten tydelig gruppemapping). _(kilde T04; UBEKREFTET gruppemapping. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter] [LØST TAX-001E: gruppe a og b er nå separert (E1X)])_
  - Stortingets oversikt (T26) gir CO2-tabell 800/1 600/3 200/5 000 kr for gruppe a – motsier Lovdata-sammendraget (450/600/1 200). _(kilde T26; KILDEKONFLIKT mellom sammendragene; ingen sats kan velges. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter] [LØST TAX-001E: gruppe a og b er nå separert (E1X)])_
- **Uløste spørsmål:**
  - Vektsats for gruppe b fra 2026-09-01 er IKKE oppgitt (ukjent).
  - Satser for andre grupper, trinnvis/marginal beregning og styrende dato er ikke gitt.
  - Forskrift/stortingsvedtak er ikke lest av Claude (E1X).

### R-OTA-002 — CO2-komponent — gruppe a, WLTP, hele g/km, stempeldrevet forbrenningsmotor (avgrenset)

- **Komponent:** Engangsavgift gruppe a  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV  
- **Nødvendig input:** CO2 g/km (heltall, WLTP; ladbar hybrid: «vektet kombinert»); kilde i vognkort/typegodkjenning  
- **Formel/trinn (struktur):** komponent = marginal sats-trapp over CO2-bånd av registrert WLTP-verdi (hele g/km)  
- **Beløp/enhet/avrunding:** Gruppe a 2026 (E1): marginale bånd (T40 + vedtaket): første 100 g/km 800 kr/g, neste 50 g/km 1 600, neste 75 g/km 3 200, resten 5 000. Heltall g/km × heltallssats ⇒ hele kroner; ingen mellomavrunding oppstår innen omfanget. Sluttkravet avrundes etter R-OTA-014. NEDC/egenvekt-10/andre grupper: R-OTA-015.  
- **Dato fra/til:** 2026-01-01 / åpen — Vedtaket § 1: «Fra 1. januar 2026»; T03 13.1.1. Ingen dokumentert sluttdato; INTERN sikkerhetssperre 2026-12-31 (ikke kildedokumentert).  
- **Styrende hendelse:** Første gangs registrering i Norge (forskrift § 1-2 nr. 1; vedtak § 1)  
- **Avgrensning:** Omfang (inne): avgiftsgruppe a personbil, stortingsvedtaket § 3 første ledd a nr 2; motorvogn med stempeldrevet forbrenningsmotor (inkl. ladbar hybrid); WLTP-godkjent (EPA/NRCan behandles som WLTP); CO2 i HELE g/km fra feltet «kombinert» (ladbar hybrid: «vektet kombinert»); marginale bånd: første 100 / neste 50 / neste 75 / resten · Utenfor omfang (blokkert): NEDC (× 1,24), CO2 = egenvekt/10, desimal-CO2 og andre avgiftsgrupper: se R-OTA-015 (E1P; motoren blokkerer dem) · Avgrenset fra: R-OTA-002 (hele CO2-komponenten, E1P) · Sporbarhet: Kilder og funn for NEDC/fallback/andre grupper er flyttet uendret til R-OTA-015; tidligere formulering ligger i git-historikken (commit før runde 12).  
- **Kilder:** T03, T05, T40, T41, T47, T43, T48  
- **Evidensnivå:** E1 · **Status:** `E1_avgrenset_gruppe_a_WLTP_hele_gkm_parameter_ikke_godkjent` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - CO2 hentes for WLTP-kjøretøy fra samsvarssertifikat (CoC); satstabellen i stortingsvedtaket brukes direkte for WLTP. _(kilde T03, 3.2.5, lest 2026-10-15)_
  - EPA/NRCan-målt CO2 beregnes som WLTP. _(kilde T03, 3.2.5, lest 2026-10-15)_
  - Gruppe a, personbiler med forbrenningsmotor, CO2-utslipp kr per g/km: første 100 g/km 800; neste 50 g/km 1 600; neste 75 g/km 3 200; resten 5 000 (kolonne «Enighet 2026»; 2025-regler «-»). Satsen gjelder for gram i hvert intervall (marginalt/progressivt). _(kilde T40, PDF s. 3, «CO2-utslipp, kr per g/km», lest 2026-10-18)_
  - FORSLAG: § 3 a 2 – CO2-tabell per g/km: 0–100: 800; 101–150: 1 600; 151–225: 3 200; over 225: 5 000 (tabellen alene sier ikke eksplisitt marginal/flat; T40 gjør det). _(kilde T41, PDF s. 2, § 3 a 2, lest 2026-10-18)_
  - WLTP-godkjent kjøretøy i gruppe a: CO2 fra feltet «kombinert» i samsvarssertifikatet; ladbar hybrid: feltet «vektet kombinert». NEDC: verdi × 1,24 (gruppe a og j), × 1,22 (gruppe b). Ikke godkjent etter WLTP/NEDC: CO2 = egenvekt (kg) / 10. Uten kjent testmetode: WLTP hvis første registrering i utlandet 1.9.2018 eller senere eller ikke tidligere registrert; ellers NEDC. EPA/NRCan behandles som WLTP. _(kilde T05, § 3-1 andre til sjette ledd (PDF s. 5), lest 2026-10-18)_
  - Konsolidert vedtak § 3 første ledd a nr 2 (avgiftsgruppe a): CO2-utslipp per g/km kr 0–100: 800; 101–150: 1 600; 151–225: 3 200; over 225: 5 000. Uendret av FOR-2026-06-19-1246 (endrer bare bokstav b nr 2). At bånd regnes marginalt («første 100 / neste 50 / neste 75 / resten») står i Finansdepartementets satsoversikt (T40), ikke i vedtaksteksten. _(kilde T47, § 3 første ledd a nr 2; T40 s. 3, lest 2026-10-18)_
  - Vedtaket § 3 første ledd a nr 2 gir CO2-satsene som intervalltabell (0–100: 800; 101–150: 1 600; 151–225: 3 200; over 225: 5 000); Finansdepartementets satsoversikt T40 s. 3 viser de samme beløpene som «første 100 g/km / neste 50 g/km / neste 75 g/km / resten», kr per g/km. Innen omfanget (WLTP, hele g/km, gruppe a, forbrenningsmotor) er den marginale strukturen belagt av T40 uttrykkelig, sammen med vedtakets satser. Vedtaksteksten selv sier ikke «marginal» (vekten sier «den delen av egenvekten som overstiger»). _(kilde T40, PDF s. 3 (visuelt lest); T47 § 3 første ledd a nr 2, lest 2026-10-18)_
- **Vurdering av tilstrekkelig belegg:** 2026-10-18: Christian bestemte at T40s uttrykkelige «første / neste / resten», sammen med vedtakets satser, er tilstrekkelig belegg for den marginale strukturen innen avgrenset omfang. Evidensnivået følger lest kildetekst (T40 er E1-kilde); beslutningen om tilstrekkelighet er registrert her og er ikke en parametergodkjenning.
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Gruppe a 2026: CO2 0–100 g/km 800 kr/g, 101–150 g/km 1 600, 151–225 g/km 3 200, over 225 g/km 5 000. _(kilde T30, Vedtak 220 (gruppe a), verifisert 2026-10-16)_
- **Datert parameter DP-CO2-A-2026:** CO2-komponent, avgiftsgruppe a fra **2026-01-01** (NOK per g/km): 0–100 g/km = 800; 101–150 g/km = 1600; 151–225 g/km = 3200; 226–∞ g/km = 5000 (til åpen). Før fra-datoen: UKJENT.
- **Lead (ikke regel):**
  - Hvis Statens vegvesen har registrert CO2, brukes den som hovedregel. _(kilde T02)_
  - CO2-trinn 0–100/101–150/>150 g/km = 450/600/1 200 kr er sitert i Lovdata-sammendrag uten gruppe; 2025-vedtaket har eget fradrag under 70 g/km. _(kilde T04)_
- **Uløste spørsmål:**
  - Sluttdato: ingen dokumentert (R-OTA-001); motoren har intern sperre 2026-12-31.
  - Marginal struktur står i T40, ikke i vedtaksteksten; vurdert tilstrekkelig innen omfanget (evidenceJudgement).
  - Utenfor omfang og blokkert: NEDC, egenvekt/10, desimal-CO2, andre grupper (R-OTA-015).
  - Per kjøretøy: CO2-felt og målemetode må dokumenteres (inputkrav, ikke regelusikkerhet).

### R-OTA-015 — CO2-grunnlag utenfor WLTP-heltall: NEDC (× 1,24/1,22), egenvekt/10-anslag, desimal-CO2 og andre avgiftsgrupper (blokkert)

- **Komponent:** Engangsavgift gruppe a  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV  
- **Nødvendig input:** CO2 g/km; testmetode (WLTP/NEDC); kilde i vognkort/typegodkjenning  
- **Formel/trinn (struktur):** komponent = sats-trapp over CO2-bånd; CO2 fra registrert verdi, ellers anslag  
- **Beløp/enhet/avrunding:** NEDC-faktor 1,24 (gruppe a/j) og 1,22 (gruppe b) (T05 § 3-1; T03 3.2.5); anslått CO2 = egenvekt (kg) / 10. Resultatet gir desimaler; avrunding er IKKE kildebelagt (U-012). Ikke beregnet.  
- **Dato fra/til:** ukjent / åpen — Ikke fastsatt for denne regelen; blokkert. Gyldighet kildebelegges ved senere løfting.  
- **Styrende hendelse:** Første gangs registrering i Norge (forskrift § 1-2 nr. 1; vedtak § 1)  
- **Avgrensning:** Utskilt fra: R-OTA-002 · Merknad: Dokumenterte formler beholdes som funn; resultatet er ikke beregnbart fordi avrunding av desimal-CO2 mangler kilde (U-012). Andre grupper (b, c, j …) er ikke registrert som parametere.  
- **Kilder:** T03, T05, T47  
- **Evidensnivå:** E1P · **Status:** `E1P_blokkert_i_motor_desimal_CO2_uten_avrundingskilde` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - NEDC-godkjente kjøretøy: registrert CO2 justeres opp med fast faktor, 24 % i gruppe a og j og 22 % i gruppe b, før satstabellen. _(kilde T03, 3.2.5, lest 2026-10-15)_
  - Målemetode ukjent: første registrering i utlandet før 1.9.2018 → NEDC-behandling; fra og med 1.9.2018 eller ikke tidligere registrert → WLTP. _(kilde T03, 3.2.5, lest 2026-10-15)_
  - Uten plikt til å oppgi CO2: anslått CO2 = egenvekt/10 (se R-OTA-004). _(kilde T03, 3.2.6, lest 2026-10-15)_
  - WLTP-godkjent kjøretøy i gruppe a: CO2 fra feltet «kombinert» i samsvarssertifikatet; ladbar hybrid: feltet «vektet kombinert». NEDC: verdi × 1,24 (gruppe a og j), × 1,22 (gruppe b). Ikke godkjent etter WLTP/NEDC: CO2 = egenvekt (kg) / 10. Uten kjent testmetode: WLTP hvis første registrering i utlandet 1.9.2018 eller senere eller ikke tidligere registrert; ellers NEDC. EPA/NRCan behandles som WLTP. _(kilde T05, § 3-1 andre til sjette ledd (PDF s. 5), lest 2026-10-18)_
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - CO2-komponenten for gruppe b er endret med virkning fra 2026-09-01 (450/600/1 200 kr per g/km); satser for gruppe a er ikke verifisert. _(kilde T31, Vedtak 1131/1132, verifisert 2026-10-16)_
  - § 3-1: WLTP-kjøretøy bruker relevant kombinert CO2-verdi; der forskriften anvender NEDC-omregning er faktoren 1,24 for gruppe a/j og 1,22 for gruppe b. _(kilde T05, Forskrift § 3-1, verifisert 2026-10-16)_
- **Uløste spørsmål:**
  - Avrunding av CO2 etter × 1,24 / egenvekt/10 (desimaler) er ikke omtalt i noen kilde (U-012): resultatet kan ikke beregnes.
  - Andre avgiftsgrupper (b, c, j …) er ikke registrert som parametere.
  - Gruppe b CO2 endret fra 2026-09-01 (E1X; R-OTA-008).

### R-OTA-003 — NOx-komponenten er fjernet fra 1.1.2026

- **Komponent:** Engangsavgift  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** NOx mg/km  
- **Formel/trinn (struktur):** ikke aktuelt hvis komponenten er avviklet  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2026-01-01 / åpen — Overgang rundt årsskiftet ikke avklart.  
- **Styrende hendelse:** Første gangs registrering i Norge (forskrift § 1-2 nr. 1; vedtak § 1)  
- **Kilder:** T03, T02  
- **Evidensnivå:** E1 · **Status:** `dokumentert_E1_parameter_ikke_godkjent` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - «NOx-komponenten er fjernet med virkning fra 1. januar 2026.» _(kilde T03, 3.2.4 og 13.1.2, lest 2026-10-15)_
- **Uløste spørsmål:**
  - T02 (oversiktsside) er ikke lest; sammendraget nevnte NOx i oversiktsteksten. Rundskrivet er entydig; T02 må avstemmes ved senere lesing.

### R-OTA-004 — Slagvolum som grunnlag er avviklet for gruppe a, b, j fra 1.1.2026; erstattet av anslått CO2 = egenvekt/10

- **Komponent:** Engangsavgift  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** slagvolum; CO2 registrert?  
- **Formel/trinn (struktur):** eldre regel: slagvolum når CO2 ikke er registrert  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2026-01-01 / åpen — Rundskriv 2026.  
- **Styrende hendelse:** Første gangs registrering i Norge (forskrift § 1-2 nr. 1; vedtak § 1)  
- **Kilder:** T03, T05  
- **Evidensnivå:** E1 · **Status:** `dokumentert_E1_parameter_ikke_godkjent` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Fra 1.1.2026 brukes ikke slagvolum som alternativt grunnlag for motorvogner i gruppe a, b og j uten plikt til å dokumentere CO2; i stedet anslått CO2 (g/km) = egenvekt i kg / 10. _(kilde T03, 3.2.6, lest 2026-10-15)_
  - Slagvolum brukes fortsatt for campingbiler i gruppe c. _(kilde T03, 3.2.6, lest 2026-10-15)_
  - Forskrift § 3-1 sjette ledd: for motorvogner i gruppe a, b og j som ikke er godkjent etter WLTP eller NEDC (eller omfattet av femte ledd) settes CO2-utslippet i g/km til egenvekt i kg dividert med 10. _(kilde T05, § 3-1 siste ledd (PDF s. 5), lest 2026-10-18)_
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Der relevant CO2-grunnlag mangler og lovfestet fallback gjelder, bygger fallback på egenvekt/10 (eksternt bekreftet; stemmer med rundskriv 3.2.6, E1). _(kilde T05, Forskrift § 3-1, verifisert 2026-10-16)_
- **Uløste spørsmål:**
  - Avrunding av egenvekt/10, og hva «egenvekt» er for utenlandsk bil (3.2.2: minimumsvekt fra europeisk typegodkjenning) – forskrift § 3-1 ikke lest.

### R-OTA-005 — Ladbar hybrid: CO2-grunnlag og fradrag for elektrisk rekkevidde

- **Komponent:** Engangsavgift  
- **Profiler:** PB-PHEV, VB-PHEV  
- **Nødvendig input:** CO2 vektet kombinert (WLTP); elektrisk rekkevidde km; avgiftsgruppe  
- **Formel/trinn (struktur):** CO2-grunnlag = verdi i feltet «vektet kombinert» (ev. faktor); eventuelt fradrag i vektgrunnlag etter rekkevidde  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2026-01-01 / åpen — Anvendes under 2026-vedtaket (§ 1: «Fra 1. januar 2026»; § 3 innledning: stempeldrevet forbrenningsmotor). Tidligere «2022 (historisk lead)» er fjernet fordi den ikke er kildebelagt for 2026; opphevelsen av vektfradraget (1. januar 2024, T03 3.3.11) er bakgrunn, ikke startdato.  
- **Styrende hendelse:** Første gangs registrering i Norge (forskrift § 1-2 nr. 1; vedtak § 1)  
- **Kilder:** T05, T03, T41, T40, T47, T43  
- **Evidensnivå:** E1 · **Status:** `E1_vilkaar_i_vedtak_og_forskrift_3_1_ingen_phev_saerregel_parameter_ikke_godkjent` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Vektfradraget for ladbare hybridbiler er opphevet med virkning fra 1. januar 2024. _(kilde T03, 3.3.11, lest 2026-10-15)_
  - Ladbare hybridbiler: CO2-grunnlaget er feltet «vektet kombinert» (både WLTP og NEDC); NEDC-verdi × 1,24 i gruppe a. _(kilde T05, § 3-1 andre og tredje ledd (PDF s. 5), lest 2026-10-18)_
  - Avgiften etter § 3 (forbrenningsmotorkomponentene: tilleggsvekt og CO2) ilegges motorvogner med stempeldrevet forbrenningsmotor; elektriske motorvogner i gruppe a betaler bare § 2. _(kilde T03, 6.12, lest 2026-10-18)_
  - FORSLAG § 3: kriteriet er «stempeldrevet forbrenningsmotor»; det finnes ingen bestemmelse om vektfradrag i § 2 eller § 3 for ladbar hybrid. _(kilde T41, PDF s. 1–2, lest 2026-10-18)_
  - Forskriften bruker begrepet «ladbare hybridbiler» men definerer det ikke i de leste paragrafene (§§ 1-1…9-5 gjennomgått; kapittel II har definisjoner av varebil, lastebil, campingbil, minibuss – ingen for ladbar hybrid). Anvendelsen i § 3-1 forutsetter at ladbar hybrid har en CO2-komponent å beregne. _(kilde T05, PDF s. 1–17 (gjennomgått), § 3-1 andre og tredje ledd, lest 2026-10-18)_
  - Rundskrivet nevner bare «Vektfradraget for ladbare hybridbiler er opphevet med virkning fra 1. januar 2024» (3.3.11); «hybrid» forekommer ellers ikke. Vektfradraget var et fradrag i vektgrunnlaget for avgiften på motorvogner med forbrenningsmotor; at det er opphevet betyr at ladbar hybrid i 2026 behandles som øvrige biler med forbrenningsmotor på vektgrunnlaget. _(kilde T03, 3.3.11 (s. 16) [TOLKNING av hva opphevelsen innebærer], lest 2026-10-18)_
  - Satsoversikten for gruppe a har bare to rader for personbil: «Alle personbiler» (generell vekt) og «Personbiler mv. med forbrenningsmotor» (tilleggsvekt og CO2). Det finnes ingen egen rad, sats eller fradrag for ladbar hybrid. _(kilde T40, PDF s. 3 (gruppe a-radene) [TOLKNING: fravær av rad], lest 2026-10-18)_
  - Konsolidert vedtak § 3 innledning: «For motorvogner med stempeldrevet forbrenningsmotor skal det betales avgift med følgende beløp» — vilkåret er den tekniske egenskapen stempeldrevet forbrenningsmotor, ikke drivstoff, hybridtype eller markedsføringsnavn. Ladbar hybrid er ikke nevnt og ikke definert i vedtaket. _(kilde T47, § 3 innledning, lest 2026-10-18)_
  - Fullstendig lest vedtak (§§ 1–11, T47) inneholder ingen bestemmelse som utelater, endrer eller gir fradrag for ladbar hybrid i §§ 2–4; § 3 a nr 1 og nr 2 har samme innledende vilkår og er ikke delt etter drivlinje. Forskrift § 3-1 (T05, alle sider lest) angir CO2-feltet for ladbare hybridbiler og forutsetter dermed at ladbar hybrid har en CO2-komponent etter § 3; ingen annen bestemmelse i forskriften gir særregler for dem. _(kilde T47, §§ 2–4 (fravær av PHEV-særregel) og § 3 innledning; T05 § 3-1, lest 2026-10-18)_
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Ladbar hybrid bruker vektet kombinert CO2-verdi (§ 3-1). _(kilde T05, Forskrift § 3-1, verifisert 2026-10-16)_
- **Lead (ikke regel):**
  - Eldre forskriftstekst: CO2 for ladbar hybrid tas fra «vektet kombinert»; for gruppe a og j multipliseres med 1,24. _(kilde T05)_
  - 2022-forskrift: 10 % fradrag i vektgrunnlag ved ≥ 100 km elektrisk rekkevidde, proporsjonalt lavere under. _(kilde T19)_
  - Lead om 10 % fradrag i vektgrunnlag ved ≥ 100 km elektrisk rekkevidde (2022-forskrift) er MOTSAGT for 2026 av rundskriv 3.3.11 (opphevet 1.1.2024). _(kilde T03/T19)_
  - Skatteetatens side (sammendrag) sier at ladbar hybrid får fradrag i vektavgiftsgrunnlaget på inntil 10 % (stortingsvedtaket § 8 og forskriften § 3-1). _(kilde T05)_
- **Uløste spørsmål:**
  - Per kjøretøy må stempeldrevet forbrenningsmotor, ekstern ladbarhet, CO2-felt «vektet kombinert» (heltall g/km forutsettes) og minimumsvekt dokumenteres fra typegodkjenning/register (inputkrav, ikke regelusikkerhet).
  - NEDC-godkjent ladbar hybrid (× 1,24) støttes ikke (U-012).
  - Avrunding: sluttkravet R-OTA-014; mellomledd U-012.
  - Elektrisk rekkevidde har ingen avgiftseffekt i leste kilder.

### R-OTA-006 — Ikke-ladbar hybrid: behandlet som forbrenningsbil?

- **Komponent:** Engangsavgift  
- **Profiler:** PB-HEV, VB-HEV  
- **Nødvendig input:** CO2; egenvekt  
- **Formel/trinn (struktur):** samme som bensin/diesel hvis ingen egne regler  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ukjent.  
- **Kilder:** T03, T05  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_ingen_regeltekst_funnet` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Rundskrivet 2026 har ingen egen omtale av ikke-ladbar hybrid; ordet «hybrid» forekommer ellers bare i 3.3.11 (ladbar hybridbil). _(kilde T03, tekstsøk i hele PDF, lest 2026-10-15)_
- **Lead (ikke regel):**
  - Eldre regjeringsnotat (2019): ikke-ladbare hybrider behandles som forbrenningsbiler. _(kilde T05; Gammel kilde.)_
- **Uløste spørsmål:**
  - Egne regler 2026 for mild/full hybrid?
  - Hvordan skilles ikke-ladbar hybrid fra plug-in i Statens vegvesen-data?
  - Behandling av ikke-ladbar hybrid er ikke dokumentert i lest materiale; antagelsen «som forbrenningsbil» (2019-lead) står ubekreftet.

### R-OTA-007 — Batterielektrisk: kun vektkomponent

- **Komponent:** Engangsavgift  
- **Profiler:** PB-BEV, VB-BEV  
- **Nødvendig input:** egenvekt  
- **Formel/trinn (struktur):** vektkomponent uten CO2-komponent  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2026-01-01 / åpen — Vedtaket § 1: «Fra 1. januar 2026»; § 2 gjelder alle personbiler i gruppe a, § 3 bare stempeldrevet forbrenningsmotor. Ingen dokumentert sluttdato; intern sikkerhetssperre 2026-12-31 (R-OTA-001).  
- **Styrende hendelse:** Første gangs registrering i Norge (forskrift § 1-2 nr. 1; vedtak § 1)  
- **Kilder:** T03, T40, T41, T47  
- **Evidensnivå:** E1 · **Status:** `E1_generell_vektkomponent_ingen_ice_tillegg_parameter_ikke_godkjent` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Fritaket for elektriske motorvogner er opphevet fra 1.1.2023; elektriske motorvogner i avgiftsgruppe a betaler engangsavgift etter stortingsvedtaket § 2. _(kilde T03, 6.12, lest 2026-10-15)_
  - Elektriske motorvogner i andre grupper enn a betaler ikke engangsavgift, fordi § 3 bare ilegges motorvogner med stempeldrevet forbrenningsmotor. _(kilde T03, 6.12, lest 2026-10-15)_
  - Elbil (avgiftsgruppe a) betaler engangsavgift bare etter § 2 (generell vektkomponent 12,71 kr/kg over 500 kg); komponentene for forbrenningsmotor (tillegg 260 kr/kg over 1 200 kg og CO2) gjelder ikke. _(kilde T40, PDF s. 3 (rad «Alle personbiler» mot rad «med forbrenningsmotor»), lest 2026-10-18)_
  - FORSLAG § 2 gjelder alle personbiler i gruppe a; § 3 gjelder bare motorvogner med stempeldrevet forbrenningsmotor. _(kilde T41, PDF s. 1–2, § 2 og § 3, lest 2026-10-18)_
  - Vedtaket § 2 gjelder alle personbiler i avgiftsgruppe a; § 3 gjelder «motorvogner med stempeldrevet forbrenningsmotor». En elbil uten slik motor betaler dermed bare § 2 (12,71 kr/kg over 500 kg). Samme konklusjon i rundskriv 6.12. _(kilde T47, § 2 og § 3 innledning; T03 6.12, lest 2026-10-18)_
- **Lead (ikke regel):**
  - Elbiler omfattes bare av vektkomponenten (sammendrag). _(kilde T02)_
- **Uløste spørsmål:**
  - Hydrogen-/brenselcellebiler er ikke vurdert (utenfor støttet profil); elbil i andre grupper enn a er ikke dekket.
  - Avrunding: R-OTA-014 (sluttkrav) og U-012 (mellomledd).

### R-OTA-008 — Varebil klasse 2: sammensetning og satser

- **Komponent:** Engangsavgift gruppe b  
- **Profiler:** VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** avgiftsgruppe b bekreftet; egenvekt; CO2  
- **Formel/trinn (struktur):** b: vektkomponent + CO2-komponent (sammendrag av § 3 b i stortingsvedtaket)  
- **Beløp/enhet/avrunding:** Gruppe b: 2026-01-01–08-31: vekt 30 kr/kg >1 200 kg; CO2 300/600/1 200 kr per g/km (0–100/101–150/>150). Fra 2026-09-01: CO2 450/600/1 200; vekt fra 09-01 UKJENT (E1X). Avrunding: IKKE KONTROLLERT.  
- **Dato fra/til:** 2026-01-01 / ukjent — Gruppe b har to perioder: til og med 2026-08-31 og fra 2026-09-01 (CO2). Vekt er oppgitt bare til 2026-08-31.  
- **Kilder:** T04, T03, T27  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_og_E1X_gruppe_b_to_perioder` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Varebil klasse 2 er en ren avgiftsmessig definisjon (gruppe b) med lavere avgift; vilkår i forskrift § 2-3 (lasterom, beskyttelsesvegg); Statens vegvesen avgjør klassifiseringen. _(kilde T03, 3.3.3.1–3.3.3.2, lest 2026-10-15)_
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Avgiftsgruppe b, fra 2026-09-01: CO2-sats 450 kr per g/km (0–100 g/km), 600 kr (101–150), 1 200 kr (over 150). _(kilde T31, Vedtak 1131/1132 (revidert 2026), verifisert 2026-10-16)_
  - Grunnvedtaket for 2026 er Vedtak 220. _(kilde T30, Vedtak 220, verifisert 2026-10-16)_
  - Gruppe b 2026-01-01–2026-08-31: vektkomponent 30 kr/kg over 1 200 kg; CO2 0–100 g/km 300 kr/g, 101–150 600, over 150 1 200. _(kilde T30, Vedtak 220 (gruppe b), verifisert 2026-10-16)_
- **Datert parameter DP-WEIGHT-B-2026-01-01:** Vektkomponent, avgiftsgruppe b fra **2026-01-01** (NOK per kg over terskel): over 1200 kg = 30 (gruppe b, til 2026-08-31). Før fra-datoen: UKJENT – tiden før fra-datoen er ikke dokumentert for denne parameteren (skal gi not_calculated). Etter til-datoen: UKJENT – vektsats for gruppe b fra 2026-09-01 er ikke oppgitt (ikke anta 30). Ikke godkjente implementasjonsforutsetninger: Vektsats fra 2026-09-01 er ukjent: skal gi not_calculated, ikke 30.
- **Datert parameter DP-CO2-B-2026-01-01:** CO2-komponent, avgiftsgruppe b fra **2026-01-01** (NOK per g/km): 0–100 g/km = 300; 101–150 g/km = 600; 151–∞ g/km = 1200 (gruppe b, til 2026-08-31). Før fra-datoen: UKJENT – tiden før fra-datoen er ikke dokumentert for denne parameteren (skal gi not_calculated). Etter til-datoen: dekket av DP-CO2-B-2026-09-01. Ikke godkjente implementasjonsforutsetninger: Trinnvis/marginal beregning og styrende hendelsesdato er IKKE gitt.
- **Datert parameter DP-CO2-B-2026-09-01:** CO2-komponent, avgiftsgruppe b fra **2026-09-01** (NOK per g/km): 0–100 g/km = 450; 101–150 g/km = 600; 151–∞ g/km = 1200 (gruppe b, til åpen). Før fra-datoen: dekket av DP-CO2-B-2026-01-01 (til og med 2026-08-31). Etter til-datoen: n/a. Ikke godkjente implementasjonsforutsetninger: Om bånd regnes trinnvis (marginalt) eller som flat sats i hvert intervall er IKKE gitt; Hvilken dato som styrer (registrering eller innførsel) er IKKE gitt; Om satsene gjelder varebil klasse 2 elbil/hybrid er IKKE gitt.
- **Lead (ikke regel):**
  - Komitéinnstilling omtaler forslag om at CO2-komponenten for varebil skal være 50 % av personbil; ikke bekreftet vedtatt. _(kilde T27; Ikke avgjort om gruppe b ble endret. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Vektsats gruppe b fra 2026-09-01 er ikke oppgitt (ukjent).
  - Trinnvis/marginal beregning og styrende hendelsesdato (registrering/innførsel) er ikke gitt.
  - Forskrift § 2-3 (klassifisering varebil klasse 2) ikke adressert.
  - Hvilken dato som styrer hvilken sats ved innførsel før og registrering etter 1.9.2026.

### R-OTA-009 — Varebil klasse 1/2, avgiftsgruppe og hvem som avgjør

- **Komponent:** Kjøretøyklassifisering  
- **Profiler:** VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** teknisk klasse N1; seteplass bak førersete; fast skillevegg/lasterom (mål); Statens vegvesens avgiftsgruppe  
- **Formel/trinn (struktur):** klasse 2 = N1 uten sete bak fører (+ lastromkrav); klasse 1 = N1 som ikke oppfyller dette; klasse 2 → gruppe b, klasse 1 → gruppe a  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Definisjonene fra eldre versjon; gjeldende tekst må leses.  
- **Kilder:** T05, T15, T03  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_forskrift_ikke_lest` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Statens vegvesen avgjør i første instans avgiftsmessig klassifisering (forskrift § 2-1); kan påklages til Skattedirektoratet via SVV. _(kilde T03, 3.3.1, lest 2026-10-15)_
  - Varebil klasse 1 er N1 som ikke oppfyller kravene til varebil klasse 2; personbil (M1) har inntil åtte seter i tillegg til fører. Busser under 6 m med inntil 17 seter hører til gruppe a (klasse 1) eller j (klasse 2). _(kilde T03, 3.3.2, lest 2026-10-15)_
  - Obligatorisk enkeltgodkjenning på trafikkstasjon av bruktimporterte kjøretøy før beregning og forhåndsbetaling av engangsavgiften; SVV leverer tekniske grunnlagsdata. _(kilde T03, 3.1, lest 2026-10-15)_
  - Avgiftsplikt oppstår primært ved første gangs registrering i Kjøretøyregisteret. _(kilde T03, 2.1.1, lest 2026-10-15)_
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Statens vegvesens kodeverk AVGIFT finnes som offisielt kodesystem; kode 315 = Varebil klasse 2, fortollet etter 31.3.2001. _(kilde T15, Kodeverk AVGIFT, verifisert 2026-10-16)_
- **Lead (ikke regel):**
  - Varebil klasse 2: N1 uten sete/sitteanordning bak føreren; pick-up-regel om lasteplan; klasse 1 faller i gruppe a. Statens vegvesen avgjør klassifiseringen og vedtaket kan påklages. _(kilde T05/T15; Sammendrag av eldre rundskriv og forskrift.)_
- **Uløste spørsmål:**
  - Gjeldende presis definisjon, målekrav til lasterom.
  - Hva dokumenterer klassen (vognkort, typegodkjenning, vegvesenvedtak) for utenlandsk bil som ennå ikke er registrert i Norge?
  - Hvordan påvirker ombygging klassifiseringen, og hvilke kostnader/godkjenninger gjelder?
  - Teknisk klassifisering (kjøretøyets kode) er ikke det samme som avgiftsbehandling; implementasjon må holde dem adskilt og hente avgiftsgruppe fra kodeverk + vedtak, ikke fra karosseri.
  - Hele kodelisten er ikke gitt.

### R-OTA-010 — Ordinært bruksfradrag: tabellmetode (avgrenset: trinndato finnes; ikke U-009-vinduet; under 20 år)

- **Komponent:** Bruksfradrag  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** første utenlandske registreringsdato (dag/måned); planlagt norsk registreringsdato; grunnlaget fradraget gjelder  
- **Formel/trinn (struktur):** fradrag = prosent (alder, dato til dato) av beregnet engangsavgift etter §§ 2 og 3; alder = tid fra første registrering i utlandet til første registrering i Norge  
- **Beløp/enhet/avrunding:** Prosenttrinn 2–100 pst etter tabell i forskrift § 3-3 (41 trinn; T05, T07, T42 identiske). Fradraget gjøres i avgiften etter §§ 2 og 3 (vedtak § 4). Avrunding: sluttkravet (R-OTA-014); prosentfradrag og mellomsummer avrundes ikke (U-012, ikke omtalt i kilder).  
- **Dato fra/til:** 2024-01-01 / åpen — Gjeldende tabellversjon i kraft 1. januar 2024 (forskrift 18. des 2023 nr. 2154; T42). Ingen dokumentert sluttdato. Anvendelsen i 2026 følger vedtaket § 4 (fra 1. januar 2026).  
- **Styrende hendelse:** Første gangs registrering av brukte motorvogner i Norge (forskrift § 3-3 første ledd; vedtak § 4)  
- **Avgrensning:** Omfang (inne): ordinær tabellmetode (forskrift § 3-3) med 41 trinn; alder fra første gangs registrering i utlandet til første gangs registrering her i landet, dato til dato; trinn nås på dagen for trinndatoen, også månedstrinn (kildens ordlyd, se e1Findings); fradrag i avgiften etter §§ 2 og 3, ikke i vrakpantavgiften; 20-årsregelen: 20 år fra 1. januar i året 20 år er gått · Utenfor omfang (uavklart): trinndato som ikke finnes i målmåneden (første registrering dag 29–31): R-OTA-016 / U-009; blokkert i vinduet; motorvogn 20 år eller eldre: 100 pst fradrag er belagt, men setningen «Avgiften kan likevel ikke settes lavere enn den avgift som skal svares for motorvogner som på innførselstidspunktet er 20 år eller eldre» er ikke utledet (R-OTA-011); motoren gir advarsel, ikke blokkering; alternativ beregning (§ 3-4): utenfor MVP · Avgrenset fra: R-OTA-010 (E1P) · Sporbarhet: Det uavklarte (dag 29–31) er flyttet til R-OTA-016.  
- **Kilder:** T07, T03, T05, T42, T47, T43  
- **Evidensnivå:** E1 · **Status:** `E1_avgrenset_U009_i_R-OTA-016_parameter_ikke_godkjent` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Ordinært bruksfradrag gis som prosentvis fradrag i den utregnede avgiften etter tabell i forskrift § 3-3 (4.3). Alder regnes fra første gangs registrering i utlandet til registrering i Norge, dato til dato (4.2). _(kilde T03, 4.2–4.3, lest 2026-10-15)_
  - Tabellen (41 trinn) fra 2 % ved 1 måned til 100 % ved 20 år er transkribert fra Skatteetatens engelske satsside (bruksfradrag-tabell-T07.json). _(kilde T07, tabell, lest 2026-10-15)_
  - § 3-3: «Ved første gangs registrering av brukte motorvogner gjøres det følgende fradrag i avgiften» – tabell «Alder over 1 måned 2 pst.» … «Alder over 18 år 98 pst», «Alder 20 år eller eldre 100 pst» (41 trinn; identisk med T07/T42). _(kilde T05, § 3-3 første ledd (PDF s. 5–6), lest 2026-10-18)_
  - § 3-3: «Ved fastsettelse av motorvognens alder skal tidspunktet for første gangs registrering legges til grunn. En motorvogn anses å være 20 år 1. januar i det året det har gått 20 år siden første gangs registrering.» _(kilde T05, § 3-3 tredje ledd (PDF s. 6), lest 2026-10-18)_
  - Bruksfradraget regnes fra første gang registrert i utlandet til første gang registrert i Norge. «Merk at neste steg i bruksfradragstabellen oppnås på dagen kjøretøyet "fyller år", med unntak for siste steg, da ansees kjøretøyet å være 20 år fra og med 1. januar dette året.» _(kilde T42, PDF s. 1–2, lest 2026-10-18)_
  - Norsk, juridisk ordlyd bruker «første gangs registrering» (ikke «production» som i den engelske satssiden T07). _(kilde T05, § 3-3 tredje ledd, lest 2026-10-18)_
  - Rekkefølge: avgiften regnes ut først («utregnede avgiften»/«i avgiften»), deretter trekkes prosentfradraget; ingen kilde sier noe om avrunding av beløp, mellomsummer eller prosent. _(kilde T05, § 3-3 første ledd; § 5-2 andre ledd; T03 4.3, lest 2026-10-18)_
  - Konsolidert vedtak § 4: «For motorvogner som har vært registrert i utlandet før registrering her i landet, gjøres fradrag i den avgift som beregnes etter §§ 2 og 3 basert på motorvognens alder (bruksfradrag). Departementet kan gi forskrift om fastsettelse av bruksfradrag.» Fradraget gjelder avgiften etter §§ 2 og 3 (ikke vrakpantavgiften etter § 5); tabellen står i forskrift § 3-3 (T05). _(kilde T47, § 4, lest 2026-10-18)_
  - Forskrift § 3-3 første ledd: «Ved første gangs registrering av brukte motorvogner gjøres det følgende fradrag i avgiften»; tabellen angir «Alder over 1 måned 2 pst.» … «Alder over 18 år 98 pst», «Alder 20 år eller eldre 100 pst». _(kilde T05, § 3-3 første ledd (PDF s. 5–6), lest 2026-10-18)_
  - Rundskriv 4.2: «Motorvognens alder regnes fra det tidspunktet motorvognen ble registrert første gang i utlandet og frem til tidspunktet motorvognen registreres her i landet. Bruksfradraget skal regnes fra dato til dato.» Eksempelet (15. januar → ett-års fradrag 15. januar året etter) er et årseksempel, men setningen «regnes fra dato til dato» er generell og ikke avgrenset til hele år. _(kilde T03, 4.2, lest 2026-10-18)_
  - T42: «Merk at neste steg i bruksfradragstabellen oppnås på dagen kjøretøyet «fyller år», med unntak for siste steg, da ansees kjøretøyet å være 20 år fra og med 1. januar dette året.» Ordlyden gjelder «neste steg» i tabellen (som har både måneds- og årstrinn), og den eneste uttrykte unntaket er siste steg. «Fyller år» er årsformulert; det finnes ikke noe eksplisitt månedseksempel, og ingen kilde gir en annen regel for månedstrinn. Tabellen sier «Alder over …», men T42 presiserer at steget oppnås på dagen. _(kilde T42, PDF s. 1–2 (visuelt lest), lest 2026-10-18)_
  - Forskrift § 3-3 tredje ledd: «Ved fastsettelse av motorvognens alder skal tidspunktet for første gangs registrering legges til grunn.» _(kilde T05, § 3-3 tredje ledd (PDF s. 6), lest 2026-10-18)_
  - § 3-3 er sist endret ved forskrift 18. des 2023 nr. 2154 (i kraft 1. jan 2024); T42: «Med virkning fra 1. januar 2024 er det gjort endringer i bruksfradragstabellen … nytt steg (20 år).» Dette er ikrafttredelsen av gjeldende tabellversjon. _(kilde T05, § 3-3, fotnote om endringer (PDF s. 6); T42 PDF s. 2, lest 2026-10-18)_
- **Lesing av ordlyd:** Månedstrinn behandles som øvrige trinn (dato til dato; neste steg på dagen) fordi ordlyden i T03 4.2 og T42 er generell og eneste uttrykte unntak er siste steg. Det er en lesing av hele ordlyden, ikke et eksplisitt månedseksempel i kilden. Ingen ny blokkering på månedstrinndager er innført; U-009 beholdes uendret.
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Ordinært bruksfradrag er aldersbasert; relevant periode er første registrering i utlandet til første registrering i Norge; tabellen går til 100 % ved 20 år. _(kilde T32, Deduction for use + tabellside, verifisert 2026-10-16)_
  - Tabellen går til 100 % ved 20 år (også bekreftet eksternt for T07; T07 er i tillegg lest lokalt, E1). _(kilde T32, Deduction for use table (T07), verifisert 2026-10-16)_
- **Lead (ikke regel):**
  - Standardiserte prosentsatser etter alder; alternativ individuell metode finnes (utenfor første motor). _(kilde T06)_
  - Lovdata-sammendrag av § 3-3 viser trappen 16 % (>9 mnd), 17 % (>10), 18 % (>11) … 100 % (≥ 20 år) – samsvarer med T07 for de viste trinnene. _(kilde T05)_
- **Uløste spørsmål:**
  - U-009 → R-OTA-016: trinndato som ikke finnes i målmåneden (dag 29–31); motoren blokkerer i vinduet.
  - Motorvogn 20 år eller eldre: minimumssetningen i § 3-3 («ikke lavere enn avgift for 20 år eller eldre») er ikke utledet (R-OTA-011); advarsel, ikke blokkering.
  - Alternativ beregning (§ 3-4) er utenfor MVP.
  - Avrunding: R-OTA-014; prosentfradrag og mellomsummer avrundes ikke (U-012).
  - Forventet norsk registreringsdato er en forutsetning (ECON-001); styrende hendelse er faktisk første registrering.

### R-OTA-016 — Månedstrinn der målmånedens dato ikke finnes (første registrering dag 29–31) — uavklart og blokkert

- **Komponent:** Bruksfradrag  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** første registreringsdag (29–31); norsk registreringsdato  
- **Formel/trinn (struktur):** Ikke fastsatt: kilden angir ikke hvilken dato et trinn nås når målmåneden er kortere enn registreringsdagen.  
- **Beløp/enhet/avrunding:** Ikke fastsatt. Motoren regner begge kandidater (siste dag i måneden / 1. i neste måned) og blokkerer med age_step_boundary_ambiguous bare når norsk registreringsdato ligger i vinduet mellom dem.  
- **Dato fra/til:** ukjent / åpen — Ikke fastsatt (kilden er taus).  
- **Styrende hendelse:** Første gangs registrering av brukte motorvogner i Norge (forskrift § 3-3 første ledd)  
- **Avgrensning:** Utskilt fra: R-OTA-010  
- **Kilder:** T05, T42, T03  
- **Evidensnivå:** E1P · **Status:** `E1P_uavklart_blokkert_i_vinduet_U009` · **Kontrollert dato:** 2026-10-18 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Forskrift § 3-3, tabellen og T42 inneholder ingen bestemmelse om trinndato når registreringsdagen (29–31) ikke finnes i målmåneden. Rundskriv 4.2 gir bare eksempelet 15. januar → 15. januar året etter, og T42 sier at neste steg nås på dagen kjøretøyet «fyller år». _(kilde T05, § 3-3 (PDF s. 5–6); T42 PDF s. 1–2; T03 4.2, lest 2026-10-18)_
- **Uløste spørsmål:**
  - U-009: hva som skjer når trinndatoen ikke finnes i målmåneden (f.eks. første registrering 31. januar, trinn «1 måned»): ingen kilde sier om trinnet nås siste dag i måneden eller 1. i neste måned.
  - Utenfor vinduet er utfallet identisk under begge lesninger (motoren regner begge).

### R-OTA-011 — Aldersgrense 20 år / fritak

- **Komponent:** Bruksfradrag  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** alder ved norsk registrering  
- **Formel/trinn (struktur):** kjøretøy ≥ 20 år: ingen engangsavgift (sammendrag)  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2024-01-01 (lead) / ukjent — Sammenheng med Stortingsvedtakets pkt. 9 bokstav p (avvikling) uklar.  
- **Kilder:** T06, T07, T03  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_forskrift_ikke_lest` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Fritaket for kjøretøy ≥ 20 år i stortingsvedtaket er opphevet fra 1.1.2024; kjøretøyet innvilges i stedet 100 % bruksfradrag (forskrift § 3-3). _(kilde T03, 6.21, lest 2026-10-15)_
  - En motorvogn anses 20 år 1. januar i det året det har gått 20 år siden første gangs registrering; åpenbart ≥ 20 år gamle kjøretøy kan behandles etter produksjonsår. _(kilde T03, 6.21, lest 2026-10-15)_
  - Tabellen er utvidet med 20-årstrinn (100 %) fra 1.1.2024; siste trinn nås etter 1. januar-regelen, øvrige trinn på datoen (sideteksten bruker ordet «production»). _(kilde T07, forklaringstekst, lest 2026-10-15)_
- **Uløste spørsmål:**
  - Språkforskjell U-002.
  - Forskrift § 3-3 tredje ledd ikke lest.

### R-OTA-012 — Alternativ metode (individuell, pris og km)

- **Komponent:** Bruksfradrag  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** pris og kilometerstand  
- **Formel/trinn (struktur):** utenfor første motor  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — UTENFOR første motor.  
- **Kilder:** T06  
- **Evidensnivå:** E1X · **Status:** `utenfor_første_motor_E1X_dokumentert` · **Kontrollert dato:** 2026-10-16 · **Godkjent parameter:** nei
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Alternativ beregning av bruksfradrag finnes og er bindende når den er valgt. _(kilde T32, Deduction for use, verifisert 2026-10-16)_
- **Lead (ikke regel):**
  - Alternativ metode er individuell og dokumentkrevende. _(kilde T06)_
- **Uløste spørsmål:**
  - Utenfor første motor. Detaljer (søknad, beregning, kjøretøy som omfattes) ikke gitt i denne pakken (rundskriv 4.4 er ikke lest i detalj).

### R-OTA-013 — Fritak/særordninger i engangsavgiften

- **Komponent:** Fritak  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** særskilt grunnlag  
- **Formel/trinn (struktur):** ingen særordninger støttes i første motor  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ikke kartlagt.  
- **Kilder:** T05, T04  
- **Evidensnivå:** E2 · **Status:** `utenfor_første_motor` · **Kontrollert dato:** ingen · **Godkjent parameter:** nei
- **Lead (ikke regel):**
  - Fritak finnes (forskrift kap. IV); innhold ikke lest. _(kilde T05)_
- **Uløste spørsmål:**
  - Hvilke fritak er relevante for forhandlerimport?

### R-OTA-014 — Avrunding av skatte- og avgiftskrav ned til nærmeste hele krone (skattebetalingsforskriften § 10-4-4) – sluttkravet, ikke mellomledd

- **Komponent:** Engangsavgift – avrunding av avgiftskravet  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** det samlede engangsavgiftskravet (eksakt desimal)  
- **Formel/trinn (struktur):** sluttkrav = floor(eksakt avgift etter bruksfradrag + vrakpantavgift); mellomledd (kg × sats, CO2-bånd, sum, prosentfradrag) avrundes ikke  
- **Beløp/enhet/avrunding:** Ned til nærmeste hele krone, bare for det samlede kravet (T46 § 10-4-4; T45). Mellomledd: ingen regel funnet (U-012). Vrakpantavgift er heltall.  
- **Dato fra/til:** 2010-04-01 / åpen — § 10-4-4 «Endret ved forskrift 25 mars 2010 nr. 462 (i kraft 1 april 2010, tidligere § 10-4-3)»; forskriften sist endret FOR-2026-06-26-1385.  
- **Styrende hendelse:** Beregning av skatte- og avgiftskravet (skattebetalingsforskriften § 10-4-4: «Ved beregning av skatte- og avgiftskrav»); for engangsavgift skjer beregningen ved første gangs registrering (vedtak § 1)  
- **Kilder:** T46, T45, T49, T47  
- **Evidensnivå:** E1P · **Status:** `E1P_regel_lest_anvendelse_paa_engangsavgift_sluttkrav_utledet_fra_virkeomraade` · **Kontrollert dato:** 2026-10-18 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - «Ved beregning av skatte- og avgiftskrav avrundes beløpet ned til nærmeste hele krone.» _(kilde T46, § 10-4-4 (konsolidert; endret 25 mars 2010 nr. 462, i kraft 1 april 2010), lest 2026-10-18)_
  - Skattedirektoratets håndbok: «Ved beregning av skatte- og avgiftskrav avrundes beløpet ned til nærmeste hele krone. Tilsvarende gjelder ved beregning av forsinkelsesrenter. … Bestemmelsen medfører at skatte- og avgiftsregnskapene ikke vil inneholde ørebeløp.» (publisert 24.06.2026) _(kilde T45, avsnitt «Skattebetalingsforskriften § 10-4-4 – Avrunding», lest 2026-10-18)_
  - Skattebetalingsloven § 1-1 (2): «Med skatte- og avgiftskrav menes … i. særavgifter omfattet av lov 19. juni 1959 nr. 2 om avgifter vedrørende motorkjøretøyer og båter». Engangsavgiften er fastsatt etter denne loven (vedtak § 1; hjemmel LOV-1959-06-19-2). _(kilde T49, § 1-1 (2) i; T47 § 1 og hjemmelslinje, lest 2026-10-18)_
  - Skattebetalingsloven § 10-40 (1) c: «engangsavgiften for registrerte virksomheter, som forfaller til betaling den 18. i måneden etter at avgiftsplikten oppstod» — engangsavgift er et krav under kapittel 10. _(kilde T49, § 10-40 første ledd c, lest 2026-10-18)_
  - Skattebetalingsforskriften § 10-4-1 første ledd d: «engangsavgift på motorvogner, hvor beløpsgrensen er 200 kroner» — regelfamilien § 10-4-1…10-4-4 nevner engangsavgift uttrykkelig. _(kilde T46, § 10-4-1 d, lest 2026-10-18)_
  - Skattebetalingsloven § 10-4: «Departementet kan i forskrift gi regler til utfylling og gjennomføring av bestemmelsene i dette kapitlet, og herunder bestemme at skatte- og avgiftskrav som er lavere enn en nærmere fastsatt beløpsgrense, ikke skal betales eller tilbakebetales.» _(kilde T49, § 10-4, lest 2026-10-18)_
- **Uløste spørsmål:**
  - Skattebetalingsforskriften § 10-4-4 nevner ikke engangsavgift uttrykkelig; anvendelsen følger av at engangsavgift er et «avgiftskrav» (skattebetalingsloven § 1-1 (2) bokstav i: særavgifter etter lov 19. juni 1959 nr. 2), at skattebetalingsloven § 10-40 (1) c regulerer forfall for engangsavgift, og at forskriften § 10-4-1 d (samme § 10-4) nevner engangsavgift på motorvogner (200 kr).
  - Hjemmel: skattebetalingsloven § 10-4 gir forskriftshjemmel «til utfylling og gjennomføring av bestemmelsene i dette kapitlet» (kap. 10 Forfall); håndboken (T45) beskriver regelen som generell for skatte- og avgiftskrav («regnskapene ikke vil inneholde ørebeløp»). Om avrunding «ved beregning» av engangsavgift er omfattet av kapittel 10-hjemmelen er ikke uttrykkelig avklart.
  - Mellomledd: ingen kilde omtaler avrunding av kg × sats, CO2-bånd, sum før fradrag eller prosentfradrag (U-012). Motoren avrunder ikke mellomledd (implementasjonskonklusjon).
  - Lov 19 juni 2026 nr. 41 (ikke i kraft per hentedato) endrer bl.a. skattebetalingsloven § 1-1 og § 10-40; innhold og virkning er ikke lest.
  - Om Skatteetatens egen beregning avrunder komponenter eller prosentfradrag (kan gi ±1–2 kr) kan ikke avgjøres fra kildene; golden cases er valideringsreferanser, ikke regelkilde.

### R-IMP-OTH-001 — Vrakpantavgift – del av engangsavgiften, betales ved registrering

- **Komponent:** Vrakpantavgift (innbetaling ved første gangs registrering)  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** kjøretøytype  
- **Formel/trinn (struktur):** Fast beløp pr. kjøretøy etter avgiftsgruppe. Lette lastebiler som blir avgiftspliktige i gruppe b (a/c) svarer 2 400.  
- **Beløp/enhet/avrunding:** 2 400 kr, fast beløp per kjøretøy i avgiftsgruppe a, b, c, g, j og k (rundskriv 3.4); 500 kr moped/motorsykkel; 3 000 kr campingvogn; 5 000 kr lastebil som ikke er avgiftspliktig i gruppe b. Heltall, ingen avrunding.  
- **Dato fra/til:** 2026-01-01 / ukjent — Rundskriv 2026 (1. januar). Skatteetaten-siden viser 2026 valgt. Endring senere i 2026 ikke dokumentert.  
- **Styrende hendelse:** Første gangs registrering i Kjøretøyregisteret (rundskriv 2.1.1 og 3.4); betales sammen med engangsavgiften (T20)  
- **Kilder:** T03, T20  
- **Evidensnivå:** E1 · **Status:** `dokumentert_E1_parameter_ikke_godkjent` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Vrakpantavgift 2 400 kr ved første gangs registrering for motorvogner i avgiftsgruppe a, b, c, g, j, k. _(kilde T03, 3.4 (PDF-side 17), lest 2026-10-15)_
  - Satsside for vrakpantavgift viser 2 400 kr for person-, vare- og campingbiler og busser under 6 m; 500 mopeder/motorsykler; 3 000 campingvogner; 5 000 lastebiler. Årsvelger 2026 valgt. _(kilde T20, satsside, lest 2026-10-15)_
  - Vrakpantavgiften er en del av engangsavgiften og betales sammen med den etter godkjenning hos Statens vegvesen. _(kilde T20, innledning, lest 2026-10-15)_
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Vrakpantavgift 2 400 kr (eksternt bekreftet, TAX-001E). _(kilde T20, Vrakpantavgift, verifisert 2026-10-16)_
- **Uløste spørsmål:**
  - Reduseres vrakpantavgiften av bruksfradrag for brukte kjøretøy? Lest tekst sier bruksfradrag gis «i den utregnede engangsavgiften» (4.1/4.3); vrakpantavgiften omtales som del av engangsavgiften, men at den omfattes av bruksfradrag er IKKE lest. Ikke avgjort.
  - Fritak etter stortingsvedtaket § 9 a–c gir også fritak for vrakpantavgift; relevans for forhandler ikke vurdert.
  - Uavhengig kalkulatorreferanse mangler.

### R-IMP-OTH-002 — Avgift på klimagass i kjøretøyets klimaanlegg

- **Komponent:** Klimagassavgift  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** gasstype; mengde (gram/kg)  
- **Formel/trinn (struktur):** avgift avhenger av type og mengde; typisk ca. 1 kg (sammendrag)  
- **Beløp/enhet/avrunding:** HFK-134a: 2 130,70 kr per kg ekskl. mva. (E1X). Andre gasser, GWP, mengde per kjøretøy og avrunding: IKKE KONTROLLERT.  
- **Dato fra/til:** ukjent / ukjent — Ikrafttredelse/gyldighetsår ikke oppgitt.  
- **Kilder:** T08, T25  
- **Evidensnivå:** E1X · **Status:** `delvis_E1X_hfk134a` · **Kontrollert dato:** 2026-10-16 · **Godkjent parameter:** nei
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Klimagassavgift for HFK-134a er 2 130,70 kr per kg ekskl. mva. _(kilde T25, Klimagassavgift, verifisert 2026-10-16)_
- **Lead (ikke regel):**
  - Avgift på klimagass; mengde ca. 1 kg for typisk personbil (sammendrag). _(kilde T08)_
  - Sats for HFK/PFK: 1,639 kr pr. kg × GWP nevnt, og HFK-134a 2 130,70 kr/kg nevnt på en annen side. Gjelder klimaanlegg i importerte kjøretøy. _(kilde T25; KILDEKONFLIKT mellom sammendrag. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter] [LØST TAX-001E: 2 130,70 kr/kg for HFK-134a; 1,639 er sannsynligvis sats per GWP-enhet (1,639 × 1 300 = 2 130,7) – GWP-verdien er ikke levert som kilde])_
- **Uløste spørsmål:**
  - Hvilken gass og mengde et konkret kjøretøy har (vehicle-specific; ukjent inntil dokumentert).
  - Satser for andre gasser og GWP-kilde.
  - Om elbil/varebil omfattes.
  - Ikrafttredelse.

### R-IMP-OTH-003 — Registreringsgebyr, merker og lignende

- **Komponent:** Øvrige gebyr  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** —  
- **Formel/trinn (struktur):** ikke kartlagt  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ikke undersøkt.  
- **Kilder:** ingen  
- **Evidensnivå:** E2 · **Status:** `ikke_undersøkt` · **Kontrollert dato:** ingen · **Godkjent parameter:** nei
- **Uløste spørsmål:**
  - Hvilke gebyrer hos Statens vegvesen er obligatoriske ved førstegangsregistrering?
  - Omregistreringsavgift er en annen avgift og er ikke antatt relevant ved førstegangsregistrering.

### R-DED-001 — Inngående mva. på personkjøretøy kjøpt/innført for videresalg

- **Komponent:** Fradragsrett  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** importørens mva.-registrering; bilen er salgsvare (lager); dokumentasjon  
- **Formel/trinn (struktur):** fradrag etter mval. § 8-4 første ledd bokstav a (unntak fra personkjøretøyforbudet) – gjelder også innførselsmva. (sammendrag)  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ikke kontrollert.  
- **Kilder:** T12, T11, T22, T28  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_og_E1X_videresalg_unntak` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Hovedregel: ingen fradragsrett for inngående avgift på personkjøretøy. Unntak etter mval. § 8-4 første ledd annet punktum bokstav a: anskaffelse av personkjøretøy for videresalg (kodifisert fra 1.3.2004). _(kilde T22, «Unntak fra hovedregelen» – Videresalg, lest 2026-10-15)_
  - Fradragsretten omfatter vedlikehold, reparasjoner og klargjøring, og drivstoff ved forflytning av salgsvarer fra lager/importsted til utsalgssted. _(kilde T22, «Vedlikehold, reparasjoner, klargjøring», lest 2026-10-15)_
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Inngående mva. på personkjøretøy kan fradragsføres når kjøretøyet anskaffes for videresalg; dette er et uttrykkelig unntak fra den ordinære fradragsbegrensningen for personkjøretøy. _(kilde T36, Håndbok § 8-4.3 (utgave 2023), verifisert 2026-10-16)_
- **Lead (ikke regel):**
  - Håndbok (sammendrag): tilbakeføring etter § 9-6 gjelder utleie/persontransport, ikke videresalg; eksport utløser ikke tilbakeføring; åtteårsregel. _(kilde T28; Vilkår for importørens videresalg ikke lest; forhandlerprofil ikke dokumentert. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Gjelder KUN anskaffelse for videresalg; ikke generalisert til utleie, privat bruk eller andre profiler.
  - Innførselsmva. spesielt, varebil, bindingstid/tilbakeføring og importørprofil er ikke gitt.
  - Utgaver: 2023 (E1X) og 2025 (E1).

### R-DED-002 — Tilbakeføring av fradragsført mva. (åtte år)

- **Komponent:** Fradragsrett  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** omdisponering  
- **Formel/trinn (struktur):** tilbakeføring ved omdisponering de første åtte år  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Utenfor første motor.  
- **Kilder:** T12  
- **Evidensnivå:** E2 · **Status:** `utenfor_første_motor` · **Kontrollert dato:** ingen · **Godkjent parameter:** nei
- **Lead (ikke regel):**
  - § 9-6: tilbakeføring ved omdisponering de første åtte årene. _(kilde T12)_

### R-DED-003 — Salgs-mva. ved importørens salg av bruktimportert bil

- **Komponent:** Salgs-mva.  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** salgsprofil  
- **Formel/trinn (struktur):** utenfor budsjettmodellen (DEC-030); ikke del av TAX-001A  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Utenfor.  
- **Kilder:** T13  
- **Evidensnivå:** E2 · **Status:** `utenfor_første_motor` · **Kontrollert dato:** ingen · **Godkjent parameter:** nei

### R-FOR-001 — Tyskland: skattefri utførsel til tredjeland (Norge)

- **Komponent:** Utenlandsk mva.  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** land = DE; kjøper/mottaker; hvem transporterer; utførselsbevis med VIN  
- **Formel/trinn (struktur):** netto eksportfaktura når vilkår og bevis er oppfylt  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Tysk rettsstilling per 2026 ikke kontrollert.  
- **Kilder:** T16  
- **Evidensnivå:** E1X · **Status:** `delvis_E1X_vilkår_ikke_gitt` · **Kontrollert dato:** 2026-10-16 · **Godkjent parameter:** nei
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Kvalifiserende utførselsleveranser kan være mva.-fritatt; berettigelse avhenger av lovens vilkår (§ 4, § 6 UStG). _(kilde T38, UStG § 4, verifisert 2026-10-16)_
  - Kvalifiserende utførselsleveranser kan være mva.-fritatt; berettigelse avhenger av lovens vilkår. _(kilde T39, UStG § 6, verifisert 2026-10-16)_
- **Lead (ikke regel):**
  - Skattefri utførsel avhenger av hvem som flytter varen; ved selvhenting kreves utenlandsk kjøper. Utførselsbevis for registreringspliktige kjøretøy må inneholde VIN; vanligvis tollbekreftet utgang. _(kilde T16)_
- **Uløste spørsmål:**
  - Lovens vilkår (Abholfall, bevis, utenlandsk kjøper) ikke gitt; ingen enkeltannonse kan antas å kvalifisere. Annonsepåstander, land eller «MwSt. ausweisbar» gir ikke netto eksportpris.

### R-FOR-002 — Tyskland: differansebeskatning (§ 25a UStG)

- **Komponent:** Utenlandsk mva.  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** regime = margin; faktura viser ikke mva.  
- **Formel/trinn (struktur):** normal mva. kan ikke deles mekanisk ut av prisen  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ikke kontrollert.  
- **Kilder:** T17, T29  
- **Evidensnivå:** E1X · **Status:** `delvis_E1X_vilkår_ikke_gitt` · **Kontrollert dato:** 2026-10-16 · **Godkjent parameter:** nei
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Tysk differansebeskatning finnes for kvalifiserende gjenselgertransaksjoner. _(kilde T17, UStG § 25a, verifisert 2026-10-16)_
- **Lead (ikke regel):**
  - Utførselsfritak består under differansebeskatning (sammendrag); vilkår: gjenselger av brukte gjenstander. _(kilde T17; Hva dette betyr for faktisk fakturabeløp er ikke avklart.)_
  - UStH (sammendrag): § 25a krever bl.a. at gjenstanden er anskaffet i Fellesskapet uten mva. eller også med differansebeskatning; faktura må ha «Gebrauchtgegenstände/Sonderregelung». _(kilde T29; Forholdet til § 6-utførsel ikke avklart i sammendragene. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Vilkår, fakturakrav og forhold til § 6-utførsel ikke gitt; ingen enkeltannonse kan antas å være margin- eller nettoeksport uten at annonsen/kilden bekrefter det.

### R-FOR-003 — Privat salg og ukjent regime

- **Komponent:** Utenlandsk mva.  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** selgertype; regime  
- **Formel/trinn (struktur):** ingen mva.-justering uten dokumentert regime; ingen skattekonklusjon fra annonsetekst  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Prosjektregel (CLAUDE.md pkt. 4, DEC-019).  
- **Kilder:** ingen  
- **Evidensnivå:** E2 · **Status:** `prosjektregel` · **Kontrollert dato:** ingen · **Godkjent parameter:** nei
- **Uløste spørsmål:**
  - Tilstrekkelig dokumentasjon for privat salg.

### R-FOR-004 — Landdekning utover Tyskland

- **Komponent:** Utenlandsk mva.  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** land  
- **Formel/trinn (struktur):** støttes ikke uten egen kilde per land  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Bare Tyskland har lead-kilder (T16/T17).  
- **Kilder:** T16  
- **Evidensnivå:** E2 · **Status:** `ikke_undersøkt` · **Kontrollert dato:** ingen · **Godkjent parameter:** nei
- **Uløste spørsmål:**
  - Hvilke land skal støttes først (Østerrike, Nederland, Belgia, Frankrike …)?
  - Bekreftede enkelttilbud fra andre land kan representeres som dokumentert tilbud uten landregel (se purchase-basis.md).

### R-SCR-PAY-001 — Vrakpant som utbetales til biloppsamlingsplass ved skroting – UTENFOR importkostnaden

- **Komponent:** Vrakpantutbetaling (ved skroting)  
- **Profiler:** ingen (utenfor beregning)  
- **Nødvendig input:** —  
- **Formel/trinn (struktur):** Ingen: utbetaling ved skroting er ikke et element i innkjøps- eller importkostnad og trekkes ikke fra kjøpspris.  
- **Beløp/enhet/avrunding:** 3 000 kr for personbil, varebil, campingbil, campingvogn, snøscooter og minibuss/buss under 6 m; 500 kr moped/motorsykkel (utbetaling, 2026 valgt i lest side).  
- **Dato fra/til:** 2026-01-01 / ukjent — Årsvelger 2026; irrelevant for beregningen.  
- **Styrende hendelse:** Skroting/avregistrering – irrelevant for innkjøpsberegning  
- **Kilder:** T09  
- **Evidensnivå:** E1 · **Status:** `utenfor_beregning_begrepsskille` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Vrakpant er beløpet som mottas av biloppsamlingsplassen ved skroting (3 000 kr for flere kjøretøytyper). Beløpsforskjellen mot vrakpantavgift (2 400) er ikke en satskonflikt. _(kilde T09, ingress og Oppsummert, lest 2026-10-15)_

### R-IMP-REF-001 — Refusjon av utenlandsk mva. er en sak mellom kjøper og selger – ikke et sikkert netto kjøpsgrunnlag

- **Komponent:** Refusjon av utenlandsk mva.  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** kjøpsbekreftelse (brutto/netto); refusjonsstatus (agreed|conditional)  
- **Formel/trinn (struktur):** Tolletaten behandler ikke refusjonen. Brutto betalt med senere refusjon: kjøpsgrunnlag = betalt beløp, med mindre dokumentert netto faktura/kjøpsbekreftelse foreligger; avtalt tilbakebetalingskrav → bekreftet inndekning i betalingsforløp; betinget refusjon → bare scenario.  
- **Beløp/enhet/avrunding:** Ingen beløp (strukturell regel). Refusjonsbeløp kommer fra kjøpsbekreftelsen.  
- **Dato fra/til:** ukjent / ukjent — Tolletatens side oppdatert 5.2.2026 (privatperson-side).  
- **Styrende hendelse:** Kjøpsbekreftelse (avtalens innhold)  
- **Kilder:** T21  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_tolletatens_posisjon` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - «Refusjon av utenlandsk merverdiavgift er en sak mellom kjøper og selger. Tolletaten har ingenting med dette å gjøre.» _(kilde T21, Merk-boks før «Ankomst grensen», lest 2026-10-15)_
- **Uløste spørsmål:**
  - Selgerlandets regler for utbetaling/refusjon er ikke lest (T16/T17).
  - Om en konkret avtale er depositum/tilbakebetalingskrav eller betinget refusjon må dokumenteres per tilbud.
  - Siden gjelder privatpersoner; forhandlerens stilling overfor Tolletaten er ikke lest.

### R-FOR-005 — Tyskland: regelsats for mva. (§ 12 UStG)

- **Komponent:** Utenlandsk mva.  
- **Profiler:** ingen (utenfor beregning)  
- **Nødvendig input:** salgsland  
- **Formel/trinn (struktur):** Brutto = netto × (1 + sats) bare når dokumentert regime er ordinær lokal mva. (se purchase-basis.md); sats bestemmes ikke av land alene.  
- **Beløp/enhet/avrunding:** 19 % regelsats (E1X). Redusert sats, avrunding og ikrafttredelse: IKKE KONTROLLERT.  
- **Dato fra/til:** ukjent / ukjent — Gjeldende ved verifisering 2026-10-16; ikrafttredelse ikke oppgitt.  
- **Kilder:** T37  
- **Evidensnivå:** E1X · **Status:** `E1X_regelsats` · **Kontrollert dato:** 2026-10-16 · **Godkjent parameter:** nei
- **E1X-funn (eksternt verifisert, ikke lest av Claude):**
  - Regelsatsen for mva. er 19 %. _(kilde T37, UStG § 12, verifisert 2026-10-16)_
- **Uløste spørsmål:**
  - Om en konkret annonse er ordinær mva., eksport eller margin avgjøres av annonsen/dokumentet, ikke av satsen.

## 3. Kildefortegnelse

| ID | Kilde | Utgiver | Nivå | Lest / status | Versjon | Pakkehash (SHA-256) |
|---|---|---|---|---|---|---|
| T01 | [Importere bil og andre kjøretøy (oversikt)](https://www.skatteetaten.no/person/avgifter/bil/importere/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T02 | [Hva er engangsavgiften? (en: What is the one-off registration tax?)](https://www.skatteetaten.no/person/avgifter/bil/importere/engangsavgift/hva-er-engangsavgiften/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T03 | [Årsrundskriv for engangsavgift 2026 (PDF, 57 sider, datert 1. januar 2026)](https://www.skatteetaten.no/globalassets/rettskilder/avgiftsrundskriv/engangsavgift-2026.pdf) | Skatteetaten (Skattedirektoratet) | E1 | lest 2026-10-15 | Skattedirektoratet, årsrundskriv engangsavgift 2026, datert 1. januar 2026 | 08296e9a32afb53f… |
| T04 | [Stortingsvedtak om engangsavgift på motorvogner mv. for 2026 (FOR-2025-12-18-2755)](https://lovdata.no/dokument/STV/forskrift/2025-12-18-2755) | Lovdata / Stortinget | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T05 | [Forskrift om engangsavgift på motorvogner (FOR-2001-03-19-268)](https://lovdata.no/dokument/SF/forskrift/2001-03-19-268) | Lovdata / Finansdepartementet | E1X | eksternt verifisert 2026-10-16 | — | — |
| T06 | [Bruksfradrag (engangsavgift)](https://www.skatteetaten.no/person/avgifter/bil/importere/engangsavgift/bruksfradrag/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T07 | [Bruksfradragstabell (en: Deduction for use table)](https://www.skatteetaten.no/en/rates/car-rates---deduction-for-use-table/) | Skatteetaten | E1 | lest 2026-10-15 | Skatteetaten, «Deduction for use table» (engelsk sats-side), ukjent sidedato i filen | f91e8040d3443901… |
| T08 | [Andre avgifter ved import (en: Other taxes when importing a vehicle)](https://www.skatteetaten.no/person/avgifter/bil/importere/andre-avgifter/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T09 | [Vrakpant (en: Scrap deposit) – UTBETALING ved skroting (ikke innbetalingen ved registrering)](https://www.skatteetaten.no/en/rates/scrap-deposit/) | Skatteetaten | E1 | lest 2026-10-15 | Skatteetaten, «Scrap deposit», år 2026 valgt i sidens årsvelger | 97103b849c8dac65… |
| T10 | [Beregning av tollavgift og andre avgifter / Betaling av mva. ved import av bil / Fastsettelse av fraktkostnader (sjablong)](https://www.toll.no/no/varer/bil-og-andre-kjoretoy/bilimport/betaling-av-avgifter) | Tolletaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T11 | [Beregning og rapportering av innførselsmva. (guide og PDF)](https://www.skatteetaten.no/globalassets/bedrift-og-organisasjon/avgifter/merverdiavgift/import-mva/beregning-og-bokforing-innforselsmva.pdf) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T12 | [Merverdiavgiftshåndboken kap. 8-4 (personkjøretøy for videresalg) og mval. § 8-1/§ 8-4; kap. 9-6 (tilbakeføring)](https://www.skatteetaten.no/en/rettskilder/type/handboker/merverdiavgiftshandboken/gjeldende/M-8/M-8-4/M-8-4.3/) | Skatteetaten / Lovdata | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T13 | [Merverdiavgiftshåndboken kap. 6 (importørens salg av bruktimportert bil)](https://oppslag.rettskilder.skatteetaten.no/rettskilder2/type/handboker/merverdiavgiftshandboken/gjeldende/MVA2025_M-6) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T14 | [Lovvedtak 14 (2025–2026) om endringer i merverdiavgiftsloven (elbilfritaket) og Innst. 4 L / Skatter og avgifter 2026](https://stortinget.no/no/saker-og-publikasjoner/vedtak/beslutninger/lovvedtak/2025-2026/vedtak-202526-014/) | Stortinget | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T15 | [Kodeverk «Kjøretøygruppe avgift» (AVGIFT)](https://autosys-kjoretoy-api.atlas.vegvesen.no/kodeverk-ui/index-kodeverk.html?kodeverkId=AVGIFT) | Statens vegvesen | E1X | eksternt verifisert 2026-10-16 | — | — |
| T16 | [BMF Umsatzsteuer-Handausgabe § 6 UStG Ausfuhrlieferung (inkl. 6.5 Ausfuhrnachweis)](https://usth.bundesfinanzministerium.de/usth/2023/A-Umsatzsteuergesetz/II-Steuerbefreiungen-und-Steuerverguetungen/Paragraf-6/inhalt.html) | Bundesfinanzministerium (DE) | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T17 | [§ 25a UStG Differenzbesteuerung](https://www.gesetze-im-internet.de/ustg_1980/__25a.html) | gesetze-im-internet.de (DE) | E1X | eksternt verifisert 2026-10-16 | — | — |
| T18 | [Avgiftssatser 2026 (oversikt)](https://www.regjeringen.no/no/tema/okonomi-og-budsjett/skatter-og-avgifter/skatte-og-avgiftssatser/avgiftssatser-2026/id3121982/) | Regjeringen | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T19 | [Forskrift om endring i forskrift om engangsavgift på motorvogner (FOR-2022-12-16-2271)](https://lovdata.no/dokument/LTI/forskrift/2022-12-16-2271) | Lovdata | E2 | ikke_hentet_nettverk_blokkert | — | — |
| S07 | [Skatteetatens importkalkulator (fra SOURCES.md)](https://www.skatteetaten.no/person/avgifter/bil/importere/regn-ut/) | Skatteetaten | E0 | ikke_hentet_nettverk_blokkert | — | — |
| X01 | [Smarte Penger – engangsavgifter på bil (aggregator)](https://www.smartepenger.no/bilokonomi/354-engangsavgifter-pa-bil) | smartepenger.no | E3 | avvist_som_grunnlag | — | — |
| X02 | [Crowe – Statsbudsjettet for 2026](https://www.crowe.com/no/nyheter/statsbudsjettet-for-2026) | crowe.com | E3 | avvist_som_grunnlag | — | — |
| T20 | [Vrakpantavgift (INNBETALING ved første gangs registrering) – satser](https://www.skatteetaten.no/satser/vrakpantavgift/) | Skatteetaten | E1 | lest 2026-10-15 | Skatteetaten, «Vrakpantavgift», 2026 valgt | 1199368756d6df63… |
| T21 | [Import av bil og andre kjøretøy (Tolletaten, oversikt for privatperson)](https://www.toll.no/no/varer/bil-og-andre-kjoretoy/bilimport) | Tolletaten | E1 | lest 2026-10-15 | Tolletaten, «Import av bil og andre kjøretøy», «Oppdatert: 5.2.2026» | fbb5c5fb52406f16… |
| T22 | [Merverdiavgiftshåndboken 8-4.3 (fradragsrett for personkjøretøy ved nærmere bestemt bruk)](https://www.skatteetaten.no/en/rettskilder/type/handboker/merverdiavgiftshandboken/gjeldende/M-8/M-8-4/M-8-4.3/) | Skatteetaten | E1 | lest 2026-10-15 | Merverdiavgiftshåndboken 2025 (sidens tittel i filen) | deff20eba1d073c0… |
| T23 | [Valutakurser (Tolletaten)](https://www.toll.no/no/verktoy/valutakurser) | Tolletaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T24 | [Vareførselshandboken § 6-12 Omregningskurs](https://www.toll.no/no/verktoy/regelverk/handboker/vareforselshandboken/6-12) | Tolletaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T25 | [Avgift på HFK/PFK (klimagass) – satser og kjøretøy](https://www.skatteetaten.no/en/business-and-organisation/vat-and-duties/excise-duties/about-the-excise-duties/hfc-and-pfc/) | Skatteetaten | E1X | eksternt verifisert 2026-10-16 | — | — |
| T26 | [Skatter og avgifter 2026 – stortingsvedtak (oversikt)](https://www.stortinget.no/no/Saker-og-publikasjoner/Vedtak/Vedtak/Sak/?p=104915) | Stortinget | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T27 | [Innst. 3 S (2025–2026) Skatter og avgifter 2026](https://www.stortinget.no/no/Saker-og-publikasjoner/Publikasjoner/Innstillinger/Stortinget/2025-2026/inns-202526-003s/?all=true) | Stortinget | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T28 | [Merverdiavgiftshåndboken 9-6.2 Tilbakeføring av inngående mva. på personkjøretøy](https://www.skatteetaten.no/en/rettskilder/type/handboker/merverdiavgiftshandboken/gjeldende/M-9/M-9-6/M-9-6.2/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T29 | [Umsatzsteuer-Handausgabe § 25a UStG Differenzbesteuerung](https://usth.bundesfinanzministerium.de/usth/2023/A-Umsatzsteuergesetz/VI-Sonderregelungen/Paragraf-25a/inhalt.html) | Bundesfinanzministerium (DE) | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T30 | [Stortinget – Vedtak 220: Engangsavgift på motorvogner mv. for 2026](https://www.stortinget.no/no/Saker-og-publikasjoner/Vedtak/Vedtak/Sak/?did=40035798&p=104911) | Stortinget | E1X | eksternt verifisert 2026-10-16 | — | — |
| T31 | [Stortinget – Revidert 2026, vedtak 1131/1132 (endring av engangsavgift)](https://www.stortinget.no/no/Saker-og-publikasjoner/Vedtak/Vedtak/Sak/?p=200313) | Stortinget | E1X | eksternt verifisert 2026-10-16 | — | — |
| T32 | [Skatteetaten – Deduction for use (bruksfradrag)](https://www.skatteetaten.no/en/person/duties/cars-and-other-vehicles/importing/one-off-registration-tax/deduction-for-use/) | Skatteetaten | E1X | eksternt verifisert 2026-10-16 | — | — |
| T33 | [Tolletaten – Import av bil og andre kjøretøy (eksternt verifiserte fakta)](https://www.toll.no/no/varer/bil-og-andre-kjoretoy/bilimport) | Tolletaten | E1X | eksternt verifisert 2026-10-16 | — | — |
| T34 | [Tolletaten – Incoterms / tollverdi](https://www.toll.no/no/bedrift/import/deklarering-av-varer/incoterms-2010) | Tolletaten | E1X | eksternt verifisert 2026-10-16 | — | — |
| T35 | [Merverdiavgiftshåndboken – § 6-8 (elbil, avgiftsfritak)](https://oppslag.rettskilder.skatteetaten.no/rettskilder2/type/handboker/merverdiavgiftshandboken/gjeldende/MVA2025_M-6) | Skatteetaten | E1X | eksternt verifisert 2026-10-16 | — | — |
| T36 | [Merverdiavgiftshåndboken – § 8-4.3 (utgave 2023)](https://www.skatteetaten.no/rettskilder/type/handboker/merverdiavgiftshandboken/2023/M-8/M-8-4/M-8-4.3/) | Skatteetaten | E1X | eksternt verifisert 2026-10-16 | — | — |
| T37 | [UStG § 12 (Steuersätze)](https://www.gesetze-im-internet.de/ustg_1980/__12.html) | gesetze-im-internet.de (DE) | E1X | eksternt verifisert 2026-10-16 | — | — |
| T38 | [UStG § 4 (Steuerbefreiungen)](https://www.gesetze-im-internet.de/ustg_1980/__4.html) | gesetze-im-internet.de (DE) | E1X | eksternt verifisert 2026-10-16 | — | — |
| T39 | [UStG § 6 (Ausfuhrlieferung)](https://www.gesetze-im-internet.de/ustg_1980/__6.html) | gesetze-im-internet.de (DE) | E1X | eksternt verifisert 2026-10-16 | — | — |

`S07`/`S0x` viser til SOURCES.md. `whatToExtract` per kilde er sjekklisten for en direkte lesning. Kilder med nivå E1 har fullstendig hash i `sources.json`; filene ligger i kildepakken, ikke i Git.

## 4. Avgrensninger
- Første motor: ordinært bruksfradrag. Alternativ metode, fritak/særordninger, tilbakeføring av fradrag og salgs-mva. er utenfor.
- Landdekning: bare Tyskland har lead-kilder; ingen annen utenlandsk regel er påstått.
- DEC-030 gjelder: budsjettsummen skal ikke trekke fra fradragsberettiget mva.; salgspris/margin er ikke påkrevd. Økonomisk kost og kapitalbehov er egne summeringer fra et felles komponentgrunnlag (`purchase-basis.md` §6).
