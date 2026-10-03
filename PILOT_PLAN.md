# Pilotplan — fem forhandlere, 14 faktiske dager

03.10.2026. Christian rekrutterer og følger opp; ChatGPT hjelper med oppsummering og beslutninger. Planlagt start senest 01.11 betinget av Gate B. Evaluering 14 dager etter faktisk start.

## Utvalg og oppstart

Fem profiler: premium/sportsbil, tysk premium, bred bruktbil, volum og en annen aktiv importprofil. Dette er ønsket variasjon, ikke navn på rekrutterte kunder. Bruk `templates/PILOT_INTERVIEW.md`.

Hver forhandler gir tre konkrete biltyper de vil kjøpe, forventet norsk sluttkundepris med avgiftsgrunnlag, minste bidrag, klargjøringsreserve og forhold som diskvalifiserer bilen. Onboarding: 30–45 min per firma; minst 4 agenter hver gir 20 samlet, fortsatt maks 10 per firma.

Før første varsel bekreftes firmatilgang, mottakeradresse, aktive søk, skatteprofiler og hva estimatene dekker. Brukeren får tydelig informasjon om at tilstand og selgerpåstander ikke er verifisert.

## Gjennomføring

- Dag 0: onboarding og forventninger; logg starttidspunkt.
- Dag 1–3: Christian kontrollerer varsler og får rask relevansfeedback. Feil kalkyle isoleres og tilsvarende varsler pauses.
- Dag 7: 15 min samtale med hver: hvilke biler ble åpnet, hvilke selgere ble kontaktet, hvorfor kjøp ble/ikke ble vurdert?
- Dag 14: vis konkret tilbud om 990 kr/mnd eks. mva. etter prøveperioden og noter hvem som aksepterer. En «interessant idé» teller ikke som aksept.

Gratisperioden er 30 dager; beslutningsmålingen kan gjøres etter 14 dager uten å fakturere før prøveperioden er over. Avtal uttrykkelig betalt videreføring og eventuell fakturastart. Ingen automatisk fakturering er implementert.

## Måledefinisjoner og mål

| KPI | Arbeidsmål | Hvordan måles |
|---|---:|---|
| Pilotforhandlere | 5 | Fullført onboarding, ikke bare et møte |
| Aktive agenter totalt | >=20 | Lagret, aktivert og kjørbar |
| Relevante opportunities | >=50 | Unike dealer-agent-annonse-kombinasjoner; globalt unike annonser rapporteres separat |
| Feilrelevans | <15 % | Forhandlerbedømte varsler som ikke passer det bekreftede søket / alle bedømte varsler; rapporter antall bedømte og vurderingsdekning |
| Aktive etter to uker | >=4 av 5 | Minst én meningsfull handling i dag 8–14: vurdering, agentendring eller bekreftet selgerkontakt |
| Selgerkontakter | >=5 totalt | Rapportert kontakt med selger for et Scout-funn; originalannonseklikk alene teller ikke |
| Biler reelt vurdert for kjøp | >=3 | Konkret vurdering/innhenting av dokumenter/tilbud bekreftet av dealer |
| Betalt videreføring | >=3 av 5 | Uttrykkelig aksept av 990 kr/mnd eks. mva. og fakturastart etter prøveperioden |
| Faktisk kjøp | Bonus | Dokumentert kjøp; ikke krav for første pilot |

50 treff er et hypotesemål og kan utebli i smale søk uten at produktet nødvendigvis er dårlig. Registrer faktisk markedstilgjengelighet og søkebredde. 5 firmaer er en liten kvalitativ pilot; tallene gir ikke statistisk bevis for hele markedet.

## Hva vi logger

Dato, pseudonymisert firma-ID, agent-ID, source-ID, opportunity-ID, kalkyleversjon, varselstatus, klikk, relevant/irrelevant/ubedømt, begrunnelse, selgerkontakt, kjøpsvurdering og betalingsaksept. Ikke lagre unødvendig person-/selgerdialog i analysearket.

## Avslutningsbeslutning

**Fortsett til kommersiell v1:** betalingsmålet nås, faktisk kjøpsinteresse dokumenteres, feil kan håndteres og leverandørkostnader er bærekraftige.

**Revider:** noen vil betale, men relevans, importdekning eller arbeidsflyt hindrer bruk. Velg én konkret flaskehals og nytt avgrenset forsøk.

**Pause:** manglende rettigheter, utrygg økonomimotor eller ingen tydelig betalingsvilje. Ikke utvid featurelisten for å skjule manglende verdi.

Rapporten skiller mellom data som faktisk ble målt og hypotetisk margin. Den skal inneholde hvilke profiler som var støttet, hvilke søk som var ufullstendige, antall vurderinger og konkrete anbefalinger.
