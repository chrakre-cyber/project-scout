# Testplan og pilotport

03.10.2026. Ingen tester er utført ved levering av denne dokumentpakken. Testbevis legges til når kode og referansecaser finnes. Kontrollør kjører samme relevante kontroller på den faktiske leveransen, ikke bare leser utviklerens rapport.

## Testmatrise

| Område | Minstekontroll | Aksept / belegg |
|---|---|---|
| Agentflyt | Opprett, hent, rediger, pause, ugyldig input, maks 10 og samtidige aktiveringer | Tilstand og serverkontroll korrekte; G1 |
| Firmatilgang | Firma A/B med vanlige sesjoner; les/skriv, ID-manipulasjon, membership og serverjobb | Ingen cross-tenant tilgang; direkte DB/RLS og serverruter kontrollert |
| Marketplace | Gjentatt/samme annonse, endret pris/tekst, sider, >2 000 treff, 404, auth, kvote, timeout | Ingen stille truncation, duplikat eller checkpoint-tap |
| Kritiske felt | Ukjent prisgrunnlag, dato med bare år/måned, CO2-metode, miles/km, valuta, manglende vekt | Ukjent forblir ukjent; feil profile/felt kan ikke gi marginvarsel |
| Kost/avgifter | Minst 50 beregningstilfeller inkl. relevante alders-/satsgrenser og drivlinjer | Uavhengig fasit for alle pilotprofiler; ingen uforklarte avvik |
| Mva./bidrag | Retail inkl./eks. mva., importfradrag, salgsgrunnlag, utenlandsk netto/brutto, utlegg og reserve | Ingen dobbeltelling; ukjent fradrag/salgsprofil blokkerer bidrag |
| Regler og kurs | Versjoner, virkningsdato, foreldet kurs/regelsett, tollkurs vs handel | Resultat kan reproduseres fra snapshot; utløpt regelsett blokkerer |
| Score | Grenser, hardfilter, T=0, negativ/ukjent margin, manglende km | 0–100, forklarbare delpoeng, varselport uavhengig av score |
| LLM | Minst 30 fasittekster, negasjon, motstrid, injection, ugyldig JSON og belegg | Ingen oppdiktede kritiske claims; alle kritiske innlagte claims flagget |
| Varsler | Retry, dobbeltjobber, crash før/etter ekstern send, pause og feil mottaker | Unik outbox; ingen kjente duplikater; ukjent levering avstemmes |
| Drift | Jobblås, retry-budsjett, kvoter, failed run og én ødelagt annonse | Synlige feil, normal data bevart, gjenstart gir ingen tap |
| Gjenoppretting | Backup/restore eller dokumentert leverandørmekanisme; replay i testmiljø | Faktisk prøvd gjenoppretting for konfigurasjonen som skal brukes |
| UI | Tre skjermer, demo-banner, estimat/unknown, dato/kilde, mobil/desktop | Forhandler kan forstå prisgrunnlag og åpne originalannonse |

## Tre datasett med forskjellig bevisverdi

1. Syntetisk mock: minst 100 interne annonser og 10 ulike agentoppsett. Tester flyt, dedup, rangering og grenser. Beviser ikke mobile.de-format eller avgiftsfasit.
2. Adapter-fixturer/testkonto: representative dokumenterte responser, deretter godkjente live-annonser. Tester mapping, dekning og feilbilder.
3. Avgifts-/mva.-referanser: input, dato, kilder og uavhengig forventet output. Skatteetatens kalkulator er referanse for avgiftsdelen; salgsmva., fradrag og bidrag krever egne dokumenterte referanser.

## Feilnivåer

- P0 kritisk: firmalekkasje, secrets-eksponering, vesentlig feil mva./margin, uautoriserte data eller systematisk feil varsling. Stopper reell pilot/berørt funksjon.
- P1 alvorlig: manglende annonser, uklare kalkyleforutsetninger, checkpoint-feil eller ikke håndtert truncation. Må rettes før relevant pilotflyt.
- P2 mindre: kosmetikk som ikke endrer forståelsen. Kan stå med eier/dato etter pilotport.

## Gate B — må dokumenteres

QA-001–QA-003 består. QA-004 kontrollerer full flyt mot godkjent live-kilde, støttede profiler, bekreftede pilotmottakere og faktisk deploy. Ingen åpne P0/P1 for pilotens flyt. Retensjon/datarettigheter er avklart, driftsstatus er synlig, og pause/gjenoppretting er kontrollert. Christians sign-off gjelder pilotomfang, ikke en påstand om juridisk sertifisert avgiftsmotor.

## Rapportmal

Commit / miljø / dato / utfører / dataset / kommando eller kontrollmetode / forventet / faktisk / avvik / severity / retting / retest / gatebeslutning.

Test uavhengige invariants og offisielle grenser; ikke bare kopier samme formel i både implementering og test. Featurearbeid stopper i siste QA-sprint til kritiske feil er lukket.
