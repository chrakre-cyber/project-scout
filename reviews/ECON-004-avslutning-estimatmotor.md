# ECON-004 — avgrenset avslutning som estimat-/scenariomotor (forberedelse til pilotflyt)

**Dato 20.10.2026. Utgangspunkt: commit `519016b`. Dokumentasjon; ingen kodeendring, ingen godkjenning, ingen runtime-endring.** ECON-004 forblir **REVIEW** (ikke DONE); alle fire økonomiflagg er `false`; ingen regel eller avrundingspolicy godkjennes; ECON-005 er ikke startet. Planen for ECON-005 ligger i `docs/econ/ECON-005-implementeringsplan.md` og er ikke gjennomgått av deg ennå.

**Hva «avgrenset avslutning» betyr her:** ECON-004 leveres som en ren kjerne som gir *estimat, scenarier, nedre grenser eller blokkering* — aldri `validated` (uoppnåelig med registerprofilen; testet). Presedens for avgrenset DONE finnes (ECON-002 «DONE innen avtalt omfang», ECON-003 «DONE som avgrenset fixture-/aritmetikkleveranse»). Forslag til formulering når du beslutter: «ECON-004 DONE innen avtalt omfang: estimat-/scenariomotor; ingen produksjonsregler godkjent; `validated` kreves egen godkjenning (D1–D9)».

## 1. Akseptkrav
Kilder til kravene: backlogg-raden (rene funksjoner, avgiftsdel bak grensesnitt, «ikke beregnet»), oppdraget (åtte kjernekrav, gjenbruk av ECON-003, ingen UI/DB/auth/provider), ECON-001 §§ 8, 11–13, CLAUDE.md pkt. 2, 4, 5, 12, 13, 15.

### 1a. Oppfylt (med belegg)
| Krav | Belegg |
|---|---|
| Rene funksjoner; ingen I/O, UI, DB, provider, LLM | arkitekturtest i `economics-core.test.ts` («kjernen bruker ikke float … /server-importer») over hele `src/domain/economics/` |
| Eksakt aritmetikk, ingen float | samme test + `rational.ts` (bigint/rasjonal) |
| Gjenbruk av ECON-002-motor og ECON-003-fixturer som regresjon; begge uendret | regresjonstester mot ECON-001 §7 i `economics-core.test.ts`; `git status` tom for `tests/fixtures` og `src/domain/tax` i hver runde |
| Avgiftsdel bak grensesnitt; blokkert/uavklart avgift ⇒ ikke beregnet, aldri 0 | `tax_blocked`, `taxLine`; testet |
| Ukjent er ukjent, aldri 0 (transport, forsikring, lasting, toll uten dekning, provisjon, betalingskostnad, utenlandsk mva., klimagass) | tester i `economics-round34-implementation`/`-fix1`; kilder `kildevurdering-6` |
| Nedre grenser overstiger aldri en støttet fullføring (tillegg og fradrag) | property-tester i `-round34-implementation` (§ 7), `-fix2`; reviewers egne 3 600 sammenligninger (FIX2-review) |
| Kontantbehov (brutto) skilt fra økonomisk kost; fradragsstatus og betalingskanal som uavhengige akser | `importCashRequirement` / `estimatedLandedCost` / `importVatSettlement` |
| Tre adskilte datoer, to kursroller, råkurs/enhet, akseptdato uavhengig av valuta | `-source-driven`, `-src1-review-regressions` |
| `validated` kun via godkjent profil; registerflaggene `false` | test «aldri med dagens register»; `REGISTRY_ECONOMICS_PROFILE` |
| Kildegrunnlag registrert med evidens skilt fra godkjenning | `rules.json` (E1P), `sources.json` T53–T89, `check-docs` OK |
| Uavhengige reviews, alle P2 lukket | f12d44a → cefe290 (4 P2); 76200ff → bd67c8d (2 P2); afdc9f0 → 33d2fb9 (2 P2); 33d2fb9 → 7378368 (1 P2); 7378368: ingen nye blokkerende funn |
| Dokumentasjon av feltbetydning og oppførsel | `docs/econ/landed-cost-core.md`, `DECISIONS.md` (runde 26–37), `MVP_BACKLOG.md` |
| Kontroller | 953 tester (42 filer), `tsc`, `eslint`, `check-docs` OK ved 7378368; ingen kodeendring siden |

### 1b. Nødvendige gjenstående endringer (før ECON-004 kan kalles ferdig som estimat-/scenariomotor)
| # | Endring | Hvorfor | Type |
|---|---|---|---|
| **B1** | **Vakt for dokumentert gyldighetsvindu.** Probe (kjørt 20.10.2026, ikke committet): med eksplisitt oppgitt toll gir akseptdato **2027-02-01** og **2025-06-01** `estimate` med 25 % mva. (27 000 på 108 000) — ingen dato-vakt. Utelatt toll gir `incomplete` bare fordi tollsats 0 krever 2026 (tilfeldig beskyttelse). Satsvedtaket (T76/T77/T80), elbilgrensen/tollsatsen er dokumentert for 2026; 2027 er udokumentert (T75 varsel). | Estimat for udokumentert år er en feilkilde i en pilotflyt; ikke svekking, men stramming | **kodeendring** (liten): akseptdato utenfor 2026 ⇒ `incomplete` («utenfor dokumentert periode»), ikke blokkert; strengere vindu (3.9.–31.12.2026) bare hvis du beslutter D7 |
| **B2** | **Konsolidert uavhengig review av endelig tilstand** (9ad2cbd..HEAD). Alle reviews hittil er avgrensede delta-reviews («ikke en full review av hele ECON-004», FIX2-review). CLAUDE.md pkt. 15: DONE først med review-belegg. | Krav for DONE; ikke for å planlegge | review (ekstern) |
| **B3** | Du eksplisitt aksepterer avgrenset DONE-formulering (over) *eller* eksplisitt tillater at ECON-005 starter fra REVIEW-baseline (pinnet commit). | Backlog-avhengighet «ECON-004» er ikke formelt oppfylt før DONE | beslutning |
| B4 | Dokumentasjonen av «±1 kr» rettet (utført nå, § 2) | feil generell påstand | docs (gjort) |

Valgfri opprydding (ikke krav): flere gamle review-zip-filer er sporet i repo-roten (`git ls-files | grep zip`); kan flyttes ut.

### 1c. Forhold som bare hindrer `validated` (ikke estimat-/scenariomotoren)
De fire flaggene og D1–D9 i `reviews/ECON-004-beslutningsgrunnlag.md`; reglene er E1P (krever E1, klasse 1/2-referanse og din godkjenning); U-013 (avrunding per importberegning/enhet/metode); registrert importør som sammenstilling; lasting/håndtering/salgsprovisjon i elbilgrensen; tolltariffendringer 2026; suspensjonspublisering; fradrag/salgsvare-dokumentasjon; scope 3.9.–31.12.2026 (D7); varebil/uttak/livssyklus. Ingen av disse er nødvendige for at motoren skal levere estimat med riktig merking — de er allerede uttrykt som estimatårsaker, `incomplete` eller nedre grense.

## 2. Rettelse: «±1 kr» er ikke en dokumentert feilgrense
**Feil:** `reviews/ECON-004-beslutningsgrunnlag.md` (rad «Kan avgrenses?» under `roundingApproved`) sa at resultatet er «et estimat ±1 kr». Det er rettet (banner + ny formulering), og en tilsvarende setning er lagt i `docs/econ/landed-cost-core.md`.
**Hva som faktisk er dokumentert:**
- ECON-002: avvik −1…+2 kr gjelder bare det definerte variantsettet og inputområdet for avgiftsmotorens sluttkrav (`reviews/ECON-002.md` §16.3; «ikke en generell garanti»).
- ECON-003/kildeavklaring 2: half-up-literalene ville avvike 1 NOK i fire fixturetilfeller dersom nedrunding ble valgt — gjelder bare disse fixturene.
- T73 (FAQ): valideringstoleranse «+/-1kr × antall linjer» er verken en avrundingsregel eller en feilgrense for beregningen.
- ECON-004: ved avrundingslikhet gir kjernen nedre grense/kandidater under de to støttede policyene (half_up/half_even). Spredningen mellom disse vokser med antall avrundede poster (hver tie kan bidra opptil 1 kr, og mva. gir ¼ av tollverdi-endringen videre), og er **ikke** en rettslig feilgrense.
**Hva som ikke er avgrenset:** avvik fra en fremtidig, kildebelagt regel (nedrunding per importberegning, per linje, per deklarasjon, periodesum; avrunding av tollverdi/kursomregning) er ukjent og kan overstige 1 kr (f.eks. nedrunding per linje akkumulerer per linje). Produkt-/UI-tekst skal derfor ikke oppgi «±1 kr»; den skal si «estimat i hele kroner, avrundingsregel ikke avklart».

## 3. Tillater godkjenningsportene ECON-005 med estimater og nedre grenser?
**Konklusjon: Ja — som implementering, forutsatt at ingen gate svekkes og at estimat/nedre grense aldri behandles som validert. Nei — til positive budsjettstatuser, «fullt treff» eller positive varsler.** Formell forutsetning: B3.

| Port / krav | Kilde | Gir ECON-005 med estimater tillatelse? |
|---|---|---|
| **TAX-gate** (backlogg: ECON-005 avhenger av «ECON-004, TAX-gate»; ECON-001 §14/§15.7a: avgiftsmotor validert for viste profiler) | `MVP_BACKLOG.md`, `reviews/ECON-001.md` | Oppfylt for PB-DIE/PB-BEV/PB-PHEV (ECON-002 DONE innen omfang: sju godkjente regler, tre klasse 1); *ikke* oppfylt for andre profiler ⇒ kjernen gir `blocked`/`incomplete` (tolkning av «TAX-gate»; bekreft i B3) |
| **Budsjettkontrakten**: positiv status bare med `complete_validated`, samme kandidat/revisjon/kostnadsgrunnlag, ikke foreldet | `src/domain/search-v2/budget.ts` (`classifyBudget`), DEC-031 | Ikke svekket: kjernen når aldri `validated` ⇒ mapping gir aldri `complete_validated` ⇒ aldri `within_budget`/`within_deviation`/`isFullHit` |
| **DEC-030**: «oppfylte bilkrav uten fullstendig kostnad kan vises med kontrollbehov, aldri som bekreftet budsjettreff» | `DECISIONS.md` | Estimat/nedre grense kan vises som kontrollbehov |
| **ECON-001 §11/§12**: ukjent kritisk komponent ⇒ `lower_bound`, ingen «inne i mål»; ukjent fradrag ⇒ ingen enkelt landed cost | `reviews/ECON-001.md` | Allerede implementert i kjernen; må bevares i visningsmodellen |
| **ECON-001 §15.7 (b)–(h)** (FX-kilde/dato vist, forutsetninger vist, ikke støttet ⇒ «ikke beregnet», «estimat — ikke rådgivning»/syntetisk-etikett, rettighetskontroll, CI-tester, review) | `reviews/ECON-001.md` | Må oppfylles av ECON-005/006; gjelder ekstern partnerdemo, og samme innhold kreves av `PILOT_PLAN.md` («hva estimatene dekker», «feil kalkyle isoleres») |
| **Rettigheter** `allow_derived_economics`/`display_derived_economics` (begge default nei, fail-closed) | ECON-001 §13, DEC-034, DATA-001 §3 | Må bygges i ECON-005; uten rett ⇒ `unavailable: rights_not_granted` |
| **Syntetisk profil** `usage.alerts = false` | `provider-rights.ts` | Ingen varsler fra syntetiske kilder uansett |
| **`approvalRequirements`/flagg** (E1, klasse 1/2, Christians godkjenning) | `rules.json` | Gjelder `validated`/parametergodkjenning, ikke estimatvisning; **ikke endret** |
| CLAUDE.md pkt. 3, 4, 13 (mock markert, ukjent ≠ 0, rapporter bare kjørt) | `CLAUDE.md` | Krever demo-merking og at ukjent/nedre grense aldri vises som 0 eller bekreftet |

**Eksplisitt ikke tillatt (ingen port svekkes):** (i) mapping av `estimate`/`lower_bound`/`scenarios` til `complete_validated`; (ii) «innenfor budsjett», `isFullHit` eller positivt varsel fra estimat, nedre grense eller ukjent kostnad (også når nedre grense ≤ budsjett); (iii) én enkelt landed cost ved ukjent fradragsstatus; (iv) økonomi vist uten visningsrett; (v) endring av flagg, `classifyBudget`-terskler eller avrundingspolicy.
