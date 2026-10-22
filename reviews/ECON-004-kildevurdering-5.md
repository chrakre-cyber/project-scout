# ECON-004 — ajourført satsvedtak og bilimportsider (19.10.2026)

> **KORRIGERT 19.10.2026 (runde 32, se `reviews/ECON-004-kildevurdering-6.md`):** § 3 og § 4 sier at bilimportsiden ikke omtaler elbilgrensen/300 000 — **feil**: innholdet lå i serialiserte sidedata og ble utelatt av TXT-lesekopien. Se kildevurdering 6. Alt om privatpersonflyt, T80 (ajourført vedtak) og betalingssiden står.

**Status: kildevurdering. Ingen kodeendring, fixture-endring, parametergodkjenning eller økonomiflagg (alle `false`).** ECON-004 forblir REVIEW; ECON-002/ECON-003 er uendret; ECON-005 er ikke startet. Henvendelsesutkastet er **ikke sendt**: `reviews/ECON-004-henvendelse-utkast.md`.

## 1. Pakke
`MANIFEST.json`: 9 av 9 filer stemmer på byte og SHA-256 (kontrollert på nytt i repoet etter arkivering). Arkivert i `docs/tax/primarkilder/econ004d/`. Registrert som **T80** (ajourført Lovdata-visning), **T81** (Tolletaten bilimport) og **T82** (betalingssiden). Alle er nye hentede versjoner av eksisterende dokumentidentiteter (T76/T77, T21/T33, T10); eldre oppføringer er beholdt som proveniens. HTML er lest som original; TXT er brukt som lesekopi.

## 2. Ajourført vedtak mot T76/T77
- **§§ 1–5 har identisk ordlyd** som originalversjonen (T77) etter blanktegn-normalisering av HTML-teksten; § 1–2 er også identisk med Stortingets vedtak 217 (T76).
- Siden viser § 2: «25 pst. av avgiftspliktig omsetning, uttak og innførsel». Metadata: ikrafttredelse «Budsjettåret 2026». Ingen «Endret ved»-/«Sist endret»-rad og ingen endringsnotis i den hentede HTML-en; siden lenker til «opprinnelig kunngjort versjon».
- **Hva dette dokumenterer:** at Lovdatas ajourførte visning per **2026-10-19 14:22 UTC** viser uendret 25 %. **Hva det ikke dokumenterer:** fremtidig gyldighet, eller sats for 2027 (vedtaket gjelder budsjettåret 2026). Siden må hentes på nytt ved senere dato. Dette lukker blokkeringspunkt 4 fra kildevurdering 4 *som datert status*, ikke som garanti.
- R-IMP-VAT-001: validity-notat og åpent spørsmål omskrevet («per hentedato»); to nye E1-funn (T80, T81). Evidensnivå E1P uendret; ingen parametergodkjenning.

## 3. Bilimportsidene — innenfor faktisk omfang
| Støttet | Ikke støttet |
|---|---|
| For **privatpersoner**: deklarere først og betale mva. til Tolletaten, deretter engangsavgift til Skatteetaten (T81). | Registrerte importører: oppgjør, kanal og beregning. Betalingsflyten (kort, remisse, grenser) er ikke generalisert og brukes ikke i kjernen (kortgebyret 0,70 % er betalingskost, ikke avgiftsregel). |
| «Avgiften beregnes ut fra kjøpesummen, frakt og forsikring» for nylig kjøpt bil (T81); mva. også av fraktkostnaden, og sjablong for egne hjul fra SE/DK/DE (henvisning uten beløp; beløp i T64) (T82). | **Tollsats:** sidene nevner ikke toll i det hele tatt. Taushet er ikke tollsats 0. |
| Refusjon av utenlandsk mva. er en sak mellom kjøper og selger (T81, samme ordlyd som T21). | **Elbilgrensens målegrunnlag:** ingen omtale av 300 000, elbil eller fritak. «Kjøpesum, frakt, forsikring» er veiledningsspråk for privatpersoner, ikke et kriterium. |
| | **Avrunding:** ingen omtale. **Engangsavgift i innførselsgrunnlaget:** bare betalingsrekkefølge («deretter»), ikke grunnlag. |

Oppdateringer: R-IMP-VAT-002 (+T81/T82) og R-IMP-REF-001 (+T81) fikk funn med begrensninger; R-IMP-VAT-003/-004 og U-013 er **ikke endret**. T21-originalen er ikke arkivert i repoet, så T81 er sammenlignet med T21 bare på URL og «Oppdatert: 5.2.2026», ikke tekstlikt.

## 4. Evidens, godkjenning og åpne delpåstander (holdt atskilt)
| Delpåstand | Kildestatus | Godkjent parameter |
|---|---|---|
| 25 % ved innførsel, gjelder fra 1.1.2026 | E1 (T76/T77/T80), datert 2026-10-19 | nei |
| Sats etter 2026 | ikke dokumentert | nei |
| Tollsats personbil | **åpen** | nei |
| Engangsavgift i innførselsgrunnlag | **åpen** (mval. § 4-2 (1) a gjelder omsetning) | nei |
| 300 000-grensens målegrunnlag ved innførsel (R-IMP-VAT-004) | **åpen** (E0) | nei |
| Avrunding: A samlet krav / B hver importberegning / C rapportering | A tekstlig støtte, enhet åpen; B ingen regel; C format dokumentert, metode ikke | nei |
| Dokumentasjon salgsvare/uttak (fradrag) | **åpen** | nei |
| Privatpersonflyt (mva ved grensen, engangsavgift senere) | støttet (T81/T82), kun privatperson | – |

Alle fire flagg er `false`; `validated` er fortsatt bare nåbart i syntetiske tester.

## 5. Omfang
Datoavgrensningen **3.9.–31.12.2026 er et forslag, ikke en godkjent produktgrense**. Runtime håndhever den ikke (akseptdato i 2027 eller før 2026-09-03 blokkeres ikke av kjernen; registreringsår utenfor 2026 blokkeres av avgiftsmotoren). Ajourført vedtak dekker bare budsjettåret 2026. Ingen beslutning er tatt; ECON-002-omfanget står.

## 6. Gjenstående punkter og henvendelsen
Punktene som fortsatt blokkerer, og som utkastet samler i én tekst: (1) målegrunnlag for 300 000; (2) avrundingsnivå for registrert importør (U-013 A-enhet og B, og C-metode); (3) tollsats og engangsavgift i grunnlaget; (4) minimumsdokumentasjon for fradrag (salgsvare/uttak). Utenfor henvendelsen (ikke utvidet): akseptøyeblikk i praksis/suspensjonspublisering og nyere XSD-versjon; disse kan legges til hvis Christian ønsker det. Ingen av punktene er erklært avklart.

## 7. Kontroller kjørt
`node docs/tax/check-docs.mjs`: OK (35 regler, 84 kilder). Ingen kode, tester eller fixturer er endret. Neste oppgave: Christians beslutning om henvendelsen sendes; ECON-005 startes ikke.
