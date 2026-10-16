# TAX-001C — status for gjenværende belegg og grunnlagsstatus (16.10.2026)

**Konklusjon: TAX-grunnlaget er IKKE DONE. Status forblir REVIEW.** Ingen nye primærkilder kunne leses og ingen kalkulator kunne kjøres, fordi miljøets nettverkspolicy avviser alle relevante verter. Ingenting er funnet på, utledet eller godkjent.

## Hva som faktisk ble forsøkt (16.10.2026)
- `curl` via agentproxy mot www.skatteetaten.no, lovdata.no, www.toll.no, www.stortinget.no, www.regjeringen.no, www.gesetze-im-internet.de, usth.bundesfinanzministerium.de, www.vegvesen.no, web.archive.org, www.europarl.europa.eu → **CONNECT 403 (policydenial)**. Ikke forsøkt omgått.
- `WebFetch` mot lovdata.no og www.gesetze-im-internet.de → **ENOTFOUND**.
- `WebSearch` (kun sammendrag, USA): ga fragmenterte og delvis motstridende **E2-ledetråder** (lagt inn i `rules.json` som `leads`, merket «ikke lest primærtekst; kan ikke brukes som parameter»).
- Skatteetatens kalkulator: **ikke kjørt** (host blokkert; også et interaktivt verktøy). Ingen kalkulatorresultat finnes eller er utledet.

## Status per punkt i TAX-001B §10 / oppdraget
| # | Punkt | Status | Det som gjenstår |
|---|---|---|---|
| 1 | Stortingsvedtak 2026 (§§ 2–3, gruppe a/b, vekt/CO2, overgang, U-001) | **IKKE LEST.** Kun E2: motstridende CO2-tabeller (450/600/1 200 mot 800/1 600/3 200/5 000; U-004). U-001 uløst | Lese Lovdata STV 2025-12-18-2755 direkte |
| 2 | Forskrift § 2-3, § 3-1, § 3-3; T07-avstemming; U-002; vrakpant og bruksfradrag | **IKKE LEST.** E2: trappen i § 3-3 samsvarer for viste trinn med T07 (16/17/18 % … 100 %), men forskriften er ifølge Lovdata endret 2026 og utdraget kan være eldre. U-005: ladbar hybrid 10 % fradrag mot rundskriv 3.3.11 (opphevet 2024) | Lese forskriften (T05, gjeldende versjon) |
| 3 | Kalkulatorreferanser | **IKKE KJØRT.** Klasse 1 = **0** | Kjøre S07 for `C4-BASE-*`, `C4-AGE-*`, `C2-*`; lagre input, dato, output |
| 4 | Import-mva. (sats, grunnlag, rekkefølge, tollkursdato, frakt, gebyr, EV, forhandler) | **IKKE LEST.** E2: grunnlag = tollverdi + toll og andre avgifter (tyder på at engangsavgift inngår); tollkurs på akseptert deklarasjon; kurssyklus motstridende (U-008); aug 2026-endring av § 6-12-1; elbil-fritak 300 000/500 000 (U-007). 25 %-sats og forhandlerbehandling ikke funnet | Lese T10/T11/T14/T23/T24 |
| 5 | Fradragsrett | E1P (håndbok 2025, T22) uendret. E2: § 9-6 gjelder utleie/persontransport, ikke videresalg; varebil ikke dekket | Lese lov/håndbok 2026, T11, T12, T13, T28 |
| 6 | Klimagass, gebyrer, SVV-kodeverk | **IKKE LEST.** E2: 1,639 mot 2 130,70 kr/kg (U-006). Registrerings-/merkegebyr og SVV-kodeverk (T15) ikke funnet | Lese T25, T15, gebyrkilde |
| 7 | Tyskland (§ 25a, § 6, ordinær mva.) | **IKKE LEST.** E2: § 25a-vilkår og fakturakrav; samspill med § 6 uavklart | Lese gesetze-im-internet.de og UStH |

## Evidensnivå per regel (30 regler)
- **E1** (4): R-OTA-003, R-OTA-004, R-IMP-OTH-001, R-SCR-PAY-001
- **E1P** (13): R-IMP-VAT-001, R-IMP-VAT-002, R-OTA-001, R-OTA-002, R-OTA-005, R-OTA-006, R-OTA-007, R-OTA-008, R-OTA-009, R-OTA-010, R-OTA-011, R-DED-001, R-IMP-REF-001
- **E2** (13): R-OTA-000, R-IMP-FX-001, R-IMP-VAT-003, R-OTA-012, R-OTA-013, R-IMP-OTH-002, R-IMP-OTH-003, R-DED-002, R-DED-003, R-FOR-001, R-FOR-002, R-FOR-003, R-FOR-004

## Godkjente parametere for implementasjon: **0**
Ingen regel har `usableAsRuleParameter=true`. Kravene (E1 + dato + kilde-hash + klasse 1-referanse + uttrykkelig godkjenning) er ikke oppfylt for noen. E1-reglene (vrakpantavgift 2 400 kr, NOx fjernet, slagvolum erstattet av egenvekt/10, vrakpantutbetaling utenfor) er dokumentert, men ikke godkjent: mangler uavhengig referanse og eksplisitt godkjenning.

## Klasse 1 (uavhengig offisiell referanse): **0**. Klasse 2: 10. Klasse 3: 38. Klasse 4: 54.

## Uløst (samlet)
U-001 (påstått endring 1.9.2026), U-002 (production vs første registrering), U-003 (håndbok 2025), U-004 (CO2-tabeller), U-005 (PHEV-fradrag), U-006 (klimagass-sats), U-007 (elbil-mva.), U-008 (tollkurs-syklus), samt alle satser i stortingsvedtaket, forskriftsdetaljer, mva.-sats/grunnlag/forhandlerbehandling, SVV-kodeverk, tyske kilder, og kalkulatorreferanser.

## Slik kan det låses opp
1. **Nettverk:** miljøeier åpner verter under Allowed domains (Edit environment → Network access, https://code.claude.com/docs/en/cloud-environments#network-access): `www.skatteetaten.no`, `lovdata.no`, `www.toll.no`, `www.stortinget.no`, `www.regjeringen.no`, `www.vegvesen.no`, `autosys-kjoretoy-api.atlas.vegvesen.no`, `www.gesetze-im-internet.de`, `usth.bundesfinanzministerium.de` — og Skatteetatens kalkulator må kunne brukes interaktivt (ellers kan ikke klasse 1 skapes herfra).
2. **Kildepakke (som i TAX-001B):** Codex/Christian henter filene (lovtekst som PDF/HTML) og kjører kalkulatoren selv; Claude leser lokalt. Ønskeliste: Lovdata STV 2025-12-18-2755; SF 2001-03-19-268 (gjeldende); Tolletatens vareførselsforskrift § 6-12-1/handbok 6-12 og valutakurser; Skatteetaten innførselsmva. (T11) og mva.-håndbok 8-4/9-6 for 2026; HFK-/PFK-avgift; SVV-kodeverk AVGIFT; § 25a og § 6 UStG + UStAE. Kalkulatorkjøringer: tilfellene `C4-BASE-*` (10), `C4-AGE-*` (8), `C2-AGE-01…07`, `C2-SCRAP-A/B` med lagret input/dato/output.
