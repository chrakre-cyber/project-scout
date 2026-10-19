# ECON-004 — samlet beslutningsgrunnlag for avslutning (19.10.2026)

**Status: beslutningsgrunnlag. Ingen kodeendring, ingen nye kilder, ingen godkjenning.** ECON-004 står på REVIEW; alle fire flagg er `false`; ECON-005 er ikke startet. FIX2-reviewen (`ECON-004-r34-FIX2-review-7378368.md`, registrert): P2 fra FIX1-reviewen er **lukket**, ingen nye blokkerende funn i den avgrensede rettingsreviewen (ikke en full review eller juridisk godkjenning).

**Hva «godkjent» krever i registeret** (`rules.json` → `approvalRequirements`): regelen på E1 (ikke E1P) med kontrolldato; alle kilder E1 med hash; gyldighet og styrende hendelse begrunnet; minst én uavhengig klasse 1-referanse (offisiell kalkulator/vedtak) eller dokumentert klasse 2-håndregning; og `parameterApproval` satt av deg (eller delegert), aldri av utvikler. Alle ECON-004-regler er i dag E1P. Uten godkjenning gir kjernen alltid `estimate`/`incomplete` (aldri `validated`) — det er bevisst og er ikke en feil.

**Hva kjernen allerede gjør uten godkjenning** (derfor kan usikkerhet avgrenses uten ny kode): ukjent ⇒ nedre grense/`incomplete`; estimatårsaker per åpent punkt (`vat_rules_unapproved`, `rounding_unconfirmed`, `customs_fx_rule_unconfirmed`, `deduction_rule_unapproved`, m.fl.); avrundingslikhet ⇒ nedre grense; nedre grenser overstiger aldri en støttet fullføring (FIX1/FIX2).

## 1. `vatRulesApproved` (R-IMP-VAT-001 til -004, R-IMP-REF-001)
| | |
|---|---|
| **Kildene dekker** | 25 % ved innførsel (T76/T77, ajourført T80 per 19.10.2026); grunnlag = tollverdi + toll/avgifter ved innførsel (mval. § 4-11); tollverdikomponenter og provisjonsroller (vareførselsloven §§ 6-10/6-11, T67/T69/T87/T88); ordinær toll 0 for personbil 87.03 (Tolltariffen 2026, T83); 300 000-grensen og at avgiften bare tas av overskytende, målt mot tollverdi (T71/T63 + T81, R-IMP-VAT-004 E1P); engangsavgift utenfor grunnlaget (rettsanvendelse: § 4-11, vedtakets § 1, T60, T89). |
| **Hindrer godkjenning** | Reglene er E1P, ikke E1; ingen klasse 1-referanse for import (Skatteetatens importkalkulator er nevnt på T81, men ikke lest/kjørt; håndregninger/Python-kontroller finnes som klasse 2-kandidat). Åpne delpåstander: registrert importør = sammenstilling (T56 + § 4-11), ikke sitat; lasting/håndtering og salgsprovisjon i beløpet elbilgrensen måles mot; endringer i tolltariffen etter 1.1.2026 er ikke lest (T86-lenke); klimagassavgiftens plass i grunnlaget; bank-/valutagebyr i «pris»; utenlandsk mva.-vilkår krever dokumentasjon (T88). |
| **Kan avgrenses?** | **Ja.** Snever profil: ordinær innførsel, personbil M1, akseptdato 2026, mva.-registrert importør, kjøp til videresalg. Utenfor dette gir kjernen i dag ukjent toll, `incomplete` og nedre grenser; de uløste komponentene har egne estimatårsaker (`ev_threshold_components_unconfirmed`, `vat_base_charge_unclassified`, `foreign_vat_exclusion_undocumented`, `customs_duty_ordinary_rate_unapproved`). |
| **Beslutning fra deg** | **D1** Godkjenne den snevre profilen over (ja/nei/senere). **D2** Godta sammenstillingen (T56 + § 4-11) som regel for registrert importør, eller holde den som estimat. **D3** Elbil: ta elbil med i profilen (med estimatårsaken for lasting/håndtering/salgsprovisjon) eller blokkere elbil over 300 000 til videre. **D4** Godta Tolltariffen 2026 (gjeldende 1.1.2026) som datert belegg med estimat, eller holde tollsats 0 som ikke-godkjent. **D5** Om klasse 2-håndregning (dokumentert, uavhengig Python) er akseptabel som referanse, eller om du krever klasse 1 (offisiell kalkulator). |

## 2. `roundingApproved` (U-013)
| | |
|---|---|
| **Kildene dekker** | A (samlet avgiftskrav): tekstlig støtte for nedrunding til hele krone (skattebetalingsforskriften § 10-4-4 + § 10-4-1 (1) b, T46/T50/T49), enhet uavklart for registrert importør. C (rapportering): XSD v1.0 godtar desimaltall (T79) — ingen metode. |
| **Hindrer godkjenning** | B: ingen regel for hver importberegning (tollverdi, omregning, mva. per deklarasjon/vare); A-enhet (deklarasjon vs periodesum) og C-metode mangler; valideringstoleranse i FAQ er ikke en regel; fixture-half-up er en ubekreftet konvensjon (ville gitt 1 kr avvik i 4 tilfeller ved floor). Ingen kilde i pakkene omtaler avrunding av importberegning. |
| **Kan avgrenses?** | **Ja, uten godkjenning:** kjernen viser allerede nedre grense og kandidater ved likhet og gir aldri `validated`. Resultatet er et «estimat ±1 kr» i hele kroner. |
| **Beslutning fra deg** | **D6** Velg: (a) la `roundingApproved` stå `false` og akseptere at ingen beregning blir `validated` (anbefalt standard inntil videre); (b) innføre en eksplisitt **produktkonvensjon** (merket som ikke-rettslig) — da må du velge policy selv; (c) be om én presis avklaring av B + A-enhet (konkret restspørsmål, ikke bred henvendelse). Jeg velger ingen av dem. |

## 3. `customsFxRuleApproved` (R-IMP-FX-001, U-008)
| | |
|---|---|
| **Kildene dekker** | Regelkjeden: kursdato = aksept av deklarasjonen (tollavgiftsloven § 2-2, vareførselsforskriften § 6-12-1 (3), vareførselsloven §§ 3-3/3-4; T65/T67/T68/T69); nytt kursregime fra 3.9.2026 (annenhver tirsdag, 14 dager, suspensjon > 5 %); kursdata (T23/T55); «fri rådighet» i veiledning avgjort av lovkjeden. Kjernen: gyldighetsperiode mot akseptdato, råkurs/enhet, suspensjon ukjent ⇒ estimat. |
| **Hindrer godkjenning** | Kurser før 3.9.2026 er bare lest i veiledning (T53) og i 2018-uttalelsen med gammelt regime; suspensjonspublisering ikke verifisert; akseptdato i praksis (tidlig levert deklarasjon) er et dataspørsmål; valutaer utenfor Tolletatens liste; avrunding av omregning (U-013 B). Datoomfanget 3.9.–31.12.2026 er et forslag og **ikke håndhevet i runtime** (akseptdato i 2027 eller før 3.9.2026 blokkeres ikke av kjernen). |
| **Kan avgrenses?** | **Ja i prinsippet:** akseptdato fra 3.9.2026 i 2026, valuta på Tolletatens liste, suspensjon `unknown` ⇒ estimat. Å *håndheve* grensen krever en senere kodeendring (ikke nå). |
| **Beslutning fra deg** | **D7** Godkjenne 3.9.–31.12.2026 som produktgrense (ja/nei/annen avgrensning), og at håndheving i runtime da er en egen, senere oppgave. **D8** Godta «suspensjon ukjent ⇒ estimat» som permanent nivå, eller kreve bekreftet «not_suspended» før noe kan kalles godkjent. |

## 4. `deductionRuleApproved` (R-DED-001)
| | |
|---|---|
| **Kildene dekker** | Fradragsrett for innførselsmva. på personkjøretøy til videresalg: mval. § 8-1 og § 8-4 (1) a (T63); håndbok 8-4.3 (T59, ordrett lik 2023-utgaven T36); Skatteetatens importveiledning: samme regler som innenlands, registrerte beregner innførselsmva. selv (T56); dokumentasjon: tolldeklarasjon med underbilag og grunnlag/avgift per sats (T56). Demobil: § 3-24 (1) (T35). Kjernen tar fradragsstatus bare fra forhandlerens uttrykkelige oppgave (aldri fra annonse/«forhandler»). |
| **Hindrer godkjenning** | R-DED-001 er E1P; ingen hjemmel funnet for et eget «salgsvarebevis» (status underbygges av kjøps-/lager-/salgsdokumentasjon); uttak/omdisponering og tilbakeføring (§ 3-24, § 9-6, T28 ulest) er ikke utredet; varebil og andre profiler ikke vurdert; ingen referanse (klasse 1/2) for et fradragsutfall. |
| **Kan avgrenses?** | **Ja, tydeligst av de fire:** begrens til **kjøp for videresalg, fradragsstatus oppgitt av forhandler** (`deduction_status_dealer_stated` + `deduction_rule_unapproved` forblir estimat). Senere bruk (uttak, demobil, utleie) ligger utenfor kjøpsberegningen. |
| **Beslutning fra deg** | **D9** Godkjenne flagget for dette avgrensede omfanget (kjøp for videresalg, forhandleroppgitt status), og bekrefte at uttak/livssyklus er utenfor ECON-004. |

## Skillet du ba om
| Kategori | Innhold |
|---|---|
| **Nødvendig for dagens kjøpsberegning** (for å kunne kalle noe godkjent/`validated`) | D6 (avrunding; det eneste punktet uten noen kildedekning for kjerneoperasjonen), D1/D2 (mva.-profil og registrert importør), D7 (datoomfang), D9 (fradragsomfang), D5 (referansenivå). Uten disse forblir resultatet `estimate`/`incomplete` — som er trygt og fungerer for mock-/estimatsporet. |
| **Senere uttaksforløp** (utenfor kjøpsberegningen) | demobil/uttak § 3-24, tilbakeføring § 9-6/T28, utleie/utlån, forholdsmessig fradrag, varebil og andre profiler. |
| **Datainnhenting** | suspensjonspublisering og kursdata for en gitt dato; endringer i tolltariffen etter 1.1.2026; akseptdato fra deklarasjon; Skatteetatens importkalkulator som klasse 1-referanse; sats og elbilfritak etter 2026. |
| **UI** | felt/flyt for `foreignVat`-dokumentasjon, `commission` (rolle, betalt separat, `deductionConditionsMet`), `paymentCosts`, `importLevies`/`climateGasVatBase`, akseptdato og suspensjon; visning av `lower_bound`/estimat; ingen `validated`-merking uten godkjenning. |

## Anbefalt avslutning (din beslutning)
Avslutt ECON-004 som **levert og REVIEW-godkjent kode med alle flagg `false`** (estimat-/nedre-grense-sporet er komplett og testet: 953 tester), og ta D1–D9 når et konkret behov for `validated` oppstår. Hvis du vil ha minst mulig videre arbeid: D6(a), D7 og D9 er de billigste avgrensningene; D1–D5 krever mest vurdering. Ingen av beslutningene krever nye kilder for å kunne tas — de avgjør omfang og referansenivå.
