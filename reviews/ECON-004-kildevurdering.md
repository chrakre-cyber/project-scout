# ECON-004 — kildevurdering av pakken «Merovo_ECON-004_primarkilder_2026» (19.10.2026)

**Status: vurdering, ikke godkjenning.** Ingen regel eller parameter er godkjent, ingen økonomiflagg er satt (`vatRulesApproved`, `roundingApproved`, `customsFxRuleApproved`, `deductionRuleApproved` er fortsatt `false`), ECON-002-godkjenningene, klasse 1-definisjonen og ECON-003-forventningene er urørt. ECON-004 forblir REVIEW. ECON-005 er ikke startet. Ingen kode er endret. Pakken er ikke lagt inn i repoet (`docs/tax/primarkilder/`) ennå; det avventer din beslutning.

## 1. Kontroll av pakken
- ZIP: 44 filer. `MANIFEST.json` (43 oppføringer) kontrollert mot byte og SHA-256 fil for fil: **43 av 43 stemmer, 0 avvik**. Eneste fil utenfor manifestet er manifestet selv.
- `acquisition.json` (20 oppføringer): SHA-256, bytes og URL = endelig URL stemmer mot manifestet og filene (0 avvik). Hentetid 2026-10-19 11:21–11:23 UTC. 19 HTML-originaler + 19 TXT-lesekopier + 1 JSON-snapshot.
- Lest: `CLAUDE_INSTRUCTIONS.md`, `LES-MEG.md`, de 19 HTML-originalene (sitater er kontrollert mot TXT-kopiene der de er gjengitt under; TXT er bare lesekopier). Fil 17 er en navigasjons-/metadataside; kapittel 6 er lest i fil 20.
- Søk på «avrund», «hele kroner», «nærmeste krone», «desimal» i tekstinnholdet i alle 19 HTML-filer: **ingen treff**. Dette er et søkeresultat, ikke bevis for at regelen ikke finnes (jf. instruksjon 8).
- Begrensninger i pakken (fra `LES-MEG.md`, bekreftet): lov 19.6.2026 nr. 41 ikke hentet; kursuttrekket er et snapshot av 19.10.2026; håndbokens «Siste endringer» viser bare de fire nyeste endringene (22.9.2026, ingen gjelder § 8-4); ingen ekvivalenskonklusjon 2023 vs i dag fra pakken (jeg gir en under).

## 2. Kilde-ID-er (forslag, ikke registrert)
| Fil | Dokument | Forslag |
|---|---|---|
| 01 | Tolletaten: endringsforskrift omregningskurser (veiledning) | ny ID (veiledning, ikke forskriftstekst) |
| 02 | Valutakurser (toll.no) | = **T23** (samme URL; ny hentet versjon, tidligere E2 aldri hentet) |
| 03 / 04 | data.toll.no datasett / JSON-snapshot | nye ID-er (dataset, snapshot) |
| 05 | Vareførselshåndboken § 6-12 | = **T24** |
| 06 | Skatteetaten: Beregne og rapportere mva. ved import (nettside) | **ikke** T11 (T11 er et PDF-dokument med annen URL); ny ID, T11 forblir bestilt |
| 07 | Tolletaten: Elektriske kjøretøy | ny ID (relatert til T33/T21, ikke samme side) |
| 08–12 | Mva.-håndboken, løpende utgave (endringsoversikt, kap. 8, 4, 6, 7) | kap. 8 = samme dokumentidentitet som **T12/T22**, kap. 6 som **T35/T13** (URL-skjemaet er endret fra `MVA2025_M-…` til «gjeldende»); kap. 4, 7 og endringsoversikt nye |
| 13 | Mva.-håndboken 2023, 8-4.3 | = **T36** (nå lest) |
| 14 | Merverdiavgiftsloven (Lovdata) | ny ID (lov) |
| 15 | Tolletaten: fraktkostnader egne hjul/egen kjøl (sjablong) | tilleggs-URL i **T10**; ny ID anbefales |
| 16, 17, 20 | Endringsforskrift 2026-08-21-1661; vareførselsforskriften (meta); kap. 6 | nye ID-er |
| 18, 19 | Vareførselsloven; tollavgiftsloven | nye ID-er |

## 3. Samlet oversikt
| Punkt | Kan lukkes (kildestøttet, ikke godkjent) | Mangler/forblir åpent |
|---|---|---|
| **U-003** | Ja som *versjons-/årgangsspørsmål*: håndboken er løpende oppdatert (ingen årsutgave); videresalgsavsnittet i gjeldende § 8-4 er ordrett likt 2023-avsnittet; vilkårene hviler på lovteksten § 8-4 | 2026-dekning for hver påstand er ikke et årgangsspørsmål, men lov 19.6.2026 nr. 41 er ikke lest; håndbokens fulle endringslogg er ikke lest |
| **U-008** | Ja for *regelteksten*: syklus, gyldighet, tidspunkt, avviksordning, enheter | Hvilken akseptdato en konkret import får (fremtidig), suspensjon i casen, historiske kurser før 3.9.2026, valutaer utenfor listen, rubrikknummer (23 vs 22) |
| **U-013** | **Nei** | Ingen regel funnet i pakken. Se pkt. 4.3 |
| **R-IMP-VAT-002** | Delvis ja: grunnlag, transport/forsikring til innførselsstedet, lasting/håndtering, sjablong, tillegg for toll/avgifter, unntak engangsavgift (støttet av § 4-2, ikke uttrykkelig for § 4-11) | Delt fakturering før/etter grensen i praksis, tollsats for personbil, statistisk verdi vs tollverdi, hva Tolletaten faktisk innkrever ved grensen |
| **R-IMP-VAT-003** | Delvis ja: fritaket gjelder også ved innførsel, 300 000 fra 1.1.2026, kun rene batterielektriske personkjøretøy, overskytende 25 % | Måleobjektet ved innførsel («verdi» vs «vederlag» vs tollverdi), overgangsregler, lov 19.6.2026 nr. 41, 2027-trapp |
| **R-DED-001** | Delvis ja: fradragsrett er lovfestet for personkjøretøy til salgsvare; samme regler for kjøp fra utlandet; dokumentasjonskrav; *betalingsmåte er en egen akse* | Kan ikke utledes fra «forhandler» eller annonse; salgsvare-status må dokumenteres/oppgis; senere omdisponering/uttak; forholdsmessig fradrag |

## 4. Per punkt

### 4.1 U-003 — MVA-kildenes årgang
**Hva kildene sier.** Håndboken (fil 08): «Vi vil ikke lenger publisere årsversjoner, men holde innholdet løpende oppdatert.» Kapitlene er merket «Håndbok fra Skattedirektoratet … Publisert 15.03.2025». «Siste endringer» (22.9.2026) nevner § 3-11, § 3-30 og § 8-1 (tilknytningskrav, fellesskap) — ingen endring i § 8-4 i de fire viste oppføringene.
**Sammenligning § 8-4.3 videresalg.** Gjeldende kap. 8 (fil 09): «Etter § 8-4 første ledd bokstav a kan inngående avgift fradragsføres ved anskaffelse av personkjøretøy for videresalg. Unntaket kom inn i loven med virkning fra 1. mars 2004, men er en kodifisering av tidligere forvaltningspraksis. Fradragsretten gjelder også anskaffelser til vedlikehold og reparasjoner, samt klargjøring …». 2023 (fil 13): samme ord. Jeg sammenlignet avsnittet ord for ord (overskriftene står interleavet ulikt); ordmengden er identisk. **Ingen innholdsforskjell funnet for videresalgsunntaket.**
**Rettslig vilkår (separat fra årgang):** mval. § 8-4 (1) bokstav a «salgsvare» (fil 14: «Fradragsretten omfatter ikke inngående merverdiavgift på anskaffelse, drift og vedlikehold av personkjøretøy. Det er likevel fradragsrett … på personkjøretøy til bruk som a. salgsvare …»).
**Kan lukkes:** U-003 som versjonsspørsmål («2025-utgave» er et navn på en løpende håndbok; ikke krev årsutgave 2026). **Gjenstår:** lov 19.6.2026 nr. 41 og håndbokens fulle endringslogg for § 8-4/§ 8-1.

### 4.2 U-008 — Tollkurs
**Ordlyd (fil 20/16, vareførselsforskriften § 6-12-1, endret ved FOR-2026-08-21-1661, kunngjort 24.8.2026, i kraft 3.9.2026, hjemmel vareførselsloven § 6-12):**
(1) «… fastsetter tollmyndighetene annenhver tirsdag omregningskurser for de mest benyttede valutaer basert på Norges Banks indikative markedskurser fra nærmest foregående virkedag. Kursene gjelder for to uker (14 dager) fra og med tredje påfølgende torsdag etter fastsettelse. … For øvrige valutaer skal det … benyttes Norges Banks daglige markedskurser omregnet til norske kroner.»
(2) Avviksordning: «avviker mer enn fem prosent fra Norges Banks daglige markedskurs for to påfølgende dager, skal den fastsatte omregningskursen suspenderes med virkning fra den påfølgende dagen og for resterende gyldighetsperiode.»
(3) «Ved omregning av valuta skal tidspunktet for tidfesting av tollavgiftssats i tollavgiftsloven § 2-2 anvendes.»
**Tidspunktet.** Tollavgiftsloven § 2-2 (1): beregnes «etter de reglene og satsene som gjelder på det tidspunktet tollmyndighetene aksepterer deklarasjonen etter vareførselsloven § 3-4». Vareførselsloven § 3-4 (1): deklarasjon aksepteres når vilkårene i §§ 3-2 og 3-3 er oppfylt «og varen … er fremlagt for tollmyndighetene». Særtilfeller (brudd på vilkår, midlertidig innførsel, innenlands bearbeiding) har egne tidspunkter i § 2-2 (2)–(4). Mval. § 3-29 (2): tollavgiftsloven § 2-2 om tidfesting «gjelder tilsvarende» for innførselsmva. — **samme tidspunkt styrer kurs, tollavgiftssats og mva.-regler.**
**Syklusen (konfliktløsning).** Konflikten i registeret («ukentlig» vs «annenhver tirsdag») er løst som regimeskifte: før 3.9.2026 ukentlig (onsdag, virkning påfølgende mandag; fil 01), etter 3.9.2026 annenhver tirsdag. Overgang: 7.–16.9.2026 (fastsatt 2.9) og 17.–30.9.2026 (fastsatt 3.9) (fil 01, veiledning).
**Snapshot (fil 03/04/02, hentet 19.10.2026):** 22 valutaer pluss NOK; felter `valutakode`, `valutakurs` (desimalkomma, tre desimaler), **`omregningsenhet` (1 eller 100)**, `fomdato`, `tomdato`; to perioder: 15.10–28.10.2026 og 29.10–11.11.2026 (publisert i forkant). EUR: enhet 1, 10,817 og 10,695. Valutaer med enhet 100 (bl.a. CHF, CNY, CZK, DKK, HUF, INR, JPY, KRW, PKR, RON, SEK, THB). Sidene sier «rubrikk 23» (fil 02) og «rubrikk 22» (fil 03) — inkonsistent mellom kildene. JSON er ikke historikk og ikke bevis for en bestemt casekurs.
**Kan lukkes:** regelteksten for syklus, gyldighetsperiode, grunnlag (Norges Bank foregående virkedag), avviksordning og tidspunkt (U-008). **Gjenstår:** (a) akseptdato for en fremtidig import er ukjent ved beregning ⇒ kursperiode er en antakelse/scenario; samspill med tidlig levering av deklarasjon (16–30 dager før, fil 01) og akseptkravet «varen er fremlagt» er ikke avgjort av dokumentene; (b) suspensjon (når den inntreffer, gjelder Norges Banks daglige kurs; ikke i snapshot); (c) kurser før 3.9.2026 (gammelt regime) er ikke i pakken; (d) valutaer utenfor listen; (e) **anskaffelseskursen (betalingskurs) er en egen kostnad og styres ikke av disse kildene** — kun tollkursen.

### 4.3 U-013 — Avrunding (ikke løst)
Ingen av de 19 dokumentene inneholder (per tekstsøk) en regel om avrunding av tollverdi, valutaomregning, innførselsmva. eller mva.-melding. Det som finnes: Skatteetatens eksempel (fil 06) bruker hele kroner uten å si noe om avrunding (4 700 × 25 % = 1 175); kursene har tre desimaler. **Ikke overfør** § 10-4-4 (engangsavgift) eller fixturenes half-up. For hver av de fire leddene mangler kilde:
| Ledd | Spørsmål | Status |
|---|---|---|
| Tollverdi i NOK | Avrundes beløp × kurs? når, til hva? | Ingen regel funnet |
| Valutaomregning | Enhet 1/100, antall desimaler, rekkefølge (kjøpesum × kurs, så frakt?) | Ingen regel funnet |
| Hver innførselsmva.-beregning | Per deklarasjon, per linje, per sats? | Ingen regel funnet; veiledning krever «grunnlag og avgift per avgiftssats for hver tolldeklarasjon» |
| Samlet krav / mva.-melding | Summering av avrundede eller uavrundede beløp | Ingen regel funnet |
**Presentasjon vs avrunding:** to desimaler i visning er ikke en avrundingsregel. **Foreslåtte kilder å bestille (søkespor, ikke verifisert):** Tolletatens veiledning for utfylling av tolldeklarasjon (statistisk verdi, tollverdi, avgifter; beløpsformat), Tolldirektoratets tollverdiveileder (nevnt i håndbok kap. 4 på toll.no), Skatteetatens spesifikasjon/veiledning for mva.-meldingens beløpsfelt og kode 81/82. Kjernen beholder `UNCONFIRMED_HALF_UP` og tie ⇒ nedre grense.

### 4.4 R-IMP-VAT-002 — Tollverdi / MVA-grunnlag, transport, forsikring
**Ordlyd.**
- Mval. § 4-11 (1): «Ved innførsel av varer skal beregningsgrunnlaget fastsettes etter vareførselsloven §§ 6-2 flg. om tollverdi. Tollavgift og andre avgifter som skal beregnes ved innførsel av varer, skal inngå i beregningsgrunnlaget.» (i kraft 1.1.2023.)
- Vareførselsloven § 6-10 (1): til prisen legges bl.a. «e. transport- og forsikringskostnaden for varen til innførselsstedet; f. kostnader for lasting og håndtering som er forbundet med transporten av varen.» (2): tillegg «skal bare gjøres når dette kan baseres på grunnlag av objektive og kvantifiserbare opplysninger».
- Vareførselsforskriften § 6-10-4: (1) innførselssted = «det første sted hvor varen kunne ha vært losset»; (2) felles fakturert transport før/etter innførsel fordeles etter avstand «dersom ikke en annen fordeling sannsynliggjøres»; (3) transporterer kjøperen selv: «fraktkostnadene beregnes ut fra hva som er vanlige fraktkostnader for tilsvarende transportmåte».
- Sjablong (fil 15, oppdatert 27.11.2025): gjelder **varer som ankommer på egne hjul**: «Fra Sverige NOK 500; Fra Danmark NOK 1 500; Fra Tyskland NOK 2 500»; andre land: ingen felles sjablong, beregning «skal … stå i forhold til de tre … satsene»; importøren kan dokumentere reelle kostnader.
- Skatteetaten (fil 06): grunnlaget er «summen av statistisk verdi + toll og avgifter» (statistisk verdi i tolldeklarasjonens post 46; toll og andre avgifter i rubrikk 47; eksempel 3 000 + 1 700 = 4 700 × 25 % = 1 175).
- Engangsavgift: mval. § 4-2 (1) a (omsetning): «…unntatt engangsavgift på motorvogner mv.»; håndbok kap. 4: engangsavgiften ble lagt om fra innførselsavgift til registreringsavgift fra 1.4.2001. For *innførsel* (§ 4-11) står unntaket ikke uttrykkelig; § 4-11-kommentaren nevner «motorvognavgifter» som eksempel på særavgifter. Konklusjon: *støttet av § 4-2 og avgiftens karakter, ikke uttrykkelig for § 4-11* — fixturenes forutsetning (mva. uten engangsavgift) er kildestøttet, men ikke avgjort.
**Kan lukkes:** transport og forsikring til innførselsstedet inngår i tollverdien (og dermed mva.-grunnlaget) forutsatt objektiv/kvantifiserbar dokumentasjon; lasting/håndtering inngår også; frakt etter innførselsstedet inngår ikke; toll og andre avgifter som beregnes ved innførsel inngår; sjablongen er *bare* for egne hjul og tre land.
**Gjenstår:** tollsats for personbil (ikke i pakken; kjernen beholder `customsDuty` ukjent ⇒ nedre grense); «andre avgifter» for personbil i praksis; om statistisk verdi alltid er lik tollverdi; hva Tolletaten innkrever ved grensen for registrerte importører (T10 «Betaling av avgifter» er ikke i pakken).

### 4.5 R-IMP-VAT-003 — Elbilfritak
**Ordlyd.** Mval. § 6-8 (1): «Omsetning av personkjøretøy som bare bruker elektrisitet til framdrift, og hvor elektrisiteten leveres fra batteripakke som kan lades fra ekstern strømkilde, er fritatt for merverdiavgift for vederlag til og med 300 000 kroner.» (endret ved lov 22.12.2025 nr. 121, i kraft 1.1.2026, «se endringsloven del III for overgangsregel».) § 7-1 (1): «Det skal ikke beregnes merverdiavgift ved innførsel av varer som nevnt i … § 6-8 første ledd …». Håndbok kap. 7: «Beløpsgrensen for fritak gjelder også ved innførsel. Avgiftsfritaket ved innførsel gjelder både nye og brukte kjøretøy.» «Hybridbilene vil således falle utenfor fritaket.» Håndbok kap. 6: «…fra merverdiavgift på den delen av kjøpesummen som overstiger 500 000 kroner til 300 000 kroner» (1.1.2026); «Avgiftsgrunnlaget fastsettes på grunnlag av vederlaget som betales for selve kjøretøyet, fratrukket 300 000 kroner. … Den nye vektkomponenten i engangsavgiften inngår ikke i beregningsgrunnlaget.» Tolletaten (fil 07, oppdatert 19.8.2026): «Elektriske kjøretøy med verdi på inntil 300 000 kroner er fritatt …; overstiger verdien … 25 prosent … av beløpet som overstiger dette.» Gjelder «nye og brukte kjøretøy som ikke tidligere har vært registrert i Norge»; «hybridbiler» er avgiftspliktige; importøren må dokumentere vilkårene.
**Kan lukkes:** at fritaket gjelder ved innførsel; grensen 300 000 fra 1.1.2026; kjøretøykriterium (bare elektrisk framdrift, ladbar batteripakke, personkjøretøy etter FMVA § 1-3-1); overskytende beløp ⇒ 25 %; ikke vektkomponenten. Test under/på/over grensen er allerede dekket (299 999, 300 000, 300 001–300 003, 350 000).
**Gjenstår:** (a) **måleobjektet ved innførsel**: lovteksten sier «vederlag», Tolletaten «verdi», mva.-grunnlaget ved innførsel er tollverdi (+ toll/avgifter). Dokumentene sier ikke uttrykkelig at transport/forsikring til grensen teller med i 300 000-grensen ved innførsel; (b) lov 19.6.2026 nr. 41 og trapp 2027/2028 (ikke hentet); (c) overgangsregelen i endringsloven; (d) **kjernen klassifiserer BEV ut fra «ingen stempelmotor» (avgiftsmotoren), men fritakets kriterium er snevrere («bare elektrisitet … batteripakke … ladbar»)** — brenselcelle (hydrogen) er ikke uttrykkelig avklart; kjernen trenger et eget kvalifiseringsfelt.

### 4.6 R-DED-001 — Fradragsrett og oppgitt status
**Ordlyd.** Mval. § 8-1: «Et registrert avgiftssubjekt har rett til fradrag for inngående merverdiavgift på anskaffelser av varer og tjenester som er til bruk i den registrerte virksomheten.» § 8-4 (1) som over (salgsvare). Skatteetaten (fil 06): «Mva-registrerte virksomheter skal beregne innførselsmerverdiavgift selv og føre det i mva-meldingen. Dette gjelder for alle kjøp av varer, både varer som skal brukes i virksomheten og varer som skal videreselges. Det gjelder også for varer virksomheten ikke har fradragsrett for.» «Det gjelder samme regler for fradrag for kjøp fra utlandet som for kjøp av varer og tjenester i Norge.» Mva-melding: kode 81 «med fradragsrett», 82 «uten fradragsrett» (høy sats). Dokumentasjon: tolldeklarasjon med underbilag; grunnlag og avgift per sats for hver deklarasjon.
**Kan lukkes:** at vilkårene er (1) registrert avgiftssubjekt, (2) kjøretøyet anskaffet som salgsvare, (3) dokumentasjon; at fradragsrett ved import følger de innenlandske reglene; videresalgsunntaket er uendret mot 2023 (se 4.1).
**Gjenstår / kan ikke utledes:** fradragsstatus følger ikke av ordet «forhandler» eller annonse; om bilen faktisk er salgsvare (demonstrasjon, utlån, egen bruk) og hva som skjer ved senere omdisponering/uttak er ikke vurdert; forholdsmessig fradrag. **Hold adskilt:** (i) regelvilkår, (ii) dokumentasjon, (iii) produktets opplysningspolicy (hvem kan oppgi status; kjernen godtar i dag bare `dealer_entered`/`dealer_profile`).

## 5. Kontantbehov for mva-registrerte forhandlere (instruksjon 7)
**Funn.** Kjernens `importCashRequirement` er definert (ECON-001) som kjøpesum + transport (+ forsikring) **+ import-mva.** + registreringsavgifter + øvrige poster, uavhengig av fradragsrett. Kildene viser at dette *ikke* beskriver betalingsbehovet for en mva-registrert virksomhet:
- Mva-registrert virksomhet **beregner og rapporterer innførselsmva. selv i mva-meldingen** (kode 81/82) for den terminen *ekspedisjonsdatoen* tilhører — også for varer til videresalg og uten fradragsrett. Den betaler ikke mva. til Tolletaten ved innførsel; det gjør privatpersoner og ikke-registrerte (fil 06).
- **Avledet, ikke uttrykkelig sitert:** kode 81 (med fradragsrett) og 82 (uten) er skilt i meldingen. Med fradragsrett er det rimelig å lese det slik at beregnet mva. og fradrag føres i samme melding, så nettoeffekten på betalingen er null; uten fradragsrett betales mva. via meldingen, senere enn grensen. Betalingsfrist og netting er ikke i pakken og må bekreftes.
- **Fradragsrett og betalingsmåte er to uavhengige akser.** Registrert + ikke fradrag: mva. betales via meldingen. Ikke registrert: betales ved import, ingen fradrag (ingen fradragsrett uten registrering).
**Konsekvens.** `importCashRequirement` er i dag en **brutto utgift inkl. mva.**, ikke «kontantbehov ved innførsel». For en registrert forhandler overstiger den kontantbehovet ved grensen med hele import-mva. (fixture, B-standard: CASE-001 674 312, CASE-002 18 666, CASE-003 104 873 NOK), og med fradrag er mva. aldri en kostnad. Navnet «kontantbehov» er derfor misvisende for denne brukergruppen.
**Foreslått avgrenset retting (ikke utført; endrer ikke betydningen av eksisterende felt).**
1. Nytt inputfelt `vatHandling: "registered_reports_in_vat_return" | "not_registered_pays_at_import" | "unknown"` med kilde (`dealer_entered`/`dealer_profile` — aldri fra annonse eller «forhandler»), standard `unknown`.
2. Nye resultatfelt ved siden av dagens: `cashAtImport` (ekskl. mva. for registrert; inkl. for ikke-registrert; `lower_bound`/scenarioer når `unknown`) og `vatViaReturn: { payableInReturn, deductedInReturn, netEffect }` (kun beskrivende beløp, ingen terminlogikk).
3. Beholde `importCashRequirement` uendret i verdi, men dokumentere/omdøpe presentasjonen til «brutto inkl. mva.» i ECON-004-docs og ECON-005-kontrakten før noen UI bruker det som betalingsbehov. ECON-003-literalene (858 087 osv.) forblir gyldige som *brutto*.
4. Ikke modellere tidspunkt (termin, betalingsfrist) før kilde for betalingsfrist og dato (`ekspedisjonsdato`) foreligger.
Mangler i pakken for en full likviditetsmodell: hva Tolletaten innkrever ved grensen fra registrerte (toll, gebyrer), mva.-meldingens betalingsfrist, engangsavgiftens betalingstidspunkt (T21 beskriver rekkefølgen Tolletaten → Skatteetaten → Statens vegvesen for privatpersoner).

## 6. Øvrige konsekvenser for implementeringen (forslag, ikke utført)
| # | Konsekvens | Begrunnelse |
|---|---|---|
| 1 | `FxQuote` mangler **enhet** (`omregningsenhet` 1/100); rate lagres «NOK per enhet» uten enhetsfelt ⇒ 100×-feil for JPY, SEK, DKK m.fl. | fil 03/04 |
| 2 | `FxQuote` har ett `effectiveAt` og kjernen avviser kurs med `effectiveAt > asOf`; kildene gir **gyldighetsperiode (`fomdato`–`tomdato`) og fremtidige kurser publisert på forhånd**. Riktig sjekk er at *aksept-/importdato* ligger i perioden og ikke er suspendert | fil 01–04, 20 |
| 3 | Kjernen har ingen `declarationAcceptanceDate`; `asOf` er beregningsdato. Tidspunktet for kurs, sats og mva.-regler er akseptdatoen (§ 3-29 (2), tollavgiftsloven § 2-2) og må være eget input (forventet/faktisk). Adskilt fra avgiftsmotorens norske registreringsdato | § 2-2, § 6-12-1 (3) |
| 4 | Transport er ett beløp som i sin helhet går inn i tollverdien. Kilden skiller transport **til** innførselsstedet (i tollverdi) fra transport **etter** (kostnad, ikke i grunnlaget). Produktstandard 8 000 har ingen kilde (sjablong 500/1 500/2 500 gjelder bare egne hjul). Foreslått split `transportToBorder`/`transportAfterBorder` + `loadingHandling` | § 6-10, § 6-10-4, fil 15 |
| 5 | Elbilfritak: egen kvalifiseringsinput (batterielektrisk, ladbar, personkjøretøy) i stedet for å bruke avgiftsmotorens `bev`; måleobjektet ved innførsel forblir en åpen beslutning | pkt. 4.5 |
| 6 | `otherKnown` påvirker ikke mva.-grunnlaget. Kostnader som er tollverdielementer (lasting/håndtering, provisjoner) må kunne merkes `customsValueComponent` | § 6-10 |
| 7 | Betalingsmåte (pkt. 5) | fil 06 |
| 8 | Alle økonomiflagg forblir `false`. Disse funnene gir ikke grunnlag for å sette dem | |
Ingen av disse endringene bør gjøres før du har avgjort punktene under; flere (1–3) er rene kontraktsutvidelser, 4–5 og 7 krever produktbeslutning.

## 7. Beslutninger du må ta (jeg har ikke tatt noen)
1. Skal kjernen regne `import cash` som *brutto* (nåværende) eller innføre betalingsmåte-aksen (pkt. 5)? Anbefaling: innføre aksen; beholde brutto-feltet umerket endret.
2. Hvilken dato styrer tollkursen i produktet (forventet akseptdato oppgitt av forhandler, ankomstdato, eller scenario)?
3. Skal 300 000-grensen ved innførsel måles mot tollverdi (mest sannsynlig ut fra mva.-grunnlaget) eller annet — og kan en rettskilde (Tolletaten/Skattedirektoratet) bestilles?
4. Standard transport: beholde 8 000 som ukildebelagt produktantakelse (merket), eller kreve oppgitt beløp?
5. Skal pakken (20 filer + manifest) arkiveres i `docs/tax/primarkilder/` med SHA-256 og nye T-ID-er (forslag i pkt. 2)?
6. Avrunding (U-013): beslutning om metode kan først tas når kilde er funnet eller du uttrykkelig velger en produktkonvensjon.

## 8. Ikke gjort
Ingen kode, ingen testendring, ingen registeroppdatering (`sources.json`, `rules.json`), ingen godkjenninger, ingen økonomiflagg, ingen endring i ECON-002/ECON-003. Dokumentene er lest fra pakken; det er ikke gjort ny nettinnhenting.
