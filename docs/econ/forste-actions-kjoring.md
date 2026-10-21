# Første manuelle Actions-kjøring (CI-001) — fremgangsmåte (ikke utført)

**Status 21.10.2026:** beskrivelse av enkleste vei. **Ingenting er aktivert:** ingenting er endret på `main`, ingen kjøring er startet, ingen GitHub-innstillinger er endret. CI-001 forblir REVIEW; uavhengig review av 215bc2c: ingen nye blokkerende funn (`reviews/CI-001-FIX2-review-215bc2c.md`). Kjøringen gir bare belegg for lokal Supabase i Actions (L1–L3, L7); L4–L6, Playwright og hosted H1–H4 er fortsatt åpne.

## Fakta om repoet (kontrollert 21.10.2026)
- Repoet `chrakre-cyber/project-scout` er **offentlig**; logg og jobbsammendrag blir offentlige (derfor sanert rapport).
- `main` (`d22eda7`) har **ingen** `.github/`-mappe og ingen `scripts/ci/`. Den inneholder tidligere sammenslåinger av denne arbeidsgrenen (PR #1–#3) og **ingenting som ikke allerede er i arbeidsgrenen** (`git diff HEAD...origin/main` er tom). Arbeidsgrenen ligger 95 commits foran og 3 (bare sammenslåings-)commits bak.
- Workflowen bruker `workflow_dispatch`. Etter GitHubs dokumentasjon må en slik workflowfil ligge på **standardgrenen** for at «Run workflow» skal dukke opp; når den først finnes der, kan man velge en annen gren under «Use workflow from», og da kjøres workflowfilen og koden fra *den grenen* (workflowen henter selv kjørt commit med `git fetch`). Dette bekreftes først av selve første kjøring.

## Hva som må ligge på `main` (minimum)
**Nøyaktig én fil, ingenting annet:** `.github/workflows/supabase-local.yml`, med innholdet fra den reviewede commiten `215bc2c` (workflowfilen er ikke endret siden; `git diff 215bc2c HEAD -- .github scripts tests supabase src` er tom):
- git blob-SHA: `83fa4fd269048d330aecdb3e5b792a614084e7a2`
- SHA-256 av filen: `3d3d2a1754033bc608c4a9aa2c5af34041f3f0b59373900b094a58c2c7767a93`
Skript, tester og migrasjoner trenger **ikke** å ligge på `main`: de hentes fra grenen når den velges. (Alternativet — å slå sammen hele arbeidsgrenen — er mulig fordi `main` ikke har noe grenen mangler, men bringer 95 commits inn på `main` mens CI-001 ennå er REVIEW; ikke anbefalt som første steg.)

## Enkleste fremgangsmåte (Christian, ca. 10 minutter)
1. **Sjekk innstillinger** (les, endre bare hvis nødvendig): Settings → Actions → General: Actions tillatt; «Workflow permissions» = *Read repository contents permission*; Settings → Billing → *Spending limit* = 0 USD. Ingen larger runners.
2. **Legg filen på `main` med ett commit:** på GitHub, åpne `main` → *Add file → Create new file* → filnavn `.github/workflows/supabase-local.yml` → lim inn innholdet fra filen på arbeidsgrenen (åpne `.github/workflows/supabase-local.yml` på grenen `claude/wonderful-bardeen-yussx3` → *Raw* → kopier alt) → *Commit directly to main* (eller via PR hvis du foretrekker det). Kontroller at filen er lik: nedlastet/limt innhold skal gi SHA-256 `3d3d2a17…c7767a93` (`sha256sum`) eller blob-SHA `83fa4fd2…ea` (`git hash-object`). Ikke endre noe annet.
3. **Start kjøringen:** Actions → *Supabase lokal kontroll (L1–L3, L7)* → *Run workflow* → *Use workflow from:* **`claude/wonderful-bardeen-yussx3`** → *Run workflow*. (Ingen inndata.) Noter commit-SHA øverst i kjøringen; den skal være grenens spiss, som ikke avviker fra 215bc2c i `.github/`, `scripts/`, `tests/`, `supabase/` og `src/`.
4. **Les resultatet:** åpne kjøringen → jobbsammendraget («Summary») eller loggen for steget «L1–L3 og L7». Rapporten viser L1, L2, L3a, L3b, L3 samlet og L7 hver for seg, og at L4–L6/hosted er åpne. Forventet kjøretid anslått 30–60 min (ikke målt; jobbgrensen er 90 min).
5. **Hvis noe i loggen ligner en nøkkel/URL med passord:** slett kjøringen (Actions → kjøringen → *…* → *Delete workflow run*) og meld fra. Ellers: send meg teksten fra sammendraget (ingen credentials trengs), så vurderer reviewer kjøringen.
Alternativt kan jeg utføre trinn 2 og 3 via GitHub-verktøyene (filopprettelse på `main` og `workflow_dispatch`), men bare etter at du uttrykkelig har godkjent hver av dem.

## Hva første kjøring kan vise (forhåndsvarsel)
- L3b kan bli «IKKE KJØRT» hvis runneren mangler PostgreSQL-binærer (ikke verifisert); da kan L3 ikke bli PASS. Ingenting installeres automatisk.
- L2 mot ekte Supabase CLI, bildehenting (`public.ecr.aws`), minne og kjøretid er ukjent og kan gi FEIL eller tidsavbrudd — dette er hensikten med første kjøring.
- L7 kan bli «HOPPET OVER» hvis `supabase status -o env` ikke eksponerer alle nøkkelnavn.
- Samlet «IKKE FULLT BESTÅTT» ved første forsøk er et normalt og ærlig utfall; det gir ikke tillatelse til å svekke PASS-kravet.
