# CI-001 – uavhengig review av 9baba31

Grunnlag: `CI-001-review-9baba31.zip`, workflow, orkestrerings-/rapporteringsskript, endringen i oppgraderingskontrollen og tester.

## Konklusjon

**To P2-funn i feil-/resultathåndteringen. Behold CI-001 på REVIEW. Ingen merge til standardgren eller Actions-kjøring anbefales før retting og re-review.** Seks planlagt hoppede DB-tester er et separat, dokumentert åpent punkt og skal fortsatt ikke telles som bestått.

## P2-1 – L7 kan bli PASS uten registrert build

Sted: `scripts/ci/evaluate.mjs`, `evaluateL7`.

L7 omfatter hemmelighetsskann av byggeartefakter. Funksjonen håndterer en feilet build når `buildRc !== null`, men behandler ikke `buildRc === null` som manglende kontroll. Med rent skannresultat og exit 0 blir L7 dermed PASS også uten registrert resultat fra build.

**Selv reprodukert:**

```text
evaluateL7("PASS scan (0 treff)\nSECRET-SKANN: INGEN FUNN\n", 0, null)
→ status PASS
```

Vedlagt `ci-independent-regressions.test.ts` krever at dette ikke er PASS og feiler på levert kode. Dette er en feil i vurdereren, ikke en påstand om at hovedskriptet normalt hopper over build. En ufullstendig resultatkatalog må likevel ikke gi bestått kontroll.

**Retting:** krev registrert vellykket build før L7 kan være PASS. Manglende buildresultat må gi NOT_RUN/SKIPPED/FAIL med forklaring og hindre samlet PASS. Test både `evaluateL7` og `evaluateDir` med ellers vellykkede resultater, men manglende `build.rc`. Bevar bestått kontroll med build-exit 0 og korrekt håndtering av feilet build.

## P2-2 – mislykkede schema-dumper kan bestå som identiske

Sted: `scripts/qa-upgrade-check.sh`, `dump > "$OUT/schema-clean.sql"` og de etterfølgende `dump`/`diff`-sammenligningene for oppgraderte schemaer.

Skriptet bruker `set -uo pipefail`, men sjekker ikke exit-statusen fra `dump` ved lagring. Dersom `docker exec ... pg_dump` feiler, fortsetter skriptet med filen redirigeringen opprettet. Feiler også dumpen etter oppgradering uten stdout, blir begge filer tomme. `diff -q` returnerer da 0 og kontrollen skriver PASS for identisk schema. Det samme problemet gjelder like, ufullstendige dumper ved feil. SQL-kontrollene kan ellers lykkes, så dumpfeilen alene hindrer ikke nødvendigvis sluttmelding om bestått migrasjonskjede.

Den nye ikke-tom-kontrollen i `check()` retter SQL-svarenes tidligere vakuøse sammenligning, men beskytter ikke schema-dumpene. Dette er et gjenværende hull i samme krav om at feilet kontroll ikke må bli grønn.

**Retting:** kontroller at hver dump faktisk lykkes og er ikke-tom før sammenligning. En mislykket dump må gi FAIL og ikke kunne brukes som referanse eller utløse en PASS-linje. Gjør det samme for alle schema-sammenligningene. Ikke skriv rå SQL-dumper til offentlig rapport.

**Påkrevd feilinnsetting:** la dumpkommandoen returnere ikke-null exit og tom stdout mens de øvrige emulerte kontrollene lykkes. La også en dump returnere delvis stdout og feil. Begge tilfeller må hindre slutt-PASS og L2-PASS. Kontroller normaltilfellet i tillegg.

Dette funnet er basert på statisk gjennomgang av den faktiske shellflyten. Reviewer har ikke Bash/PostgreSQL-testmiljøet tilgjengelig og har ikke selv kjørt feilinnsettingen eller utviklerens emulerte L2-løp.

## Øvrige vurderinger

- Workflowen har bare manuell trigger, `contents: read`, standard Ubuntu-runner, tidsgrense, concurrency og ingen tredjeparts-actions, konto-secrets, artefakter eller hosted handlinger.
- Rå Supabase-/underskriptutskrift går til en privat midlertidig katalog. Rapporteringen bruker sanering og literal-maskering, og eksisterende tester for disse består. Dette er ikke en garanti for at enhver mulig fremtidig diagnoseutskrift er ufarlig; første faktiske kjøring må fortsatt gjennomgås før videre bruk.
- De kjente L3-hoppene beholdes som ikke bestått. De bør kjøres separat med dokumentert resultat eller gjøres kjørbare i egnet testmiljø; de skal ikke bare omklassifiseres til PASS.
- L4–L6, Playwright mot ekte tjenester og hosted Supabase er fortsatt åpne. Ingen av disse er godkjent eller bekreftet av denne reviewen.

## Reviewerens egne kontroller

| Kontroll | Resultat |
| --- | --- |
| Manifest | 636 av 636 SHA-256-oppføringer stemmer før lokalt testtillegg |
| Eksisterende kjørbare tester | 73 filer / 1 591 tester består |
| Ny L7-regresjon | 1 test feiler som beskrevet over |
| TypeScript (`--noEmit --incremental false`) | Består |
| ESLint | Består uten feil eller advarsler |

Typekontroll og lint er kjørt også med det lokale regresjonstesttillegget. Eksisterende lokale avhengigheter er brukt.

`tax-engine.test.ts` og `economics-source-driven.test.ts` er ikke kjørt fordi primærkildene er utelatt. Utviklerens fulle 1 717 tester er derfor ikke selv bekreftet. Reviewer har ikke kjørt workflow, Bash-skriptene, Docker, PostgreSQL, ekte Supabase/Auth/PostgREST, build, `qa:*`, hosted migrasjon eller deploy. Ingen GitHub-innstillinger, grener eller eksterne tjenester er endret.
