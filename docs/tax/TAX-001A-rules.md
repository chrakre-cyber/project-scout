# TAX-001A/B/C — regel- og kilderegister (dokumentasjon, ikke regelsett)

Oppdatert **16.10.2026** (TAX-001C: ingen nye primærkilder lest, se `TAX-001C-evidence-status.md`). Status: **REVIEW**. Generert fra `rules.json` og `sources.json`. Dette er et *kartleggingsregister*. Ingen regel her er godkjent som parameter i kode (`usableAsRuleParameter=false` for alle); «dokumentert E1» betyr lest primærkilde, ikke godkjent regelprofil.

## 1. Status for kontrollgrunnlaget

**Seks originale kildefiler** (kildepakke `TAX-001B-handoff`, hentet av Codex 15.10.2026, SHA-256 i `sources.json`) er lest lokalt av Claude: rundskriv for engangsavgift 2026 (T03), bruksfradragstabell (T07), vrakpantutbetaling (T09), vrakpantavgift (T20), Tolletatens bilimportside (T21) og Merverdiavgiftshåndboken 8-4.3 (T22, **2025-utgave**). Nettverket mot norske verter er fortsatt blokkert for Claude; det er ikke lest noe utover pakken.

**Ikke lest:** stortingsvedtaket om engangsavgift (T04, satstabellene for vekt og CO2), forskrift om engangsavgift (T05, §§ 3-1 og 3-3), Tolletatens underordnede sider (T10: tollkurs, sjablongfrakt), Skatteetatens guide til innførselsmva. (T11), elbil-mva. (T14), Statens vegvesen-kodeverk (T15) og tyske kilder (T16/T17). **Ingen satstabell for engangsavgift eller mva.-sats er derfor kontrollert**, og ingen offisiell kalkulator er kjørt.

### Evidensnivåer
| Nivå | Betydning | Brukes som grunnlag? |
|---|---|---|
| E0 | ikke undersøkt | nei |
| E1 | primærkilde lest; regelens `e1Findings` dekkes av lest tekst (kilde, versjon, avsnitt, dato) | dokumentert regel – **ikke** automatisk godkjent parameter |
| E1P | delvis: avgrensede påstander er E1, resten uavklart | bare de enkelte `e1Findings` |
| E2 | sammendrag fra søkeverktøy, ikke lest | nei – lead |
| E3 | sekundærkilde | **avvist** (Smarte Penger, Crowe) |

**Krav før en regel kan godkjennes som parameter** (`approvalRequirements`, håndheves av `check-docs.mjs`): evidenceLevel E1 (ikke E1P) med controlledDate; alle kilder i sources er E1 med publishedVersion og packageSha256; validity.from og governingEvent er satt og begrunnet mot rettskilden; minst ett uavhengig klasse 1-referansetilfelle (offisiell kalkulator/vedtak) eller godkjent dokumentert klasse 2-håndregning; parameterApproval.approved=true med approvedBy og approvedDate (Christian eller delegert) – ikke satt av utvikler alene.

Antall regler: 30 (E1 4, E1P 13, E2 13). Ingen er godkjent.

### Uavklarte kildeopplysninger
- **U-001** (uavklart kildeopplysning): Søkesammendrag av stortingsvedtaket (T04) nevnte en endring med virkning 1.9.2026 (vedtak 19.6.2026). Rundskriv 2026 er datert 1. januar og dokumenterer ikke endringer senere i året. T04 (Lovdata) kunne ikke leses. Ingen regel eller testfasit bygger på påstanden; regler gjelder som versjon pr. 1.1.2026, ikke bekreftet gyldig senere. _(berører: R-OTA-001, R-OTA-002, R-OTA-008)_
- **U-002** (uavklart språkforskjell): Engelsk bruksfradragsside sier at neste trinn nås på 'date of the vehicle's production', mens rundskriv 4.2/6.21 regner fra første gangs registrering i utlandet, dato til dato. Forskrift § 3-3 er ikke lest. Ikke gjettet. _(berører: R-OTA-010, R-OTA-011)_
- **U-003** (versjon avklart: 2025-utgave): Merverdiavgiftshåndbok-siden med URL 'gjeldende' er faktisk merket 2025. Dekning for 2026 ikke kontrollert. _(berører: R-DED-001)_
- **U-004** (uavklart kildekonflikt (E2)): Motstridende satstabeller for CO2/vekt i sammendrag av stortingsvedtaket (Lovdata 450/600/1 200; Stortinget 800/1 600/3 200/5 000). Primærtekst T04 ikke lest. _(berører: R-OTA-001, R-OTA-002, R-OTA-008)_
- **U-005** (uavklart (E1 rundskriv mot E2 sammendrag)): Ladbar hybrid: sammendrag nevner 10 % vektfradrag, rundskriv 2026 (E1) sier vektfradraget er opphevet fra 1.1.2024. Rundskrivet er den kontrollerte kilden, men forskrift/stortingsvedtak ikke lest. _(berører: R-OTA-005)_
- **U-006** (uavklart kildekonflikt (E2)): Klimagassavgift: 1,639 mot 2 130,70 kr/kg i sammendrag. T25 ikke lest. _(berører: R-IMP-OTH-002)_
- **U-007** (uavklart (E2)): Elbil-mva.: 300 000 mot 500 000 kr i sammendrag; ikrafttredelse av lov 19.6.2026 ukjent. T14 ikke lest. _(berører: R-IMP-VAT-003)_
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
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Sats-/grunnlagsdato ikke lest.  
- **Styrende hendelse:** Innførsel/deklarasjon til Tolletaten  
- **Kilder:** T01, T08, T11, T21  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_sats_og_grunnlag_mangler` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Kjøretøy innført av privatperson deklareres og merverdiavgift betales til Tolletaten (ved grensen); deretter engangsavgift til Skatteetaten etter godkjenning; til slutt registrering hos Statens vegvesen. (Betalingsrekkefølge – ikke beregningsrekkefølge eller grunnlag.) _(kilde T21, innledning, «Avgifter du må betale til Tolletaten», lest 2026-10-15)_
- **Lead (ikke regel):**
  - Sammendrag: mva. 25 % av tollverdien for importerte kjøretøy. _(kilde T08; Universell 25 % skal ikke innføres uten kildekontroll (IMPORT_ENGINE_SPEC); elbil har egen regel (R-IMP-VAT-003).)_
  - Skatteetaten (sammendrag): mva.-grunnlag ved innførsel er tollverdi + toll og andre avgifter – tyder på at engangsavgift kan inngå i grunnlaget; sats ikke vist. _(kilde T11; Må leses i T11/mval. § 4-? ; ikke avgjort. 25 % er fortsatt ikke kontrollert. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Inngår engangsavgift i mva.-grunnlaget ved import? (må leses)
  - Rekkefølge: tollverdi → toll → engangsavgift → mva.?
  - Siden gjelder privatpersoner. Næringsdrivende forhandlers deklarasjon/mva.-oppgjør er ikke dokumentert (T11 ikke lest).

### R-IMP-VAT-002 — Tollverdi: kjøpspris + frakt + forsikring til norsk grense

- **Komponent:** Tollverdi  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** kjøpspris i kontrakts-/fakturavaluta; frakt til norsk grense; forsikring til norsk grense; kurs  
- **Formel/trinn (struktur):** tollverdi = kjøpspris + frakt til grensen + forsikring til grensen (sammendrag); frakt etter grensen inngår ikke  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ikke lest.  
- **Styrende hendelse:** Innførsel/deklarasjon til Tolletaten (dato for tollkurs og tollverdi uavklart, se R-IMP-FX-001)  
- **Kilder:** T08, T10, T21  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_grunnlag_overordnet` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - For nylig kjøpt bil beregnes avgiften ut fra kjøpesummen, frakt og forsikring; ellers må bilens verdi dokumenteres, og noen ganger kreves takst. _(kilde T21, «Avgifter du må betale til Tolletaten», lest 2026-10-15)_
- **Lead (ikke regel):**
  - Tollverdi bygges av kjøpspris, frakt og forsikring til norsk grense (Skatteetaten og Tolletaten, sammendrag). _(kilde T08/T10)_
  - For biler kjørt inn på egne hjul brukes Tolletatens sjablongfrakt per land, med rett til å dokumentere faktisk frakt (sammendrag). _(kilde T10)_
- **Uløste spørsmål:**
  - Beløp for sjablongfrakt (land, bilkategori, gyldig dato).
  - Skal kostnader som ikke er del av prisen (f.eks. transaksjonsgebyr, provisjon) inn i tollverdien?
  - Sjablongfrakt, tollkurs og transaksjonsgebyr er ikke lest (T10).

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
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2026-01-01 (lead: 300 000 kr) / ukjent — Videre nedtrapping 2027/2028 er omtalt som beslutning/ønske; status må avklares – FREMTIDIG, ikke i kraft per 2026-10-15.  
- **Kilder:** T14  
- **Evidensnivå:** E2 · **Status:** `fremtidig_ikke_i_kraft` · **Kontrollert dato:** ingen · **Godkjent parameter:** nei
- **Lead (ikke regel):**
  - Stortingets lovvedtak (18.12.2025): fritak for første 300 000 kr av vederlaget fra 1.1.2026 (ned fra 500 000 kr). _(kilde T14)_
  - Videre nedtrapping (150 000 kr per år i 2027 og 2028 forutsatt ESA-godkjenning; regjeringen foreslo full mva. fra 2027) er FREMTIDIG/uenighet. _(kilde T14)_
  - Stortingets lovvedtak (sammendrag): fritak for omsetning av rene elbiler opptil 300 000 kr; et annet sted nevnes 500 000 kr (leasing) – inkonsistent; ny lov 19.6.2026 med ikrafttredelse ved kongelig resolusjon. _(kilde T14; Ikke i kraft-status og innførselsregel uavklart. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Gjelder beløpsgrensen import (innførselsmva.) på samme måte som innenlandsk omsetning? Hva regnes av (tollverdi eller vederlag)?
  - Gjelder grensen brukte elbiler fra utlandet?

### R-OTA-001 — Vektkomponent

- **Komponent:** Engangsavgift gruppe a  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** egenvekt (kg, norsk definisjon); avgiftsgruppe; drivlinje  
- **Formel/trinn (struktur):** komponent = sats × (vekt over terskel) per sats-trinn; ny komponent for alle drivlinjer inkl. elbil fra 2026  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2026-01-01 (lead) / ukjent — Endring i § 3 av 19.6.2026 med virkning 1.9.2026 funnet som lead (innhold ukjent) → minst to regelversjoner i 2026.  
- **Kilder:** T02, T03, T04, T26  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_satser_mangler` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Avgiften beregnes for personbil og varebil i gruppe a og b på grunnlag av egenvekt og CO2-utslipp; satsendringer og omstrukturering av satstabellene i § 3 ble gjort 1.1.2026. _(kilde T03, 3.1, 13.1.1, lest 2026-10-15)_
- **Lead (ikke regel):**
  - Bil med forbrenningsmotor: ny vektkomponent + generell engangsavgift (CO2/egenvekt); elbil: bare vektkomponent (Skatteetaten, sammendrag). _(kilde T02)_
  - Lovdata-sammendrag av stortingsvedtaket (T04) viser vektsats i § 3 over 1 200 kg (260 kr/kg og 30 kr/kg nevnt uten tydelig gruppemapping). _(kilde T04; UBEKREFTET gruppemapping. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
  - Stortingets oversikt (T26) gir CO2-tabell 800/1 600/3 200/5 000 kr for gruppe a – motsier Lovdata-sammendraget (450/600/1 200). _(kilde T26; KILDEKONFLIKT mellom sammendragene; ingen sats kan velges. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Satser, terskler og trinn står i stortingsvedtaket §§ 2–3 (T04) – ikke lest.
  - Uavklart kildeopplysning U-001 (påstått endring 1.9.2026) er ikke kontrollert.

### R-OTA-002 — CO2-komponent

- **Komponent:** Engangsavgift gruppe a  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV  
- **Nødvendig input:** CO2 g/km; testmetode (WLTP/NEDC); kilde i vognkort/typegodkjenning  
- **Formel/trinn (struktur):** komponent = sats-trapp over CO2-bånd; CO2 fra registrert verdi, ellers anslag  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2026-01-01 (lead) / ukjent — Se R-OTA-001 for 1.9.2026.  
- **Kilder:** T02, T03, T04  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_satser_mangler` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - CO2 hentes for WLTP-kjøretøy fra samsvarssertifikat (CoC); satstabellen i stortingsvedtaket brukes direkte for WLTP. _(kilde T03, 3.2.5, lest 2026-10-15)_
  - NEDC-godkjente kjøretøy: registrert CO2 justeres opp med fast faktor, 24 % i gruppe a og j og 22 % i gruppe b, før satstabellen. _(kilde T03, 3.2.5, lest 2026-10-15)_
  - EPA/NRCan-målt CO2 beregnes som WLTP. _(kilde T03, 3.2.5, lest 2026-10-15)_
  - Målemetode ukjent: første registrering i utlandet før 1.9.2018 → NEDC-behandling; fra og med 1.9.2018 eller ikke tidligere registrert → WLTP. _(kilde T03, 3.2.5, lest 2026-10-15)_
  - Uten plikt til å oppgi CO2: anslått CO2 = egenvekt/10 (se R-OTA-004). _(kilde T03, 3.2.6, lest 2026-10-15)_
- **Lead (ikke regel):**
  - Hvis Statens vegvesen har registrert CO2, brukes den som hovedregel. _(kilde T02)_
  - CO2-trinn 0–100/101–150/>150 g/km = 450/600/1 200 kr er sitert i Lovdata-sammendrag uten gruppe; 2025-vedtaket har eget fradrag under 70 g/km. _(kilde T04; Gruppe, årgang og overgang ukjent. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Satsbånd og beløp for CO2-komponenten står i stortingsvedtaket §§ 2–3 (T04, ikke lest); rundskrivet inneholder ikke satstabellene.
  - Overgangsregler ved registrering nær årsskifte.

### R-OTA-003 — NOx-komponenten er fjernet fra 1.1.2026

- **Komponent:** Engangsavgift  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** NOx mg/km  
- **Formel/trinn (struktur):** ikke aktuelt hvis komponenten er avviklet  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2026-01-01 / ukjent — Overgang rundt årsskiftet ikke avklart.  
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
- **Dato fra/til:** 2026-01-01 / ukjent — Rundskriv 2026.  
- **Kilder:** T03  
- **Evidensnivå:** E1 · **Status:** `dokumentert_E1_parameter_ikke_godkjent` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Fra 1.1.2026 brukes ikke slagvolum som alternativt grunnlag for motorvogner i gruppe a, b og j uten plikt til å dokumentere CO2; i stedet anslått CO2 (g/km) = egenvekt i kg / 10. _(kilde T03, 3.2.6, lest 2026-10-15)_
  - Slagvolum brukes fortsatt for campingbiler i gruppe c. _(kilde T03, 3.2.6, lest 2026-10-15)_
- **Uløste spørsmål:**
  - Avrunding av egenvekt/10, og hva «egenvekt» er for utenlandsk bil (3.2.2: minimumsvekt fra europeisk typegodkjenning) – forskrift § 3-1 ikke lest.

### R-OTA-005 — Ladbar hybrid: CO2-grunnlag og fradrag for elektrisk rekkevidde

- **Komponent:** Engangsavgift  
- **Profiler:** PB-PHEV, VB-PHEV  
- **Nødvendig input:** CO2 vektet kombinert (WLTP); elektrisk rekkevidde km; avgiftsgruppe  
- **Formel/trinn (struktur):** CO2-grunnlag = verdi i feltet «vektet kombinert» (ev. faktor); eventuelt fradrag i vektgrunnlag etter rekkevidde  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2022 (historisk lead) / ukjent — 2026-gyldighet ukjent.  
- **Kilder:** T05, T19, T03  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_lead_motsagt` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Vektfradraget for ladbare hybridbiler er opphevet med virkning fra 1. januar 2024. _(kilde T03, 3.3.11, lest 2026-10-15)_
- **Lead (ikke regel):**
  - Eldre forskriftstekst: CO2 for ladbar hybrid tas fra «vektet kombinert»; for gruppe a og j multipliseres med 1,24. _(kilde T05; Kan være utdatert.)_
  - 2022-forskrift: 10 % fradrag i vektgrunnlag ved ≥ 100 km elektrisk rekkevidde, proporsjonalt lavere under. _(kilde T19; 2026-status ukjent.)_
  - Lead om 10 % fradrag i vektgrunnlag ved ≥ 100 km elektrisk rekkevidde (2022-forskrift) er MOTSAGT for 2026 av rundskriv 3.3.11 (opphevet 1.1.2024). _(kilde T03/T19; Ikke bruk fradraget.)_
  - Skatteetatens side (sammendrag) sier at ladbar hybrid får fradrag i vektavgiftsgrunnlaget på inntil 10 % (stortingsvedtaket § 8 og forskriften § 3-1). _(kilde T05; MOTSIER rundskriv 2026 punkt 3.3.11 (E1): vektfradraget for ladbare hybrider er opphevet fra 1.1.2024. Mulig utdatert sammendrag; uavklart. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Hvilket CO2-tall brukes for ladbar hybrid («vektet kombinert»?) – forskrift § 3-1 ikke lest.
  - Leadet «×1,24 for gruppe a og j» ligner NEDC-justeringsfaktoren i rundskriv 3.2.5 (24 % gruppe a/j); mulig forveksling, IKKE avgjort uten forskriftstekst.

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
- **Dato fra/til:** 2026-01-01 (lead) / ukjent — Se R-OTA-001.  
- **Kilder:** T02, T04, T03  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_satser_mangler` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Fritaket for elektriske motorvogner er opphevet fra 1.1.2023; elektriske motorvogner i avgiftsgruppe a betaler engangsavgift etter stortingsvedtaket § 2. _(kilde T03, 6.12, lest 2026-10-15)_
  - Elektriske motorvogner i andre grupper enn a betaler ikke engangsavgift, fordi § 3 bare ilegges motorvogner med stempeldrevet forbrenningsmotor. _(kilde T03, 6.12, lest 2026-10-15)_
- **Lead (ikke regel):**
  - Elbiler omfattes bare av vektkomponenten (sammendrag). _(kilde T02)_
- **Uløste spørsmål:**
  - Vektkomponentens satser (stortingsvedtaket § 2) ikke lest.
  - Konsekvens av lest tekst: elektrisk varebil klasse 2 (gruppe b) → ingen engangsavgift; elektrisk personbil og varebil klasse 1 (gruppe a) → engangsavgift. Avhenger av korrekt klassifisering (SVV).

### R-OTA-008 — Varebil klasse 2: sammensetning og satser

- **Komponent:** Engangsavgift gruppe b  
- **Profiler:** VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** avgiftsgruppe b bekreftet; egenvekt; CO2  
- **Formel/trinn (struktur):** b: vektkomponent + CO2-komponent (sammendrag av § 3 b i stortingsvedtaket)  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2026-01-01 (lead) / ukjent — § 3 endret 19.6.2026, virkning 1.9.2026: innhold ukjent. Lead-tallene under kan tilhøre FØR-versjonen.  
- **Kilder:** T04, T03, T27  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_satser_mangler` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Varebil klasse 2 er en ren avgiftsmessig definisjon (gruppe b) med lavere avgift; vilkår i forskrift § 2-3 (lasterom, beskyttelsesvegg); Statens vegvesen avgjør klassifiseringen. _(kilde T03, 3.3.3.1–3.3.3.2, lest 2026-10-15)_
- **Lead (ikke regel):**
  - Lead (Lovdata-snutt, ikke lest direkte): gruppe b har vekt 30 kr per kg over 1 200 kg og CO2-trapp 450/600/1 200 kr for 0–100 / 101–150 / >150 g/km. _(kilde T04; SKAL IKKE BRUKES SOM REGELPARAMETER før primærkilden er lest og datoversjon er avklart.)_
  - Komitéinnstilling omtaler forslag om at CO2-komponenten for varebil skal være 50 % av personbil; ikke bekreftet vedtatt. _(kilde T27; Ikke avgjort om gruppe b ble endret. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Satser i stortingsvedtaket § 3 (T04) ikke lest; lead i leads er ikke brukbart.
  - Uavklart kildeopplysning U-001.

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
- **Lead (ikke regel):**
  - Varebil klasse 2: N1 uten sete/sitteanordning bak føreren; pick-up-regel om lasteplan; klasse 1 faller i gruppe a. Statens vegvesen avgjør klassifiseringen og vedtaket kan påklages. _(kilde T05/T15; Sammendrag av eldre rundskriv og forskrift.)_
  - Statens vegvesen-kodeverk for avgiftsgruppe (T15) ble ikke funnet via søk; ikke lest. _(kilde T15; Åpent. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Gjeldende presis definisjon, målekrav til lasterom.
  - Hva dokumenterer klassen (vognkort, typegodkjenning, vegvesenvedtak) for utenlandsk bil som ennå ikke er registrert i Norge?
  - Hvordan påvirker ombygging klassifiseringen, og hvilke kostnader/godkjenninger gjelder?

### R-OTA-010 — Ordinært bruksfradrag: tabellmetode

- **Komponent:** Bruksfradrag  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** første utenlandske registreringsdato (dag/måned); planlagt norsk registreringsdato; grunnlaget fradraget gjelder  
- **Formel/trinn (struktur):** fradrag = prosent (alder) av beregnet engangsavgift; alder = tid fra første utenlandske registrering til første norske registrering  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Tabellens ikrafttredelse ikke dokumentert i filen; endret 1.1.2024 (ett ekstra trinn).  
- **Kilder:** T06, T07, T04, T03  
- **Evidensnivå:** E1P · **Status:** `delvis_E1_tabell_ikke_avstemt_mot_forskrift` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Ordinært bruksfradrag gis som prosentvis fradrag i den utregnede avgiften etter tabell i forskrift § 3-3 (4.3). Alder regnes fra første gangs registrering i utlandet til registrering i Norge, dato til dato (4.2). _(kilde T03, 4.2–4.3, lest 2026-10-15)_
  - Tabellen (41 trinn) fra 2 % ved 1 måned til 100 % ved 20 år er transkribert fra Skatteetatens engelske satsside (bruksfradrag-tabell-T07.json). _(kilde T07, tabell, lest 2026-10-15)_
- **Lead (ikke regel):**
  - Standardiserte prosentsatser etter alder; alternativ individuell metode finnes (utenfor første motor). _(kilde T06)_
  - Lovdata-sammendrag av § 3-3 viser trappen 16 % (>9 mnd), 17 % (>10), 18 % (>11) … 100 % (≥ 20 år) – samsvarer med T07 for de viste trinnene. _(kilde T05; Sammendraget oppgir at forskriften sist ble endret i 2026; tekstutdraget kan være eldre. Ikke avstemt trinn for trinn (U-002 uløst). [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Forskrift § 3-3 ikke lest: tabellen er ikke avstemt mot forskriftstekst.
  - Uavklart språkforskjell U-002 (production vs første registrering).
  - Gjelder månedstrinn samme dato-til-dato-prinsipp som rundskrivets årseksempel?
  - Reduseres vrakpantavgift av bruksfradrag? (se R-IMP-OTH-001)

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
- **Evidensnivå:** E2 · **Status:** `utenfor_første_motor` · **Kontrollert dato:** ingen · **Godkjent parameter:** nei
- **Lead (ikke regel):**
  - Alternativ metode er individuell og dokumentkrevende. _(kilde T06)_

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
- **Uløste spørsmål:**
  - Reduseres vrakpantavgiften av bruksfradrag for brukte kjøretøy? Lest tekst sier bruksfradrag gis «i den utregnede engangsavgiften» (4.1/4.3); vrakpantavgiften omtales som del av engangsavgiften, men at den omfattes av bruksfradrag er IKKE lest. Ikke avgjort.
  - Fritak etter stortingsvedtaket § 9 a–c gir også fritak for vrakpantavgift; relevans for forhandler ikke vurdert.
  - Uavhengig kalkulatorreferanse mangler.

### R-IMP-OTH-002 — Avgift på klimagass i kjøretøyets klimaanlegg

- **Komponent:** Klimagassavgift  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** gasstype; mengde (gram/kg)  
- **Formel/trinn (struktur):** avgift avhenger av type og mengde; typisk ca. 1 kg (sammendrag)  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ukjent.  
- **Kilder:** T08, T25  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato:** ingen · **Godkjent parameter:** nei
- **Lead (ikke regel):**
  - Avgift på klimagass; mengde ca. 1 kg for typisk personbil (sammendrag). _(kilde T08)_
  - Sats for HFK/PFK: 1,639 kr pr. kg × GWP nevnt, og HFK-134a 2 130,70 kr/kg nevnt på en annen side. Gjelder klimaanlegg i importerte kjøretøy. _(kilde T25; KILDEKONFLIKT mellom sammendrag. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Sats per gass, hvor hentes type/mengde for utenlandsk bil?
  - Kan avgiften ignoreres for elbil/varebil?

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
- **Evidensnivå:** E1P · **Status:** `delvis_E1_2025_utgave` · **Kontrollert dato:** 2026-10-15 · **Godkjent parameter:** nei
- **E1-funn (lest primærkilde):**
  - Hovedregel: ingen fradragsrett for inngående avgift på personkjøretøy. Unntak etter mval. § 8-4 første ledd annet punktum bokstav a: anskaffelse av personkjøretøy for videresalg (kodifisert fra 1.3.2004). _(kilde T22, «Unntak fra hovedregelen» – Videresalg, lest 2026-10-15)_
  - Fradragsretten omfatter vedlikehold, reparasjoner og klargjøring, og drivstoff ved forflytning av salgsvarer fra lager/importsted til utsalgssted. _(kilde T22, «Vedlikehold, reparasjoner, klargjøring», lest 2026-10-15)_
- **Lead (ikke regel):**
  - Håndbok (sammendrag): tilbakeføring etter § 9-6 gjelder utleie/persontransport, ikke videresalg; eksport utløser ikke tilbakeføring; åtteårsregel. _(kilde T28; Vilkår for importørens videresalg ikke lest; forhandlerprofil ikke dokumentert. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Siden er Merverdiavgiftshåndboken 2025, ikke verifisert for 2026.
  - Håndbokssiden dekker «anskaffelse»; om innførselsmva. fradragsføres på samme måte, dokumentasjonskrav og bindingstid (§ 9-6) er ikke lest (kap. 3-29, 9-6, T11).
  - Importørens faktiske fradragsrett (mva.-registrert, lagerbil vs. bruk) avgjøres ikke av håndboken; krever importørprofil.
  - Om det gjelder varebil er ikke lest.

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
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato:** ingen · **Godkjent parameter:** nei
- **Lead (ikke regel):**
  - Skattefri utførsel avhenger av hvem som flytter varen; ved selvhenting kreves utenlandsk kjøper. Utførselsbevis for registreringspliktige kjøretøy må inneholde VIN; vanligvis tollbekreftet utgang. _(kilde T16)_
- **Uløste spørsmål:**
  - Konkret dokumentasjonspakke Merovo kan be om (faktura, utførselsbevis).
  - Hvordan representeres ordinær tysk mva.-sats (19 %) – er den sats i faktura og ikke per land-regel?

### R-FOR-002 — Tyskland: differansebeskatning (§ 25a UStG)

- **Komponent:** Utenlandsk mva.  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** regime = margin; faktura viser ikke mva.  
- **Formel/trinn (struktur):** normal mva. kan ikke deles mekanisk ut av prisen  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ikke kontrollert.  
- **Kilder:** T17, T29  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato:** ingen · **Godkjent parameter:** nei
- **Lead (ikke regel):**
  - Utførselsfritak består under differansebeskatning (sammendrag); vilkår: gjenselger av brukte gjenstander. _(kilde T17; Hva dette betyr for faktisk fakturabeløp er ikke avklart.)_
  - UStH (sammendrag): § 25a krever bl.a. at gjenstanden er anskaffet i Fellesskapet uten mva. eller også med differansebeskatning; faktura må ha «Gebrauchtgegenstände/Sonderregelung». _(kilde T29; Forholdet til § 6-utførsel ikke avklart i sammendragene. [E2-ledetråd fra søkesammendrag 2026-10-16; ikke lest primærtekst; kan ikke brukes som parameter])_
- **Uløste spørsmål:**
  - Hva er den faktiske nettoprisen ved eksport av margin-bil (samme pris, eller lavere)? Krever faktura/tilbud, ikke regel.

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

## 3. Kildefortegnelse

| ID | Kilde | Utgiver | Nivå | Lest / status | Versjon | Pakkehash (SHA-256) |
|---|---|---|---|---|---|---|
| T01 | [Importere bil og andre kjøretøy (oversikt)](https://www.skatteetaten.no/person/avgifter/bil/importere/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T02 | [Hva er engangsavgiften? (en: What is the one-off registration tax?)](https://www.skatteetaten.no/person/avgifter/bil/importere/engangsavgift/hva-er-engangsavgiften/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T03 | [Årsrundskriv for engangsavgift 2026 (PDF, 57 sider, datert 1. januar 2026)](https://www.skatteetaten.no/globalassets/rettskilder/avgiftsrundskriv/engangsavgift-2026.pdf) | Skatteetaten (Skattedirektoratet) | E1 | lest 2026-10-15 | Skattedirektoratet, årsrundskriv engangsavgift 2026, datert 1. januar 2026 | 08296e9a32afb53f… |
| T04 | [Stortingsvedtak om engangsavgift på motorvogner mv. for 2026 (FOR-2025-12-18-2755)](https://lovdata.no/dokument/STV/forskrift/2025-12-18-2755) | Lovdata / Stortinget | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T05 | [Forskrift om engangsavgift på motorvogner (FOR-2001-03-19-268)](https://lovdata.no/dokument/SF/forskrift/2001-03-19-268) | Lovdata / Finansdepartementet | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T06 | [Bruksfradrag (engangsavgift)](https://www.skatteetaten.no/person/avgifter/bil/importere/engangsavgift/bruksfradrag/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T07 | [Bruksfradragstabell (en: Deduction for use table)](https://www.skatteetaten.no/en/rates/car-rates---deduction-for-use-table/) | Skatteetaten | E1 | lest 2026-10-15 | Skatteetaten, «Deduction for use table» (engelsk sats-side), ukjent sidedato i filen | f91e8040d3443901… |
| T08 | [Andre avgifter ved import (en: Other taxes when importing a vehicle)](https://www.skatteetaten.no/person/avgifter/bil/importere/andre-avgifter/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T09 | [Vrakpant (en: Scrap deposit) – UTBETALING ved skroting (ikke innbetalingen ved registrering)](https://www.skatteetaten.no/en/rates/scrap-deposit/) | Skatteetaten | E1 | lest 2026-10-15 | Skatteetaten, «Scrap deposit», år 2026 valgt i sidens årsvelger | 97103b849c8dac65… |
| T10 | [Beregning av tollavgift og andre avgifter / Betaling av mva. ved import av bil / Fastsettelse av fraktkostnader (sjablong)](https://www.toll.no/no/varer/bil-og-andre-kjoretoy/bilimport/betaling-av-avgifter) | Tolletaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T11 | [Beregning og rapportering av innførselsmva. (guide og PDF)](https://www.skatteetaten.no/globalassets/bedrift-og-organisasjon/avgifter/merverdiavgift/import-mva/beregning-og-bokforing-innforselsmva.pdf) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T12 | [Merverdiavgiftshåndboken kap. 8-4 (personkjøretøy for videresalg) og mval. § 8-1/§ 8-4; kap. 9-6 (tilbakeføring)](https://www.skatteetaten.no/en/rettskilder/type/handboker/merverdiavgiftshandboken/gjeldende/M-8/M-8-4/M-8-4.3/) | Skatteetaten / Lovdata | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T13 | [Merverdiavgiftshåndboken kap. 6 (importørens salg av bruktimportert bil)](https://oppslag.rettskilder.skatteetaten.no/rettskilder2/type/handboker/merverdiavgiftshandboken/gjeldende/MVA2025_M-6) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T14 | [Lovvedtak 14 (2025–2026) om endringer i merverdiavgiftsloven (elbilfritaket) og Innst. 4 L / Skatter og avgifter 2026](https://stortinget.no/no/saker-og-publikasjoner/vedtak/beslutninger/lovvedtak/2025-2026/vedtak-202526-014/) | Stortinget | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T15 | [Kodeverk «Kjøretøygruppe avgift» (AVGIFT)](https://autosys-kjoretoy-api.atlas.vegvesen.no/kodeverk-ui/index-kodeverk.html?kodeverkId=AVGIFT) | Statens vegvesen | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T16 | [BMF Umsatzsteuer-Handausgabe § 6 UStG Ausfuhrlieferung (inkl. 6.5 Ausfuhrnachweis)](https://usth.bundesfinanzministerium.de/usth/2023/A-Umsatzsteuergesetz/II-Steuerbefreiungen-und-Steuerverguetungen/Paragraf-6/inhalt.html) | Bundesfinanzministerium (DE) | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T17 | [§ 25a UStG Differenzbesteuerung](https://www.gesetze-im-internet.de/ustg_1980/__25a.html) | gesetze-im-internet.de (DE) | E2 | ikke_hentet_nettverk_blokkert | — | — |
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
| T25 | [Avgift på HFK/PFK (klimagass) – satser og kjøretøy](https://www.skatteetaten.no/en/business-and-organisation/vat-and-duties/excise-duties/about-the-excise-duties/hfc-and-pfc/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T26 | [Skatter og avgifter 2026 – stortingsvedtak (oversikt)](https://www.stortinget.no/no/Saker-og-publikasjoner/Vedtak/Vedtak/Sak/?p=104915) | Stortinget | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T27 | [Innst. 3 S (2025–2026) Skatter og avgifter 2026](https://www.stortinget.no/no/Saker-og-publikasjoner/Publikasjoner/Innstillinger/Stortinget/2025-2026/inns-202526-003s/?all=true) | Stortinget | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T28 | [Merverdiavgiftshåndboken 9-6.2 Tilbakeføring av inngående mva. på personkjøretøy](https://www.skatteetaten.no/en/rettskilder/type/handboker/merverdiavgiftshandboken/gjeldende/M-9/M-9-6/M-9-6.2/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert | — | — |
| T29 | [Umsatzsteuer-Handausgabe § 25a UStG Differenzbesteuerung](https://usth.bundesfinanzministerium.de/usth/2023/A-Umsatzsteuergesetz/VI-Sonderregelungen/Paragraf-25a/inhalt.html) | Bundesfinanzministerium (DE) | E2 | ikke_hentet_nettverk_blokkert | — | — |

`S07`/`S0x` viser til SOURCES.md. `whatToExtract` per kilde er sjekklisten for en direkte lesning. Kilder med nivå E1 har fullstendig hash i `sources.json`; filene ligger i kildepakken, ikke i Git.

## 4. Avgrensninger
- Første motor: ordinært bruksfradrag. Alternativ metode, fritak/særordninger, tilbakeføring av fradrag og salgs-mva. er utenfor.
- Landdekning: bare Tyskland har lead-kilder; ingen annen utenlandsk regel er påstått.
- DEC-030 gjelder: budsjettsummen skal ikke trekke fra fradragsberettiget mva.; salgspris/margin er ikke påkrevd. Økonomisk kost og kapitalbehov er egne summeringer fra et felles komponentgrunnlag (`purchase-basis.md` §6).
