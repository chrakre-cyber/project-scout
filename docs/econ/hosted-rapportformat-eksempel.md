# Eksempler på rapportformat for H2–H4 (HOST-001) — SYNTETISKE data

**EKSEMPEL.** Verdiene under er konstruerte for å vise formatet. De er ikke resultater fra noe hosted prosjekt, og ingenting er kjørt mot hosted. Fingeravtrykket er påfunnet.

---

## Eksempel 1: H2, tomt prosjekt (alle trinn bestått)

# Hosted testprosjekt — H2 (HOST-001)

Modus: **TOMT prosjekt (første anvendelse av alle migrasjoner)**
Mål: fingeravtrykk 0f1e2d3c (prosjekt-ref, adresser og nøkler vises aldri)
Dette er et hosted TESTPROSJEKT — ikke produksjon, ikke pilotdata, ikke pilotgodkjenning.

- Supabase CLI 2.119.0 (versjon notert av kjøreren)

## Skrivebeskyttet inspeksjon (utgangspunkt og modus): BESTÅTT
- tilstand tomt
- anvendt 0/12

## DATA-002D-kartlegging: IKKE RELEVANT
- tomt prosjekt: ingen eksisterende rader å kartlegge; migrasjonens egen kartlegging kjøres likevel under anvendelsen og forventes å passere trivielt

## Dry-run av migrasjonene: BESTÅTT
- CLI-avslutning 0
- listet 12 av 12 forventede migrasjoner

## Anvendelse av migrasjonene: BESTÅTT
- CLI-avslutning 0

## Kontroll etter anvendelse (historikk = repo, ingen ventende): BESTÅTT
- historikk current, 12/12

## Samlet H2: BESTÅTT

Alle påkrevde punkter er bestått.

---

## Eksempel 2: H2, oppgradering av eksisterende database — STOPP på DATA-002D (ugyldige rader)

# Hosted testprosjekt — H2 (HOST-001)

Modus: **OPPGRADERING av eksisterende database**
Mål: fingeravtrykk 0f1e2d3c (prosjekt-ref, adresser og nøkler vises aldri)
Dette er et hosted TESTPROSJEKT — ikke produksjon, ikke pilotdata, ikke pilotgodkjenning.

## Skrivebeskyttet inspeksjon (utgangspunkt og modus): FEILET
- tilstand oppgradering
- anvendt 9/12
- DATA-002D-kartleggingen: INVALID — ugyldige/tomme feltkart må avklares av eier før migrasjon 20261022090000

## DATA-002D-kartlegging mot eksisterende rettighetsprofiler (FØR anvendelse): FEILET
- status INVALID
- ugyldige profiler 2

## Dry-run av migrasjonene: IKKE KJØRT

## Anvendelse av migrasjonene: IKKE KJØRT

## Kontroll etter anvendelse (historikk = repo, ingen ventende): IKKE KJØRT

## Samlet H2: FEILET

Minst ett påkrevd punkt feilet, ble hoppet over, er delvis eller ble ikke kjørt. Slike punkter regnes aldri som bestått.

---

## Eksempel 3: H3 (API-nivå) — nettleserdelene er ikke forberedt, og én test er bevisst utelatt

# Hosted testprosjekt — H3 (HOST-001)

Modus: **TOMT prosjekt (første anvendelse av alle migrasjoner)**
Mål: fingeravtrykk 0f1e2d3c (prosjekt-ref, adresser og nøkler vises aldri)
Dette er et hosted TESTPROSJEKT — ikke produksjon, ikke pilotdata, ikke pilotgodkjenning.

## L4a innlogging/tokenvalidering mot hosted (API-nivå): DELVIS (ikke bestått)
- 10 av 11 navngitte tester kjørt og bestått
- utløpt token utelatt (krever hosted JWT-hemmelighet)

## L6 firmaskille via hosted PostgREST: BESTÅTT

## L7 hemmelighetsskann: BESTÅTT

## L4b innlogging i nettleser mot hosted — IKKE forberedt i denne omgangen: IKKE KJØRT

## L5a econ006 i nettleser mot hosted — IKKE forberedt: IKKE KJØRT

## L5b econ006d i nettleser mot hosted — IKKE forberedt: IKKE KJØRT

## Samlet H3: IKKE FULLT BESTÅTT

Minst ett påkrevd punkt feilet, ble hoppet over, er delvis eller ble ikke kjørt. Slike punkter regnes aldri som bestått.

---

## Eksempel 4: H4 — testdata ryddet, men eiers sletting av prosjektet er ikke bekreftet

# Hosted testprosjekt — H4 (HOST-001)

Modus: **TOMT prosjekt (første anvendelse av alle migrasjoner)**
Mål: fingeravtrykk 0f1e2d3c (prosjekt-ref, adresser og nøkler vises aldri)
Dette er et hosted TESTPROSJEKT — ikke produksjon, ikke pilotdata, ikke pilotgodkjenning.

## Opprydding: tørrkjøring (hva som ville slettes): BESTÅTT

## Opprydding: testdata slettet: BESTÅTT

## Kontroll etter opprydding (ingen testdata igjen): BESTÅTT

## Eier har slettet testprosjektet (bekreftes av eier; kan ikke måles av skriptene): IKKE KJØRT

## Samlet H4: IKKE FULLT BESTÅTT

Minst ett påkrevd punkt feilet, ble hoppet over, er delvis eller ble ikke kjørt. Slike punkter regnes aldri som bestått.
