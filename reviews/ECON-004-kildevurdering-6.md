# ECON-004 — målrettet nettkontroll, korrigering av avlesningsfeil og registeroppdatering (runde 32, 19.10.2026)

**Status: kildevurdering og registerkorrigering. Ingen kodeendring, fixture-endring, parametergodkjenning, produktgrense eller økonomiflagg (alle `false`).** ECON-004 forblir REVIEW; ECON-002 og ECON-003 er uendret; ECON-005 er ikke startet. De brede henvendelsene skal **ikke sendes** (se § 8). Kildebelegg og evidensnivå er holdt atskilt fra parametergodkjenning: ingen regel har fått `parameterApproval`.

## 1. Pakke og kontroll
- `MANIFEST.json`: **23 av 23** filer stemmer på byte og SHA-256 (kontrollert i repoet etter arkivering i `docs/tax/primarkilder/econ004e/`); `acquisition.json` har URL = endelig URL for alle oppføringer.
- Fil 08 er **byte-identisk** med T81-filen jeg arkiverte forrige runde (SHA-256 `a75ee10d…0d4e`).
- **Egen kontroll av sidedataene (uten JavaScript):** HTML-en inneholder en `enqueue("…")`-streng som er en JSON-streng med en JSON-liste (17 289 elementer). Jeg parset den med en JSON-parser og leste indeks 11047, 11054 og 11068; de stemmer ordrett med `BILIMPORT_INNHOLD_FRA_SIDEDATA.txt`. En fersk henting (fil 03, nå T85) har samme tekst.
- Tolltariffen: PDF-sidene 501–502 er kontrollert både i PDF-ens tekstlag (`pdftotext`, side 501) og visuelt (PNG av begge sider).

## 2. Korrigering av tidligere feil
| Tidligere påstand | Korrigert | Rettet i |
|---|---|---|
| T81/T82 og kildevurdering 5 § 3: siden «nevner ingen 300 000-grense, elbil eller fritak» | **Feil.** Elbilregelen, tollverdiformelen og 25 % på tollverdi ligger i utvidbart innhold (serialiserte sidedata). TXT-lesekopien utelot script-innhold, og jeg bygde konklusjonen på den i stedet for å søke i HTML-originalen. | sources.json T81 (`supportedClaims`, `limitations`, `correction`), T21/T33-notater, kildevurdering 5 og 4 (banner), rules.json |
| R-IMP-VAT-004 står E0: «ingen lest kilde avgjør målegrunnlaget» | **Feil for ordinær import.** Nå E1P med delpåstander; ikke godkjent. | rules.json, TAX-001A-rules.md, U-007 |
| R-IMP-VAT-001/-002: «tollsats for personbil er ikke dokumentert» | Besvart: ordinær sats 0 (Tolltariffen 2026, side 501–502). | rules.json |
| R-IMP-VAT-001/-002: engangsavgift i innførselsgrunnlaget «uavklart: mval. § 4-2 (1) a gjelder bare omsetning» | Avgjort ved sammenstilling (§ 4); håndbok kap. 4 (T60) lå allerede i repoet og forklarte omleggingen, men jeg trakk ikke konklusjonen. | rules.json |
| Henvendelsesutkastene (Skatteetaten/Tolletaten) | Tre av de fire Tolletaten-spørsmålene og to av tre Skatteetaten-spørsmålene er helt eller delvis besvart av kildene. **Trukket tilbake** (banner). | reviews/ECON-004-henvendelse-*.md |
| Tolkning «fri rådighet» (T72) som uavklart spenning | Avgrenset: veiledningsord; loven gjelder (aksept). | R-IMP-FX-001 |

**Metode fra nå:** for hver HTML-kilde fra toll.no sjekkes serialiserte sidedata (JSON-parsing av `enqueue`-strengen) og ikke bare synlig tekst. Jeg kjørte denne sjekken over alle arkiverte HTML-filer med serialiserte data (søkeord: 300 000, suspensjon, fri rådighet/disponering, aksept, tollkurs, avrunding, sjablong, tollsats, opprinnelsesbevis, elbil). Eneste nye relevante funn utenom T81: T57 («Elektriske kjøretøy») har i sidedataene en **gammel metadatabeskrivelse med «500 000 kroner»**, mens brødteksten sier 300 000; loven (T71/T63 § 6-8) gjelder, og 500 000 er utdatert metadata (notert i T57). Ingen annen kilde endret konklusjon. Skatteetatens sider har annen oppbygning og er sjekket på synlig tekst.

## 3. Elbilgrensen ved innførsel (R-IMP-VAT-004: E0 → E1P, delvis)
**Tolletaten, T81 (indeks 11047):** «For elbiler: Du betaler bare merverdiavgift hvis bilens pris, frakt- og forsikringskostnadene overstiger 300 000 kroner, og da kun på beløpet som overstiger 300 000 kroner.» Formelen under (indeks 11054): tollverdi = innkjøpspris + frakt + forsikring fram til norsk grense; 25 % på tollverdi (indeks 11068).
| Delpåstand | Dekning |
|---|---|
| Grensen sammenlignes med bilpris + frakt + forsikring, ikke bilpris alene | **Dekket** (veiledning, privatperson) |
| Avgift bare av beløpet over 300 000; samme beløp brukes for grensen og fradraget | **Dekket** (veiledning + mval. §§ 6-8, 7-1) |
| Tollverdi = innkjøpspris + frakt + forsikring til norsk grense | **Dekket** (veiledning + vareførselsloven § 6-10, T67/T87) |
| Samme for mva.-registrert importør | **Sammenstilling** av T56 og § 4-11 (ikke et eget sitat); ingen kilde peker mot et annet verdigrunnlag |
| Lasting/håndtering og salgsprovisjon (er tollverdi, men står ikke i elbilsetningen) i målt beløp | **Ikke avgjort ordrett** |
| Uvanlige kjøretøy/prosedyrer | **Ikke vurdert** |
Konsekvens: `vehicle_price_only` kan ikke lenger begrunnes som et like godt kildebelagt alternativ i det ordinære eksemplet (295 000 + 10 000 = 305 000 → 25 % av 5 000 = 1 250; dette er et regneeksempel på veiledningsregelen, ikke en offisiell kalkulatorreferanse). Kode og godkjenning behandles separat (§ 10).

## 4. Tollsats (Tolltariffen 2026, T83)
PDF-side 501–502 (trykt 87-2/87-3), posisjon 87.03: kolonnen «Ordinær» er **0** for alle personbil-underposisjoner, nye og brukte: stempeldrevet bensin (.2102/.2109 … .2402/.2409), diesel (.3102/.3109 … .3302/.3309), hybrid bensin (.4001/.4009), hybrid diesel (.5001/.5009), ladbar hybrid bensin (.6001/.6009), ladbar hybrid diesel (.7001/.7009), elektrisk (.8001/.8009), ellers (.9000). Kolonnen «Frihandelsavtaler» er **tom**: nullsatsen er den ordinære satsen, ikke en preferanse som krever opprinnelsesbevis; det ubestemte kravet om preferanseopprinnelsesbevis er ikke videreført. Dekker motorens støttede biler (BEN/DIE/HEV/PHEV/BEV). Avgrensninger: utgaven er «gjeldende fra 1. januar 2026»; «Endringer i tolltariffen 2026» (lenke på T86, oppdatert 26.6.2026) er ikke lest; riktig klassifisering, sanksjoner, særtiltak og uvanlige kjøretøy er ikke vurdert.

## 5. Engangsavgift utenfor innførselsgrunnlaget (rettsanvendelse)
Kjeden er lest samlet, og den avgjør ordinær behandling uten en setning der alle ordene står sammen: (1) mval. § 4-11 tar med «tollavgift og andre avgifter som skal beregnes ved innførsel» (T63); (2) engangsavgiftsvedtakets § 1 pålegger avgift «ved første gangs registrering … i Statens vegvesens Kjøretøyregister» (T47), ikke ved innførsel; (3) håndbok kap. 4 (T60): engangsavgiften ble fra 1.4.2001 lagt om fra innførselsavgift til avgift ved førstegangsregistrering, og engangsavgift skal ikke medtas i grunnlaget; (4) St.prp. nr. 1 (2003–2004) (T89) sier det samme historisk («ikke lenger en del av beregningsgrunnlaget for merverdiavgiften»); (5) Tolletaten: engangsavgift betales senere til Skatteetaten (T81). **Dette er en begrunnet rettsanvendelse (sammenstilling), ikke et sitat; T89 er historisk forklaringsbelegg og ikke dagens satsregel.** Ingen kilde peker motsatt. Ikke noe nytt produktvalg om å inkludere den.

## 6. Tollverdikomponenter og kostnadstyper (T87, T88, T84)
| Post | Behandling (kilde) |
|---|---|
| Transport og forsikring til innførselsstedet | Inngår (§ 6-10 (1) e); faktiske kostnader; for bil/egen transport kan alminnelig fraktrate/sjablong brukes |
| Felles fakturert transport | Fordeles etter avstand før/etter innførselsstedet; annen fordeling kan sannsynliggjøres (forskrift § 6-10-4, T87) |
| Lasting/håndtering forbundet med transporten (inkl. demurrage) | Inngår (§ 6-10 (1) f); lossing og ventetid på/etter innførselsstedet inngår ikke |
| Transport/forsikring i Norge | Holdes utenfor (§ 6-11 (1) b, T88) |
| Provisjon | **Ikke én kostnadstype:** salgsprovisjon/meglersalær legges til; innkjøpsprovisjon (for kjøperen) holdes utenfor (§ 6-10 (1) a nr. 1/§ 6-11 (1) e); mellommannens rolle avgjør |
| Renter | Holdes utenfor på vilkår (§ 6-11 (1) d) |
| Bank-/valutagebyr | **Ikke et listet tillegg**; tilleggene er uttømmende (§ 6-10 (2)). Om det inngår i «prisen» når det betales selger er ikke besvart ordrett |
| Utenlandsk mva. i prisen | Ikke del av prisen når kjøperen ikke endelig belastes; vilkår ved overgang til fri disponering, kjøperen sannsynliggjør (T88) |
| Statistisk verdi (rubrikk 46) | «Ofte» lik tollverdi; unntak (kunst, tann, gjeninnførsel) gjelder ikke personbil (T84). **2018/2020-uttalelsen bruker gammel tolllov og ukentlig kurs og overstyrer ikke 2026-reglene.** |

## 7. Fradrag, senere bruk, aksept og suspensjon
- **Salgsvare/fradrag:** T56 (tolldeklarasjon med underbilag; grunnlag og avgift per sats per deklarasjon), §§ 8-1/8-4 (1) a (T63). Statusen underbygges av kjøps-/lager-/salgsdokumentasjon. **Ingen påvist hjemmel for et eget «salgsvarebevis»; ikke bestill et.** Håndbok kap. 6 (T35, allerede arkivert): § 3-24 første ledd (uttak) gjelder når forhandleren registrerer bruktimportert bil på eget navn og bruker den som demonstrasjonsbil; ikke sammenblandet med andre omdisponeringer eller § 9-6. Hele livssyklusen ligger utenfor en kjerne for innkjøp til videresalg.
- **Aksept/«fri rådighet»:** kursdatoen følger aksept av deklarasjonen (tollavgiftsloven § 2-2 via forskrift § 6-12-1 (3); vareførselsloven § 3-4). «Fri rådighet/disponering» er prosedyre-/veiledningsspråk (også i skattebetalingshåndboken: tollavgift beregnes når varen går over til fri disponering, tollavgiftsloven § 2-1). Avgjort ved lovkjeden (rettsanvendelse); særlige prosedyrer avgrenses separat.
- **Suspensjon:** hvor en fullstendig historikk publiseres er **ikke verifisert** (datainnhentingsbegrensning). Kjernen har allerede estimatstatus ved ukjent suspensjon og bruker ikke en bekreftet suspendert kurs; dette beskrives, ikke skjules.
- **Prinsipputtalelsen (2018/2020):** støttekilde for grunnlaget; gamle tollovshenvisninger og ukentlig kurs er ikke 2026-regler.

## 8. Avrunding — fortsatt åpen (ingen metode erklært)
Skattebetalingsregelen for krav (§ 10-4-4), XSD-ens desimalformat og FAQ-ens valideringstoleranse er fortsatt tre ulike ting. Prinsipputtalelsen (T84) og de nye kildene har **ingen** omtale av avrunding. Ingen floor per import eller half-up-policy godkjennes; fixture-literaler uendret.

## 9. Leveranse 1 — åpne spørsmål som nå kan lukkes eller avgrenses
| Spørsmål | Før | Nå |
|---|---|---|
| Hva 300 000 måles mot ved innførsel | Åpent (E0) | **Avgrenset/dekket for ordinær import** (bilpris + frakt + forsikring = tollverdi); rest: lasting/håndtering/provisjon i målt beløp; registrert importør = sammenstilling |
| Fritatt del trekkes fra samme beløp | Åpent | **Lukket for ordinær import** («kun på beløpet som overstiger») |
| Tollsats personbil | Åpent | **Lukket for ordinær sats (0)**; rest: endringer etter 1.1.2026 ikke lest |
| Avsenderland mot opprinnelse | Spørsmål i brev | **Faller bort** for ordinær sats (preferanse ikke nødvendig) |
| Engangsavgift i innførselsgrunnlaget | Åpent | **Lukket ved rettsanvendelse** (utenfor grunnlaget) |
| Tollverdikomponenter (transport, lasting/håndtering, forsikring, provisjon) | Åpent | **Lukket i hovedsak**; rest: bank-/valutagebyr i «pris» |
| Dokumentasjon for fradrag/salgsvare | Åpent | **Avgrenset** (T56 + §§ 8-1/8-4; ingen hjemmel for eget bevis; demobil § 3-24 (1)) |
| Aksept mot «fri rådighet» | Spenning | **Lukket ved lovkjeden** |
| Suspensjonspublisering | Åpent | **Uendret** (datainnhenting) |
| Avrunding per importberegning | Åpent | **Uendret åpent** |

## 10. Leveranse 2 — kodeendringer dette tilsier (IKKE gjort; krever din beslutning, og godkjenning gis separat)
1. **`evThresholdBasis`-standard** (`src/domain/economics/types.ts`, `landed-cost.ts` ca. l. 332–380): standard `unresolved` → `customs_value` for ordinær import; scenarioet `vehicle_price_only` fjernes eller beholdes bare som eksplisitt, merket sensitivitetsverdi («ikke kildebelagt for ordinær import»). Resultat: ett mva.-tall i stedet for to scenarier for BEV over 300 000. Estimatårsak bør settes når lasting/håndtering eller salgsprovisjon > 0 (restpunkt). Tester som må følge: `economics-review-regressions.test.ts` (scenariotabellen l. 166), `economics-source-driven.test.ts` (l. 247), `economics-core.test.ts`; docs `landed-cost-core.md`.
2. **Tollavgift** (`landed-cost.ts` l. 288–294): ukjent/manglende `customsDuty` gir i dag `incomplete`; for støttede 87.03-profiler bør ordinær sats 0 (T83) kunne brukes som dokumentert standard med uttrykkelig grunnlag («ordinær sats, tolltariffen 2026») og estimat inntil godkjenning, ikke `incomplete`. Ikke-null toll (brukerinput) skal **legges i mva.-grunnlaget** (§ 4-11) i stedet for `incomplete: customs_duty_vat_base_unresolved` (i dag ignorert i grunnlaget). Test: `economics-core.test.ts` l. 310 må endres.
3. **Engangsavgift:** ingen kodeendring (grunnlaget består i dag bare av tollverdi); legg inn en regresjonstest som låser at engangsavgift, klimagassavgift og registreringsgebyr ikke inngår i innførselsgrunnlaget.
4. **Provisjon som egen type** (ny input, f.eks. `commission: { kind: "purchase" | "sales_or_brokerage" | "unknown", amount }`): salgsprovisjon/meglersalær skal inn i tollverdien; innkjøpsprovisjon utenfor; ukjent rolle ⇒ ukjent. I dag havner slike beløp i `charges.otherKnown` (utenfor tollverdi), som er feil for salgsprovisjon. Bank-/valutagebyr: kostnad utenfor tollverdi inntil kilde sier annet.
5. **Utenlandsk mva. i innkjøpsprisen:** gjennomgå kjøpsgrunnlagslogikken mot § 6-11 (T88): netto pris bare når kjøperen ikke endelig belastes (dokumentert); ellers brutto i tollverdi. Revisjonspunkt, ikke nødvendigvis endring.
6. **Ingen endring:** avrunding (policy, tie-regel, fixtures), aksept-/kurslogikk, suspensjonsstatus, økonomiflagg, `validated`-grenser, produktomfang (3.9.–31.12.2026 forblir forslag).
Ingen av punktene kan gjøre `validated` nåbart i produksjon uten at flaggene settes ved uttrykkelig godkjenning.

## 11. Leveranse 3 — reelle kildeuklarheter som gjenstår
1. **Avrunding:** enhet og metode for hver importberegning hos registrert importør, og avrunding ved rapportering (U-013 A-enhet, B, C-metode).
2. **Tolltariffen etter 1.1.2026:** «Endringer i tolltariffen 2026» er ikke lest; fravær av endring i 87.03 er ikke dokumentert.
3. **Lasting/håndtering og salgsprovisjon i det som sammenlignes med 300 000** (veiledningen forenkler).
4. **Registrert importør:** elbilregelen er hentet fra en privatpersonside; likebehandling er sammenstilling.
5. **Bank-/valutagebyr** i «pris» (§ 6-3) når det betales selger.
6. **Suspensjon av tollkurser:** publiseringssted/maskinlesbar historikk ikke verifisert.
7. **Sats etter 2026** (vedtaket gjelder budsjettåret 2026) og elbilfritaket for 2027 (T75 varsel, ikke vedtatt).
8. (Valgfritt) Nyere XSD-versjon — utsatt på din instruks.
**Hvis noe skal spørres om, begrens det til punkt 1** (og eventuelt 6) som konkrete restspørsmål med henvisning til hva vi har lest; ingen bred henvendelse.

## 12. Kontroller kjørt
`node docs/tax/check-docs.mjs`; fullt vitest-sett, `tsc --noEmit` og `eslint .` (resultater i leveringsmeldingen). Ingen kode/test/fixture er endret.
