# TAX-001A — regel- og kilderegister (dokumentasjon, ikke regelsett)

Forskningsdato **15.10.2026**. Status: **REVIEW**. Dette dokumentet er et *kartleggingsregister*. Det inneholder **ingen** godkjente satser, og ingen regel her skal brukes som parameter i kode.

## 1. Viktigste funn om kontrollgrunnlaget

**Ingen primærkilde er lest direkte.** Skatteetaten, Tolletaten, Lovdata og Regjeringen (`www.skatteetaten.no`, `www.toll.no`, `lovdata.no`, `www.regjeringen.no`, `oppslag.rettskilder.skatteetaten.no`) var **ikke tilgjengelige** fra utviklingsmiljøet (DNS-/proxy-feil ved direkte henting). Skatteetatens kalkulator er ikke forsøkt kjørt. Det som er samlet kommer fra **søkeverktøyets sammendrag av offisielle sider** (evidensnivå **E2**), begrenset til offisielle domener. Slike sammendrag er *ledetråder*, ikke kontrollerte kilder: de er korte, kan være utdaterte (flere er fra 2018–2023) og motsier hverandre i enkelte tilfeller.

Følgelig er **alle** regler under merket `ikke_primærkontrollert`, `kildekonflikt`, `fremtidig_ikke_i_kraft`, `utenfor_første_motor`, `ikke_undersøkt` eller `prosjektregel`. Ingen satser er fastsatt. For å gjennomføre kontrollen kreves ett av:

1. at miljøets nettverk åpnes for de navngitte vertene (Edit environment → Network access → Allowed domains), slik at kilden kan leses og settes til E1; eller
2. at Christian/Codex leser kildene i `sources.json` (`whatToExtract`) og kjører kalkulatoren med inputene i `references.json` (klasse 4).

Se `reviews/TAX-001A.md` for den presise kontrolllisten.

### Evidensnivåer
| Nivå | Betydning | Brukes som grunnlag? |
|---|---|---|
| E0 | ikke undersøkt | nei |
| E1 | primærkilde direkte lest og kontrollert | ja (**ingen oppnådd**) |
| E2 | sammendrag fra søkeverktøy av offisiell side, ikke direkte lest | nei – lead |
| E3 | sekundærkilde (blogg/aggregator) | **avvist** (Smarte Penger, Crowe) |

### Viktige ledetråder (E2) som Codex bør kontrollere først
- **Mulig regelendring midt i 2026:** Lovdata-oppføringen for Stortingsvedtaket om engangsavgift 2026 (FOR-2025-12-18-2755) skal ifølge søkeverktøyet være endret 19.6.2026 med virkning fra **1.9.2026** for § 3. Planlagt registreringsdato før/etter 1.9.2026 kan dermed gi ulik regelversjon. Innholdet er ukjent.
- **NOx-komponenten:** Skatteetaten oppgir at NOx er avviklet fra 1.1.2026, mens samme side fortsatt nevner NOx i oversiktsteksten (kildekonflikt).
- **Ny vektkomponent fra 2026** gjelder ifølge Skatteetaten alle drivlinjer (elbil bare vektkomponent).
- **Bruksfradrag:** alder regnes fra første *utenlandske* registrering til første norske; tabellen utvidet 1.1.2024 med trinn for 20 år (ankerpunkter ca. 2 % / 19 % / 94 % / 100 % ved 1 mnd / 1 år / 14 år / 20 år – ikke brukbare som parametere).
- **Elbil-mva.:** Stortingets lovvedtak 18.12.2025 setter fritaksgrensen til 300 000 kr fra 1.1.2026; videre nedtrapping (2027/2028) er omtalt som uenighet/forslag og er **fremtidig** (ikke i kraft).
- **Vrakpant:** 2 400 kr (2018-rundskriv) mot 3 000 kr (nyere side) – kildekonflikt.
- **Tollkurs:** kildene er uenige om hvilken dato som styrer Tolletatens kurs (deklarasjon eller frigivelse).
- **Fradragsrett:** Mva.-håndboken beskriver § 8-4 første ledd bokstav a (personkjøretøy som salgsvare) – gjelder også innførselsmva. (sammendrag).
- **Tyskland:** skattefri utførsel (§ 6 UStG) og differansebeskatning (§ 25a UStG) er funnet som lead; **ingen andre land** er dekket.

## 2. Regelregister (generert fra `rules.json`)

Kolonnene `Satser/avrunding` er **tomme med vilje**: ingen verdi er kontrollert. `Lead` er det søkeverktøyet sa, ikke en regel.

### R-OTA-000 — Rekkefølge og sammensetning av avgifter ved import

- **Komponent:** Oversikt  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** avgiftsgruppe; drivlinje; registreringsdato  
- **Formel/trinn (struktur):** Engangsavgift + import-mva. + vrakpant + klimagassavgift (Skatteetaten oversikt); toll normalt 0 for bil fra EU/EØS-kontekst (IKKE undersøkt)  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ukjent. Virkningsdatoer må leses per komponent.  
- **Kilder:** T01, T08  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
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
- **Kilder:** T01, T08 (import-mva.), T11  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Sammendrag: mva. 25 % av tollverdien for importerte kjøretøy. _(kilde T08; Universell 25 % skal ikke innføres uten kildekontroll (IMPORT_ENGINE_SPEC); elbil har egen regel (R-IMP-VAT-003).)_
- **Uløste spørsmål:**
  - Inngår engangsavgift i mva.-grunnlaget ved import? (må leses)
  - Rekkefølge: tollverdi → toll → engangsavgift → mva.?

### R-IMP-VAT-002 — Tollverdi: kjøpspris + frakt + forsikring til norsk grense

- **Komponent:** Tollverdi  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** kjøpspris i kontrakts-/fakturavaluta; frakt til norsk grense; forsikring til norsk grense; kurs  
- **Formel/trinn (struktur):** tollverdi = kjøpspris + frakt til grensen + forsikring til grensen (sammendrag); frakt etter grensen inngår ikke  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ikke lest.  
- **Kilder:** T08, T10  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Tollverdi bygges av kjøpspris, frakt og forsikring til norsk grense (Skatteetaten og Tolletaten, sammendrag). _(kilde T08/T10)_
  - For biler kjørt inn på egne hjul brukes Tolletatens sjablongfrakt per land, med rett til å dokumentere faktisk frakt (sammendrag). _(kilde T10)_
- **Uløste spørsmål:**
  - Beløp for sjablongfrakt (land, bilkategori, gyldig dato).
  - Skal kostnader som ikke er del av prisen (f.eks. transaksjonsgebyr, provisjon) inn i tollverdien?

### R-IMP-FX-001 — Tollkurs (Tolletatens kurs) kontra betalingskurs

- **Komponent:** Valutakurs  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** valuta; tidspunkt/dato for kursvalg  
- **Formel/trinn (struktur):** tollverdi i NOK = tollverdi i valuta × Tolletatens kurs; betalingskurs er egen kostnad  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ukjent.  
- **Kilder:** T10  
- **Evidensnivå:** E2 · **Status:** `kildekonflikt` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Tolletaten fastsetter kurs for én uke om gangen (sammendrag). _(kilde T10)_
  - Kildene er uenige om hvilken dato som styrer kursen: tidspunkt tolldeklarasjon godtas, eller frigivelsestidspunkt. _(kilde T10; KILDEKONFLIKT i sammendragene.)_
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
- **Evidensnivå:** E2 · **Status:** `fremtidig_ikke_i_kraft` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Stortingets lovvedtak (18.12.2025): fritak for første 300 000 kr av vederlaget fra 1.1.2026 (ned fra 500 000 kr). _(kilde T14)_
  - Videre nedtrapping (150 000 kr per år i 2027 og 2028 forutsatt ESA-godkjenning; regjeringen foreslo full mva. fra 2027) er FREMTIDIG/uenighet. _(kilde T14)_
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
- **Kilder:** T02, T03, T04 (§ 3)  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Bil med forbrenningsmotor: ny vektkomponent + generell engangsavgift (CO2/egenvekt); elbil: bare vektkomponent (Skatteetaten, sammendrag). _(kilde T02)_
- **Uløste spørsmål:**
  - Satser, terskler og trinn for 2026 – og etter 1.9.2026.
  - Gjelder samme vektkomponent for elbil og hybrid?

### R-OTA-002 — CO2-komponent

- **Komponent:** Engangsavgift gruppe a  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV  
- **Nødvendig input:** CO2 g/km; testmetode (WLTP/NEDC); kilde i vognkort/typegodkjenning  
- **Formel/trinn (struktur):** komponent = sats-trapp over CO2-bånd; CO2 fra registrert verdi, ellers anslag  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2026-01-01 (lead) / ukjent — Se R-OTA-001 for 1.9.2026.  
- **Kilder:** T02, T03, T04 (§ 3)  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Fra 1.1.2026 anslås CO2 fra egenvekt (egenvekt/10) når CO2-data mangler (Skatteetaten, sammendrag). _(kilde T02)_
  - Hvis Statens vegvesen har registrert CO2, brukes den som hovedregel. _(kilde T02)_
- **Uløste spørsmål:**
  - Bånd og beløp.
  - Presis anslagsregel (egenvekt/10) og om den gjelder både ny og brukt import.
  - Hvordan håndteres NEDC vs WLTP?

### R-OTA-003 — NOx-komponent

- **Komponent:** Engangsavgift  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** NOx mg/km  
- **Formel/trinn (struktur):** ikke aktuelt hvis komponenten er avviklet  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / 2025-12-31 (lead) — Lead: NOx avviklet fra 1.1.2026.  
- **Kilder:** T02  
- **Evidensnivå:** E2 · **Status:** `kildekonflikt` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Skatteetaten: NOx-avgiften er avviklet fra og med 1.1.2026, NOx inngår ikke lenger i engangsavgiften. _(kilde T02; Samme side nevner fortsatt NOx i oversiktsteksten: sannsynlig utdatert tekst, MÅ avklares.)_
- **Uløste spørsmål:**
  - Er NOx fjernet også for varebil gruppe b og for brukt import?

### R-OTA-004 — Fallback når CO2 mangler: slagvolum (eldre regel)

- **Komponent:** Engangsavgift  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** slagvolum; CO2 registrert?  
- **Formel/trinn (struktur):** eldre regel: slagvolum når CO2 ikke er registrert  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ukjent om gjelder 2026.  
- **Kilder:** T02, T03  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Eldre rundskriv: slagvolum kan brukes der CO2 ikke er registrert. _(kilde T03; Kan være erstattet av egenvekt/10-anslaget.)_
- **Uløste spørsmål:**
  - Er slagvolumregelen opphevet 2026?

### R-OTA-005 — Ladbar hybrid: CO2-grunnlag og fradrag for elektrisk rekkevidde

- **Komponent:** Engangsavgift  
- **Profiler:** PB-PHEV, VB-PHEV  
- **Nødvendig input:** CO2 vektet kombinert (WLTP); elektrisk rekkevidde km; avgiftsgruppe  
- **Formel/trinn (struktur):** CO2-grunnlag = verdi i feltet «vektet kombinert» (ev. faktor); eventuelt fradrag i vektgrunnlag etter rekkevidde  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2022 (historisk lead) / ukjent — 2026-gyldighet ukjent.  
- **Kilder:** T05, T19, T03  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Eldre forskriftstekst: CO2 for ladbar hybrid tas fra «vektet kombinert»; for gruppe a og j multipliseres med 1,24. _(kilde T05; Kan være utdatert.)_
  - 2022-forskrift: 10 % fradrag i vektgrunnlag ved ≥ 100 km elektrisk rekkevidde, proporsjonalt lavere under. _(kilde T19; 2026-status ukjent.)_
- **Uløste spørsmål:**
  - Gjelder faktor og fradrag fortsatt?
  - Hva er «vektet kombinert» på utenlandsk typegodkjenning/COC?

### R-OTA-006 — Ikke-ladbar hybrid: behandlet som forbrenningsbil?

- **Komponent:** Engangsavgift  
- **Profiler:** PB-HEV, VB-HEV  
- **Nødvendig input:** CO2; egenvekt  
- **Formel/trinn (struktur):** samme som bensin/diesel hvis ingen egne regler  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ukjent.  
- **Kilder:** T03, T05  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Eldre regjeringsnotat (2019): ikke-ladbare hybrider behandles som forbrenningsbiler. _(kilde T05; Gammel kilde.)_
- **Uløste spørsmål:**
  - Egne regler 2026 for mild/full hybrid?
  - Hvordan skilles ikke-ladbar hybrid fra plug-in i Statens vegvesen-data?

### R-OTA-007 — Batterielektrisk: kun vektkomponent

- **Komponent:** Engangsavgift  
- **Profiler:** PB-BEV, VB-BEV  
- **Nødvendig input:** egenvekt  
- **Formel/trinn (struktur):** vektkomponent uten CO2-komponent  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2026-01-01 (lead) / ukjent — Se R-OTA-001.  
- **Kilder:** T02, T04  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Elbiler omfattes bare av vektkomponenten (sammendrag). _(kilde T02)_
- **Uløste spørsmål:**
  - Fritak/reduksjon for elbil i gruppe b?
  - Egne regler for brukte elbiler?

### R-OTA-008 — Varebil klasse 2: sammensetning og satser

- **Komponent:** Engangsavgift gruppe b  
- **Profiler:** VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** avgiftsgruppe b bekreftet; egenvekt; CO2  
- **Formel/trinn (struktur):** b: vektkomponent + CO2-komponent (sammendrag av § 3 b i stortingsvedtaket)  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2026-01-01 (lead) / ukjent — § 3 endret 19.6.2026, virkning 1.9.2026: innhold ukjent. Lead-tallene under kan tilhøre FØR-versjonen.  
- **Kilder:** T04 (§ 3 b)  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Lead (Lovdata-snutt, ikke lest direkte): gruppe b har vekt 30 kr per kg over 1 200 kg og CO2-trapp 450/600/1 200 kr for 0–100 / 101–150 / >150 g/km. _(kilde T04; SKAL IKKE BRUKES SOM REGELPARAMETER før primærkilden er lest og datoversjon er avklart.)_
- **Uløste spørsmål:**
  - Er tallene fra før eller etter endringen 1.9.2026?
  - Gjelder gruppe b også elbil/hybrid-varebil?

### R-OTA-009 — Varebil klasse 1/2, avgiftsgruppe og hvem som avgjør

- **Komponent:** Kjøretøyklassifisering  
- **Profiler:** VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** teknisk klasse N1; seteplass bak førersete; fast skillevegg/lasterom (mål); Statens vegvesens avgiftsgruppe  
- **Formel/trinn (struktur):** klasse 2 = N1 uten sete bak fører (+ lastromkrav); klasse 1 = N1 som ikke oppfyller dette; klasse 2 → gruppe b, klasse 1 → gruppe a  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Definisjonene fra eldre versjon; gjeldende tekst må leses.  
- **Kilder:** T05, T15, T03  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Varebil klasse 2: N1 uten sete/sitteanordning bak føreren; pick-up-regel om lasteplan; klasse 1 faller i gruppe a. Statens vegvesen avgjør klassifiseringen og vedtaket kan påklages. _(kilde T05/T15; Sammendrag av eldre rundskriv og forskrift.)_
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
- **Dato fra/til:** 2024-01-01 (tabell utvidet med 20 år) / ukjent — Nåværende tabell og eventuell endring 2026 ikke lest.  
- **Kilder:** T06, T07, T04 (§ 4)  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Standardiserte prosentsatser etter alder; alternativ individuell metode finnes (utenfor første motor). _(kilde T06)_
  - Ankerpunkter i tabellen: ca. 2 % ved 1 mnd, 19 % ved 1 år, 94 % ved 14 år, 100 % ved 20 år. _(kilde T07; Ikke hele tabellen; ikke brukbart som parameter.)_
- **Uløste spørsmål:**
  - Hele tabellen og om trinn er månedlige.
  - Gjelder fradraget alle komponenter, inkl. vektkomponent?
  - Avrunding av alder og av beløp.

### R-OTA-011 — Aldersgrense 20 år / fritak

- **Komponent:** Bruksfradrag  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** alder ved norsk registrering  
- **Formel/trinn (struktur):** kjøretøy ≥ 20 år: ingen engangsavgift (sammendrag)  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** 2024-01-01 (lead) / ukjent — Sammenheng med Stortingsvedtakets pkt. 9 bokstav p (avvikling) uklar.  
- **Kilder:** T06, T07  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Tabellen ble utvidet med trinn for 20 år for å avvikle fritaket for kjøretøy ≥ 20 år (sammendrag). _(kilde T07; Kan bety 100 % fradrag ved 20 år i stedet for et eget fritak.)_
- **Uløste spørsmål:**
  - Er 20-årsgrensen et fritak eller 100 % bruksfradrag?

### R-OTA-012 — Alternativ metode (individuell, pris og km)

- **Komponent:** Bruksfradrag  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** pris og kilometerstand  
- **Formel/trinn (struktur):** utenfor første motor  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — UTENFOR første motor.  
- **Kilder:** T06  
- **Evidensnivå:** E2 · **Status:** `utenfor_første_motor` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Alternativ metode er individuell og dokumentkrevende. _(kilde T06)_

### R-OTA-013 — Fritak/særordninger i engangsavgiften

- **Komponent:** Fritak  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** særskilt grunnlag  
- **Formel/trinn (struktur):** ingen særordninger støttes i første motor  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ikke kartlagt.  
- **Kilder:** T05 (kap. IV), T04  
- **Evidensnivå:** E2 · **Status:** `utenfor_første_motor` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Fritak finnes (forskrift kap. IV); innhold ikke lest. _(kilde T05)_
- **Uløste spørsmål:**
  - Hvilke fritak er relevante for forhandlerimport?

### R-IMP-OTH-001 — Vrakpantavgift

- **Komponent:** Vrakpant  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** kjøretøytype  
- **Formel/trinn (struktur):** fast beløp per kjøretøytype  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Beløp og dato ukjent.  
- **Kilder:** T08, T09  
- **Evidensnivå:** E2 · **Status:** `kildekonflikt` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Én side: 2 400 kr (rundskriv 2018); en annen: 3 000 kr (personbil, varebil, bobil, minibuss). _(kilde T08/T09; KILDEKONFLIKT – ingen verdi kan brukes.)_
- **Uløste spørsmål:**
  - Gjeldende beløp og virkningsdato for personbil og varebil.

### R-IMP-OTH-002 — Avgift på klimagass i kjøretøyets klimaanlegg

- **Komponent:** Klimagassavgift  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** gasstype; mengde (gram/kg)  
- **Formel/trinn (struktur):** avgift avhenger av type og mengde; typisk ca. 1 kg (sammendrag)  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Ukjent.  
- **Kilder:** T08  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Avgift på klimagass; mengde ca. 1 kg for typisk personbil (sammendrag). _(kilde T08)_
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
- **Evidensnivå:** E2 · **Status:** `ikke_undersøkt` · **Kontrollert dato (E1):** ingen
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
- **Kilder:** T12, T11  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Fradragsretten omfatter ikke personkjøretøy, men unntaket for salgsvarer gjør at innførselsmva. kan fradragsføres ved videresalg (Mva.-håndboken, sammendrag). _(kilde T12)_
- **Uløste spørsmål:**
  - Gjelder det samme for varebil?
  - Dokumentasjonskrav; brukt som demo/leasing; tilbakeføring etter § 9-6 (åtte år).
  - Hvilken forhandlerprofil gjelder (mva.-registrert, lagerbil)? Brukes aldri antatt.

### R-DED-002 — Tilbakeføring av fradragsført mva. (åtte år)

- **Komponent:** Fradragsrett  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** omdisponering  
- **Formel/trinn (struktur):** tilbakeføring ved omdisponering de første åtte år  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Utenfor første motor.  
- **Kilder:** T12 (M-9-6)  
- **Evidensnivå:** E2 · **Status:** `utenfor_første_motor` · **Kontrollert dato (E1):** ingen
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
- **Evidensnivå:** E2 · **Status:** `utenfor_første_motor` · **Kontrollert dato (E1):** ingen

### R-FOR-001 — Tyskland: skattefri utførsel til tredjeland (Norge)

- **Komponent:** Utenlandsk mva.  
- **Profiler:** PB-BEN, PB-DIE, PB-HEV, PB-PHEV, PB-BEV, VB-BEN, VB-DIE, VB-HEV, VB-PHEV, VB-BEV  
- **Nødvendig input:** land = DE; kjøper/mottaker; hvem transporterer; utførselsbevis med VIN  
- **Formel/trinn (struktur):** netto eksportfaktura når vilkår og bevis er oppfylt  
- **Beløp/enhet/avrunding:** IKKE KONTROLLERT – må leses fra primærkilde (belop, enhet, avrunding, rekkefølge)  
- **Dato fra/til:** ukjent / ukjent — Tysk rettsstilling per 2026 ikke kontrollert.  
- **Kilder:** T16  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
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
- **Kilder:** T17  
- **Evidensnivå:** E2 · **Status:** `ikke_primærkontrollert` · **Kontrollert dato (E1):** ingen
- **Lead (ikke regel):**
  - Utførselsfritak består under differansebeskatning (sammendrag); vilkår: gjenselger av brukte gjenstander. _(kilde T17; Hva dette betyr for faktisk fakturabeløp er ikke avklart.)_
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
- **Evidensnivå:** E2 · **Status:** `prosjektregel` · **Kontrollert dato (E1):** ingen
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
- **Evidensnivå:** E2 · **Status:** `ikke_undersøkt` · **Kontrollert dato (E1):** ingen
- **Uløste spørsmål:**
  - Hvilke land skal støttes først (Østerrike, Nederland, Belgia, Frankrike …)?
  - Bekreftede enkelttilbud fra andre land kan representeres som dokumentert tilbud uten landregel (se purchase-basis.md).

## 3. Kildefortegnelse (generert fra `sources.json`)

| ID | Kilde | Utgiver | Nivå | Hentestatus |
|---|---|---|---|---|
| T01 | [Importere bil og andre kjøretøy (oversikt)](https://www.skatteetaten.no/person/avgifter/bil/importere/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert |
| T02 | [Hva er engangsavgiften? (en: What is the one-off registration tax?)](https://www.skatteetaten.no/person/avgifter/bil/importere/engangsavgift/hva-er-engangsavgiften/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert |
| T03 | [Årsrundskriv for engangsavgift 2026](https://www.skatteetaten.no/rettskilder/type/rundskriv-retningslinjer-og-andre-rettskilder/avgiftsrundskriv/engangsavgift-2026/) | Skatteetaten (Skattedirektoratet) | E2 | ikke_hentet_nettverk_blokkert |
| T04 | [Stortingsvedtak om engangsavgift på motorvogner mv. for 2026 (FOR-2025-12-18-2755)](https://lovdata.no/dokument/STV/forskrift/2025-12-18-2755) | Lovdata / Stortinget | E2 | ikke_hentet_nettverk_blokkert |
| T05 | [Forskrift om engangsavgift på motorvogner (FOR-2001-03-19-268)](https://lovdata.no/dokument/SF/forskrift/2001-03-19-268) | Lovdata / Finansdepartementet | E2 | ikke_hentet_nettverk_blokkert |
| T06 | [Bruksfradrag (engangsavgift)](https://www.skatteetaten.no/person/avgifter/bil/importere/engangsavgift/bruksfradrag/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert |
| T07 | [Bruksfradragstabell (en: Deduction for use table)](https://www.skatteetaten.no/en/rates/car-rates---deduction-for-use-table/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert |
| T08 | [Andre avgifter ved import (en: Other taxes when importing a vehicle)](https://www.skatteetaten.no/person/avgifter/bil/importere/andre-avgifter/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert |
| T09 | [Vrakpant (en: Scrap deposit) – satser](https://www.skatteetaten.no/en/rates/scrap-deposit/) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert |
| T10 | [Beregning av tollavgift og andre avgifter / Betaling av mva. ved import av bil / Fastsettelse av fraktkostnader (sjablong)](https://www.toll.no/no/varer/bil-og-andre-kjoretoy/bilimport/betaling-av-avgifter) | Tolletaten | E2 | ikke_hentet_nettverk_blokkert |
| T11 | [Beregning og rapportering av innførselsmva. (guide og PDF)](https://www.skatteetaten.no/globalassets/bedrift-og-organisasjon/avgifter/merverdiavgift/import-mva/beregning-og-bokforing-innforselsmva.pdf) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert |
| T12 | [Merverdiavgiftshåndboken kap. 8-4 (personkjøretøy for videresalg) og mval. § 8-1/§ 8-4; kap. 9-6 (tilbakeføring)](https://www.skatteetaten.no/en/rettskilder/type/handboker/merverdiavgiftshandboken/gjeldende/M-8/M-8-4/M-8-4.3/) | Skatteetaten / Lovdata | E2 | ikke_hentet_nettverk_blokkert |
| T13 | [Merverdiavgiftshåndboken kap. 6 (importørens salg av bruktimportert bil)](https://oppslag.rettskilder.skatteetaten.no/rettskilder2/type/handboker/merverdiavgiftshandboken/gjeldende/MVA2025_M-6) | Skatteetaten | E2 | ikke_hentet_nettverk_blokkert |
| T14 | [Lovvedtak 14 (2025–2026) om endringer i merverdiavgiftsloven (elbilfritaket) og Innst. 4 L / Skatter og avgifter 2026](https://stortinget.no/no/saker-og-publikasjoner/vedtak/beslutninger/lovvedtak/2025-2026/vedtak-202526-014/) | Stortinget | E2 | ikke_hentet_nettverk_blokkert |
| T15 | [Kodeverk «Kjøretøygruppe avgift» (AVGIFT)](https://autosys-kjoretoy-api.atlas.vegvesen.no/kodeverk-ui/index-kodeverk.html?kodeverkId=AVGIFT) | Statens vegvesen | E2 | ikke_hentet_nettverk_blokkert |
| T16 | [BMF Umsatzsteuer-Handausgabe § 6 UStG Ausfuhrlieferung (inkl. 6.5 Ausfuhrnachweis)](https://usth.bundesfinanzministerium.de/usth/2023/A-Umsatzsteuergesetz/II-Steuerbefreiungen-und-Steuerverguetungen/Paragraf-6/inhalt.html) | Bundesfinanzministerium (DE) | E2 | ikke_hentet_nettverk_blokkert |
| T17 | [§ 25a UStG Differenzbesteuerung](https://www.gesetze-im-internet.de/ustg_1980/__25a.html) | gesetze-im-internet.de (DE) | E2 | ikke_hentet_nettverk_blokkert |
| T18 | [Avgiftssatser 2026 (oversikt)](https://www.regjeringen.no/no/tema/okonomi-og-budsjett/skatter-og-avgifter/skatte-og-avgiftssatser/avgiftssatser-2026/id3121982/) | Regjeringen | E2 | ikke_hentet_nettverk_blokkert |
| T19 | [Forskrift om endring i forskrift om engangsavgift på motorvogner (FOR-2022-12-16-2271)](https://lovdata.no/dokument/LTI/forskrift/2022-12-16-2271) | Lovdata | E2 | ikke_hentet_nettverk_blokkert |
| S07 | [Skatteetatens importkalkulator (fra SOURCES.md)](https://www.skatteetaten.no/person/avgifter/bil/importere/regn-ut/) | Skatteetaten | E0 | ikke_hentet_nettverk_blokkert |
| X01 | [Smarte Penger – engangsavgifter på bil (aggregator)](https://www.smartepenger.no/bilokonomi/354-engangsavgifter-pa-bil) | smartepenger.no | E3 | avvist_som_grunnlag |
| X02 | [Crowe – Statsbudsjettet for 2026](https://www.crowe.com/no/nyheter/statsbudsjettet-for-2026) | crowe.com | E3 | avvist_som_grunnlag |

`S07`/`S0x` viser til SOURCES.md. `whatToExtract` per kilde er sjekklisten for en direkte lesning.

## 4. Avgrensninger
- Første motor: ordinært bruksfradrag. Alternativ metode, fritak/særordninger, tilbakeføring av fradrag og salgs-mva. er utenfor.
- Landdekning: bare Tyskland har lead-kilder; ingen annen utenlandsk regel er påstått.
- DEC-030 gjelder: budsjettsummen skal ikke trekke fra fradragsberettiget mva.; salgspris/margin er ikke påkrevd.
