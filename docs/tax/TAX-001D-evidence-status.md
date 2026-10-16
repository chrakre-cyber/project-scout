# TAX-001D — status etter eksternt verifiserte kilder (16.10.2026)

**TAX-grunnlaget er fortsatt REVIEW, ikke DONE.** Ingen ny websøking er gjort. Kalkulatoren er ikke kjørt (klasse 1 = 0). Ingen implementasjonsparameter er godkjent (0).

## Nytt evidensnivå: E1X
Kildene i TAX-001D er verifisert eksternt av Christian/Codex og levert som sammendrag. Claude har ikke lest dem, og kildefil/hash finnes ikke. De er derfor **E1X**: sterkere enn E2, men **svakere enn E1** (lest primærkilde med hash). Sperren for godkjent parameter krever fortsatt E1 + klasse 1 + uttrykkelig godkjenning og er uendret; E1X kan ikke godkjenne noe alene. `check-docs.mjs` håndhever dette (E1X-kilder kan ikke ha lesedato/hash; E1X-funn må peke på E1X-kilde).

## Evidensnivå per regel (31 regler)
- **E1** (4): R-OTA-003, R-OTA-004, R-IMP-OTH-001, R-SCR-PAY-001
- **E1P** (13): R-IMP-VAT-001, R-IMP-VAT-002, R-OTA-001, R-OTA-002, R-OTA-005, R-OTA-006, R-OTA-007, R-OTA-008, R-OTA-009, R-OTA-010, R-OTA-011, R-DED-001, R-IMP-REF-001
- **E1X** (5): R-IMP-VAT-003, R-OTA-012, R-FOR-001, R-FOR-002, R-FOR-005
- **E2** (9): R-OTA-000, R-IMP-FX-001, R-OTA-013, R-IMP-OTH-002, R-IMP-OTH-003, R-DED-002, R-DED-003, R-FOR-003, R-FOR-004

## Det som er lagt inn (juridisk regel, adskilt fra implementasjonsforutsetning)
| Regel | Juridisk regel (E1X) | Ikke avgjort / ikke godkjent |
|---|---|---|
| R-OTA-008 gruppe b CO2 | **Fra 2026-09-01:** 450 / 600 / 1 200 kr per g/km for 0–100 / 101–150 / >150 g/km (datert parameter `DP-CO2-B-2026-09-01`, vedtak 1131/1132) | Satser før 1.9 (UKJENT → `not_calculated`), vektkomponent, gruppe a, trinnvis/marginal beregning, styrende hendelsesdato |
| R-OTA-010/012 bruksfradrag | Aldersbasert; periode utenlandsk → norsk første registrering; tabell til 100 % ved 20 år; alternativ beregning finnes og er **bindende når valgt** | U-002 (production-ordlyd), forskrift § 3-3, vrakpant × bruksfradrag |
| R-IMP-VAT-001/002 | Import-mva. **25 %**, grunnlag **tollverdi**; transport og forsikring til norsk innførselssted inngår; senere norske avgifter inngår ikke bare fordi de oppstår senere | Toll (finnes tollsats for bil?), tollkurs/U-008, sjablongfrakt, transaksjonsgebyr, forhandlerdeklarasjon, avrunding, ikrafttredelse |
| R-IMP-VAT-003 elbil | **300 000 kr** mva.-fritt fra 2026-01-01; 25 % over; vektkomponenten ikke i grunnlaget | Eksplisitt anvendelse ved innførsel, «kvalifiserende», lov 19.6.2026/nedtrapping |
| R-DED-001 | Inngående mva. på personkjøretøy kan fradragsføres ved anskaffelse **for videresalg** (uttrykkelig unntak). Ikke generalisert | Innførselsmva., varebil, bindingstid, importørprofil, andre profiler |
| R-OTA-009 | SVV-kodeverk AVGIFT finnes; kode 315 = Varebil klasse 2, fortollet etter 31.3.2001. Teknisk klassifisering ≠ avgiftsbehandling | Hele kodelisten, forskrift § 2-3 |
| R-FOR-005 (ny) | Tyskland regelsats 19 % (§ 12 UStG) | Redusert sats; om en annonse er ordinær/eksport/margin |
| R-FOR-001 | Kvalifiserende utførsel kan være mva.-fritatt etter lovens vilkår (§ 4, § 6 UStG) | Vilkår/bevis; ingen annonse antas å kvalifisere |
| R-FOR-002 | Differansebeskatning (§ 25a) finnes for kvalifiserende gjenselgere | Vilkår; ingen annonse antas å kvalifisere |

## Konflikter
- **U-004 løst for gruppe b** (450/600/1 200 fra 2026-09-01). Tallene 800/1 600/3 200/5 000 er ikke verifisert og tilhører ikke denne regelen; **gruppe a forblir ukjent**.
- **U-007 løst** (300 000 kr; 500 000-tallet hører ikke til denne regelen). Innførselsanvendelse og 19.6.2026-loven uavklart.
- **U-001 delvis løst:** endringen med virkning 1.9.2026 finnes (gruppe b CO2). Øvrig innhold ukjent.
- **Fortsatt uløst:** U-002, U-003, U-005 (ladbar hybrid-fradrag mot rundskriv), U-006 (klimagass 1,639 mot 2 130,70), U-008 (tollkurs-syklus).

## Referanser
Klasse 1 = **0**, klasse 2 = 10, klasse 3 = 42 (nye C3-040…043: import-mva. 25 % av tollverdi uten senere avgifter; elbil-mva. over 300 000, ved og under grensen — rene aritmetiske illustrasjoner, regnet på nytt av `check-docs.mjs`), klasse 4 = 56 (nye C4-VER-B-0831/0901 datovakt: ingen sats før 2026-09-01).

## Gjenstår før DONE
1. Kildefiler (E1) for T30–T39 med hash, så E1X kan bli E1 (eller Christian godkjenner E1X som grunnlag eksplisitt).
2. Stortingsvedtakets satser for gruppe a og vektkomponenter, og satser før 1.9.2026 for gruppe b.
3. Forskrift §§ 2-3, 3-1, 3-3 (U-002, U-005, vrakpant × bruksfradrag).
4. Skatteetatens kalkulator kjørt av Christian/Codex på de navngitte tilfellene (klasse 1).
5. Tollkurs/frakt/gebyr/forhandlerdeklarasjon, klimagass, registreringsgebyr, tyske vilkår, listing-spesifikke fakta.
6. Uttrykkelig godkjenning av parametere (`parameterApproval`) etter 1–4.
