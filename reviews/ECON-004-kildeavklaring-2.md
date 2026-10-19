# ECON-004 — kildeavklaring runde 2: U-013, elbilfritakets målegrunnlag, omfang, lov 19.6.2026 nr. 41 (19.10.2026)

**Status: kildeavklaring, ingen godkjenning, ingen kodeendring.** ECON-004 forblir REVIEW. De fire økonomiflaggene er `false`. Dagens produktvalg og scenarioer er uendret (inkl. `UNCONFIRMED_HALF_UP`, `evThresholdBasis = unresolved`, `vehicle_price_only`-scenarioet, 8 000 som konfigurasjon). ECON-005 er ikke startet. Kilder: kun dokumenter som allerede er i repoet (`docs/tax/primarkilder/` T03, T45, T46, T49, T50 og `econ004/` T53–T69). Nettverk er fortsatt blokkert (HTTP 000 mot lovdata.no, toll.no, skatteetaten.no, regjeringen.no, testet 19.10.2026); ingen nye dokumenter er hentet.

## 0. Korrigering av tidligere rapportering
I `ECON-004-kildevurdering.md` og `ECON-004-gjenstaende-behov.md` skrev jeg at U-013 (avrunding av innførselsmva.) ikke hadde noen kildedekning i pakken. Det stemmer for *pakken* (T53–T69), men er for strengt: de allerede arkiverte ECON-002-kildene (T46, T49, T50, T45) gir en tekstlig støtte for at § 10-4-4 omfatter innførselskrav, som jeg ikke koblet til U-013. Se pkt. 1. Prio 1 i gjenstående-oversikten er derfor delvis besvart av eksisterende kilder, men ikke avgjort.

## 1. U-013 — avrunding

### 1.1 Hva eksisterende kilder sier
| Kilde | Ordlyd/innhold | Relevans for innførselsmva. |
|---|---|---|
| T46 skattebetalingsforskriften § 10-4-4 «Avrunding» | «Ved beregning av skatte- og avgiftskrav avrundes beløpet ned til nærmeste hele krone.» (endret 25.3.2010, i kraft 1.4.2010) | Generell regel i kapittel 10-forskriften |
| T46 § 10-4-1 (1) b | Beløpsgrense 50 kr for «betaling av krav på tollavgift, merverdiavgift og særavgifter som kreves opp ved innførsel, jf. skattebetalingsloven § 10-41» | **Nytt koblingspunkt:** samme regelfamilie (§§ 10-4-1 til 10-4-4) nevner uttrykkelig innførselsmva.-krav |
| T49 skattebetalingsloven § 1-1 (2) g, j | «skatte- og avgiftskrav» omfatter «merverdiavgift etter merverdiavgiftsloven» og «tollavgift omfattet av tollavgiftsloven» | Innførselsmva. er et skatte- og avgiftskrav |
| T49 § 10-41 | «Tollavgift og andre avgifter som oppstår ved innførsel … forfaller til betaling samtidig med at plikten til å beregne avgiftene oppstår» (tollkreditt/månedsoppgjør: den 18. i neste måned) | Innførselskrav er regulert i kapittel 10 |
| T50 høringsnotat 2006, merknad «Til § 10-4-3 Avrunding» | «Bestemmelsen er ment å gjelde generelt for alle skatte- og avgiftskrav» | Departementets uttrykte hensikt (historisk utkast; innførsel/mva. nevnes ikke uttrykkelig) |
| T45 Skattebetalingshåndboken § 10-4-4 (publisert 24.6.2026) | Gjentar regelen og tilføyer: «Bestemmelsen medfører at skatte- og avgiftsregnskapene ikke vil inneholde ørebeløp.» | Bekrefter praksis uten å nevne mva. spesielt |
| T56 Skatteetaten importveiledning | Eksempel 4 700 × 25 % = 1 175; ingen omtale av avrunding | Ingen |
| T63 mval. (§§ 4-11, 11-1), T67, T68, T69, T53–T55 | Ingen avrundingsregel (tekstsøk «avrund», «hele kroner», «nærmeste krone», «desimal»: 0 treff i alle 19 HTML-originaler — søkeresultat, ikke bevis for fravær) | Ingen |

### 1.2 Hva dette avgjør — og ikke
Samme kildekjede som ECON-002 brukte for engangsavgift (R-OTA-014, E1) peker på at **selve innførselsmva.-kravet** avrundes ned til nærmeste hele krone, med tillegget at forskriften § 10-4-1 (1) b uttrykkelig nevner innførselskrav. Dette er en *rettsanvendelse* (forskriftens ordlyd + departementets uttrykte hensikt), ikke en uttrykkelig mva.-bestemmelse. Det kunne tilsi nivå E1P, men er ikke registrert og ikke godkjent.

| Ledd (U-013) | Status etter denne gjennomgangen |
|---|---|
| (a) Innførselsmva.-kravet (beløpet) | **Støttet av eksisterende kilder** (se over): ned til hele krone. Ikke godkjent. Likhetsproblemet (x,5) faller bort for selve kravet hvis dette legges til grunn |
| (b) Tollverdi i NOK / valutaomregning (mellomledd) | **Ingen regel funnet.** § 10-4-4 gjelder «skatte- og avgiftskrav», ikke tollverdien. Tilsvarer U-012 (mellomledd) for engangsavgift: ikke dekket |
| (c) Hver beregning vs per deklarasjon vs mva-melding | **Uavklart.** T56 krever «grunnlag og avgift per sats for hver tolldeklarasjon»; T49 § 10-30: mva. for en periode forfaller samme dag som skattemeldingen skal leveres. Ingen kilde sier om avrundingen skjer per deklarasjon eller på periodens sum |
| (d) Beløpsformat i tolldeklarasjon/mva-melding | **Ikke dekket** (post 46/rubrikk 47 omtales uten beløpsformat) |

### 1.3 Konflikt med fixture-konvensjonen og med et tidligere valideringssignal
Hvis (a) senere godkjennes, avviker ECON-001/003-literalene (half-up) med 1 NOK i fire tilfeller (uavhengig regnet): CASE-002 B 18 665,75 → 18 665 (fixture 18 666); CASE-003 B 104 872,75 → 104 872 (fixture 104 873); A-oppgitt CASE-002 16 665,75 → 16 665 (oppgitt 16 666) og CASE-003 102 872,75 → 102 872 (oppgitt 102 873). CASE-001 (674 312) og kursrolle-scenarioet (105 153,25) er upåvirket. De oppgitte A-tallene kommer fra Skatteetatens *kalkulator* (Christian, uten skjermbilder) og er et signal, ikke en rettskilde; at kalkulatoren viser avrundede-til-nærmeste tall er ikke avgjørende for hvordan Tolletatens deklarasjon/mva-meldingen avrunder. **Ingen forventning endres nå**; fixture-konvensjonen står som «ubekreftet konvensjon».

### 1.4 Hva som gjenstår for U-013 (nye kilder)
Tolletatens veiledning for utfylling av tolldeklarasjon (statistisk verdi, post 46/47, beløpsformat) og/eller Tolldirektoratets tollverdiveileder; Skatteetatens mva-melding-veiledning (kode 81/82, beløpsfelt); eventuelt Skattebetalingshåndboken § 10-41. Se pkt. 5. Ingen produktkonvensjon er valgt.

## 2. Elbilfritaket ved innførsel — målegrunnlag

### 2.1 Hva eksisterende kilder sier (oppdatert)
- Mval. § 6-8 (1) (T63): fritak «for vederlag til og med 300 000 kroner». § 7-1 (1): ingen mva. ved innførsel av varer «som nevnt i … § 6-8 første ledd». Mval. § 4-11 (1): innførselsgrunnlaget er tollverdi (+ toll og andre avgifter som beregnes ved innførsel).
- Håndbok kap. 7 (T62): «Beløpsgrensen for fritak gjelder også ved innførsel. Avgiftsfritaket ved innførsel gjelder både nye og brukte kjøretøy.» — sier ikke hva grensen måles mot.
- Håndbok kap. 6 (T35, publisert 1.1.2026, omsetning): «Avgiftsgrunnlaget fastsettes på grunnlag av vederlaget som betales for selve kjøretøyet, fratrukket 300 000 kroner»; vektkomponenten i engangsavgiften inngår ikke.
- Tolletaten (T57): «verdi på inntil 300 000 kroner … 25 prosent … av beløpet som overstig dette.»
- **Forarbeidet (Prop. 1 LS (2025–2026) s. 197 flg./pkt. 11.2, sitert av T35) er ikke i arkivet.** `02_Prop_1_LS_2025-2026_Engangsavgift.pdf` (8 sider) og `05_Arsrundskriv…` inneholder ingen tekst om elbilens mva.-beløpsgrense (pdftotext-søk: 0 treff på «300 000»/«elbil»/«beløpsgrense» i mva.-sammenheng).

### 2.2 Vurdering
Målegrunnlaget ved innførsel er **fortsatt ikke avgjort av noen lest kilde**. Det som er nytt: tre uttrykk («vederlag» i loven, «verdi» hos Tolletaten, tollverdi som innførselsgrunnlag) er identifisert og sammenstilt; ingen kilde forklarer overgangen. Ingen produktkonvensjon er valgt; scenarioene `customs_value` / `vehicle_price_only` står uendret, og `vehicle_price_only` er fortsatt en modelleringsvariant, ikke en rettsregel. Kilde som mest sannsynlig avgjør: Prop. 1 LS (2025–2026) pkt. 11.2 (forarbeid til endringen 1.1.2026) og/eller Finansdepartementets/Skattedirektoratets uttalelse om innførsel.

### 2.3 To tidligere åpne punkter som nå er besvart av eksisterende kilder
- **Brenselcelle/hydrogen:** T35 (kap. 6, publisert 1.1.2026): fritaket for hydrogenbiler «ble avviklet» med virkning fra 1.1.2024 (daværende § 6-8 første ledd opphevet). Dagens § 6-8 gjelder bare batteri-elektriske kjøretøy med ladbar batteripakke. Kjernens kriterium `batteryOnlyPropulsion/externallyChargeableBattery` er dermed i samsvar med kildene; en brenselcellebil faller utenfor.
- **Personkjøretøy (FMVA § 1-3-1):** T35 sammenfatter at klassifiseringen følger kjøretøyregisteret og omfatter «personbiler, … varebiler med 2 seterader (varebil klasse 1), campingbiler, busser under 6 meter med inntil 17 seteplasser, snøscootere, motorsykler og mopeder». Forskriftsteksten selv er ikke lest. **Merk:** dette er bredere enn avgiftsmotorens støttede omfang (kun personbil, avgiftsgruppe a, `passenger_car_m1`); kjøretøy utenfor motorens klasse blokkeres av avgiftsmotoren (se pkt. 3).

## 3. Støttet 2026-omfang vs utvidelser

Foreslått omfangsavgrensning (ikke innført; omfanget er uendret). Kolonnen «dekkes i dag av» er kontrollert med kjøring av kjernen mot eksisterende inputkombinasjoner (midlertidig prøvefil, ikke committet).

| Tema | Nødvendig for støttet 2026-omfang? | Dekkes i dag av eksisterende blokkering/estimat? | Foreslått omfangsgrense | Trenger kilder for å utvide? |
|---|---|---|---|---|
| Norsk registrering utenfor 2026-profilen (f.eks. 2027) | Nei | **Ja:** avgiftsmotoren blokkerer (`profile_internal_limit_exceeded`) ⇒ `incomplete`/`tax_blocked` (prøve B) | Bare registreringsdato i 2026 | Ja (2027-satser; ECON-002-omfang) |
| Akseptdato 2027 eller senere (elbilgrense 300 000 brukes uendret) | Nei | **Nei:** kjernen bruker 300 000 og gir `estimate` (prøve C). Bare `customs_acceptance_date_expected` (hvis forventet) | Bare akseptdato i 2026. *Kan ikke håndheves uten en liten kodeendring* (eller ved at kaller begrenser inputen); foreslås som egen senere oppgave dersom du bekrefter grensen | Ja (lov 22.12.2025 nr. 121 del III overgang, trapp 2027/2028; pkt. 4) |
| Akseptdato før 3.9.2026 (gammelt ukentlig regime) | Nei | **Nei:** kjernen kjenner ikke regimeskiftet; en kursperiode kontrolleres bare mot akseptdato (prøve D gir `estimate`). `customs_fx_rule_unconfirmed` er alltid satt så lenge flagget er false | Bare akseptdato fra og med 3.9.2026. Håndheves ikke i dag (samme merknad) | Ja (kurser/regler før 3.9.2026, overgangsperioden i T53) |
| Andre kjøretøygrupper (varebil, motorsykkel, lastebil …) | Nei | **Ja:** avgiftsmotoren blokkerer `vehicle_class_unsupported` ⇒ `incomplete` (prøve E); elbilkvalifikasjon avgjøres av kriteriene | Bare personbil, avgiftsgruppe a (PB-DIE, PB-BEV, PB-PHEV) som i ECON-002 | Ja (FMVA § 1-3-1-tekst; egne mva.-regler per gruppe) |
| Full likviditetsmodell (frister, netting, tidspunkter) | Nei | **Ja i praksis:** kjernen modellerer ingen tidspunkter; `importCashRequirement` er dokumentert som brutto utlegg; mva.-kanal er bare beløp | Ingen likviditetsmodell; bare brutto + mva.-kanal | Delvis besvart (se under); full modell krever egne beslutninger |
| Suspendert tollkurs / valutaer utenfor Tolletatens liste | Delvis | **Delvis:** `suspension` ukjent ⇒ estimat; `suspended` ⇒ kurs ikke brukt og `incomplete`; valuta uten tollkurs ⇒ `customs_fx_missing` (`incomplete`) eller uttrykkelig fallback ⇒ estimat | Bare valutaer med publisert tollkurs; suspensjon må oppgis | Nei for 2026-omfanget |

**Betalingstidspunkter som allerede er besvart av eksisterende kilder** (hvis en likviditetsmodell senere tas inn): T49 § 10-40 (1) c: engangsavgift for registrerte virksomheter forfaller den 18. i måneden etter at avgiftsplikten oppstod; T03 pkt. 11.1: for ikke-registrerte (kontantkunder) må avgiften være innbetalt før registrering, og brukt kjøretøy må være «fortollet (betalt merverdiavgift)» før enkeltgodkjenning; T49 § 10-30 (1): mva. for en periode forfaller samme dag som skattemeldingen skal leveres (selve fristen står i skatteforvaltningsloven § 8-3, ikke i arkivet); T49 § 10-41: innførselsavgifter forfaller når beregningsplikten oppstår (tollkreditt/månedsoppgjør: den 18. i neste måned). Ikke besvart: hva Tolletaten innkrever ved grensen fra registrerte, og skattemeldingens frister.

## 4. Lov 19. juni 2026 nr. 41 — identitet og relevans

**Hva kildene faktisk dokumenterer** (alt fra Lovdata-fotnoter i T49 og T63; selve loven er ikke hentet):
- «Endres ved lov 19 juni 2026 nr. 41 (i kraft fra den tid Kongen bestemmer)» står på: skattebetalingsloven § 1-1, § 3-3, overskriften til § 10-30 (innenlands mva. og arveavgift), §§ 10-30, 10-31, 10-32 (blir § 10-40), 10-40 (blir § 10-41), **10-41** (innførselsavgifter), 11-2, 14-20, 14-21, **14-22 (tilføyes)**, 14-11, 16-40, og **opphever** §§ 16-41 og 16-42. I merverdiavgiftsloven står den på **§ 6-7** (omsetning av kjøretøy som omfattes av vedtaket om omregistreringsavgift), **ikke** på § 6-8, § 4-11, § 7-1, § 8-1 eller § 8-4. (En annen lov, nr. 48, står på mval. § 9-7; «lov 19 juni 2026 nr. 45» er i kraft 1.7.2026 og berører skattebetalingsloven § 14-11.)
- Alle endringene er «ikke i kraft» (Kongen bestemmer).
- Skattebetalingsforskriften § 10-4-4 og skattebetalingsloven § 10-4 er **ikke** nevnt som endret av nr. 41 i fotnotene.

**Ikke dokumentert (må ikke videreføres som antatt):** lovens tittel og formål; hva endringene i § 1-1 og § 10-41 faktisk innebærer; ikrafttredelse; om den påvirker elbilfritaket (§ 6-8), tollverdi (§ 4-11), fradrag (§ 8-1/§ 8-4), tollkurs eller avrundingskjeden (§ 10-4-4).

**Konsekvens for videreføring:**
| Regel/punkt | Videreføres «lov nr. 41» som blokkering? | Begrunnelse |
|---|---|---|
| R-IMP-VAT-003 (elbilfritak, 300 000) | **Nei** | Ikke nevnt på § 6-8; tidligere kobling («nedtrapping/lov 19.6.2026») hadde ikke dokumentert belegg. Relevante endringer for § 6-8 er lov 22.12.2025 nr. 121 (del III overgangsregel) — dokumentert i § 6-8-fotnoten |
| R-IMP-VAT-001/-002 (grunnlag/tollverdi) | Nei | Ikke nevnt på §§ 4-11 eller 3-29 |
| R-DED-001 (fradrag) | Nei | Ikke nevnt på §§ 8-1, 8-4 |
| U-013 / R-OTA-014 (avrunding) | **Som overvåkingspunkt** | § 1-1 (som definerer «skatte- og avgiftskrav») og § 10-41 endres, ikke i kraft. Effekten på kjeden § 1-1 → § 10-4-4 er ukjent. Må leses (pkt. 5, nr. 1) før (a) i pkt. 1.2 løftes |
| Likviditetsmodell (§§ 10-30, 10-40, 10-41) | Som overvåkingspunkt | Betalingsfrister endres ved ikrafttredelse; irrelevant for støttet omfang uten likviditetsmodell |
| 2027/2028-trapp for elbilfritaket | Nei | Ingen kilde knytter trappen til nr. 41; den hører til lov 22.12.2025 nr. 121 / Prop. 1 LS-sporet (ikke dokumentert i arkivet) |

**Dokumentert relevans vs søkespor:** *dokumentert:* nr. 41 endrer skattebetalingsloven (bl.a. § 1-1 og § 10-41) og mval. § 6-7; *søkespor (uundersøkt):* alt annet, inkludert enhver kobling til elbilfritak og trapp 2027/2028. Registerets formuleringer i `rules.json` (R-IMP-VAT-003 «Lov av 19.6.2026: ikrafttredelse ukjent») og `ECON-004-gjenstaende-behov.md` (prio 3) bør derfor omformuleres neste gang registeret oppdateres; ikke gjort nå.

## 5. Innhentingsliste (kort; Christian må hente — nettverk blokkert for meg)
«Forsøkt» = hva som allerede er gjort, så vi unngår gjentatt søk. Prioritet for støttet 2026-omfang: **H** = trengs for å vurdere flagg, **M** = nyttig, **L** = bare ved utvidelse.

| # | P | Dokument (identitet) | Bestemmelse | Spørsmålet teksten skal besvare | Kjent URL | Allerede forsøkt |
|---|---|---|---|---|---|---|
| 1 | H | Lov 19. juni 2026 nr. 41 (tittel ukjent) — LOV-2026-06-19-41 | Hele loven (endringsliste), spesielt endringene i skattebetalingsloven § 1-1 og § 10-41, og mval. § 6-7 | Hva endrer den, når trer den i kraft, og berører den kjeden § 1-1 (2) g → § 10-4-4 eller innførselsmva.? | Lovdata `…/dokument/LTI/lov/2026-06-19-41` (mønster utledet fra T65-URL, **ikke verifisert**) | Bare fotnoter i T49/T63 lest (pkt. 4); loven selv ikke hentet; nettverk blokkert |
| 2 | H | Prop. 1 LS (2025–2026) Skatter, avgifter og toll 2026, pkt. 11.2 (s. 197 flg.) | Mva.-beløpsgrense for elektriske personkjøretøy 500 000 → 300 000 | Hva måles 300 000 mot ved **innførsel** (vederlag, tollverdi, kjøretøyets pris)? Gjelder forarbeidet innførsel? | regjeringen.no, `…/prop.-1-ls-20252026/id3124192/` (dokumentet T41 er hentet herfra; kapittel om mva. har ukjent `?ch=`) | T41 (8-siders utdrag) lest: ingen mva.-tekst; T35 siterer sidene; ikke hentet |
| 3 | H | Tolletatens veiledning for tolldeklarasjon (utfylling) + Tolldirektoratets tollverdiveileder | Rubrikk 22/23 (valuta), 37, 46 (statistisk verdi), 47 (avgifter), beløpsformat | Avrunding/desimaler på tollverdi i NOK, statistisk verdi vs tollverdi, hvordan mva. beregnes og avrundes i deklarasjonen | Ingen verifisert URL (T60 nevner tollverdiveileder «på www.toll.no»; T10 tilleggs-URL `toll.no/no/bedrift/import/beregning`, aldri hentet) | Tekstsøk «avrund»/«hele kroner»/«desimal» i T53–T69: 0 treff; T10 aldri lest |
| 4 | M | Skatteetatens mva-melding: veiledning/spesifikasjon for beløpsfelt, kode 81/82 | Innførsel (kode 81/82), beløpsformat | Rapporteres innførselsmva. i hele kroner, og avrundes summen eller hver deklarasjon? | Ingen verifisert URL (T56 er hentet; sidene under `…/bedrift-og-organisasjon/avgifter/mva/` ellers ikke) | T56 lest: ingen avrundingstekst |
| 5 | M | Lov 22. desember 2025 nr. 121, endringslovens del III (overgangsregel) | Overgangsregel til mval. § 6-8 (1) fra 1.1.2026 | Gjelder 300 000 uten forbehold for innførsel etter 1.1.2026, også for kjøretøy anskaffet/bestilt før? | Lovdata (mønster som nr. 1, **ikke verifisert**) | § 6-8-fotnoten i T63 lest: viser bare «se endringsloven del III»; selve overgangsregelen ikke lest |
| 6 | M | Vareførselsloven § 3-3/§ 3-4 er allerede i arkivet (T67) — **trengs ikke**; derimot Tolletatens side om «Digitoll/deklarasjon før innførsel» | Når regnes akseptøyeblikket for tidlig levert deklarasjon i praksis | Bekrefte at akseptdato = tidspunkt for fremleggelse (jf. § 3-3 (3): deklarasjon uten fremleggelse innen 30 dager anses ikke levert; § 3-4 (1): aksept krever at varen er fremlagt) | T53 henviser til Digitoll (høring 7); ingen URL verifisert | § 3-3 (3) og § 3-4 (1) lest i T67 (se under) |
| 7 | M | Forskrift om merverdiavgift (FMVA) § 1-3-1 «personkjøretøy» (og eventuelle bestemmelser om elbil/innførsel) | § 1-3-1 | Eksakt definisjon av personkjøretøy for fritaket | Lovdata, FMVA (FOR-2009-12-01-1500 — **ID fra hukommelsen, ikke verifisert**) | T35 har bare håndbokens sammendrag |
| 8 | L | Tolltariffen for personbiler (kap. 87, 8703) | Tollsats | Er tollsatsen 0 for personbiler (relevant for om `customsDuty` kan settes «ikke aktuelt»)? | Ingen verifisert URL | T68 § 3-1 henviser til tolltariffen; ikke lest |
| 9 | L | Skatteforvaltningsloven § 8-3 / skattemeldingens frister for mva. | Frister | Likviditetsmodell | Ingen verifisert URL | T49 § 10-30 lest: henviser dit |
| 10 | L | Tolletatens kurshistorikk før 3.9.2026 og suspensjonsvarsler | `Finn historiske kursar`; suspensjonsside | Bare for utvidelse (historiske regimer) | Lenke på T23-siden (`toll.no/no/verktoy/valutakurser/`); datasett `data.toll.no/no/dataset/valutakurs` (T54) | T23/T54/T55 lest: ingen historikk, ingen suspensjon vist |

**Ikke bestill (allerede i arkivet):** vareførselsloven § 3-3/§ 3-4 (T67): § 3-3 (3) «Deklarasjonen kan leveres før varen legges frem … Hvis varen ikke legges frem senest 30 dager etter at deklarasjonen er levert, anses deklarasjonen som ikke levert»; § 3-4 (1): aksept når §§ 3-2 og 3-3 er oppfylt «og varen … er fremlagt for tollmyndighetene». Kombinert med tollavgiftsloven § 2-2 (1) og forskriften § 6-12-1 (3) følger at tidlig levert deklarasjon ikke fikserer kursen før varen er fremlagt (lest av to bestemmelser sammen; ikke bekreftet av en praksiskilde — nr. 6 over). Skattebetalingsforskriften, skattebetalingsloven og håndbok § 10-4 (T45, T46, T49) er også allerede arkivert.

## 6. Hva som er gjort og ikke gjort
Gjort: lesing av eksisterende arkiv, tekstsøk, én midlertidig prøvekjøring av kjernen (fil slettet, ikke committet). Ikke gjort: kode, tester, registeroppdatering (`sources.json`/`rules.json` er uendret; noen påstander over — § 3-3 (3), § 10-4-1 (1) b, hydrogenavviklingen — kan registreres som `supportedClaims` ved neste registeroppdatering), parameter- eller flaggendring, nye produktvalg.
