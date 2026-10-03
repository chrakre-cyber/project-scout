# Opportunity score v0.1

03.10.2026. Forklarbar regelmotor, ikke ML eller sannsynlighet for gevinst. Score er kun rangering blant kandidater som allerede passer de harde filtrene. Vis delpoeng.

## Før score

Hardfilter: modell/variant der avklart, år, km, prisramme, gir, drivstoff, karosseri og land slik agenten har satt dem. Kjent avvik gir excluded. Ukjent obligatorisk felt gir needs_review og ingen automatisk match/varsel. Ikke la høy margin kompensere for feil modell.

## Poeng

`clamp(x,0,1)` begrenser x til intervallet 0–1. `M` er konservativt estimert bidrag i kroner og `T` er minimum bidrag; agenten må ha T > 0.

| Faktor | Maks | Regel |
|---|---:|---|
| Match | 30 | Alle hardfilter bekreftet: 20. Foretrukne myke kriterier: 10 × bekreftede preferanser / antall preferanser. Ingen preferanser: 10 |
| Bidrag | 30 | 30 × clamp(M / (2 × T), 0, 1). Ukjent M: 0 og varsel blokkert |
| Kilometer | 10 | Med max-km > 0: 10 × clamp(1 − km/max-km, 0, 1). Ingen km-mål eller ukjent km: 0 |
| Ferskhet i Scout | 10 | 0–24 t siden first_seen: 10; >24–72 t: 7; >72–168 t: 3; deretter 0 |
| Annonse-/selgeropplysninger | 10 | 2 poeng hver for kjent selgertype, land/poststed, prisgrunnlag, detaljtekst og original-URL. Ikke påstand om pålitelig selger |
| Kalkyledata | 10 | HIGH: 10, MEDIUM: 5, LOW: 0 etter validerte regler |

Total avrundes til heltall 0–100 etter at alle delpoeng er summert. Kilometer er en enkel rangeringspreferanse, ikke en modell for slitasje/verdi. Preferanser om eksempelvis farge må skilles fra eksplisitte «ikke rød»-hardfilter.

## Varselkrav

Alle må være oppfylt:

1. Agent fortsatt aktiv og hardmatch bekreftet.
2. Godkjent data-/analysebruk og tilgjengelig originalannonse.
3. Fullført og validert skatteprofil; ingen kritiske ukjente input.
4. M >= T, også i godkjent konservativt scenario.
5. Annonseanalyse fullført; kritisk motstrid eller kontrollflagget alvorlig skade/motorhistorikk blokkerer automatisk opportunity-varsel etter definert policy. Bilen kan vises med kontrollbehov.
6. Initial-varselnøkkelen er ikke allerede sendt/enqueued.

Score terskler: >=80 «høy rangering», 60–79 «relevant», <60 lavere rangert. **Score er ikke varselport**; bilen kan nå bidragsmålet med lav score og fortsatt varsles hvis alle krav er oppfylt. Dette forhindrer at en arbitær poengterskel skjuler et økonomisk relevant kjøp.

## Matematisk testeksempel

Alle hardfilter, ingen soft-preferanser: 30. M=150 000, T=100 000: 22,5. km=50 000 av max=100 000: 5. Først observert for 10 t siden: 10. Alle fem annonseopplysninger: 10. HIGH: 10. Total 87,5 → 88. Dette er syntetisk testdata, ikke en validering av konkret bilmargin.

Test: høyere M kan ikke gi lavere bidragspoeng; hardfilterbrudd kan aldri få kvalifisert opportunity; endret annonse gir ikke nytt initialvarsel; ukjent M gir ingen varsel selv med høye øvrige poeng.
