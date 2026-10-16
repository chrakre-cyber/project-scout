# TAX-001C — gjenværende belegg og avslutning av TAX-grunnlaget · rapport (16.10.2026)

**Status: REVIEW. TAX-grunnlaget kan IKKE merkes DONE.** Ingen kode, app, UI, DB, auth eller deploy er endret. Detaljer per punkt: `docs/tax/TAX-001C-evidence-status.md`.

## Utgangspunkt bekreftet mot `reviews/TAX-001B.md` §10
HEAD `2dd61fd`, rent tre. De sju gjenværende punktene i TAX-001B §10 (stortingsvedtak, forskrift, kalkulator, import-mva., fradragsrett, klimagass/gebyr/SVV, Tyskland) var åpne ved start og er fortsatt åpne.

## Hva som ble forsøkt, og hva som blokkerer
- `curl` mot skatteetaten.no, lovdata.no, toll.no, stortinget.no, regjeringen.no, vegvesen.no, gesetze-im-internet.de, usth.bundesfinanzministerium.de (+ to kontrollverter): **403 CONNECT, policydenial** (agentproxyens status viser avvisningene). `WebFetch`: **ENOTFOUND** for lovdata.no og gesetze-im-internet.de. Policyen er ikke forsøkt omgått.
- `WebSearch` ga bare sammendrag. De er lagt inn som **E2-ledetråder** (7 nye kilder T23–T29, nye `leads` på 14 regler) og er eksplisitt merket «ikke lest, ikke parameter». Flere er innbyrdes motstridende og er ført som uløste kildekonflikter U-004…U-008 (CO2-/vekttabeller 450/600/1 200 mot 800/1 600/3 200/5 000; ladbar hybrid 10 % fradrag mot rundskrivets «opphevet 2024»; klimagass 1,639 mot 2 130,70 kr/kg; elbil-mva. 300 000/500 000; tollkursens syklus).
- **Skatteetatens kalkulator er ikke kjørt.** Ingen kalkulatorresultat finnes, er utledet eller er funnet på.

## Svar på sluttkravene
| Spørsmål | Svar |
|---|---|
| Regler E1 / E1P / E2 | **4 / 13 / 13** av 30 (uendret fra TAX-001B; ingen kunne oppgraderes uten primærlesing) |
| Parametere godkjent for implementasjon | **0** |
| Klasse 1 uavhengige referanser | **0** (klasse 2: 10, klasse 3: 38, klasse 4: 54) |
| Uløst | Alle satser i stortingsvedtaket (U-001, U-004), forskrift §§ 2-3/3-1/3-3 og U-002/U-005, vrakpant × bruksfradrag, kalkulatorreferanser, import-mva. (sats, grunnlag, rekkefølge, tollkurs-syklus U-008, frakt, gebyr, forhandlerbehandling, EV U-007), fradragsrett 2026 for import/varebil, klimagass U-006 og andre gebyrer, SVV-kodeverk, tyske primærkilder (ordinær, eksport, margin) |
| TAX-grunnlaget | **REVIEW — ikke DONE** |

## Endringer
`docs/tax/{sources,rules,references}.json` (tilgangsforsøk, E2-ledetråder, U-004…U-008, `foundationStatus`), nytt `docs/tax/TAX-001C-evidence-status.md`, regenerert `TAX-001A-rules.md`, `check-docs.mjs` (ny sperre: `foundationStatus` må stemme med faktisk antall godkjente parametere/klasse 1, og DONE krever godkjente parametere og klasse 1 per profil — negativt bevist), `MVP_BACKLOG.md`. `profiles.json` er uendret (ingen nye profildata uten primærkilder).

## Kontroller faktisk kjørt
`node docs/tax/check-docs.mjs --pack <kildepakke>`: OK (30 regler, 32 kilder, 102 tilfeller; k1 0). Negativ prøve: `foundationStatus=DONE` gir feil. Ingen kode-/appkontroller kjørt (ingen kode endret).

## Slik låses det opp
Se «Slik kan det låses opp» i `TAX-001C-evidence-status.md`: (1) miljøeier åpner de navngitte vertene under Network access (Edit environment) og tillater kalkulatorbruk, eller (2) Codex/Christian leverer en kildepakke (ønskeliste med eksakte kilder) og kjører kalkulatoren på de navngitte tilfellene. Deretter TAX-001D: primærlesing, oppgradering E1, klasse 1, godkjenning — først da kan tax-avhengig kode bestilles. Uavhengig komponentmodell (tre summeringer) kan fortsatt bygges uten satser.
